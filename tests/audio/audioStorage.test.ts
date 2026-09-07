import {
  getVoiceDirectory,
  getVoiceSentDirectory,
  ensureVoiceDirectories,
  saveSentVoiceMessage,
  saveReceivedVoiceMessage,
  readAudioBytes,
  deleteVoiceFile,
  setUseInternalFallback,
  ANDROID_MEDIA_ROOT,
  ANDROID_MEDIA_SENT,
} from "@/src/utils/audio/audioStorage";
import { File, Directory } from "expo-file-system";
import { Platform } from "react-native";

describe("audioStorage", () => {
  const originalPlatformOS = Platform.OS;

  beforeEach(() => {
    setUseInternalFallback(false);
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", {
      value: originalPlatformOS,
      configurable: true,
    });
    setUseInternalFallback(false);
  });

  describe("directories", () => {
    it("creates Directory objects with WhatsApp-style Android paths", () => {
      Object.defineProperty(Platform, "OS", {
        value: "android",
        configurable: true,
      });

      const voiceDir = getVoiceDirectory();
      expect(voiceDir.uri).toBe(ANDROID_MEDIA_ROOT);
      expect(voiceDir.uri).toContain("Android/media/in.deez.chatz/DeezChatz/Media/Voice");

      const sentDir = getVoiceSentDirectory();
      expect(sentDir.uri).toBe(ANDROID_MEDIA_SENT);
      expect(sentDir.uri).toContain("Android/media/in.deez.chatz/DeezChatz/Media/Voice/Sent");
    });

    it("creates Directory objects with iOS documents path when on iOS", () => {
      Object.defineProperty(Platform, "OS", {
        value: "ios",
        configurable: true,
      });

      const voiceDir = getVoiceDirectory();
      expect(voiceDir.uri).toContain("DeezChatz/Media/Voice");

      const sentDir = getVoiceSentDirectory();
      expect(sentDir.uri).toContain("DeezChatz/Media/Voice/Sent");
    });

    it("ensureVoiceDirectories creates directories and .nomedia file if they do not exist", async () => {
      const existsSpy = jest
        .spyOn(Directory.prototype, "exists", "get")
        .mockReturnValue(false);
      const createDirSpy = jest.spyOn(Directory.prototype, "create");
      const fileExistsSpy = jest
        .spyOn(File.prototype, "exists", "get")
        .mockReturnValue(false);
      const createFileSpy = jest.spyOn(File.prototype, "create");

      await ensureVoiceDirectories();

      expect(createDirSpy).toHaveBeenCalled();
      expect(createFileSpy).toHaveBeenCalled();

      createDirSpy.mockRestore();
      existsSpy.mockRestore();
      createFileSpy.mockRestore();
      fileExistsSpy.mockRestore();
    });

    it("falls back to internal storage if external storage directory creation throws on Android", async () => {
      Object.defineProperty(Platform, "OS", {
        value: "android",
        configurable: true,
      });

      const existsSpy = jest
        .spyOn(Directory.prototype, "exists", "get")
        .mockReturnValue(false);

      let callCount = 0;
      const createDirSpy = jest
        .spyOn(Directory.prototype, "create")
        .mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error("EACCES: permission denied on external media");
          }
        });

      await ensureVoiceDirectories();

      // Should have fallen back to internal storage
      const fallbackVoiceDir = getVoiceDirectory();
      expect(fallbackVoiceDir.uri).toContain("/mock/documents");

      createDirSpy.mockRestore();
      existsSpy.mockRestore();
    });
  });

  describe("saveSentVoiceMessage", () => {
    it("copies cached recording to permanent sent storage with messageId.opus", async () => {
      const cacheUri = "file:///mock/cache/recording_uuid123.opus";
      const messageId = "msg-uuid-456";

      const permanentUri = await saveSentVoiceMessage(cacheUri, messageId);

      expect(permanentUri).toContain("DeezChatz/Media/Voice/Sent/msg-uuid-456.opus");
    });
  });

  describe("saveReceivedVoiceMessage", () => {
    it("writes decrypted audio bytes to Voice messageId.opus", async () => {
      const audioBytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53]);
      const messageId = "recv-msg-789";

      const permanentUri = await saveReceivedVoiceMessage(audioBytes, messageId);

      expect(permanentUri).toContain("DeezChatz/Media/Voice/recv-msg-789.opus");
    });
  });

  describe("readAudioBytes and deleteVoiceFile", () => {
    it("reads audio bytes from existing file", async () => {
      const bytes = await readAudioBytes(
        "file:///mock/documents/DeezChatz/Media/Voice/test.opus"
      );
      expect(bytes).toBeInstanceOf(Uint8Array);
    });

    it("deletes file if it exists", async () => {
      const deleteSpy = jest.spyOn(File.prototype, "delete");
      await deleteVoiceFile(
        "file:///mock/documents/DeezChatz/Media/Voice/test.opus"
      );
      expect(deleteSpy).toHaveBeenCalled();
      deleteSpy.mockRestore();
    });

    it("handles undefined URI gracefully without throwing", async () => {
      await expect(deleteVoiceFile(undefined)).resolves.toBeUndefined();
    });
  });
});
