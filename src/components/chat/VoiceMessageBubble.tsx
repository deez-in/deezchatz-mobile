import React, { useMemo } from "react";
import { View, Pressable, GestureResponderEvent } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { StyledText } from "@/src/components/ui";
import { useTheme, useThemedStyles } from "@/src/hooks/useTheme";
import { Message } from "@/src/models/db";
import { formatMessageTime } from "@/src/utils/helpers/formatting";
import { formatRecordingTime } from "@/src/utils/audio";
import { useVoicePlayer } from "@/src/hooks/useVoicePlayer";

export interface VoiceMessageBubbleProps {
  message: Message;
}

const DEFAULT_WAVE_HEIGHTS = [
  8, 14, 22, 12, 18, 26, 14, 20, 24, 16, 28, 18, 12, 22, 16, 10, 18, 24, 14, 8,
];

export default function VoiceMessageBubble({ message }: VoiceMessageBubbleProps) {
  const { colors } = useTheme();
  const isMe = message.sender_id === "me" || message.sender_id === "self";
  const uri = message.content;

  const { isPlaying, progress, positionMs, durationMs, togglePlayPause, seek } =
    useVoicePlayer(uri);

  const themedStyles = useThemedStyles((themeColors) => ({
    sentBubble: {
      alignSelf: "flex-end",
      backgroundColor: themeColors.primary,
      borderRadius: 20,
      borderCurve: "continuous",
      borderBottomRightRadius: 4,
      padding: 10,
      paddingHorizontal: 12,
      marginVertical: 4,
      minWidth: 220,
      maxWidth: "85%",
    },
    receivedBubble: {
      alignSelf: "flex-start",
      backgroundColor: themeColors.surface,
      borderRadius: 20,
      borderCurve: "continuous",
      borderBottomLeftRadius: 4,
      padding: 10,
      paddingHorizontal: 12,
      marginVertical: 4,
      minWidth: 220,
      maxWidth: "85%",
    },
    bodyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    playButtonSent: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: themeColors.onPrimary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 2,
    },
    playButtonReceived: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: themeColors.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 2,
    },
    waveformAndMeta: {
      flex: 1,
      justifyContent: "center",
      gap: 4,
    },
    waveformContainer: {
      flexDirection: "row",
      alignItems: "center",
      height: 30,
      gap: 3,
    },
    waveBarActiveSent: {
      width: 3,
      borderRadius: 2,
      backgroundColor: colors.onPrimary,
    },
    waveBarInactiveSent: {
      width: 3,
      borderRadius: 2,
      backgroundColor: "rgba(255, 255, 255, 0.4)",
    },
    waveBarActiveReceived: {
      width: 3,
      borderRadius: 2,
      backgroundColor: colors.primary,
    },
    waveBarInactiveReceived: {
      width: 3,
      borderRadius: 2,
      backgroundColor: colors.outlineVariant,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 2,
    },
    durationTextSent: {
      color: colors.onPrimary,
      fontSize: 12,
      fontVariant: ["tabular-nums"],
      opacity: 0.9,
    },
    durationTextReceived: {
      color: colors.onSurfaceVariant,
      fontSize: 12,
      fontVariant: ["tabular-nums"],
    },
    timestampRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    timestampSent: {
      color: colors.onPrimary,
      opacity: 0.8,
      fontSize: 10,
    },
    timestampReceived: {
      color: colors.onSurfaceVariant,
      fontSize: 10,
    },
    failedIndicator: {
      marginLeft: 2,
    },
  }));

  const activeBarCount = useMemo(() => {
    return Math.floor(progress * DEFAULT_WAVE_HEIGHTS.length);
  }, [progress]);

  const handleWaveformPress = (e: GestureResponderEvent) => {
    const { locationX } = e.nativeEvent;
    // Calculate ratio based on container width or bar layout
    const totalBars = DEFAULT_WAVE_HEIGHTS.length;
    const approximateWidth = totalBars * 6; // 3px width + 3px gap
    const ratio = Math.max(0, Math.min(1, locationX / approximateWidth));
    seek(ratio);
  };

  const displayTime = useMemo(() => {
    if (isPlaying || positionMs > 0) {
      return formatRecordingTime(Math.floor(positionMs / 1000));
    }
    if (durationMs > 0) {
      return formatRecordingTime(Math.round(durationMs / 1000));
    }
    return "00:00";
  }, [isPlaying, positionMs, durationMs]);

  const statusIcon = isMe ? getStatusIcon(message.status, themedStyles) : null;
  const displayTimestamp = isMe
    ? message.created_at
    : (message.received_at ?? message.created_at);

  return (
    <View
      style={isMe ? themedStyles.sentBubble : themedStyles.receivedBubble}
      testID="voice-message-bubble"
    >
      <View style={themedStyles.bodyRow}>
        <Pressable
          style={isMe ? themedStyles.playButtonSent : themedStyles.playButtonReceived}
          onPress={togglePlayPause}
          hitSlop={6}
          testID="voice-play-button"
          accessibilityLabel={isPlaying ? "Pause voice message" : "Play voice message"}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={20}
            color={isMe ? (colors.primary as string) : (colors.onPrimary as string)}
            style={{ marginLeft: isPlaying ? 0 : 2 }}
          />
        </Pressable>

        <View style={themedStyles.waveformAndMeta}>
          <Pressable
            style={themedStyles.waveformContainer}
            onPress={handleWaveformPress}
            testID="voice-waveform"
          >
            {DEFAULT_WAVE_HEIGHTS.map((height, index) => {
              const isActive = index <= activeBarCount;
              const barStyle = isMe
                ? isActive
                  ? themedStyles.waveBarActiveSent
                  : themedStyles.waveBarInactiveSent
                : isActive
                ? themedStyles.waveBarActiveReceived
                : themedStyles.waveBarInactiveReceived;

              return (
                <View
                  key={index}
                  style={[barStyle, { height }]}
                />
              );
            })}
          </Pressable>

          <View style={themedStyles.footerRow}>
            <StyledText
              style={isMe ? themedStyles.durationTextSent : themedStyles.durationTextReceived}
              testID="voice-duration"
            >
              {displayTime}
            </StyledText>

            <View style={themedStyles.timestampRow}>
              <StyledText
                style={isMe ? themedStyles.timestampSent : themedStyles.timestampReceived}
              >
                {formatMessageTime(displayTimestamp)}
              </StyledText>
              {statusIcon}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function getStatusIcon(
  status: Message["status"],
  styles: { timestampSent: object; failedIndicator: object }
): React.ReactNode {
  switch (status) {
    case "pending":
      return (
        <Ionicons
          name="time-outline"
          size={12}
          color="rgba(255,255,255,0.6)"
          style={styles.timestampSent}
        />
      );
    case "failed":
      return (
        <Ionicons
          name="alert-circle"
          size={14}
          color="#FF4444"
          style={styles.failedIndicator}
        />
      );
    case "sent":
      return (
        <Ionicons
          name="checkmark"
          size={13}
          color="rgba(255,255,255,0.6)"
          style={styles.timestampSent}
        />
      );
    case "delivered":
      return (
        <Ionicons
          name="checkmark-done"
          size={13}
          color="rgba(255,255,255,0.6)"
          style={styles.timestampSent}
        />
      );
    default:
      return null;
  }
}
