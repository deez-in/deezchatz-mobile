import { File } from "expo-file-system";
import {
  formatRecordingTime,
  requestAudioPermissions,
  getAudioPermissions,
  startAudioRecording,
  stopAudioRecording,
  discardAudioRecording,
  playPreviewAudio,
  stopPreviewAudio,
  sendVoiceMessage,
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

  describe("native audio recording, playback and transmission", () => {
    it("checks and requests audio permissions", async () => {
      const perm = await getAudioPermissions();
      expect(perm.granted).toBe(true);

      const req = await requestAudioPermissions();
      expect(req.granted).toBe(true);
    });

    it("starts and stops recording, returning file metadata and duration", async () => {
      await expect(startAudioRecording()).resolves.toBeUndefined();

      const result = await stopAudioRecording();
      expect(result.durationSeconds).toBe(5);
      expect(result.durationMs).toBe(5000);
      expect(result.uri).toContain(".opus");
    });

    it("plays and stops preview audio", async () => {
      await expect(
        playPreviewAudio("file:///mock/cache/recording_mock.opus")
      ).resolves.toBeUndefined();
      await expect(stopPreviewAudio()).resolves.toBeUndefined();
    });

    it("discards recording and removes cache file", async () => {
      const deleteSpy = jest.spyOn(File.prototype, "delete");
      await expect(
        discardAudioRecording("file:///mock/cache/recording_mock.opus")
      ).resolves.toBeUndefined();
      expect(deleteSpy).toHaveBeenCalled();
      deleteSpy.mockRestore();
    });

    it("executes sendVoiceMessage without error", async () => {
      await expect(
        sendVoiceMessage({
          recipientId: "user-123",
          duration: 5,
          uri: "file:///mock/cache/recording_mock.opus",
        })
      ).resolves.toBeUndefined();
    });
  });
});
