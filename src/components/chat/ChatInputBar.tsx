import React, { useCallback, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { StyledButton, StyledTextInput } from "@/src/components/ui";
import VoiceRecordBar from "@/src/components/chat/VoiceRecordBar";
import { useTheme } from "@/src/hooks/useTheme";
import { VoiceState } from "@/src/hooks/useVoiceRecording";

export interface ChatInputBarProps {
  message: string;
  onChangeMessage: (text: string) => void;
  onSendMessage: (text: string) => void;
  voiceState: VoiceState;
  recordingDuration: number;
  isPlayingPreview: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onDiscardRecording: () => void;
  onSendVoiceRecording: () => void;
  onTogglePlayPreview: () => void;
  voiceStateRef: React.RefObject<VoiceState>;
  isRecordingJustStoppedRef: React.RefObject<boolean>;
  isBlocked: boolean;
  paddingBottom: number;
}

export default function ChatInputBar({
  message,
  onChangeMessage,
  onSendMessage,
  voiceState,
  recordingDuration,
  isPlayingPreview,
  onStartRecording,
  onStopRecording,
  onDiscardRecording,
  onSendVoiceRecording,
  onTogglePlayPreview,
  voiceStateRef,
  isRecordingJustStoppedRef,
  isBlocked,
  paddingBottom,
}: ChatInputBarProps) {
  const { colors } = useTheme();

  const handleActionButtonPressIn = useCallback(() => {
    if (voiceStateRef.current === "idle" && message.trim().length === 0) {
      onStartRecording();
    }
  }, [message, onStartRecording, voiceStateRef]);

  const handleActionButtonPressOut = useCallback(() => {
    if (voiceStateRef.current === "recording") {
      (isRecordingJustStoppedRef as React.MutableRefObject<boolean>).current = true;
      onStopRecording();
      setTimeout(() => {
        (isRecordingJustStoppedRef as React.MutableRefObject<boolean>).current = false;
      }, 150);
    }
  }, [onStopRecording, voiceStateRef, isRecordingJustStoppedRef]);

  const handleActionButtonPress = () => {
    if (isRecordingJustStoppedRef.current) {
      (isRecordingJustStoppedRef as React.MutableRefObject<boolean>).current = false;
      return;
    }

    if (voiceStateRef.current === "idle") {
      if (message.trim().length > 0) {
        onSendMessage(message);
      }
    } else if (voiceStateRef.current === "recording") {
      onStopRecording();
    } else if (voiceStateRef.current === "reviewing") {
      onSendVoiceRecording();
    }
  };

  const actionButtonConfig = useMemo(() => {
    if (voiceState === "recording") {
      return {
        icon: "mic" as const,
        iconColor: "#FFFFFF",
        style: [styles.messageButton, styles.recordingMicButton],
        testID: "voice-recording-mic-button",
        accessibilityLabel: "Release to finish recording",
      };
    }
    if (voiceState === "reviewing") {
      return {
        icon: "send" as const,
        iconColor: colors.onPrimary as string,
        style: styles.messageButton,
        testID: "voice-send-button",
        accessibilityLabel: "Send voice message",
      };
    }
    if (message.trim().length > 0) {
      return {
        icon: "send" as const,
        iconColor: colors.onPrimary as string,
        style: styles.messageButton,
        testID: "send-message-button",
        accessibilityLabel: "Send message",
      };
    }
    return {
      icon: "mic" as const,
      iconColor: colors.onPrimary as string,
      style: styles.messageButton,
      testID: "voice-mic-button",
      accessibilityLabel: "Record voice message",
    };
  }, [voiceState, message, colors.onPrimary]);

  return (
    <View
      style={StyleSheet.flatten([
        styles.messageBar,
        { paddingBottom, backgroundColor: colors.background },
      ])}
    >
      {voiceState === "idle" ? (
        <StyledTextInput
          style={styles.messageInput}
          placeholder={isBlocked ? "You have blocked this contact" : "Send message"}
          value={message}
          onChangeText={onChangeMessage}
          multiline
          editable={!isBlocked}
        />
      ) : (
        <VoiceRecordBar
          mode={voiceState}
          durationSeconds={recordingDuration}
          onDiscard={onDiscardRecording}
          onTogglePlayPreview={onTogglePlayPreview}
          isPlayingPreview={isPlayingPreview}
        />
      )}

      <StyledButton
        onPress={handleActionButtonPress}
        onPressIn={handleActionButtonPressIn}
        onPressOut={handleActionButtonPressOut}
        style={actionButtonConfig.style}
        disabled={isBlocked}
        testID={actionButtonConfig.testID}
        accessibilityLabel={actionButtonConfig.accessibilityLabel}
      >
        <Ionicons
          name={actionButtonConfig.icon}
          size={24}
          color={actionButtonConfig.iconColor}
        />
      </StyledButton>
    </View>
  );
}

const styles = StyleSheet.create({
  messageBar: {
    flex: 0,
    width: "100%",
    alignItems: "center",
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  messageInput: {
    borderRadius: 25,
    padding: 12,
    flex: 1,
    margin: 4,
    maxHeight: 120,
    alignSelf: "center",
  },
  messageButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    margin: 4,
    borderRadius: 25,
  },
  recordingMicButton: {
    backgroundColor: "#FF453A",
  },
});
