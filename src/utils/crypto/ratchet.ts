/**
 * Double Ratchet session management.
 * Handles encryption/decryption with in-memory caching and persistence.
 */

import LibsignalDezireModule, { RatchetEncryptResult } from 'expo-libsignal-dezire';
import {
    saveChatSession,
    loadChatSession,
    deleteChatSession,
} from '../storage/chats';

/**
 * In-memory cache for active sessions.
 */
type SessionCache = {
    uuid: string;             // Ratchet UUID (in-memory handle)
    identityKey: string;      // Identity key
    deviceId: string;         // Device ID
};
const sessionCache: Record<string, SessionCache> = {};

// ===== Session Cache Management =====

/**
 * Ensures a session is loaded into the cache.
 */
async function ensureSessionLoaded(userId: string): Promise<SessionCache | undefined> {
    if (sessionCache[userId]) {
        return sessionCache[userId];
    }

    const stored = await loadChatSession(userId);
    if (stored?.ratchetState) {
        try {
            const uuid = await LibsignalDezireModule.ratchetDeserialize(stored.ratchetState);
            sessionCache[userId] = {
                uuid,
                identityKey: stored.identityKey,
                deviceId: stored.deviceId,
            };
            return sessionCache[userId];
        } catch (e) {
            console.error('Failed to deserialize ratchet state:', e);
        }
    }

    return undefined;
}

/**
 * Persists the current session state to storage.
 */
async function persistSession(userId: string): Promise<void> {
    const cached = sessionCache[userId];
    if (!cached) return;

    const ratchetState = await LibsignalDezireModule.ratchetSerialize(cached.uuid);
    await saveChatSession(userId, {
        identityKey: cached.identityKey,
        deviceId: cached.deviceId,
        ratchetState,
    });
}

// ===== Public API =====

/**
 * Saves an identity key for a contact.
 */
export async function saveIdentityKey(userId: string, identityKey: string, deviceId: string): Promise<void> {
    if (sessionCache[userId]) {
        sessionCache[userId].identityKey = identityKey;
        sessionCache[userId].deviceId = deviceId;
        await persistSession(userId);
    } else {
        const existing = await loadChatSession(userId);
        if (existing) {
            existing.identityKey = identityKey;
            existing.deviceId = deviceId;
            await saveChatSession(userId, existing);
        } else {
            await saveChatSession(userId, { identityKey, deviceId });
        }
    }
}

/**
 * Gets the identity key for a contact.
 */
export async function getIdentityKey(userId: string): Promise<string | undefined> {
    const cached = sessionCache[userId];
    if (cached) return cached.identityKey;
    const stored = await loadChatSession(userId);
    return stored?.identityKey;
}

export async function getDeviceId(userId: string): Promise<string | undefined> {
    const cached = sessionCache[userId];
    if (cached) return cached.deviceId;
    const stored = await loadChatSession(userId);
    return stored?.deviceId;
}

/**
 * Initializes a sender (initiator) ratchet session.
 */
export async function initSender(
    userId: string,
    sharedSecret: Uint8Array,
    receiverPub: Uint8Array,
    identityKey: string,
    deviceId: string
): Promise<string> {
    const uuid = await LibsignalDezireModule.ratchetInitSender(sharedSecret, receiverPub);

    sessionCache[userId] = {
        uuid,
        identityKey,
        deviceId,
    };
    await persistSession(userId);
    return uuid;
}

/**
 * Initializes a receiver (responder) ratchet session.
 */
export async function initReceiver(
    userId: string,
    sharedSecret: Uint8Array,
    receiverPriv: Uint8Array,
    receiverPub: Uint8Array,
    identityKey: string,
    deviceId: string
): Promise<string> {
    const uuid = await LibsignalDezireModule.ratchetInitReceiver(
        sharedSecret,
        receiverPriv,
        receiverPub
    );

    sessionCache[userId] = {
        uuid,
        identityKey,
        deviceId,
    };
    await persistSession(userId);
    return uuid;
}

/**
 * Encrypts a message using the ratchet session.
 */
export async function encryptMessage(
    userId: string,
    plaintext: Uint8Array,
    ad?: Uint8Array
): Promise<RatchetEncryptResult | null> {
    const session = await ensureSessionLoaded(userId);
    if (!session) throw new Error('Session not initialized for ' + userId);

    const result = await LibsignalDezireModule.ratchetEncrypt(session.uuid, plaintext, ad);
    if (result) await persistSession(userId);
    return result;
}

/**
 * Decrypts a message using the ratchet session.
 */
export async function decryptMessage(
    userId: string,
    header: Uint8Array,
    ciphertext: Uint8Array,
    ad?: Uint8Array
): Promise<Uint8Array | null> {
    const session = await ensureSessionLoaded(userId);
    if (!session) throw new Error('Session not initialized for ' + userId);

    const plaintext = await LibsignalDezireModule.ratchetDecrypt(
        session.uuid,
        header,
        ciphertext,
        ad
    );
    if (plaintext) await persistSession(userId);
    return plaintext;
}

export async function loadRatchetSession(userId: string): Promise<string | undefined> {
    const session = await ensureSessionLoaded(userId);
    return session?.uuid;
}

export async function isRatchetInitialized(userId: string): Promise<boolean> {
    if (sessionCache[userId]) return true;
    const stored = await loadChatSession(userId);
    return !!stored?.ratchetState;
}

export async function freeRatchetSession(userId: string): Promise<void> {
    const cached = sessionCache[userId];
    if (cached) {
        try {
            await LibsignalDezireModule.ratchetFree(cached.uuid);
        } catch (e) {
            console.warn('Failed to free ratchet session', e);
        }
        delete sessionCache[userId];
    }
}

export async function clearSession(userId: string): Promise<void> {
    await freeRatchetSession(userId);
    await deleteChatSession(userId);
}

export async function getSession(userId: string): Promise<SessionCache | undefined> {
    return ensureSessionLoaded(userId);
}
