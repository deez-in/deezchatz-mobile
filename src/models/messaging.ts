import { Session } from "@/src/models/store";
import { X3DHBundle, RatchetEncryptResult } from "@/src/models/crypto";

export type SendInitialMessageParams = {
    session: Session;
    recipientIdentifier: string;
    message: string;
    name?: string;
    initSender: (
        userId: string,
        sharedSecret: Uint8Array,
        receiverPub: Uint8Array,
        identityKey: string,
        deviceId: string
    ) => Promise<string | undefined>;
    encrypt: (
        userId: string,
        plaintext: Uint8Array,
        ad?: Uint8Array
    ) => Promise<RatchetEncryptResult | null>;
};

export type SendMessageParams = {
    session: Session;
    recipientUserId: string;
    recipientDeviceId: string;
    message: string;
    encrypt: (
        userId: string,
        plaintext: Uint8Array,
        ad?: Uint8Array
    ) => Promise<RatchetEncryptResult | null>;
    recipientIdentityKey: string;
};

export type SendResult = {
    userId: string;
    deviceId?: string;
};

export type ReceiveInitialMessageParams = {
    session: Session;
    payload: X3DHBundle & { ciphertext: string; header: string; timestamp?: number };
    senderUserId: string;
    initReceiver: (
        sharedSecret: Uint8Array,
        receiverPriv: Uint8Array,
        receiverPub: Uint8Array,
        identityKey?: string
    ) => Promise<string | undefined>;
    decrypt: (
        header: Uint8Array,
        ciphertext: Uint8Array,
        ad?: Uint8Array
    ) => Promise<Uint8Array | null>;
};

export type ReceiveMessageParams = {
    session: Session;
    payload: { ciphertext: string; header: string; timestamp?: number };
    senderUserId: string;
    senderIdentityKey: string;
    decrypt: (
        header: Uint8Array,
        ciphertext: Uint8Array,
        ad?: Uint8Array
    ) => Promise<Uint8Array | null>;
};

export type ReceiveResult = {
    plaintext: string;
    senderUserId: string;
    sharedSecret?: Uint8Array;
};

export type IncomingMessagePayload = {
    topic?: string;
    payload?: string;
    sender_id?: string;
    sender?: string;
    [key: string]: unknown;
};
