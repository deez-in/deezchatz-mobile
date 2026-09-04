import { act } from "@testing-library/react-native";
import { useVoicePlayerStore } from "@/src/store/useVoicePlayerStore";
import ExpoAudioOpus from "expo-audio-opus";

describe("useVoicePlayerStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useVoicePlayerStore.setState({
      activeUri: null,
      isPlaying: false,
      positionMs: 0,
      durationMs: 0,
    });
  });

  it("plays a new audio uri and updates store state", async () => {
    const uri = "file:///mock/documents/media/voice/sample.opus";

    await act(async () => {
      await useVoicePlayerStore.getState().play(uri);
    });

    expect(ExpoAudioOpus.startPlayback).toHaveBeenCalledWith(uri);
    const state = useVoicePlayerStore.getState();
    expect(state.activeUri).toBe(uri);
    expect(state.isPlaying).toBe(true);
    expect(state.durationMs).toBe(5000);
  });

  it("pauses and resumes playback for same uri", async () => {
    const uri = "file:///mock/documents/media/voice/sample.opus";

    await act(async () => {
      await useVoicePlayerStore.getState().play(uri);
    });

    await act(async () => {
      await useVoicePlayerStore.getState().pause();
    });

    expect(ExpoAudioOpus.pausePlayback).toHaveBeenCalled();
    expect(useVoicePlayerStore.getState().isPlaying).toBe(false);

    await act(async () => {
      await useVoicePlayerStore.getState().play(uri);
    });

    expect(ExpoAudioOpus.resumePlayback).toHaveBeenCalled();
    expect(useVoicePlayerStore.getState().isPlaying).toBe(true);
  });

  it("stops playback and resets state", async () => {
    const uri = "file:///mock/documents/media/voice/sample.opus";

    await act(async () => {
      await useVoicePlayerStore.getState().play(uri);
      await useVoicePlayerStore.getState().stop();
    });

    expect(ExpoAudioOpus.stopPlayback).toHaveBeenCalled();
    const state = useVoicePlayerStore.getState();
    expect(state.activeUri).toBeNull();
    expect(state.isPlaying).toBe(false);
  });

  it("toggles play/pause correctly", async () => {
    const uri = "file:///mock/documents/media/voice/sample.opus";

    await act(async () => {
      await useVoicePlayerStore.getState().togglePlayPause(uri);
    });
    expect(useVoicePlayerStore.getState().isPlaying).toBe(true);

    await act(async () => {
      await useVoicePlayerStore.getState().togglePlayPause(uri);
    });
    expect(useVoicePlayerStore.getState().isPlaying).toBe(false);
  });

  it("seeks playback position", async () => {
    await act(async () => {
      await useVoicePlayerStore.getState().seek(2500);
    });

    expect(ExpoAudioOpus.seekTo).toHaveBeenCalledWith(2500);
    expect(useVoicePlayerStore.getState().positionMs).toBe(2500);
  });

  it("replays audio from the beginning with startPlayback after it has finished playing", async () => {
    const uri = "file:///mock/documents/media/voice/sample.opus";

    await act(async () => {
      await useVoicePlayerStore.getState().play(uri);
    });
    expect(ExpoAudioOpus.startPlayback).toHaveBeenCalledWith(uri);

    // Simulate playback reaching the end (didJustFinish)
    useVoicePlayerStore.setState({
      activeUri: uri,
      isPlaying: false,
      isPaused: false,
      positionMs: 0,
      durationMs: 5000,
    });

    jest.clearAllMocks();

    // User taps play again on the same message
    await act(async () => {
      await useVoicePlayerStore.getState().togglePlayPause(uri);
    });

    // Must call startPlayback (restarting track), NOT resumePlayback!
    expect(ExpoAudioOpus.startPlayback).toHaveBeenCalledWith(uri);
    expect(ExpoAudioOpus.resumePlayback).not.toHaveBeenCalled();
    expect(useVoicePlayerStore.getState().isPlaying).toBe(true);
  });

  it("does not allow stale in-flight bridge events to overwrite paused state", async () => {
    const uri = "file:///mock/documents/media/voice/sample.opus";

    await act(async () => {
      await useVoicePlayerStore.getState().play(uri);
    });
    expect(useVoicePlayerStore.getState().isPlaying).toBe(true);

    // User pauses
    await act(async () => {
      await useVoicePlayerStore.getState().pause();
    });
    expect(useVoicePlayerStore.getState().isPlaying).toBe(false);
    expect(useVoicePlayerStore.getState().isPaused).toBe(true);

    // Simulate in-flight bridge event arriving with isPlaying: true
    const { mockEmitPlaybackStatus } = require("@/tests/setup");
    await act(async () => {
      mockEmitPlaybackStatus({
        isPlaying: true,
        isPaused: false,
        positionMs: 1500,
        durationMs: 5000,
        didJustFinish: false,
      });
    });

    // Must remain paused!
    expect(useVoicePlayerStore.getState().isPlaying).toBe(false);
    expect(useVoicePlayerStore.getState().isPaused).toBe(true);
    expect(useVoicePlayerStore.getState().positionMs).toBe(1500);
  });
});
