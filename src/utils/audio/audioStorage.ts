/**
 * Signal-style permanent media storage for voice messages.
 * Directory hierarchy in persistent storage (Paths.document):
 *   - Received voice notes: media/voice/<messageId>.opus
 *   - Sent voice notes:     media/voice/sent/<messageId>.opus
 */

import { File, Directory, Paths } from "expo-file-system";

/**
 * Gets or creates the media/voice/ directory.
 */
export function getVoiceDirectory(): Directory {
  return new Directory(Paths.document, "media", "voice");
}

/**
 * Gets or creates the media/voice/sent/ directory.
 */
export function getVoiceSentDirectory(): Directory {
  return new Directory(Paths.document, "media", "voice", "sent");
}

/**
 * Ensures that both media/voice and media/voice/sent directories exist.
 */
export async function ensureVoiceDirectories(): Promise<void> {
  const voiceDir = getVoiceDirectory();
  if (!voiceDir.exists) {
    voiceDir.create({ intermediates: true });
  }

  const voiceSentDir = getVoiceSentDirectory();
  if (!voiceSentDir.exists) {
    voiceSentDir.create({ intermediates: true });
  }
}

/**
 * Moves/copies a recorded cache audio file to permanent sent storage:
 * media/voice/sent/<messageId>.opus
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
  const targetFile = new File(
    Paths.document,
    "media",
    "voice",
    "sent",
    `${messageId}.opus`
  );

  await sourceFile.copy(targetFile, { overwrite: true });
  return targetFile.uri;
}

/**
 * Writes decrypted Opus audio bytes to permanent received storage:
 * media/voice/<messageId>.opus
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

  const targetFile = new File(
    Paths.document,
    "media",
    "voice",
    `${messageId}.opus`
  );

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
