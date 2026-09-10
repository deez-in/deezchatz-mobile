import { compressImage } from "@/src/utils/image/imageCompression";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const mockSaveAsync = jest.fn().mockResolvedValue({
  uri: "file:///mock/cache/compressed.jpg",
  width: 1200,
  height: 800,
});
const mockImageRelease = jest.fn();
const mockContextRelease = jest.fn();
const mockResize = jest.fn();
const mockRenderAsync = jest.fn().mockResolvedValue({
  saveAsync: mockSaveAsync,
  release: mockImageRelease,
});

jest.mock("expo-image-manipulator", () => ({
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: mockResize,
      renderAsync: mockRenderAsync,
      release: mockContextRelease,
    })),
  },
  SaveFormat: {
    JPEG: "jpeg",
    PNG: "png",
    WEBP: "webp",
  },
}));

describe("imageCompression", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("downscales width to 1200 when width > height and width > 1200", async () => {
    const result = await compressImage("file:///mock/photo.jpg", {
      originalWidth: 2400,
      originalHeight: 1600,
    });

    expect(ImageManipulator.manipulate).toHaveBeenCalledWith("file:///mock/photo.jpg");
    expect(mockResize).toHaveBeenCalledWith({ width: 1200 });
    expect(mockSaveAsync).toHaveBeenCalledWith({
      compress: 0.7,
      format: SaveFormat.JPEG,
    });
    expect(mockContextRelease).toHaveBeenCalled();
    expect(mockImageRelease).toHaveBeenCalled();
    expect(result.uri).toBe("file:///mock/cache/compressed.jpg");
  });

  it("downscales height to 1200 when height > width and height > 1200", async () => {
    const result = await compressImage("file:///mock/portrait.jpg", {
      originalWidth: 1600,
      originalHeight: 2400,
    });

    expect(ImageManipulator.manipulate).toHaveBeenCalledWith("file:///mock/portrait.jpg");
    expect(mockResize).toHaveBeenCalledWith({ height: 1200 });
    expect(mockSaveAsync).toHaveBeenCalledWith({
      compress: 0.7,
      format: SaveFormat.JPEG,
    });
    expect(result.uri).toBe("file:///mock/cache/compressed.jpg");
  });

  it("does not resize when image is already within 1200px bounds", async () => {
    await compressImage("file:///mock/small.jpg", {
      originalWidth: 800,
      originalHeight: 600,
    });

    expect(ImageManipulator.manipulate).toHaveBeenCalledWith("file:///mock/small.jpg");
    expect(mockResize).not.toHaveBeenCalled();
    expect(mockSaveAsync).toHaveBeenCalledWith({
      compress: 0.7,
      format: SaveFormat.JPEG,
    });
  });

  it("applies width limit fallback if original dimensions are not provided", async () => {
    await compressImage("file:///mock/unknown.jpg");

    expect(ImageManipulator.manipulate).toHaveBeenCalledWith("file:///mock/unknown.jpg");
    expect(mockResize).toHaveBeenCalledWith({ width: 1200 });
  });
});
