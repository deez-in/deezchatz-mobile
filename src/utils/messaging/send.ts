/**
 * Message sending orchestration.
 * Coordinates crypto, transport, and storage layers for outbound messages.
 *
 * Queue-first architecture:
 *   1. Encrypt message.
 *   2. Save plaintext to per-chat DB with status 'pending'.
 *   3. Save encrypted payload to outbox (primary DB).
 *   4. Attempt MQTT publish.
 *   5. On success: mark outbox 'sent', update message status to 'sent'.
 *   6. On failure: entries stay 'pending', retried on MQTT reconnect.
 *
 * Error handling:
 *   - Throws typed errors (BundleFetchError, EncryptionError, OutboxPersistError)
 *     so callers can distinguish recoverable vs unrecoverable failures, matching
 *     the pattern used on the receiving side (DatabaseKeyMismatchError, etc.).
 *   - Does NOT call Alert.alert — that's the caller's responsibility.
 */

import useMqttStore from '@/src/store/useMqttStore';
import { Session } from '@/src/store/useSession';
import LibsignalDezireModule, { RatchetEncryptResult } from 'expo-libsignal-dezire';

import { toBase64, fromBase64, toBytes } from '../helpers/encoding';
import {
    saveMessage,
    saveMessageWithAutoOpen,
    updateMessageStatus,
    saveToOutbox,
    markOutboxSent,
    incrementOutboxRetry,
    saveContact,
    upsertChatThread,
    BundleFetchError,
    EncryptionError,
    OutboxPersistError,
    UserNotFoundError,
} from '../storage';
import { buildMessageTopic, publishMessage } from '../transport/mqtt';
import { x3dhInitiator, PreKeyBundle, clearSession } from '../crypto';
import { constructSenderAD } from '../crypto/associatedData';
import { apiRequest } from '../transport/api';
import { syncDeviceContacts } from '../sync/contactSync';

// ===== Type Definitions =====

type SendInitialMessageParams = {
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

type SendMessageParams = {
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


// On failure, increments the retry counter (auto-fails after MAX_RETRIES).
async function attemptPublish(
    outboxId: number,
    chatId: string,
    messageId: string,
    topic: string,
    payload: string
): Promise<boolean> {
    const success = await publishMessage(topic, payload);
    if (success) {
        await markOutboxSent(outboxId);
        try {
            await updateMessageStatus(chatId, messageId, 'sent');
        } catch (e) {
            console.warn(`[Send] Best-effort message status update failed (chat DB may be closed):`, e);
            // Chat DB may not be open (background context) — that's OK,
            // the status will be updated via updateMessageStatusWithAutoOpen
            // during outbox retry processing.
        }
        return true;
    } else {
        await incrementOutboxRetry(outboxId);
        return false;
    }
}

// ===== API =====

/**
 * Sends the initial message to a contact (performs X3DH key exchange).
 * Requires online connectivity — X3DH needs the recipient's pre-key bundle.
 *
 * @throws BundleFetchError    — could not fetch pre-key bundle (recoverable)
 * @throws UserNotFoundError   — the user is not registered (not recoverable)
 * @throws EncryptionError     — encryption failed (not recoverable)
 * @throws OutboxPersistError  — could not save to DB (recoverable)
 */
export async function sendInitialMessage({
    session,
    recipientIdentifier,
    message,
    name,
    initSender,
    encrypt,
}: SendInitialMessageParams): Promise<{ userId: string }> {
    // 1. Check connectivity — X3DH requires fetching the bundle
    const { isConnected } = useMqttStore.getState();
    if (!isConnected) {
        throw new BundleFetchError(recipientIdentifier);
    }

    // 2. Fetch Bundle
    let preKeyBundle: PreKeyBundle | undefined;
    try {
        preKeyBundle = await apiRequest<PreKeyBundle>(
            `/bundle/${encodeURIComponent(recipientIdentifier)}`,
            { method: 'POST', authenticated: true }
        );

        if (!preKeyBundle || !preKeyBundle.identityKey || !preKeyBundle.userId || !preKeyBundle.deviceId) {
            throw new BundleFetchError(recipientIdentifier);
        }
    } catch (e: any) {
        if (e.status === 404) throw new UserNotFoundError(recipientIdentifier);
        if (e instanceof UserNotFoundError || e instanceof BundleFetchError) throw e;
        throw new BundleFetchError(recipientIdentifier, e);
    }

    const resolvedUserId = preKeyBundle.userId;
    const resolvedPhone = preKeyBundle.phone || recipientIdentifier;

    // 4. X3DH Key Exchange
    let sharedSecret: Uint8Array;
    let ephemeralKey: Uint8Array;
    try {
        const x3dhResult = await x3dhInitiator(session, preKeyBundle);
        sharedSecret = x3dhResult.sharedSecret;
        ephemeralKey = x3dhResult.ephemeralKey;
        await initSender(
            resolvedUserId,
            sharedSecret,
            fromBase64(preKeyBundle.signedPreKey),
            preKeyBundle.identityKey,
            preKeyBundle.deviceId
        );
    } catch (e) {
        throw new EncryptionError(resolvedPhone, e as Error);
    }

    // 5. Construct AD and encrypt
    let ciphertext: RatchetEncryptResult;
    try {
        const ad = await constructSenderAD(session.iKey, preKeyBundle.identityKey);
        const result = await encrypt(resolvedUserId, toBytes(message), ad);
        if (!result) {
            throw new EncryptionError(resolvedPhone);
        }
        ciphertext = result;
    } catch (e) {
        await clearSession(resolvedUserId).catch(() => {});
        if (e instanceof EncryptionError) throw e;
        throw new EncryptionError(resolvedPhone, e as Error);
    }

    // 6. Build payload
    const now = Date.now();
    const senderIdentityPub = await LibsignalDezireModule.genPubKey(session.iKey);
    const payload = {
        identityKey: toBase64(senderIdentityPub),
        ephemeralKey: toBase64(ephemeralKey),
        spkId: preKeyBundle.spkId ?? 1,
        opkId: preKeyBundle.opk?.id ?? null,
        ciphertext: toBase64(ciphertext.ciphertext),
        header: toBase64(ciphertext.header),
        timestamp: now,
    };
    const payloadStr = JSON.stringify(payload);

    const topic = buildMessageTopic(
        resolvedUserId, preKeyBundle.deviceId,
        session.userId!, session.deviceId!
    );

    // 7. Publish to MQTT first! (Publish-first workflow)
    let publishSuccess = false;
    try {
        publishSuccess = await publishMessage(topic, payloadStr);
    } catch (e) {
        console.error('MQTT publish failed for initial message:', e);
    }

    if (!publishSuccess) {
        // Cleanup session since publish failed
        await clearSession(resolvedUserId).catch(() => {});
        throw new Error("Message has not been sent. Please try again.");
    }

    // 8. On successful publish, persist everything to DB!
    try {
        // Save phone <-> UUID mapping
        await saveContact(resolvedPhone, resolvedUserId, preKeyBundle.picture, name);
        syncDeviceContacts().catch(e => console.warn('Failed to sync device contacts after initial message:', e));

        // Save plaintext message directly as 'sent'
        const messageId = await saveMessageWithAutoOpen(resolvedUserId, {
            content: message,
            sender_id: 'me',
            status: 'sent',
            created_at: now,
        });

        // Save to outbox directly as 'sent'
        const outboxId = await saveToOutbox(resolvedUserId, messageId, topic, payloadStr);
        await markOutboxSent(outboxId);

        // Upsert chat thread using UUID and the recipient phone
        await upsertChatThread(resolvedUserId, message, resolvedPhone);
    } catch (e) {
        console.error('Failed to persist sent message metadata:', e);
        // Non-fatal since the message was already sent over the wire, but log it
    }

    return { userId: resolvedUserId };
}

/**
 * Sends a subsequent message (ratchet already initialized).
 * Messages are always saved — publish failures are retried from the outbox.
 *
 * @throws EncryptionError     — encryption failed (not recoverable)
 * @throws OutboxPersistError  — could not save to DB (recoverable)
 */
export async function sendMessage({
    session,
    recipientUserId,
    recipientDeviceId,
    message,
    encrypt,
    recipientIdentityKey,
}: SendMessageParams): Promise<void> {
    // 1. Construct AD and encrypt
    let ciphertext: RatchetEncryptResult;
    try {
        const ad = await constructSenderAD(session.iKey, recipientIdentityKey);
        const result = await encrypt(recipientUserId, toBytes(message), ad);
        if (!result) {
            throw new EncryptionError(recipientUserId);
        }
        ciphertext = result;
    } catch (e) {
        if (e instanceof EncryptionError) throw e;
        throw new EncryptionError(recipientUserId, e as Error);
    }

    // 2. Build payload
    const now = Date.now();
    const payload = {
        ciphertext: toBase64(ciphertext.ciphertext),
        header: toBase64(ciphertext.header),
        timestamp: now,
    };
    const payloadStr = JSON.stringify(payload);

    // 3. Save message as 'pending' + queue to outbox
    let messageId: string;
    let outboxId: number;
    const topic = buildMessageTopic(
        recipientUserId, recipientDeviceId,
        session.userId!, session.deviceId!
    );
    try {
        messageId = await saveMessage(recipientUserId, {
            content: message,
            sender_id: 'me',
            status: 'pending',
            created_at: now,
        });
        outboxId = await saveToOutbox(recipientUserId, messageId, topic, payloadStr);
    } catch (e) {
        throw new OutboxPersistError(recipientUserId, e as Error);
    }

    // 4. Attempt publish (if connected) — failure is non-fatal
    try {
        const { isConnected } = useMqttStore.getState();
        if (isConnected) {
            await attemptPublish(outboxId, recipientUserId, messageId, topic, payloadStr);
        }
        // If not connected, entries stay 'pending' — retried on reconnect
    } catch (e) {
        console.error('Publish attempt failed (will retry from outbox):', e);
        // Non-fatal — message is safely persisted in outbox
    }
}
