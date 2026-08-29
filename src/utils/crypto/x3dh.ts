/**
 * X3DH Key Agreement Protocol.
 * Handles key exchange for establishing shared secrets.
 */

import LibsignalDezireModule from 'expo-libsignal-dezire';
import { fromBase64 } from '../helpers/encoding';
import { Session } from '@/src/store/useSession';

export type PreKeyBundle = {
    userId: string;
    phone: string;
    deviceId: string;
    identityKey: string;
    signature: string;
    signedPreKey: string;
    opk: {
        id: number;
        key: string;
    };
    picture?: string;
};

export type X3DHBundle = {
    identityKey: string;
    ephemeralKey: string;
    opkId: number;
};

/**
 * Serializes Bob's (receiver's) key bundle for the native module.
 */
function serializeBobBundle(
    identityKey: Uint8Array,
    spkId: number,
    spkPublic: Uint8Array,
    signature: Uint8Array,
    opkId: number,
    opkPublic: Uint8Array | null,
    hasOpk: boolean
): Uint8Array {
    // Sizes: 33 (IK) + 4 (SPK ID) + 33 (SPK Pub) + 96 (Sig) + 4 (OPK ID) + [33 (OPK Pub)]
    const size = hasOpk ? 203 : 170;
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    bytes.set(identityKey, 0);           // 0-32: identityKey (33 bytes)
    view.setUint32(33, spkId, true);     // 33-36: spkId (4 bytes, little-endian)
    bytes.set(spkPublic, 37);            // 37-69: spkPublic (33 bytes)
    bytes.set(signature, 70);            // 70-165: signature (96 bytes)
    view.setUint32(166, opkId, true);    // 166-169: opkId (4 bytes, little-endian)
    if (hasOpk && opkPublic) {
        bytes.set(opkPublic, 170);       // 170-202: opkPublic (33 bytes)
    }
    return bytes;
}



/**
 * Initiator side of X3DH key agreement.
 */
export async function x3dhInitiator(
    session: Session,
    preKeyBundle: PreKeyBundle
): Promise<{ sharedSecret: Uint8Array; ephemeralKey: Uint8Array }> {
    // TODO(security): The backend currently doesn't return spkId in the PreKeyBundle.
    // We are hardcoding it to 1, which will cause X3DH to fail if Bob rotates his Signed PreKey.
    // This must be fixed in the backend API and the PreKeyBundle interface.
    console.warn("WARNING: Hardcoded SPK ID = 1 in x3dhInitiator. This will break upon key rotation!");

    const hasOpk = true;
    const bobBundle = serializeBobBundle(
        fromBase64(preKeyBundle.identityKey),
        1, // spkId - hardcoded for now
        fromBase64(preKeyBundle.signedPreKey),
        fromBase64(preKeyBundle.signature),
        preKeyBundle.opk.id,
        fromBase64(preKeyBundle.opk.key),
        hasOpk
    );

    const result = await LibsignalDezireModule.x3dhInitiator(
        session.iKey,
        bobBundle,
        hasOpk
    );

    return {
        sharedSecret: result.sharedSecret,
        ephemeralKey: result.ephemeralPublic,
    };
}

/**
 * Responder side of X3DH key agreement.
 */
export async function x3dhResponder(
    session: Session,
    bundle: X3DHBundle,
    opkPrivate: Uint8Array | null
): Promise<Uint8Array> {
    const aliceIdentityPublic = fromBase64(bundle.identityKey);
    const aliceEphemeralPublic = fromBase64(bundle.ephemeralKey);

    const result = await LibsignalDezireModule.x3dhResponder(
        session.iKey,
        session.preKey,
        opkPrivate,
        aliceIdentityPublic,
        aliceEphemeralPublic
    );

    return result.sharedSecret;
}
