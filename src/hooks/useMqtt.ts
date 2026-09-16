// WARNING: Switch to npm import once published: import MqttClient from 'expo-native-mqtt';
import MqttClient, { MqttMessage } from "expo-native-mqtt";
import { useEffect } from "react";
import { Alert, AppState, AppStateStatus } from "react-native";
import LibsignalDezireModule from "expo-libsignal-dezire";
import { toString, toBytes, toBase64 } from "@/src/utils/helpers/encoding";
import useMqttStore from "@/src/store/useMqttStore";
import useSession from "@/src/store/useSession";
import { Session } from "@/src/models/store";
import { processIncomingMessage } from "@/src/utils/messaging";
import {
    saveToInbox,
    markInboxProcessed,
    deleteFromInbox,
    incrementInboxRetry,
    getPendingInboxEntries,
    getPendingOutboxEntries,
    markOutboxSent,
    markOutboxFailed,
    incrementOutboxRetry,
    updateMessageStatusWithAutoOpen,
    StorageError,
    BlockedContactError,
} from "@/src/utils/db";
import { publishMessage } from "@/src/clients/mqttClient";

/**
 * Processes a single inbox entry.
 * On failure, increments its retry counter (auto-fails after MAX_RETRIES).
 */
async function processInboxEntry(
    session: Session,
    entry: { id: number; topic: string; payload: string }
): Promise<void> {
    try {
        await processIncomingMessage(session, entry.topic, entry.payload);
        await markInboxProcessed(entry.id);
    } catch (e) {
        if (e instanceof BlockedContactError) {
            console.debug(`[Inbox] Dropping message from blocked sender in inbox entry ${entry.id}`);
            await deleteFromInbox(entry.id).catch(() => {});
            return;
        }
        console.error(`Failed to process inbox entry ${entry.id}:`, e);
        await incrementInboxRetry(entry.id);
    }
}

/**
 * Retries all pending inbox entries.
 * Call this on app foreground resume.
 */
export async function processInboxRetries(session: Session): Promise<void> {
    try {
        const pending = await getPendingInboxEntries();
        for (const entry of pending) {
            await processInboxEntry(session, entry);
        }
    } catch (e) {
        console.error('Failed to process inbox retries:', e);
    }
}

/**
 * Processes a single outbox entry — attempts MQTT publish.
 * On success: marks 'sent' and updates message status.
 * On failure: distinguishes recoverable vs unrecoverable errors:
 *   - Recoverable (network/transient): increments retry counter, auto-fails after MAX_RETRIES.
 *   - Unrecoverable (DB corruption, storage errors): immediately marks as 'failed'.
 */
async function processOutboxEntry(
    entry: { id: number; chat_id: string; message_id: string; topic: string; payload: string; retry_count: number }
): Promise<void> {
    try {
        const success = await publishMessage(entry.topic, entry.payload);
        if (success) {
            await markOutboxSent(entry.id);
            await updateMessageStatusWithAutoOpen(entry.chat_id, entry.message_id, 'sent');
            return;
        }
        
        // Publish returned false — recoverable (network issue)
        await incrementOutboxRetry(entry.id);
        if (entry.retry_count + 1 >= 5) {
            await updateMessageStatusWithAutoOpen(entry.chat_id, entry.message_id, 'failed');
        }
    } catch (e) {
        console.error(`Failed to process outbox entry ${entry.id}:`, e);

        if (e instanceof StorageError && !e.recoverable) {
            // Unrecoverable — mark as failed immediately, don't waste retries
            console.error(`Unrecoverable error for outbox ${entry.id}: ${e.code}`);
            try {
                await markOutboxFailed(entry.id);
                await updateMessageStatusWithAutoOpen(entry.chat_id, entry.message_id, 'failed');
            } catch (innerE) {
                console.warn('[MQTT] Best-effort outbox update failed', innerE);
            }
            return;
        }

        // Recoverable — increment retry counter
        try {
            await incrementOutboxRetry(entry.id);
            if (entry.retry_count + 1 >= 5) {
                await updateMessageStatusWithAutoOpen(entry.chat_id, entry.message_id, 'failed');
            }
        } catch (innerE) {
            console.warn('[MQTT] Best-effort outbox update failed', innerE);
        }
    }
}

/**
 * Retries all pending outbox entries.
 * Call this when MQTT connection is established/restored.
 */
export async function processOutboxRetries(): Promise<void> {
    try {
        const pending = await getPendingOutboxEntries();
        if (pending.length > 0) {
            console.debug(`Processing ${pending.length} pending outbox entries...`);
        }
        for (const entry of pending) {
            await processOutboxEntry(entry);
        }
    } catch (e) {
        console.error('Failed to process outbox retries:', e);
    }
}

const useMqtt = (topic: string) => {
    const setClient = useMqttStore(s => s.setClient);
    const setConnected = useMqttStore(s => s.setConnected);
    const userId = useSession(s => s.userId);
    const deviceId = useSession(s => s.deviceId);

    useEffect(() => {
        if (!topic || !userId || !deviceId) return;

        let isMounted = true;
        let isConnecting = false;
        let isBackgrounded = AppState.currentState === 'background';
        let reconnectAttempts = 0;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let subscriptions: { remove: () => void }[] = [];

        const clearReconnectTimer = () => {
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
        };

        const scheduleReconnect = () => {
            if (!isMounted || isBackgrounded) return;
            clearReconnectTimer();

            // Exponential backoff: base 2s, factor 1.5x, max 30s with ±20% jitter
            const baseDelay = 2000;
            const factor = Math.pow(1.5, Math.min(reconnectAttempts, 6));
            const cappedDelay = Math.min(baseDelay * factor, 30000);
            const jitter = 0.8 + Math.random() * 0.4;
            const delayMs = Math.floor(cappedDelay * jitter);

            reconnectAttempts++;
            console.debug(`[MQTT] Scheduling reconnect attempt #${reconnectAttempts} in ${delayMs}ms`);

            reconnectTimer = setTimeout(() => {
                if (isMounted && !isBackgrounded) {
                    connectMqtt(false);
                }
            }, delayMs);
        };

        const connectMqtt = async (isInitial = false) => {
            if (!isMounted || isConnecting || isBackgrounded) return;
            if (useMqttStore.getState().isConnected) return;

            isConnecting = true;
            try {
                const session = useSession.getState();
                const preKey = session.preKey;
                if (!preKey || preKey.length === 0) {
                    console.error("Missing preKey, cannot connect to MQTT.");
                    isConnecting = false;
                    return;
                }

                // Ephemeral signature generation: epoch seconds prevent "old/future timestamp" errors on reconnect
                const epochSeconds = Math.floor(Date.now() / 1000).toString();
                const payloadStr = `${userId}${epochSeconds}`;
                const payload = toBytes(payloadStr);
                const { signature, vrf } = await LibsignalDezireModule.vxeddsaSign(preKey, payload);
                const password = `${toBase64(signature)}${toBase64(vrf)}${epochSeconds}`;

                const clientId = deviceId;
                await MqttClient.connect(
                    `${process.env.EXPO_PUBLIC_MQTT_URL}`,
                    userId,
                    password,
                    {
                        clientId,
                        cleanSession: false,
                        autoReconnect: false, // Reconnection handled in JS so timestamps/signatures remain fresh
                    }
                );
                if (isMounted && !isBackgrounded) {
                    setClient(MqttClient);
                } else {
                    MqttClient.disconnect();
                    setConnected(false);
                    setClient(undefined);
                }
            } catch (error) {
                const errMsg = typeof error === 'object' && error !== null ? (error as any).message || String(error) : String(error);
                if (typeof errMsg === 'string' && errMsg.includes('BAD_USER_NAME_OR_PASSWORD')) {
                    console.debug("MQTT Connection Auth pending/skipped.");
                } else {
                    console.error("MQTT Connection Error:", error);
                    if (isInitial) {
                        Alert.alert(
                            "Error",
                            "Couldn't connect to the messaging server.",
                            [{ text: "OK", style: 'cancel' }]
                        );
                    }
                }
                if (isMounted && !isBackgrounded) {
                    scheduleReconnect();
                }
            } finally {
                isConnecting = false;
            }
        };

        // Message reception: ciphertext saved to inbox prior to crypto processing
        const messageSub = MqttClient.addListener(
            "onMqttMessageReceived",
            async (data: MqttMessage) => {
                let inboxId: number | null = null;
                try {
                    const payloadStr = toString(data.payload);
                    inboxId = await saveToInbox(data.topic, payloadStr);

                    const session = useSession.getState();
                    await processIncomingMessage(session, data.topic, payloadStr);
                    await markInboxProcessed(inboxId);
                } catch (e) {
                    if (e instanceof BlockedContactError) {
                        console.debug('[MQTT] Dropping and deleting message from blocked sender');
                        if (inboxId !== null) {
                            await deleteFromInbox(inboxId).catch(() => {});
                        }
                        return;
                    }
                    console.error("Failed to process MQTT message:", e);
                }
            }
        );
        subscriptions.push(messageSub);

        const connectSub = MqttClient.addListener("onMqttConnected", async () => {
            console.debug(`Connected to MQTT broker for topic: ${topic}`);
            clearReconnectTimer();
            reconnectAttempts = 0;
            setConnected(true);

            const topicPath = `/deezchatz/${userId}/${deviceId}/#`;
            try {
                await MqttClient.subscribe(topicPath, 1);
                console.debug(`Subscribed to ${topicPath}`);
            } catch (e) {
                console.error(`Failed to subscribe to ${topicPath}:`, e);
            }

            await processOutboxRetries();
        });
        subscriptions.push(connectSub);

        const disconnectSub = MqttClient.addListener("onMqttDisconnected", () => {
            console.debug("MQTT Client disconnected.");
            setConnected(false);
            if (isMounted && !isBackgrounded) {
                scheduleReconnect();
            }
        });
        subscriptions.push(disconnectSub);

        const errorSub = MqttClient.addListener("onMqttError", (err: unknown) => {
            const errMsg = typeof err === 'object' && err !== null ? (err as any).error || (err as any).message : String(err);
            if (typeof errMsg === 'string' && errMsg.includes('BAD_USER_NAME_OR_PASSWORD')) {
                console.debug("MQTT Authentication pending/skipped.");
                return;
            }
            console.error("MQTT Error:", err);
        });
        subscriptions.push(errorSub);

        // AppState lifecycle: gracefully disconnect on background, reconnect on active
        const handleAppStateChange = (nextState: AppStateStatus) => {
            if (nextState === 'active' && isMounted) {
                isBackgrounded = false;
                const isConnected = useMqttStore.getState().isConnected;
                if (!isConnected) {
                    console.debug("[MQTT] App became active and MQTT disconnected — attempting immediate reconnect");
                    clearReconnectTimer();
                    reconnectAttempts = 0;
                    connectMqtt(false);
                }
            } else if (nextState === 'background') {
                console.debug("[MQTT] App went to background — gracefully disconnecting MQTT");
                isBackgrounded = true;
                clearReconnectTimer();
                MqttClient.disconnect();
                setConnected(false);
                setClient(undefined);
            }
        };
        const appStateSub = AppState.addEventListener('change', handleAppStateChange);
        subscriptions.push({ remove: () => appStateSub.remove() });

        connectMqtt(true);

        return () => {
            isMounted = false;
            isBackgrounded = true;
            clearReconnectTimer();
            subscriptions.forEach(sub => sub.remove());
            MqttClient.disconnect();
            setConnected(false);
            setClient(undefined);
        };
    }, [topic, userId, deviceId, setClient, setConnected]);
};

export default useMqtt;
