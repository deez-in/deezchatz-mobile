import {
  formatRecordingTime,
  startRecordingStub,
  stopRecordingStub,
  discardRecordingStub,
  sendVoiceMessageStub,
  playPreviewStub,
  stopPreviewStub,
} from "@/src/utils/audio";

describe("voiceRecorder utils", () => {
  describe("formatRecordingTime", () => {
    it("formats 0 seconds as 00:00", () => {
      expect(formatRecordingTime(0)).toBe("00:00");
    });

    it("formats single digit seconds correctly", () => {
      expect(formatRecordingTime(5)).toBe("00:05");
    });

    it("formats double digit seconds correctly", () => {
      expect(formatRecordingTime(45)).toBe("00:45");
    });

    it("formats minutes and seconds correctly", () => {
      expect(formatRecordingTime(65)).toBe("01:05");
      expect(formatRecordingTime(125)).toBe("02:05");
    });
  });

  describe("recording and playback stubs", () => {
    it("executes startRecordingStub without throwing", async () => {
      await expect(startRecordingStub()).resolves.toBeUndefined();
    });

    it("executes stopRecordingStub and returns metadata with duration", async () => {
      const result = await stopRecordingStub(12);
      expect(result.durationSeconds).toBe(12);
      expect(result.uri).toContain("mock://audio/voice_");
    });

    it("executes discardRecordingStub without throwing", async () => {
      await expect(discardRecordingStub()).resolves.toBeUndefined();
    });

    it("executes sendVoiceMessageStub without throwing", async () => {
      await expect(
        sendVoiceMessageStub({ recipientId: "user-123", duration: 15 })
      ).resolves.toBeUndefined();
    });

    it("executes playPreviewStub and stopPreviewStub without throwing", async () => {
      await expect(playPreviewStub()).resolves.toBeUndefined();
      await expect(stopPreviewStub()).resolves.toBeUndefined();
    });
  });
});
