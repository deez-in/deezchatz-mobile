import MqttClient from 'expo-native-mqtt';
import { buildMessageTopic, publishMessage } from '@/src/clients/mqttClient';
import { toBytes, toString } from '@/src/utils/helpers/encoding';

describe('mqttClient', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('buildMessageTopic', () => {
        it('constructs the expected MQTT topic path', () => {
            const topic = buildMessageTopic('user-recipient', 'device-rec-1', 'user-sender', 'device-send-1');
            expect(topic).toBe('/deezchatz/user-recipient/device-rec-1/user-sender/device-send-1');
        });
    });

    describe('publishMessage', () => {
        const topic = '/deezchatz/rec/dev1/send/dev2';

        it('publishes string payload converted to Uint8Array', async () => {
            const payloadStr = JSON.stringify({ hello: 'world' });
            const success = await publishMessage(topic, payloadStr);

            expect(success).toBe(true);
            expect(MqttClient.publish).toHaveBeenCalledTimes(1);

            const [calledTopic, calledPayload, calledQos] = (MqttClient.publish as jest.Mock).mock.calls[0];
            expect(calledTopic).toBe(topic);
            expect(calledPayload).toBeInstanceOf(Uint8Array);
            expect(toString(calledPayload)).toBe(payloadStr);
            expect(calledQos).toBe(1);
        });

        it('publishes Uint8Array payload directly without modification', async () => {
            const payloadBytes = toBytes('raw binary data');
            const success = await publishMessage(topic, payloadBytes);

            expect(success).toBe(true);
            expect(MqttClient.publish).toHaveBeenCalledTimes(1);

            const [calledTopic, calledPayload, calledQos] = (MqttClient.publish as jest.Mock).mock.calls[0];
            expect(calledTopic).toBe(topic);
            expect(calledPayload).toBe(payloadBytes);
            expect(calledQos).toBe(1);
        });

        it('returns false and logs error when publish fails', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            (MqttClient.publish as jest.Mock).mockRejectedValueOnce(new Error('Network disconnected'));

            const success = await publishMessage(topic, 'test-payload');

            expect(success).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('MQTT publish failed:', expect.any(Error));

            consoleSpy.mockRestore();
        });
    });
});
