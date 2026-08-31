import type { RatchetEncryptResult } from 'expo-libsignal-dezire';

export type { RatchetEncryptResult };

export type PreKeyBundle = {
    userId: string;
    phone: string;
    deviceId: string;
    identityKey: string;
    spkId?: number;
    signedPreKey: string;
    signature: string;
    picture?: string | null;
    opk?: {
        id: number;
        key: string;
    };
};

export type X3DHBundle = {
    identityKey: string;
    ephemeralKey: string;
    spkId?: number;
    opkId?: number;
};

;

export type X3DHInitiatorResult = {
    sharedSecret: Uint8Array;
    ephemeralKey: Uint8Array;
};