/**
 * MQTT transport utilities.
 * Handles message publishing and topic construction.
 */

// WARNING: Switch to npm import once published: import MqttClient from 'expo-native-mqtt';
import MqttClient from "expo-native-mqtt";
import { toBase64, toBytes } from "@/src/utils/helpers/encoding";

/**
 * Builds an MQTT topic for sending messages.
 * Format: /deezchatz/<recipientId>/<recipientDeviceId>/<senderId>/<senderDeviceId>
 */
export function buildMessageTopic(
    recipientUserId: string,
    recipientDeviceId: string,
    senderUserId: string,
    senderDeviceId: string,
): string {
    return `/deezchatz/${recipientUserId}/${recipientDeviceId}/${senderUserId}/${senderDeviceId}`;
}

/**
 * Publishes a message payload to an MQTT topic.
 * Returns true if publish succeeded, false on failure.
 */
export async function publishMessage(
    topic: string,
    payload: string
): Promise<boolean> {
    try {
        const payloadBase64 = toBase64(toBytes(payload));
        await MqttClient.publish(topic, payloadBase64, 1);
        return true;
    } catch (e) {
        console.error('MQTT publish failed:', e);
        return false;
    }
}
