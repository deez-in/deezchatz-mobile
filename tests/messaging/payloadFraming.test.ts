import {
  encodeTextPayload,
  encodeVoicePayload,
  decodePayload,
  PAYLOAD_TYPE_TEXT,
  PAYLOAD_TYPE_VOICE,
} from "@/src/utils/messaging/payloadFraming";

describe("payloadFraming", () => {
  describe("encodeTextPayload", () => {
    it("encodes text with 0x00 discriminator byte prefix", () => {
      const text = "Hello, world!";
      const payload = encodeTextPayload(text);

      expect(payload[0]).toBe(PAYLOAD_TYPE_TEXT);
      expect(payload[0]).toBe(0x00);

      // Verify remaining bytes are utf-8 text
      const decodedText = new TextDecoder().decode(payload.subarray(1));
      expect(decodedText).toBe(text);
    });

    it("encodes empty string with 0x00 prefix", () => {
      const payload = encodeTextPayload("");
      expect(payload.length).toBe(1);
      expect(payload[0]).toBe(PAYLOAD_TYPE_TEXT);
    });

    it("encodes unicode and emojis correctly", () => {
      const text = "Voice notes rock! 🎤🔥";
      const payload = encodeTextPayload(text);
      expect(payload[0]).toBe(PAYLOAD_TYPE_TEXT);

      const decodedText = new TextDecoder().decode(payload.subarray(1));
      expect(decodedText).toBe(text);
    });
  });

  describe("encodeVoicePayload", () => {
    it("encodes voice bytes with 0x01 discriminator byte prefix", () => {
      const rawAudio = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00, 0x02]); // OggS header bytes
      const payload = encodeVoicePayload(rawAudio);

      expect(payload[0]).toBe(PAYLOAD_TYPE_VOICE);
      expect(payload[0]).toBe(0x01);
      expect(payload.length).toBe(rawAudio.length + 1);
      expect(payload.subarray(1)).toEqual(rawAudio);
    });

    it("encodes empty audio bytes with 0x01 prefix", () => {
      const payload = encodeVoicePayload(new Uint8Array(0));
      expect(payload.length).toBe(1);
      expect(payload[0]).toBe(PAYLOAD_TYPE_VOICE);
    });
  });

  describe("decodePayload", () => {
    it("decodes valid text payload", () => {
      const originalText = "Test message";
      const encoded = encodeTextPayload(originalText);

      const result = decodePayload(encoded);
      expect(result.type).toBe("text");
      if (result.type === "text") {
        expect(result.text).toBe(originalText);
      }
    });

    it("decodes valid voice payload", () => {
      const originalAudio = new Uint8Array([10, 20, 30, 40, 50]);
      const encoded = encodeVoicePayload(originalAudio);

      const result = decodePayload(encoded);
      expect(result.type).toBe("voice");
      if (result.type === "voice") {
        expect(result.audioBytes).toEqual(originalAudio);
      }
    });

    it("throws error on empty payload buffer", () => {
      expect(() => decodePayload(new Uint8Array(0))).toThrow(
        "Cannot decode empty message payload"
      );
    });

    it("throws error on unknown discriminator (strictly no backward compatibility)", () => {
      // 0x02 or legacy ASCII character like 'H' (0x48)
      const invalidPayload = new Uint8Array([0x02, 0x01, 0x02]);
      expect(() => decodePayload(invalidPayload)).toThrow(
        "Unrecognized message payload type byte: 2"
      );

      const legacyAsciiPayload = new TextEncoder().encode("Hello legacy");
      expect(() => decodePayload(legacyAsciiPayload)).toThrow(
        "Unrecognized message payload type byte: 72"
      );
    });
  });
});
