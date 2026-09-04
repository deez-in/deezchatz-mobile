import { useCallback } from "react";
import { useVoicePlayerStore } from "@/src/store/useVoicePlayerStore";

export function useVoicePlayer(uri: string) {
  const activeUri = useVoicePlayerStore((s) => s.activeUri);
  const isPlaying = useVoicePlayerStore((s) => s.activeUri === uri && s.isPlaying);
  const positionMs = useVoicePlayerStore((s) => (s.activeUri === uri ? s.positionMs : 0));
  const durationMs = useVoicePlayerStore((s) => (s.activeUri === uri ? s.durationMs : 0));

  const toggle = useVoicePlayerStore((s) => s.togglePlayPause);
  const seekToMs = useVoicePlayerStore((s) => s.seek);

  const togglePlayPause = useCallback(() => {
    toggle(uri);
  }, [toggle, uri]);

  const seek = useCallback(
    (ratio: number) => {
      if (durationMs > 0) {
        seekToMs(Math.round(ratio * durationMs));
      }
    },
    [seekToMs, durationMs]
  );

  const progress = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;

  return {
    isActive: activeUri === uri,
    isPlaying,
    positionMs,
    durationMs,
    progress,
    togglePlayPause,
    seek,
  };
}

export default useVoicePlayer;
