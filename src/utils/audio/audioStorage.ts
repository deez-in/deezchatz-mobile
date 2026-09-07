/**
 * WhatsApp-style media storage for voice messages.
 *
 * Directory hierarchy:
 *   - Android:
 *       Received: /storage/emulated/0/Android/media/in.deez.chatz/DeezChatz/Media/Voice/<messageId>.opus
 *       Sent:     /storage/emulated/0/Android/media/in.deez.chatz/DeezChatz/Media/Voice/Sent/<messageId>.opus
 *   - iOS (or fallback):
 *       Received: Paths.document/DeezChatz/Media/Voice/<messageId>.opus
 *       Sent:     Paths.document/DeezChatz/Media/Voice/Sent/<messageId>.opus
 *
 * A .nomedia file is created in the Voice directory to prevent system audio players
 * from indexing voice messages into user playlists while keeping them accessible in file managers.
 */

import { File, Directory, Paths } from "expo-file-system";
import { Platform } from "react-native";

export const ANDROID_MEDIA_ROOT =
  "file:///storage/emulated/0/Android/media/in.deez.chatz/DeezChatz/Media/Voice";
export const ANDROID_MEDIA_SENT = `${ANDROID_MEDIA_ROOT}/Sent`;

let useInternalStorageFallback = false;

export function setUseInternalFallback(fallback: boolean): void {
  useInternalStorageFallback = fallback;
}

export function isUsingInternalFallback(): boolean {
  return useInternalStorageFallback;
}

/**
 * Gets or creates the Voice directory.
 */
export function getVoiceDirectory(): Directory {
  if (Platform.OS === "android" && !useInternalStorageFallback) {
    return new Directory(ANDROID_MEDIA_ROOT);
  }
  return new Directory(
    Paths.document,
    "DeezChatz",
    "Media",
    "Voice"
  );
}

/**
 * Gets or creates the Voice/Sent directory.
 */
export function getVoiceSentDirectory(): Directory {
  if (Platform.OS === "android" && !useInternalStorageFallback) {
    return new Directory(ANDROID_MEDIA_SENT);
  }
  return new Directory(
    Paths.document,
    "DeezChatz",
    "Media",
    "Voice",
    "Sent"
  );
}

/**
 * Ensures that both Voice and Voice/Sent directories exist,
 * and creates a .nomedia file to prevent media player indexing.
 */
export async function ensureVoiceDirectories(): Promise<void> {
  try {
    const voiceDir = getVoiceDirectory();
    if (!voiceDir.exists) {
      voiceDir.create({ intermediates: true });
    }

    const voiceSentDir = getVoiceSentDirectory();
    if (!voiceSentDir.exists) {
      voiceSentDir.create({ intermediates: true });
    }

    const nomediaFile = new File(voiceDir, ".nomedia");
    if (!nomediaFile.exists) {
      nomediaFile.create();
    }
  } catch (error) {
    if (Platform.OS === "android" && !useInternalStorageFallback) {
      console.warn(
        "Failed to create external media directory, falling back to internal storage:",
        error
      );
      useInternalStorageFallback = true;
      await ensureVoiceDirectories();
      return;
    }
    throw error;
  }
}

/**
 * Moves/copies a recorded cache audio file to permanent sent storage:
 * .../Voice/Sent/<messageId>.opus
 *
 * @param cacheUri - The temporary recording file URI in Paths.cache
 * @param messageId - The unique ID of the message
 * @returns The permanent file URI
 */
export async function saveSentVoiceMessage(
  cacheUri: string,
  messageId: string
): Promise<string> {
  await ensureVoiceDirectories();

  const sourceFile = new File(cacheUri);
  const targetFile = new File(getVoiceSentDirectory(), `${messageId}.opus`);

  await sourceFile.copy(targetFile, { overwrite: true });
  return targetFile.uri;
}

/**
 * Writes decrypted Opus audio bytes to permanent received storage:
 * .../Voice/<messageId>.opus
 *
 * @param bytes - Decrypted raw Opus file bytes
 * @param messageId - The unique ID of the received message
 * @returns The permanent file URI
 */
export async function saveReceivedVoiceMessage(
  bytes: Uint8Array,
  messageId: string
): Promise<string> {
  await ensureVoiceDirectories();

  const targetFile = new File(getVoiceDirectory(), `${messageId}.opus`);

  targetFile.create({ overwrite: true });
  targetFile.write(bytes);

  return targetFile.uri;
}

/**
 * Reads an audio file into a raw Uint8Array.
 *
 * @param uri - File URI to read
 */
export async function readAudioBytes(uri: string): Promise<Uint8Array> {
  const file = new File(uri);
  if (!file.exists) {
    throw new Error(`Audio file not found: ${uri}`);
  }

  const arrayBuffer = await file.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Deletes a voice file from disk if it exists.
 *
 * @param uri - File URI to delete
 */
export async function deleteVoiceFile(uri?: string): Promise<void> {
  if (!uri) return;

  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch (err) {
    console.warn("Failed to delete voice file:", uri, err);
  }
}
