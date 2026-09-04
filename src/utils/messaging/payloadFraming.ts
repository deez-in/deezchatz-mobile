/**
 * Binary payload framing for Double Ratchet messages.
 * Prefixes the encrypted message payload with a 1-byte type indicator:
 *   - 0: Text message (UTF-8 bytes)
 *   - 1: Voice message (raw Opus file bytes)
 */

import { toBytes, toString } from "@/src/utils/helpers/encoding";

export const PAYLOAD_TYPE_TEXT = 0;
export const PAYLOAD_TYPE_VOICE = 1;

export type DecodedPayload =
  | { type: "text"; text: string }
  | { type: "voice"; audioBytes: Uint8Array };

/**
 * Encodes a text message string into framed binary bytes: [0x00, ...utf8Bytes].
 */
export function encodeTextPayload(text: string): Uint8Array {
  const textBytes = toBytes(text);
  const payload = new Uint8Array(1 + textBytes.length);
  payload[0] = PAYLOAD_TYPE_TEXT;
  payload.set(textBytes, 1);
  return payload;
}

/**
 * Encodes raw Opus audio bytes into framed binary bytes: [0x01, ...audioBytes].
 */
export function encodeVoicePayload(audioBytes: Uint8Array): Uint8Array {
  const payload = new Uint8Array(1 + audioBytes.length);
  payload[0] = PAYLOAD_TYPE_VOICE;
  payload.set(audioBytes, 1);
  return payload;
}

/**
 * Decodes a framed binary payload by checking its first byte.
 * Throws an error if the type byte is invalid or the payload is empty.
 */
export function decodePayload(bytes: Uint8Array): DecodedPayload {
  if (!bytes || bytes.length === 0) {
    throw new Error("Cannot decode empty message payload");
  }

  const typeByte = bytes[0];

  if (typeByte === PAYLOAD_TYPE_TEXT) {
    return {
      type: "text",
      text: toString(bytes.subarray(1)),
    };
  }

  if (typeByte === PAYLOAD_TYPE_VOICE) {
    return {
      type: "voice",
      audioBytes: bytes.subarray(1),
    };
  }

  throw new Error(`Unrecognized message payload type byte: ${typeByte}`);
}
