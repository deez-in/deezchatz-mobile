import {
  getVoiceDirectory,
  getVoiceSentDirectory,
  ensureVoiceDirectories,
  saveSentVoiceMessage,
  saveReceivedVoiceMessage,
  readAudioBytes,
  deleteVoiceFile,
} from "@/src/utils/audio/audioStorage";
import { File, Directory } from "expo-file-system";

describe("audioStorage", () => {
  describe("directories", () => {
    it("creates Directory objects with correct Signal-style paths", () => {
      const voiceDir = getVoiceDirectory();
      expect(voiceDir.uri).toContain("media/voice");

      const sentDir = getVoiceSentDirectory();
      expect(sentDir.uri).toContain("media/voice/sent");
    });

    it("ensureVoiceDirectories creates both directories if they do not exist", async () => {
      const existsSpy = jest.spyOn(Directory.prototype, "exists", "get").mockReturnValue(false);
      const createSpy = jest.spyOn(Directory.prototype, "create");
      await ensureVoiceDirectories();
      expect(createSpy).toHaveBeenCalled();
      createSpy.mockRestore();
      existsSpy.mockRestore();
    });
  });

  describe("saveSentVoiceMessage", () => {
    it("copies cached recording to permanent sent storage with messageId.opus", async () => {
      const cacheUri = "file:///mock/cache/recording_uuid123.opus";
      const messageId = "msg-uuid-456";

      const permanentUri = await saveSentVoiceMessage(cacheUri, messageId);

      expect(permanentUri).toContain("media/voice/sent/msg-uuid-456.opus");
    });
  });

  describe("saveReceivedVoiceMessage", () => {
    it("writes decrypted audio bytes to media/voice/messageId.opus", async () => {
      const audioBytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53]);
      const messageId = "recv-msg-789";

      const permanentUri = await saveReceivedVoiceMessage(audioBytes, messageId);

      expect(permanentUri).toContain("media/voice/recv-msg-789.opus");
    });
  });

  describe("readAudioBytes and deleteVoiceFile", () => {
    it("reads audio bytes from existing file", async () => {
      const bytes = await readAudioBytes("file:///mock/documents/media/voice/test.opus");
      expect(bytes).toBeInstanceOf(Uint8Array);
    });

    it("deletes file if it exists", async () => {
      const deleteSpy = jest.spyOn(File.prototype, "delete");
      await deleteVoiceFile("file:///mock/documents/media/voice/test.opus");
      expect(deleteSpy).toHaveBeenCalled();
      deleteSpy.mockRestore();
    });

    it("handles undefined URI gracefully without throwing", async () => {
      await expect(deleteVoiceFile(undefined)).resolves.toBeUndefined();
    });
  });
});
