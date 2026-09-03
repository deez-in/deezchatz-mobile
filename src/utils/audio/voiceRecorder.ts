export interface VoiceRecordingResult {
  durationSeconds: number;
  uri?: string;
}

export interface SendVoiceMessageParams {
  recipientId: string;
  duration: number;
  uri?: string;
}

/**
 * Stub to simulate starting audio recording.
 * Will be replaced by native audio recording implementation (e.g. expo-av / expo-audio).
 */
export async function startRecordingStub(): Promise<void> {
  // Simulates initializing audio session and starting hardware recorder
}

/**
 * Stub to simulate stopping audio recording and returning recording metadata.
 */
export async function stopRecordingStub(durationSeconds: number): Promise<VoiceRecordingResult> {
  return {
    durationSeconds,
    uri: `mock://audio/voice_${Date.now()}.m4a`,
  };
}

/**
 * Stub to simulate discarding a recorded audio file.
 */
export async function discardRecordingStub(): Promise<void> {
  // Simulates removing temporary audio cache file
}

/**
 * Stub to simulate sending an encrypted voice message.
 */
export async function sendVoiceMessageStub(params: SendVoiceMessageParams): Promise<void> {
  // Simulates encrypting audio buffer and transmitting payload via RMQTT
}

/**
 * Stub to simulate playing preview audio.
 */
export async function playPreviewStub(): Promise<void> {
  // Simulates playing back recorded audio locally
}

/**
 * Stub to simulate stopping preview audio.
 */
export async function stopPreviewStub(): Promise<void> {
  // Simulates stopping local playback
}

/**
 * Formats a duration in seconds to MM:SS string (e.g., 5 -> "00:05", 65 -> "01:05").
 */
export function formatRecordingTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const formattedMins = mins < 10 ? `0${mins}` : `${mins}`;
  const formattedSecs = secs < 10 ? `0${secs}` : `${secs}`;
  return `${formattedMins}:${formattedSecs}`;
}
