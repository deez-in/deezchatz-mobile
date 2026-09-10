/**
 * Binary payload framing for Double Ratchet messages.
 * Prefixes the encrypted message payload with a 1-byte type indicator:
 *   - 0: Text message (UTF-8 bytes)
 *   - 1: Voice message (raw Opus file bytes)
 *   - 2: Image message (timestamp + caption + JPEG bytes)
 */

import { toBytes, toString } from "@/src/utils/helpers/encoding";

export const PAYLOAD_TYPE_TEXT = 0;
export const PAYLOAD_TYPE_VOICE = 1;
export const PAYLOAD_TYPE_IMAGE = 2;

export type DecodedPayload =
  | { type: "text"; text: string }
  | { type: "voice"; audioBytes: Uint8Array }
  | {
      type: "image";
      imageBytes: Uint8Array;
      caption: string;
      timestamp: number;
    };

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
 * Encodes an image into framed binary bytes:
 * [0x02, 4-byte timestamp BE, 2-byte caption length BE, caption UTF-8 bytes, raw JPEG bytes]
 */
export function encodeImagePayload(
  timestampSeconds: number,
  caption: string,
  imageBytes: Uint8Array
): Uint8Array {
  const captionBytes = toBytes(caption);
  const totalLength = 1 + 4 + 2 + captionBytes.length + imageBytes.length;
  const payload = new Uint8Array(totalLength);
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

  payload[0] = PAYLOAD_TYPE_IMAGE;
  view.setUint32(1, timestampSeconds, false);
  view.setUint16(5, captionBytes.length, false);
  payload.set(captionBytes, 7);
  payload.set(imageBytes, 7 + captionBytes.length);

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

  if (typeByte === PAYLOAD_TYPE_IMAGE) {
    if (bytes.length < 7) {
      throw new Error("Invalid image payload: header too short");
    }
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const timestamp = view.getUint32(1, false);
    const captionLength = view.getUint16(5, false);

    if (bytes.length < 7 + captionLength) {
      throw new Error("Invalid image payload: payload shorter than caption length");
    }

    const caption = toString(bytes.subarray(7, 7 + captionLength));
    const imageBytes = bytes.subarray(7 + captionLength);

    return {
      type: "image",
      imageBytes,
      caption,
      timestamp,
    };
  }

  throw new Error(`Unrecognized message payload type byte: ${typeByte}`);
}
