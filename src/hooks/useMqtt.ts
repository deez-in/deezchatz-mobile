// WARNING: Switch to npm import once published: import MqttClient from 'expo-native-mqtt';
import MqttClient from "expo-native-mqtt";
import { useEffect } from "react";
import { Alert } from "react-native";
import useMqttStore from "@/src/store/useMqttStore";
import useSession, { Session } from "@/src/store/useSession";
import { processIncomingMessage } from "@/src/utils/messaging";
import {
    saveToInbox,
    markInboxProcessed,
    incrementInboxRetry,
    getPendingInboxEntries,
    getPendingOutboxEntries,
    markOutboxSent,
    markOutboxFailed,
    incrementOutboxRetry,
    updateMessageStatusWithAutoOpen,
    StorageError,
} from "@/src/utils/storage";
import { publishMessage } from "@/src/utils/transport/mqtt";

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
    const session = useSession();

    useEffect(() => {
        if (!topic) return;

        let subscriptions: { remove: () => void }[] = [];

        const initMqtt = async () => {
            try {
                // 1. Handle Messages — ciphertext-first: save raw payload to inbox
                //    BEFORE any crypto, because CocoaMQTT auto-ACKs QoS 1 and the
                //    broker will never redeliver if our processing fails.
                const messageSub = MqttClient.addListener(
                    "onMqttMessageReceived",
                    async (data: { topic: string; payload: string }) => {
                        let inboxId: number | null = null;
                        try {
                            // Step 1: Save raw ciphertext to inbox (fast, no crypto)
                            inboxId = await saveToInbox(data.topic, data.payload);

                            // Step 2: Attempt full processing
                            await processIncomingMessage(session, data.topic, data.payload);

                            // Step 3: Mark as done
                            await markInboxProcessed(inboxId);
                        } catch (e) {
                            console.error("Failed to process MQTT message:", e);
                            // Entry stays 'pending' in inbox — will be retried on next
                            // app foreground via processInboxRetries()
                        }
                    }
                );
                subscriptions.push(messageSub);

                // 2. Handle Connection/Error Events
                const connectSub = MqttClient.addListener("onMqttConnected", async () => {
                    console.debug(`Connected to MQTT broker for topic: ${topic}`);
                    setConnected(true);

                    const topicPath = `/deezchatz/${session.userId}/${session.deviceId}/#`;
                    try {
                        await MqttClient.subscribe(topicPath, 1);
                        console.debug(`Subscribed to ${topicPath}`);
                    } catch (e) {
                        console.error(`Failed to subscribe to ${topicPath}:`, e);
                    }

                    // Flush pending outbox entries on reconnect
                    await processOutboxRetries();
                });
                subscriptions.push(connectSub);

                const disconnectSub = MqttClient.addListener("onMqttDisconnected", () => {
                    console.debug("MQTT Client disconnected.");
                    setConnected(false);
                });
                subscriptions.push(disconnectSub);

                const errorSub = MqttClient.addListener("onMqttError", (err: unknown) => {
                    console.error("MQTT Error:", err);
                });
                subscriptions.push(errorSub);

                // 3. Connect
                const clientId = `deezchatz-${session.userId}-${session.deviceId}`;
                await MqttClient.connect(
                    `${process.env.EXPO_PUBLIC_MQTT_URL}`,
                    "dezire",
                    "test1234",
                    {
                        clientId,
                        cleanSession: false,
                        autoReconnect: true,
                        reconnectDelay: 5000,
                    }
                );
                setClient(MqttClient);

            } catch (error) {
                console.error("MQTT Connection Error:", error);
                Alert.alert(
                    "Error",
                    "Couldn't connect to the messaging server.",
                    [{ text: "OK", style: 'cancel' }]
                );
            }
        };

        initMqtt();

        return () => {
            subscriptions.forEach(sub => sub.remove());
            MqttClient.disconnect();
            setConnected(false);
            setClient(undefined);
        };
    }, [topic, session, setClient, setConnected]);
};

export default useMqtt;
