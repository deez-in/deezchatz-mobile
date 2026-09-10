import React, { useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";

import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { StyledText } from "@/src/components/ui";
import { useThemedStyles } from "@/src/hooks/useTheme";
import { Message } from "@/src/models/db";
import { formatMessageTime } from "@/src/utils/helpers";

import ImageViewer from "./ImageViewer";

export interface ImageMessageBubbleProps {
  message: Message;
  onPress?: (uri: string, caption?: string) => void;
}

export default function ImageMessageBubble({
  message,
  onPress,
}: ImageMessageBubbleProps) {
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const themedStyles = useThemedStyles((colors) => ({
    sentBubble: {
      alignSelf: "flex-end",
      backgroundColor: colors.primary,
      borderRadius: 20,
      borderCurve: "continuous",
      borderBottomRightRadius: 4,
      padding: 4,
      marginVertical: 4,
      maxWidth: "80%",
    },
    receivedBubble: {
      alignSelf: "flex-start",
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderCurve: "continuous",
      borderBottomLeftRadius: 4,
      padding: 4,
      marginVertical: 4,
      maxWidth: "80%",
    },
    captionContainer: {
      paddingHorizontal: 8,
      paddingTop: 6,
      paddingBottom: 2,
    },
    captionSent: {
      color: colors.onPrimary,
      fontSize: 15,
      lineHeight: 21,
    },
    captionReceived: {
      color: colors.onBackground,
      fontSize: 15,
      lineHeight: 21,
    },
    timestampRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 3,
      paddingHorizontal: 8,
      paddingBottom: 4,
      paddingTop: 2,
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
    overlayPill: {
      position: "absolute",
      bottom: 8,
      right: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(0, 0, 0, 0.55)",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 12,
    },
    overlayTimestamp: {
      color: "#FFFFFF",
      fontSize: 10,
    },
  }));

  const isMe = message.sender_id === "me" || message.sender_id === "self";
  const displayTimestamp = isMe
    ? message.created_at
    : (message.received_at ?? message.created_at);

  const hasCaption = Boolean(message.caption && message.caption.trim().length > 0);

  const handlePress = () => {
    if (onPress) {
      onPress(message.content, message.caption);
    } else {
      setIsViewerOpen(true);
    }
  };

  const statusIcon = isMe
    ? getStatusIcon(message.status, hasCaption ? "rgba(255,255,255,0.7)" : "#FFFFFF")
    : null;

  return (
    <>
      <View
        testID="image-message-bubble"
        style={isMe ? themedStyles.sentBubble : themedStyles.receivedBubble}
      >
        <Pressable
          testID="image-bubble-pressable"
          onPress={handlePress}
          style={({ pressed }) => [
            styles.imageWrapper,
            pressed && styles.imagePressed,
          ]}
        >
          <Image
            source={{ uri: message.content }}
            style={[
              styles.image,
              hasCaption
                ? styles.imageWithCaption
                : isMe
                ? styles.imageSentNoCaption
                : styles.imageReceivedNoCaption,
            ]}
            contentFit="cover"
            transition={200}
          />

          {!hasCaption && (
            <View style={themedStyles.overlayPill}>
              <StyledText style={themedStyles.overlayTimestamp}>
                {formatMessageTime(displayTimestamp)}
              </StyledText>
              {statusIcon}
            </View>
          )}
        </Pressable>

        {hasCaption && (
          <>
            <View style={themedStyles.captionContainer}>
              <StyledText
                testID="image-caption"
                style={isMe ? themedStyles.captionSent : themedStyles.captionReceived}
              >
                {message.caption}
              </StyledText>
            </View>
            <View style={themedStyles.timestampRow}>
              <StyledText
                style={
                  isMe
                    ? themedStyles.timestampSent
                    : themedStyles.timestampReceived
                }
              >
                {formatMessageTime(displayTimestamp)}
              </StyledText>
              {statusIcon}
            </View>
          </>
        )}
      </View>

      {isViewerOpen && (
        <ImageViewer
          visible={isViewerOpen}
          uri={message.content}
          caption={message.caption}
          onClose={() => setIsViewerOpen(false)}
        />
      )}
    </>
  );
}

function getStatusIcon(
  status: Message["status"],
  color: string = "rgba(255,255,255,0.7)"
): React.ReactNode {
  switch (status) {
    case "pending":
      return <Ionicons name="time-outline" size={12} color={color} />;
    case "failed":
      return <Ionicons name="alert-circle" size={14} color="#FF4444" />;
    case "sent":
      return <Ionicons name="checkmark" size={13} color={color} />;
    case "delivered":
      return <Ionicons name="checkmark-done" size={13} color={color} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  imageWrapper: {
    position: "relative",
    overflow: "hidden",
  },
  imagePressed: {
    opacity: 0.9,
  },
  image: {
    width: 240,
    height: 240,
    maxWidth: "100%",
    backgroundColor: "rgba(0, 0, 0, 0.05)",
  },
  imageWithCaption: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  imageSentNoCaption: {
    borderRadius: 16,
    borderBottomRightRadius: 4,
  },
  imageReceivedNoCaption: {
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
});
