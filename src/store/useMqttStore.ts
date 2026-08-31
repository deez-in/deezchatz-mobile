import { create } from "zustand";
import type MqttClient from "expo-native-mqtt";

export type MqttStore = {
    client?: typeof MqttClient;
    setClient: (client?: typeof MqttClient) => void;
    isConnected: boolean;
    setConnected: (connected: boolean) => void;
}

const useMqttStore = create<MqttStore>((set) => ({
    client: undefined,
    setClient: (client) => set({ client }),
    isConnected: false,
    setConnected: (isConnected) => set({ isConnected }),
}));

export default useMqttStore;
