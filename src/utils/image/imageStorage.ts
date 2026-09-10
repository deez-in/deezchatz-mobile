/**
 * WhatsApp-style media storage for images.
 *
 * Directory hierarchy:
 *   - Android:
 *       Received: /storage/emulated/0/Android/media/in.deez.chatz/DeezChatz/Media/Images/<messageId>.jpg
 *       Sent:     /storage/emulated/0/Android/media/in.deez.chatz/DeezChatz/Media/Images/Sent/<messageId>.jpg
 *   - iOS (or fallback):
 *       Received: Paths.document/DeezChatz/Media/Images/<messageId>.jpg
 *       Sent:     Paths.document/DeezChatz/Media/Images/Sent/<messageId>.jpg
 *
 * Note: No .nomedia file is created so images can be indexed/viewed in system galleries.
 */

import { File, Directory, Paths } from "expo-file-system";
import { Platform } from "react-native";

export const ANDROID_MEDIA_ROOT =
  "file:///storage/emulated/0/Android/media/in.deez.chatz/DeezChatz/Media/Images";
export const ANDROID_MEDIA_SENT = `${ANDROID_MEDIA_ROOT}/Sent`;

let useInternalStorageFallback = false;

export function setUseInternalFallback(fallback: boolean): void {
  useInternalStorageFallback = fallback;
}

export function isUsingInternalFallback(): boolean {
  return useInternalStorageFallback;
}

/**
 * Gets the Images directory.
 */
export function getImageDirectory(): Directory {
  if (Platform.OS === "android" && !useInternalStorageFallback) {
    return new Directory(ANDROID_MEDIA_ROOT);
  }
  return new Directory(
    Paths.document,
    "DeezChatz",
    "Media",
    "Images"
  );
}

/**
 * Gets the Images/Sent directory.
 */
export function getImageSentDirectory(): Directory {
  if (Platform.OS === "android" && !useInternalStorageFallback) {
    return new Directory(ANDROID_MEDIA_SENT);
  }
  return new Directory(
    Paths.document,
    "DeezChatz",
    "Media",
    "Images",
    "Sent"
  );
}

/**
 * Ensures that both Images and Images/Sent directories exist.
 */
export async function ensureImageDirectories(): Promise<void> {
  try {
    const imageDir = getImageDirectory();
    if (!imageDir.exists) {
      imageDir.create({ intermediates: true });
    }

    const imageSentDir = getImageSentDirectory();
    if (!imageSentDir.exists) {
      imageSentDir.create({ intermediates: true });
    }
  } catch (error) {
    if (Platform.OS === "android" && !useInternalStorageFallback) {
      console.warn(
        "Failed to create external media directory, falling back to internal storage:",
        error
      );
      useInternalStorageFallback = true;
      await ensureImageDirectories();
      return;
    }
    throw error;
  }
}

/**
 * Moves/copies a compressed image cache file to permanent sent storage:
 * .../Images/Sent/<messageId>.jpg
 *
 * @param cacheUri - The temporary compressed image file URI in Paths.cache
 * @param messageId - The unique ID of the message
 * @returns The permanent file URI
 */
export async function saveSentImage(
  cacheUri: string,
  messageId: string
): Promise<string> {
  await ensureImageDirectories();

  const sourceFile = new File(cacheUri);
  const targetFile = new File(getImageSentDirectory(), `${messageId}.jpg`);

  await sourceFile.copy(targetFile, { overwrite: true });
  return targetFile.uri;
}

/**
 * Writes decrypted JPEG image bytes to permanent received storage:
 * .../Images/<messageId>.jpg
 *
 * @param bytes - Decrypted raw JPEG bytes
 * @param messageId - The unique ID of the received message
 * @returns The permanent file URI
 */
export async function saveReceivedImage(
  bytes: Uint8Array,
  messageId: string
): Promise<string> {
  await ensureImageDirectories();

  const targetFile = new File(getImageDirectory(), `${messageId}.jpg`);

  targetFile.create({ overwrite: true });
  targetFile.write(bytes);

  return targetFile.uri;
}

/**
 * Reads an image file into a raw Uint8Array.
 *
 * @param uri - File URI to read
 */
export async function readImageBytes(uri: string): Promise<Uint8Array> {
  const file = new File(uri);
  if (!file.exists) {
    throw new Error(`Image file not found: ${uri}`);
  }

  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Deletes an image file from disk if it exists.
 *
 * @param uri - File URI to delete
 */
export async function deleteImageFile(uri?: string): Promise<void> {
  if (!uri) return;

  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (err) {
    console.warn("Failed to delete image file:", uri, err);
  }
}
