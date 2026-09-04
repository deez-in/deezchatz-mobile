import { create } from "zustand";
import ExpoAudioOpus, {
  addPlaybackStatusListener,
  PlaybackStatus,
} from "expo-audio-opus";

export interface VoicePlayerState {
  activeUri: string | null;
  isPlaying: boolean;
  isPaused: boolean;
  positionMs: number;
  durationMs: number;
  play: (uri: string) => Promise<void>;
  pause: () => Promise<void>;
  stop: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  togglePlayPause: (uri: string) => Promise<void>;
}

let statusSubscription: { remove: () => void } | null = null;

export const useVoicePlayerStore = create<VoicePlayerState>((set, get) => {
  if (!statusSubscription) {
    statusSubscription = addPlaybackStatusListener((status: PlaybackStatus) => {
      const { activeUri, durationMs, isPaused } = get();
      if (!activeUri) return;

      if (status.didJustFinish) {
        set({
          isPlaying: false,
          isPaused: false,
          positionMs: 0,
          durationMs: status.durationMs > 0 ? status.durationMs : durationMs,
        });
        return;
      }

      // If the user has paused, do NOT let a stale in-flight bridge event
      // with isPlaying: true overwrite the paused state!
      if (isPaused) {
        set({
          isPlaying: false,
          isPaused: true,
          positionMs: status.positionMs,
          durationMs: status.durationMs > 0 ? status.durationMs : durationMs,
        });
        return;
      }

      set({
        isPlaying: status.isPlaying,
        isPaused: status.isPaused,
        positionMs: status.positionMs,
        durationMs: status.durationMs > 0 ? status.durationMs : durationMs,
      });
    });
  }

  return {
    activeUri: null,
    isPlaying: false,
    isPaused: false,
    positionMs: 0,
    durationMs: 0,

    play: async (uri: string) => {
      const state = get();
      if (state.activeUri === uri && state.isPaused) {
        // Set state synchronously so UI responds with zero lag
        set({ isPlaying: true, isPaused: false });
        try {
          await ExpoAudioOpus.resumePlayback();
        } catch (e) {
          console.warn("Failed to resume audio playback:", e);
          set({ isPlaying: false, isPaused: true });
        }
        return;
      }

      // If activeUri === uri but not paused (finished or restarted), or switching tracks:
      try {
        await ExpoAudioOpus.stopPlayback();
      } catch {
        // Ignored if nothing was playing
      }

      set({
        activeUri: uri,
        isPlaying: true,
        isPaused: false,
        positionMs: 0,
      });

      try {
        const info = await ExpoAudioOpus.startPlayback(uri);
        set({
          durationMs: info?.durationMs ?? get().durationMs,
        });
      } catch (e) {
        console.error("Failed to start audio playback for URI:", uri, e);
        set({
          activeUri: null,
          isPlaying: false,
          isPaused: false,
          positionMs: 0,
          durationMs: 0,
        });
      }
    },

    pause: async () => {
      // Set state synchronously before awaiting native bridge call
      // to ensure UI updates instantly and stale in-flight events are ignored
      set({ isPlaying: false, isPaused: true });
      try {
        await ExpoAudioOpus.pausePlayback();
      } catch (e) {
        console.warn("Failed to pause audio playback:", e);
      }
    },

    stop: async () => {
      set({
        activeUri: null,
        isPlaying: false,
        isPaused: false,
        positionMs: 0,
      });
      try {
        await ExpoAudioOpus.stopPlayback();
      } catch {
        // Ignored
      }
    },

    seek: async (positionMs: number) => {
      try {
        await ExpoAudioOpus.seekTo(positionMs);
        set({ positionMs });
      } catch (e) {
        console.warn("Failed to seek audio playback:", e);
      }
    },

    togglePlayPause: async (uri: string) => {
      const state = get();
      if (state.activeUri === uri && state.isPlaying) {
        await state.pause();
      } else {
        await state.play(uri);
      }
    },
  };
});

export default useVoicePlayerStore;
