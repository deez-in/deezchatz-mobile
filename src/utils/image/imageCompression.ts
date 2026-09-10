/**
 * Image compression and resizing utility using expo-image-manipulator.
 * Downscales images to a maximum dimension (default 1200px) and compresses to JPEG (quality 0.7).
 */

import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export interface CompressImageOptions {
  maxDimension?: number;
  quality?: number;
  originalWidth?: number;
  originalHeight?: number;
}

export interface CompressedImageResult {
  uri: string;
  width: number;
  height: number;
}

const DEFAULT_MAX_DIMENSION = 1200;
const DEFAULT_QUALITY = 0.7;

/**
 * Resizes an image preserving aspect ratio if larger than maxDimension,
 * and compresses it to JPEG format using the modern ImageManipulator API.
 */
export async function compressImage(
  uri: string,
  options?: CompressImageOptions
): Promise<CompressedImageResult> {
  const maxDim = options?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = options?.quality ?? DEFAULT_QUALITY;

  const context = ImageManipulator.manipulate(uri);

  const { originalWidth, originalHeight } = options ?? {};

  if (originalWidth && originalHeight) {
    // Only downscale if larger than max dimension; never upscale
    if (originalWidth > maxDim || originalHeight > maxDim) {
      if (originalWidth >= originalHeight) {
        context.resize({ width: maxDim });
      } else {
        context.resize({ height: maxDim });
      }
    }
  } else {
    // Fallback if dimensions not provided: ensure width doesn't exceed maxDim
    context.resize({ width: maxDim });
  }

  const image = await context.renderAsync();
  const result = await image.saveAsync({
    compress: quality,
    format: SaveFormat.JPEG,
  });

  context.release();
  image.release();

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}
