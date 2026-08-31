import { create } from "zustand";
import { setItemAsync, getItemAsync, deleteItemAsync, AFTER_FIRST_UNLOCK } from "expo-secure-store";
import { createJSONStorage, persist } from "zustand/middleware";
import { Alert } from "react-native";
import LibsignalDezireModule from "expo-libsignal-dezire";
import { Session } from "@/src/models/store";

export type PhoneIdentity = {
    countryCode: string;
    number: number;
}

const useSession = create(
  persist<Session>(
    (set) => ({
      phone: {
        countryCode: "+91",
        number: 0,
      },
      isAuthenticated: false,
      authProvider: null,
      googleOauthToken: null,
      userId: null,
      deviceId: null,
      email: null,
      displayName: null,
      avatarUrl: null,
      pushToken: null,
      pushTokenRegistered: false,
      iKey: new Uint8Array(),
      preKey: new Uint8Array(),
      devKey: new Uint8Array(),

      setPushToken: (token) => {
        set({ pushToken: token });
      },
      setPushTokenRegistered: (registered) => {
        set({ pushTokenRegistered: registered });
      },
      markDeviceRegistered: (deviceId) => {
        set({ isAuthenticated: true, deviceId });
      },
      setAuthenticatedUser: ({ token, userId, email, displayName, avatarUrl }) => {
        set({
          isAuthenticated: false,
          authProvider: "google",
          googleOauthToken: token,
          userId,
          email,
          displayName,
          avatarUrl,
        });
      },

      clearSession: async () => {
        set({
          isAuthenticated: false,
          authProvider: null,
          googleOauthToken: null,
          userId: null,
          deviceId: null,
          email: null,
          displayName: null,
          avatarUrl: null,
          pushTokenRegistered: false,
          phone: { countryCode: "", number: 0 },
          iKey: new Uint8Array(),
          preKey: new Uint8Array(),
          devKey: new Uint8Array(),
        });
      },
      initIdentityKey: async () => {
        const iKey = await LibsignalDezireModule.genSecret();
        if (!iKey) {
          Alert.alert("Error", "Couldn't initialize identity key", [{ text: "OK", style: "cancel" }]);
          return new Uint8Array();
        }
        set({ iKey });
        return iKey;
      },
      initDeviceKeys: async (phone: PhoneIdentity) => {
        await deleteItemAsync("opks");
        const preKey = await LibsignalDezireModule.genSecret();
        const devKey = await LibsignalDezireModule.genSecret();
        if (!preKey || !devKey) {
          Alert.alert("Error", "Couldn't initialize device keys", [{ text: "OK", style: "cancel" }]);
        } else {
          set({ phone, preKey, devKey });
        }
        return { preKey, devKey };
      },
    }),
    {
      name: "session",
      storage: createJSONStorage(() => ({
        setItem: (key: string, value: string) =>
          setItemAsync(key, value, { keychainAccessible: AFTER_FIRST_UNLOCK }),
        getItem: (key: string) => getItemAsync(key),
        removeItem: deleteItemAsync,
      })),
      merge: (persistedState, currentState) => {
        const merged = {
          ...currentState,
          ...(persistedState as object),
        } as Session;

        if (merged.iKey && !(merged.iKey instanceof Uint8Array)) {
          merged.iKey = Array.isArray(Object.values(merged.iKey)) 
            ? new Uint8Array(Object.values(merged.iKey)) 
            : new Uint8Array();
        }

        if (merged.preKey && !(merged.preKey instanceof Uint8Array)) {
          merged.preKey = Array.isArray(Object.values(merged.preKey))
            ? new Uint8Array(Object.values(merged.preKey))
            : new Uint8Array();
        }

        if (merged.devKey && !(merged.devKey instanceof Uint8Array)) {
          merged.devKey = Array.isArray(Object.values(merged.devKey))
            ? new Uint8Array(Object.values(merged.devKey))
            : new Uint8Array();
        } else if (!merged.devKey) {
          merged.devKey = new Uint8Array();
        }

        merged.isAuthenticated = Boolean(merged.googleOauthToken && merged.userId && merged.deviceId);
        merged.authProvider = merged.authProvider ?? null;
        merged.email = merged.email ?? null;
        merged.displayName = merged.displayName ?? null;
        merged.avatarUrl = merged.avatarUrl ?? null;
        merged.deviceId = merged.deviceId ?? null;
        merged.pushToken = merged.pushToken ?? null;
        merged.pushTokenRegistered = merged.pushTokenRegistered ?? false;

        return merged;
      },
    },
  ),
);

export default useSession;
