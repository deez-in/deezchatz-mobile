import {
  encodeTextPayload,
  encodeVoicePayload,
  encodeImagePayload,
  decodePayload,
  PAYLOAD_TYPE_TEXT,
  PAYLOAD_TYPE_VOICE,
  PAYLOAD_TYPE_IMAGE,
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

  describe("encodeImagePayload", () => {
    it("encodes image with 0x02 discriminator, timestamp, caption, and image bytes", () => {
      const timestamp = 1726030464;
      const caption = "sunset 🌅";
      const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x12, 0x34]);

      const payload = encodeImagePayload(timestamp, caption, imageBytes);

      expect(payload[0]).toBe(PAYLOAD_TYPE_IMAGE);
      expect(payload[0]).toBe(0x02);

      const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      expect(view.getUint32(1, false)).toBe(timestamp);

      const captionBytes = new TextEncoder().encode(caption);
      expect(view.getUint16(5, false)).toBe(captionBytes.length);

      const decodedCaption = new TextDecoder().decode(
        payload.subarray(7, 7 + captionBytes.length)
      );
      expect(decodedCaption).toBe(caption);

      expect(payload.subarray(7 + captionBytes.length)).toEqual(imageBytes);
    });

    it("encodes image without caption (empty string)", () => {
      const timestamp = 1726030464;
      const caption = "";
      const imageBytes = new Uint8Array([0xff, 0xd8]);

      const payload = encodeImagePayload(timestamp, caption, imageBytes);

      expect(payload[0]).toBe(0x02);
      const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
      expect(view.getUint16(5, false)).toBe(0);
      expect(payload.subarray(7)).toEqual(imageBytes);
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

    it("decodes valid image payload", () => {
      const timestamp = 1726030464;
      const caption = "Look at this! 📸";
      const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
      const encoded = encodeImagePayload(timestamp, caption, imageBytes);

      const result = decodePayload(encoded);
      expect(result.type).toBe("image");
      if (result.type === "image") {
        expect(result.timestamp).toBe(timestamp);
        expect(result.caption).toBe(caption);
        expect(result.imageBytes).toEqual(imageBytes);
      }
    });

    it("throws error on empty payload buffer", () => {
      expect(() => decodePayload(new Uint8Array(0))).toThrow(
        "Cannot decode empty message payload"
      );
    });

    it("throws error on image payload with truncated header", () => {
      const truncated = new Uint8Array([0x02, 0x01, 0x02]);
      expect(() => decodePayload(truncated)).toThrow(
        "Invalid image payload: header too short"
      );
    });

    it("throws error on image payload with truncated caption", () => {
      const payload = new Uint8Array(8);
      const view = new DataView(payload.buffer);
      payload[0] = 0x02;
      view.setUint32(1, 1000, false);
      view.setUint16(5, 10, false); // claims caption length 10, but total length is only 8
      expect(() => decodePayload(payload)).toThrow(
        "Invalid image payload: payload shorter than caption length"
      );
    });

    it("throws error on unknown discriminator (strictly no backward compatibility)", () => {
      const invalidPayload = new Uint8Array([0x05, 0x01, 0x02]);
      expect(() => decodePayload(invalidPayload)).toThrow(
        "Unrecognized message payload type byte: 5"
      );

      const legacyAsciiPayload = new TextEncoder().encode("Hello legacy");
      expect(() => decodePayload(legacyAsciiPayload)).toThrow(
        "Unrecognized message payload type byte: 72"
      );
    });
  });
});
