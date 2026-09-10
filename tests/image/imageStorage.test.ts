import {
  getImageDirectory,
  getImageSentDirectory,
  ensureImageDirectories,
  saveSentImage,
  saveReceivedImage,
  readImageBytes,
  deleteImageFile,
  setUseInternalFallback,
  ANDROID_MEDIA_ROOT,
  ANDROID_MEDIA_SENT,
} from "@/src/utils/image/imageStorage";
import { File, Directory } from "expo-file-system";
import { Platform } from "react-native";

describe("imageStorage", () => {
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

      const imgDir = getImageDirectory();
      expect(imgDir.uri).toBe(ANDROID_MEDIA_ROOT);
      expect(imgDir.uri).toContain("Android/media/in.deez.chatz/DeezChatz/Media/Images");

      const sentDir = getImageSentDirectory();
      expect(sentDir.uri).toBe(ANDROID_MEDIA_SENT);
      expect(sentDir.uri).toContain("Android/media/in.deez.chatz/DeezChatz/Media/Images/Sent");
    });

    it("creates Directory objects with iOS documents path when on iOS", () => {
      Object.defineProperty(Platform, "OS", {
        value: "ios",
        configurable: true,
      });

      const imgDir = getImageDirectory();
      expect(imgDir.uri).toContain("DeezChatz/Media/Images");

      const sentDir = getImageSentDirectory();
      expect(sentDir.uri).toContain("DeezChatz/Media/Images/Sent");
    });

    it("ensureImageDirectories creates directories without .nomedia file", async () => {
      const existsSpy = jest
        .spyOn(Directory.prototype, "exists", "get")
        .mockReturnValue(false);
      const createDirSpy = jest.spyOn(Directory.prototype, "create");
      const createFileSpy = jest.spyOn(File.prototype, "create");

      await ensureImageDirectories();

      expect(createDirSpy).toHaveBeenCalled();
      // Verify .nomedia is NOT created for images
      expect(createFileSpy).not.toHaveBeenCalled();

      createDirSpy.mockRestore();
      existsSpy.mockRestore();
      createFileSpy.mockRestore();
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

      await ensureImageDirectories();

      expect(createDirSpy).toHaveBeenCalledTimes(3);
      createDirSpy.mockRestore();
      existsSpy.mockRestore();
    });
  });

  describe("saving and reading", () => {
    it("saveSentImage copies cache file to sent directory with messageId filename", async () => {
      const copySpy = jest.spyOn(File.prototype, "copy").mockResolvedValue(undefined as any);
      jest.spyOn(Directory.prototype, "exists", "get").mockReturnValue(true);

      const uri = await saveSentImage("file:///mock/cache/image.jpg", "msg-123");
      expect(uri).toContain("msg-123.jpg");
      expect(copySpy).toHaveBeenCalled();

      copySpy.mockRestore();
    });

    it("saveReceivedImage writes bytes to image directory with messageId filename", async () => {
      const createSpy = jest.spyOn(File.prototype, "create").mockImplementation();
      const writeSpy = jest.spyOn(File.prototype, "write").mockImplementation();
      jest.spyOn(Directory.prototype, "exists", "get").mockReturnValue(true);

      const bytes = new Uint8Array([0xff, 0xd8, 0xff]);
      const uri = await saveReceivedImage(bytes, "msg-rec-456");

      expect(uri).toContain("msg-rec-456.jpg");
      expect(createSpy).toHaveBeenCalled();
      expect(writeSpy).toHaveBeenCalledWith(bytes);

      createSpy.mockRestore();
      writeSpy.mockRestore();
    });

    it("readImageBytes reads bytes from file", async () => {
      const fakeBuffer = new Uint8Array([1, 2, 3, 4]).buffer;
      jest.spyOn(File.prototype, "exists", "get").mockReturnValue(true);
      const arrayBufferSpy = jest
        .spyOn(File.prototype, "arrayBuffer")
        .mockResolvedValue(fakeBuffer as any);

      const bytes = await readImageBytes("file:///mock/img.jpg");
      expect(bytes).toEqual(new Uint8Array([1, 2, 3, 4]));

      arrayBufferSpy.mockRestore();
    });

    it("readImageBytes throws if file does not exist", async () => {
      jest.spyOn(File.prototype, "exists", "get").mockReturnValue(false);

      await expect(readImageBytes("file:///not/found.jpg")).rejects.toThrow(
        "Image file not found"
      );
    });

    it("deleteImageFile deletes file if it exists", async () => {
      jest.spyOn(File.prototype, "exists", "get").mockReturnValue(true);
      const deleteSpy = jest.spyOn(File.prototype, "delete").mockImplementation();

      await deleteImageFile("file:///mock/img.jpg");
      expect(deleteSpy).toHaveBeenCalled();

      deleteSpy.mockRestore();
    });
  });
});
