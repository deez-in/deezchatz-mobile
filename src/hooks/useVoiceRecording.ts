import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";

import {
  requestAudioPermissions,
  getAudioPermissions,
  startAudioRecording,
  stopAudioRecording,
  discardAudioRecording,
  playPreviewAudio,
  stopPreviewAudio,
  sendVoiceMessage,
  addPlaybackStatusListener,
} from "@/src/utils/audio";

export type VoiceState = "idle" | "recording" | "reviewing";

export interface UseVoiceRecordingOptions {
  isBlocked?: boolean;
}

export function useVoiceRecording(options: UseVoiceRecordingOptions = {}) {
  const { isBlocked = false } = options;

  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);

  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingDurationRef = useRef(0);
  const voiceStateRef = useRef<VoiceState>(voiceState);
  const recordedUriRef = useRef<string | null>(null);
  const isRecordingJustStoppedRef = useRef(false);

  useEffect(() => {
    recordingDurationRef.current = recordingDuration;
  }, [recordingDuration]);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    recordedUriRef.current = recordedUri;
  }, [recordedUri]);

  // Clean up timer, playback listener, and active recording on unmount
  useEffect(() => {
    const playbackSubscription = addPlaybackStatusListener((status) => {
      if (status.didJustFinish) {
        setIsPlayingPreview(false);
      }
    });

    return () => {
      playbackSubscription.remove();
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      stopPreviewAudio().catch(() => {});
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (isBlocked) return;

    // Check or request microphone permission
    const currentPermission = await getAudioPermissions();
    if (!currentPermission.granted) {
      const requestResult = await requestAudioPermissions();
      if (!requestResult.granted) {
        Alert.alert(
          "Permission Required",
          "Microphone access is required to record voice messages.",
          [{ text: "OK", style: "cancel" }]
        );
        return;
      }
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics not supported in some environments
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    setRecordingDuration(0);
    recordingDurationRef.current = 0;
    setRecordedUri(null);
    recordedUriRef.current = null;
    voiceStateRef.current = "recording";
    setVoiceState("recording");
    setIsPlayingPreview(false);

    try {
      await startAudioRecording();
    } catch {
      voiceStateRef.current = "idle";
      setVoiceState("idle");
      Alert.alert("Recording Error", "Unable to start audio recording.", [
        { text: "OK", style: "cancel" },
      ]);
      return;
    }

    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);
  }, [isBlocked]);

  const stopRecording = useCallback(async () => {
    if (voiceStateRef.current !== "recording") return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics not supported in some environments
    }

    const measuredDuration = recordingDurationRef.current;

    try {
      const result = await stopAudioRecording();
      const finalDuration =
        measuredDuration > 0 ? measuredDuration : (result.durationSeconds ?? 0);
      setRecordingDuration(finalDuration);
      recordingDurationRef.current = finalDuration;

      if (result.uri) {
        setRecordedUri(result.uri);
        recordedUriRef.current = result.uri;
      }
    } catch {
      // Retain the measured duration if native stop fails
    }

    voiceStateRef.current = "reviewing";
    setVoiceState("reviewing");
  }, []);

  const discardRecording = useCallback(async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics not supported in some environments
    }

    const uriToDiscard = recordedUriRef.current;
    await discardAudioRecording(uriToDiscard ?? undefined);

    voiceStateRef.current = "idle";
    setVoiceState("idle");
    setRecordingDuration(0);
    recordingDurationRef.current = 0;
    setRecordedUri(null);
    recordedUriRef.current = null;
    setIsPlayingPreview(false);
  }, []);

  const sendVoiceRecording = useCallback(
    async (recipientId: string) => {
      if (voiceStateRef.current !== "reviewing") return;

      const duration = recordingDurationRef.current;
      const uri = recordedUriRef.current;

      if (isPlayingPreview) {
        await stopPreviewAudio();
      }

      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Haptics not supported in some environments
      }

      await sendVoiceMessage({
        recipientId,
        duration,
        uri: uri ?? undefined,
      });

      voiceStateRef.current = "idle";
      setVoiceState("idle");
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      setRecordedUri(null);
      recordedUriRef.current = null;
      setIsPlayingPreview(false);
    },
    [isPlayingPreview]
  );

  const togglePlayPreview = useCallback(async () => {
    const uri = recordedUriRef.current;
    if (isPlayingPreview) {
      await stopPreviewAudio();
      setIsPlayingPreview(false);
    } else if (uri) {
      await playPreviewAudio(uri);
      setIsPlayingPreview(true);
    }
  }, [isPlayingPreview]);

  return {
    voiceState,
    recordingDuration,
    isPlayingPreview,
    recordedUri,
    voiceStateRef,
    isRecordingJustStoppedRef,
    startRecording,
    stopRecording,
    discardRecording,
    sendVoiceRecording,
    togglePlayPreview,
  };
}

export default useVoiceRecording;
