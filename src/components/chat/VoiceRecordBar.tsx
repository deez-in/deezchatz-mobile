import React, { useEffect, useState } from "react";
import {
  View,
  Pressable,
  Animated,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { StyledText } from "@/src/components/ui";
import { useThemedStyles } from "@/src/hooks/useTheme";
import { formatRecordingTime } from "@/src/utils/audio";

export interface VoiceRecordBarProps {
  mode: "recording" | "reviewing";
  durationSeconds: number;
  onDiscard: () => void;
  onTogglePlayPreview?: () => void;
  isPlayingPreview?: boolean;
}

const WAVE_HEIGHTS = [
  12, 22, 16, 28, 14, 20, 26, 18, 24, 15, 30, 20, 14, 26, 18, 12, 22, 16,
];

export default function VoiceRecordBar({
  mode,
  durationSeconds,
  onDiscard,
  onTogglePlayPreview,
  isPlayingPreview = false,
}: VoiceRecordBarProps) {
  const [pulseAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (mode === "recording") {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [mode, pulseAnim]);

  const themedStyles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderRadius: 25,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginHorizontal: 4,
      height: 48,
      gap: 10,
    },
    recordingIndicator: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.error,
    },
    timeText: {
      fontSize: 15,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
      color: colors.onSurface,
      minWidth: 44,
    },
    recordingLabel: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      marginLeft: "auto",
    },
    waveformContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 2.5,
      height: 32,
      overflow: "hidden",
    },
    waveBar: {
      width: 3,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    waveBarInactive: {
      width: 3,
      borderRadius: 2,
      backgroundColor: colors.outlineVariant,
    },
    deleteButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceVariant,
    },
    playButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
  }));

  if (mode === "recording") {
    return (
      <View style={themedStyles.container} testID="voice-recording-bar">
        <Animated.View
          style={[themedStyles.recordingIndicator, { opacity: pulseAnim }]}
          testID="recording-indicator"
        />
        <StyledText style={themedStyles.timeText} testID="recording-timer">
          {formatRecordingTime(durationSeconds)}
        </StyledText>
        <View style={themedStyles.waveformContainer}>
          {WAVE_HEIGHTS.map((h, index) => (
            <View
              key={index}
              style={[
                themedStyles.waveBar,
                { height: h, opacity: 0.5 + ((index % 3) * 0.2) },
              ]}
            />
          ))}
        </View>
        <StyledText style={themedStyles.recordingLabel}>Recording...</StyledText>
      </View>
    );
  }

  return (
    <View style={themedStyles.container} testID="voice-review-bar">
      <Pressable
        style={themedStyles.deleteButton}
        onPress={onDiscard}
        hitSlop={8}
        testID="voice-delete-button"
        accessibilityLabel="Delete voice recording"
      >
        <Ionicons name="trash-outline" size={18} color="#FF453A" />
      </Pressable>

      {onTogglePlayPreview && (
        <Pressable
          style={themedStyles.playButton}
          onPress={onTogglePlayPreview}
          hitSlop={6}
          testID="voice-play-preview-button"
          accessibilityLabel={isPlayingPreview ? "Pause voice preview" : "Play voice preview"}
        >
          <Ionicons
            name={isPlayingPreview ? "pause" : "play"}
            size={16}
            color="#FFFFFF"
          />
        </Pressable>
      )}

      <View style={themedStyles.waveformContainer}>
        {WAVE_HEIGHTS.map((h, index) => (
          <View
            key={index}
            style={[
              isPlayingPreview && index < 8
                ? themedStyles.waveBar
                : themedStyles.waveBarInactive,
              { height: h },
            ]}
          />
        ))}
      </View>

      <StyledText style={themedStyles.timeText} testID="voice-review-duration">
        {formatRecordingTime(durationSeconds)}
      </StyledText>
    </View>
  );
}
