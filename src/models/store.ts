import { PhoneIdentity } from "@/src/store/useSession";

export type AuthProvider = "google" | null;

export type Session = {
    userId: string | null;
    deviceId: string | null;
    preKey: Uint8Array;
    iKey: Uint8Array;
    devKey: Uint8Array;
    isAuthenticated: boolean;
    phone: PhoneIdentity;
    authProvider: AuthProvider;
    googleOauthToken: string | null;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    pushToken: string | null;
    pushTokenRegistered: boolean;

    // Actions
    setAuthenticatedUser: (user: {
        token: string;
        userId: string;
        email?: string | null;
        displayName?: string | null;
        avatarUrl?: string | null;
    }) => void;
    setPushToken: (token: string | null) => void;
    setPushTokenRegistered: (registered: boolean) => void;
    markDeviceRegistered: (deviceId: string) => void;
    clearSession: () => Promise<void>;
    initIdentityKey: () => Promise<Uint8Array>;
    initDeviceKeys: (phone: PhoneIdentity) => Promise<{ preKey: Uint8Array; devKey: Uint8Array }>;
};