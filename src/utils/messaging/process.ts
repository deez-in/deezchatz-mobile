/**
 * Shared message processing logic.
 * Used by both the live MQTT handler and the inbox retry system.
 */

import { Session } from '@/src/store/useSession';
import { X3DHBundle, initReceiver, decryptMessage, getIdentityKey, PreKeyBundle } from '@/src/utils/crypto';
import { receiveInitialMessage, receiveMessage } from './receive';
import { apiRequest } from '../transport/api';
import { saveContact, upsertChatThread, updateContactBundle, saveSystemMessage } from '../storage';
import { syncDeviceContacts } from '../sync/contactSync';

/**
 * Processes a raw MQTT message (already parsed from JSON).
 * Handles both initial (X3DH) and subsequent (ratchet) messages.
 *
 * @throws on crypto failure, storage failure, or invalid payload
 */
export async function processIncomingMessage(
    session: Session,
    topic: string,
    rawPayload: string
): Promise<string> {
    const parsed = JSON.parse(rawPayload);
    const payload = parsed as X3DHBundle & { ciphertext: string; header: string };

    // Extract sender from topic: /nijhum/{recipientId}/{recipientDeviceId}/{senderId}/{senderDeviceId}
    const topicParts = topic.split('/');
    // topicParts: ['', 'nijhum', recipientId, recipientDeviceId, senderId, senderDeviceId]
    const senderUserId = topicParts.length >= 6 ? decodeURIComponent(topicParts[4]) : null;
    const senderDeviceId = topicParts.length >= 6 ? decodeURIComponent(topicParts[5]) : null;

    if (!senderUserId || !senderDeviceId) {
        throw new Error(`Could not extract sender info from topic: ${topic}`);
    }

    if (payload.identityKey && payload.ephemeralKey && payload.opkId !== undefined) {
        // Initial message — full X3DH handshake
        if (!session.isAuthenticated) {
            throw new Error('Session not registered, cannot process initial message');
        }

        const result = await receiveInitialMessage({
            session,
            payload,
            senderUserId: senderUserId,
            initReceiver: (sharedSecret, receiverPriv, receiverPub, identityKey) =>
                initReceiver(senderUserId, sharedSecret, receiverPriv, receiverPub, identityKey!, senderDeviceId),
            decrypt: (header, ciphertext, ad) =>
                decryptMessage(senderUserId, header, ciphertext, ad),
        });

        if (!result) {
            throw new Error(`Failed to decrypt initial message from ${senderUserId}`);
        }

        // Fetch their bundle to resolve their phone number and save contact mapping!
        try {
            const bundle = await apiRequest<PreKeyBundle>(
                `/bundle/${encodeURIComponent(senderUserId)}`,
                { method: 'POST', authenticated: true }
            );
            if (bundle && bundle.phone) {
                await saveContact(bundle.phone, senderUserId, bundle.picture);
                await upsertChatThread(senderUserId, result.plaintext, bundle.phone);
                syncDeviceContacts().catch(e => console.warn('Failed to sync device contacts after incoming message:', e));
            }
        } catch (err) {
            console.error('Failed to resolve phone number for incoming initial message:', err);
        }

        // Compare identity key against stored value — detect key changes
        // No need to clearSession here: the X3DH responder already established a fresh ratchet.
        try {
            const syncResult = await updateContactBundle(
                senderUserId,
                payload.identityKey,
                null // picture already saved above via saveContact
            );
            if (syncResult?.keyChanged) {
                await saveSystemMessage(
                    senderUserId,
                    '🔒 Security info has changed. Messages will use a new session.'
                );
            }
        } catch (err) {
            console.warn('[Process] Failed to update contact bundle for incoming message:', err);
        }

        return result.plaintext;
    } 
    
    if (payload.ciphertext && payload.header) {
        // Subsequent message — ratchet already initialized
        const identityKey = await getIdentityKey(senderUserId);
        if (!identityKey) {
            throw new Error(`No identity key found for sender: ${senderUserId}`);
        }

        const result = await receiveMessage({
            session,
            payload,
            senderUserId: senderUserId,
            senderIdentityKey: identityKey,
            decrypt: (header, ciphertext, ad) =>
                decryptMessage(senderUserId, header, ciphertext, ad),
        });

        if (!result) {
            throw new Error(`Failed to decrypt subsequent message from ${senderUserId}`);
        }
        return result.plaintext;
    } 
    
    throw new Error(`Unrecognized message payload shape from ${senderUserId}`);
}
