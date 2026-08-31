/**
 * Message receiving orchestration.
 * Coordinates crypto and storage layers for inbound messages.
 */

import LibsignalDezireModule from 'expo-libsignal-dezire';

import { fromBase64, toString } from '../helpers/encoding';

import { x3dhResponder } from '../crypto/x3dh';
import { loadOpk } from '../crypto/oneTimePreKeys';
import { constructReceiverAD } from '../crypto/associatedData';

import {
    ReceiveInitialMessageParams,
    ReceiveMessageParams,
    ReceiveResult,
} from '@/src/models/messaging';



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

    if (!payload.identityKey || !payload.ephemeralKey) {
        console.error('Invalid X3DH payload');
        return null;
    }

    try {

        const opkPrivate = payload.opkId != null ? await loadOpk(payload.opkId) : null;
        if (payload.opkId != null && !opkPrivate) {
            console.warn(`[Receive] OPK ${payload.opkId} not found in local storage`);
            return null;
        }

        // X3DH Responder - derive shared secret
        const sharedSecret = await x3dhResponder(session, payload, opkPrivate);

        // Initialize Receiver Ratchet with SPK keypair
        const spkPrivate = session.preKey;
        const spkPublic = await LibsignalDezireModule.genPubKey(spkPrivate);
        await initReceiver(sharedSecret, spkPrivate, spkPublic, payload.identityKey);


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
