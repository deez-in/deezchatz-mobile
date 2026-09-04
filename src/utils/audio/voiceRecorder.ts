import { File } from "expo-file-system";
import ExpoAudioOpus, {
  addRecordingMeteringListener,
  addPlaybackStatusListener,
} from "expo-audio-opus";
import type {
  RecordingOptions,
  PlaybackStatus,
  MeteringEvent,
  PermissionResponse,
} from "expo-audio-opus";

export interface VoiceRecordingResult {
  durationSeconds: number;
  uri?: string;
  fileSize?: number;
  durationMs?: number;
}

export interface SendVoiceMessageParams {
  recipientId: string;
  duration: number;
  uri?: string;
}

export const DEFAULT_RECORDING_OPTIONS: RecordingOptions = {
  sampleRate: 48000,
  channels: 1,
  bitrate: 24000,
  application: 1, // VoIP / speech mode
  enableMetering: true,
};

/**
 * Requests microphone permissions from the operating system.
 */
export async function requestAudioPermissions(): Promise<PermissionResponse> {
  return ExpoAudioOpus.requestPermissionsAsync();
}

/**
 * Checks current microphone permission status without prompting the user.
 */
export async function getAudioPermissions(): Promise<PermissionResponse> {
  return ExpoAudioOpus.getPermissionsAsync();
}

/**
 * Starts hardware voice recording with native Opus encoding into an Ogg container.
 */
export async function startAudioRecording(
  options: RecordingOptions = DEFAULT_RECORDING_OPTIONS
): Promise<void> {
  await ExpoAudioOpus.startRecording(options);
}

/**
 * Finalizes native audio recording, flushes Opus packets, and returns file metadata.
 */
export async function stopAudioRecording(): Promise<VoiceRecordingResult> {
  const result = await ExpoAudioOpus.stopRecording();
  const durationSeconds = Math.max(1, Math.round(result.durationMs / 1000));
  return {
    durationSeconds,
    durationMs: result.durationMs,
    fileSize: result.fileSize,
    uri: result.uri,
  };
}

/**
 * Discards a recorded audio file by stopping active playback and removing the temporary cache file.
 */
export async function discardAudioRecording(uri?: string): Promise<void> {
  try {
    await ExpoAudioOpus.stopPlayback();
  } catch {
    // Ignore playback stop failures when no audio was actively playing
  }

  if (uri) {
    try {
      const file = new File(uri);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Ignore cache deletion errors if file was already removed
    }
  }
}

/**
 * Plays back a local Ogg Opus recording via the native audio player.
 */
export async function playPreviewAudio(uri: string): Promise<void> {
  await ExpoAudioOpus.startPlayback(uri);
}

/**
 * Stops ongoing preview audio playback.
 */
export async function stopPreviewAudio(): Promise<void> {
  await ExpoAudioOpus.stopPlayback();
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

export async function sendVoiceMessage(
  params: SendVoiceMessageParams
): Promise<void> {
  console.log("[sendVoiceMessage stub] Voice message queued:", {
    recipientId: params.recipientId,
    duration: params.duration,
    uri: params.uri,
  });
  return;
}

export {
  addRecordingMeteringListener,
  addPlaybackStatusListener,
  PlaybackStatus,
  MeteringEvent,
  PermissionResponse,
};
