import { AppState } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import MqttClient from 'expo-native-mqtt';
import LibsignalDezireModule from 'expo-libsignal-dezire';

import useMqtt from '@/src/hooks/useMqtt';
import useMqttStore from '@/src/store/useMqttStore';
import useSession from '@/src/store/useSession';

jest.mock('@/src/hooks/useMqtt', () => {
    const actual = jest.requireActual('@/src/hooks/useMqtt');
    return {
        __esModule: true,
        ...actual,
        processOutboxRetries: jest.fn().mockResolvedValue(undefined),
    };
});

describe('useMqtt hook', () => {
    let listeners: Record<string, Function>;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();

        listeners = {};
        (MqttClient.addListener as jest.Mock).mockImplementation((event: string, callback: Function) => {
            listeners[event] = callback;
            return { remove: jest.fn() };
        });

        useMqttStore.setState({
            isConnected: false,
            client: undefined,
        });

        useSession.setState({
            userId: 'user-alice-123',
            deviceId: 'device-alice-456',
            preKey: new Uint8Array(32).fill(7),
        });

        (LibsignalDezireModule.vxeddsaSign as jest.Mock).mockResolvedValue({
            signature: new Uint8Array(64).fill(1),
            vrf: new Uint8Array(32).fill(2),
        });
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('connects on mount with autoReconnect disabled and fresh credentials', async () => {
        await act(async () => {
            await renderHook(() => useMqtt('user-alice-123'));
        });

        expect(MqttClient.connect).toHaveBeenCalledTimes(1);

        const [url, userId, password, options] = (MqttClient.connect as jest.Mock).mock.calls[0];
        expect(userId).toBe('user-alice-123');
        expect(options).toEqual({
            clientId: 'device-alice-456',
            cleanSession: false,
            autoReconnect: false,
        });
        expect(typeof password).toBe('string');
        expect(password.length).toBeGreaterThan(0);
        expect(LibsignalDezireModule.vxeddsaSign).toHaveBeenCalledTimes(1);
    });

    it('schedules reconnection with fresh signature when disconnected', async () => {
        await act(async () => {
            await renderHook(() => useMqtt('user-alice-123'));
        });

        expect(MqttClient.connect).toHaveBeenCalledTimes(1);

        // Simulate connection established
        await act(async () => {
            listeners['onMqttConnected']?.();
        });

        expect(useMqttStore.getState().isConnected).toBe(true);

        // Simulate disconnect event from native socket
        await act(async () => {
            listeners['onMqttDisconnected']?.();
        });

        expect(useMqttStore.getState().isConnected).toBe(false);

        // Advance timers past the first backoff delay (~2000ms + jitter)
        await act(async () => {
            jest.advanceTimersByTime(3500);
        });

        // Reconnect should have been triggered with a new vxeddsaSign call
        expect(MqttClient.connect).toHaveBeenCalledTimes(2);
        expect(LibsignalDezireModule.vxeddsaSign).toHaveBeenCalledTimes(2);

        const [, , secondPassword, secondOptions] = (MqttClient.connect as jest.Mock).mock.calls[1];
        expect(secondOptions.autoReconnect).toBe(false);
        expect(typeof secondPassword).toBe('string');
    });

    it('disconnects and clears state on unmount', async () => {
        let unmountFn: () => void = () => {};
        await act(async () => {
            const hook = await renderHook(() => useMqtt('user-alice-123'));
            unmountFn = hook.unmount;
        });

        await act(async () => {
            unmountFn();
        });

        expect(MqttClient.disconnect).toHaveBeenCalled();
        expect(useMqttStore.getState().isConnected).toBe(false);
        expect(useMqttStore.getState().client).toBeUndefined();
    });

    it('gracefully disconnects on background and reconnects on active', async () => {
        let appStateListener: ((state: string) => void) | undefined;
        const addListenerSpy = jest.spyOn(AppState, 'addEventListener').mockImplementation((event: string, cb: any) => {
            if (event === 'change') {
                appStateListener = cb;
            }
            return { remove: jest.fn() } as any;
        });

        await act(async () => {
            await renderHook(() => useMqtt('user-alice-123'));
        });

        // Simulate connection established
        await act(async () => {
            listeners['onMqttConnected']?.();
        });
        expect(useMqttStore.getState().isConnected).toBe(true);

        // Transition to background
        await act(async () => {
            appStateListener?.('background');
        });

        expect(MqttClient.disconnect).toHaveBeenCalled();
        expect(useMqttStore.getState().isConnected).toBe(false);
        expect(useMqttStore.getState().client).toBeUndefined();

        // Simulate onMqttDisconnected from native
        await act(async () => {
            listeners['onMqttDisconnected']?.();
        });

        // Advance timers by 10s — should NOT attempt reconnect in background
        await act(async () => {
            jest.advanceTimersByTime(10000);
        });
        expect(MqttClient.connect).toHaveBeenCalledTimes(1); // Still only initial connect

        // Transition back to active
        await act(async () => {
            appStateListener?.('active');
        });

        expect(MqttClient.connect).toHaveBeenCalledTimes(2); // Reconnected!

        addListenerSpy.mockRestore();
    });
});
