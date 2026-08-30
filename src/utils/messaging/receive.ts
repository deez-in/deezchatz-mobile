/**
 * Message receiving orchestration.
 * Coordinates crypto and storage layers for inbound messages.
 */

import { Session } from '@/src/store/useSession';
import LibsignalDezireModule from 'expo-libsignal-dezire';

import { fromBase64, toString } from '../helpers/encoding';

import { X3DHBundle, x3dhResponder } from '../crypto/x3dh';
import { loadOpk } from '../crypto/oneTimePreKeys';
import { constructReceiverAD } from '../crypto/associatedData';

// ===== Type Definitions =====

type ReceiveInitialMessageParams = {
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

type ReceiveMessageParams = {
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

type ReceiveResult = {
    plaintext: string;
    senderUserId: string;
    sharedSecret?: Uint8Array;
};

// ===== API =====

/**
 * Receives and processes an initial message (performs X3DH responder).
 */
export async function receiveInitialMessage({
    session,
    payload,
    senderUserId,
    initReceiver,
    decrypt,
}: ReceiveInitialMessageParams): Promise<ReceiveResult | null> {
    // 1. Validate payload
    if (!payload.identityKey || !payload.ephemeralKey) {
        console.error('Invalid X3DH payload');
        return null;
    }

    try {
        // 2. Load OPK (if provided)
        const opkPrivate = payload.opkId != null ? await loadOpk(payload.opkId) : null;
        if (payload.opkId != null && !opkPrivate) {
            console.warn(`[Receive] OPK ${payload.opkId} not found in local storage`);
            return null;
        }

        // 3. X3DH Responder - derive shared secret
        const sharedSecret = await x3dhResponder(session, payload, opkPrivate);

        // 4. Initialize Receiver Ratchet with SPK keypair
        const spkPrivate = session.preKey;
        const spkPublic = await LibsignalDezireModule.genPubKey(spkPrivate);
        await initReceiver(sharedSecret, spkPrivate, spkPublic, payload.identityKey);

        // 5. Construct AD and decrypt
        const ad = await constructReceiverAD(payload.identityKey, session.iKey);
        const header = fromBase64(payload.header);
        const ciphertext = fromBase64(payload.ciphertext);
        const plaintext = await decrypt(header, ciphertext, ad);

        if (!plaintext) {
            console.error('Failed to decrypt message');
            return null;
        }

        const plaintextStr = toString(plaintext);

        return {
            sharedSecret,
            plaintext: plaintextStr,
            senderUserId,
        };
    } catch (e) {
        console.error('Error processing receive message:', e);
        return null;
    }
}

/**
 * Receives and processes a subsequent message (ratchet already initialized).
 */
export async function receiveMessage({
    session,
    payload,
    senderUserId,
    senderIdentityKey,
    decrypt,
}: ReceiveMessageParams): Promise<ReceiveResult | null> {
    try {
        // 1. Construct AD and decrypt
        const ad = await constructReceiverAD(senderIdentityKey, session.iKey);
        const header = fromBase64(payload.header);
        const ciphertext = fromBase64(payload.ciphertext);
        const plaintext = await decrypt(header, ciphertext, ad);

        if (!plaintext) {
            console.error('Failed to decrypt subsequent message');
            return null;
        }

        const plaintextStr = toString(plaintext);

        return {
            plaintext: plaintextStr,
            senderUserId,
        };
    } catch (e) {
        console.error('Error processing subsequent message:', e);
        return null;
    }
}
