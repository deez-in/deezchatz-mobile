import { renderHook, act } from "@testing-library/react-native";
import { useVoiceRecording } from "@/src/hooks/useVoiceRecording";

describe("useVoiceRecording hook", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("initializes with default idle state", async () => {
    const { result } = await renderHook(() => useVoiceRecording());

    expect(result.current.voiceState).toBe("idle");
    expect(result.current.recordingDuration).toBe(0);
    expect(result.current.isPlayingPreview).toBe(false);
  });

  it("transitions to recording mode and increments timer", async () => {
    const { result } = await renderHook(() => useVoiceRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.voiceState).toBe("recording");

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.recordingDuration).toBe(3);
  });

  it("does not start recording when blocked", async () => {
    const { result } = await renderHook(() => useVoiceRecording({ isBlocked: true }));

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.voiceState).toBe("idle");
  });

  it("transitions to reviewing when stopped", async () => {
    const { result } = await renderHook(() => useVoiceRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await act(async () => {
      await result.current.stopRecording();
    });

    expect(result.current.voiceState).toBe("reviewing");
    expect(result.current.recordingDuration).toBe(2);
  });

  it("discards recording and resets state to idle", async () => {
    const { result } = await renderHook(() => useVoiceRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    await act(async () => {
      jest.advanceTimersByTime(4000);
    });

    await act(async () => {
      await result.current.stopRecording();
    });

    expect(result.current.voiceState).toBe("reviewing");

    await act(async () => {
      await result.current.discardRecording();
    });

    expect(result.current.voiceState).toBe("idle");
    expect(result.current.recordingDuration).toBe(0);
    expect(result.current.isPlayingPreview).toBe(false);
  });

  it("toggles play preview", async () => {
    const { result } = await renderHook(() => useVoiceRecording());

    await act(async () => {
      await result.current.startRecording();
      await result.current.stopRecording();
    });

    expect(result.current.isPlayingPreview).toBe(false);

    await act(async () => {
      await result.current.togglePlayPreview();
    });

    expect(result.current.isPlayingPreview).toBe(true);

    await act(async () => {
      await result.current.togglePlayPreview();
    });

    expect(result.current.isPlayingPreview).toBe(false);
  });

  it("sends voice recording and resets state", async () => {
    const { result } = await renderHook(() => useVoiceRecording());

    await act(async () => {
      await result.current.startRecording();
      await result.current.stopRecording();
    });

    expect(result.current.voiceState).toBe("reviewing");

    await act(async () => {
      await result.current.sendVoiceRecording("recipient-456");
    });

    expect(result.current.voiceState).toBe("idle");
    expect(result.current.recordingDuration).toBe(0);
  });

  it("calls custom onSendVoice callback when provided", async () => {
    const mockOnSendVoice = jest.fn().mockResolvedValue(undefined);
    const { result } = await renderHook(() =>
      useVoiceRecording({ onSendVoice: mockOnSendVoice })
    );

    await act(async () => {
      await result.current.startRecording();
      await result.current.stopRecording();
    });

    expect(result.current.voiceState).toBe("reviewing");

    await act(async () => {
      await result.current.sendVoiceRecording();
    });

    expect(mockOnSendVoice).toHaveBeenCalledWith(
      expect.stringContaining(".opus"),
      expect.any(Number)
    );
    expect(result.current.voiceState).toBe("idle");
  });

  it("automatically stops recording at 60 seconds", async () => {
    const { result } = await renderHook(() => useVoiceRecording());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.voiceState).toBe("recording");

    await act(async () => {
      jest.advanceTimersByTime(60000);
    });

    expect(result.current.recordingDuration).toBe(60);
    expect(result.current.voiceState).toBe("reviewing");
  });
});
