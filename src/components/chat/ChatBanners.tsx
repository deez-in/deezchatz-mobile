import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { StyledText } from "@/src/components/ui";
import { useThemedStyles } from "@/src/hooks/useTheme";

export interface ChatBannersProps {
  isBlocked: boolean;
  onUnblock: () => void;
  showKeyChangeBanner: boolean;
  onDismissKeyChange: () => void;
  contactName?: string;
  isUserNotFound: boolean;
}

export default function ChatBanners({
  isBlocked,
  onUnblock,
  showKeyChangeBanner,
  onDismissKeyChange,
  contactName,
  isUserNotFound,
}: ChatBannersProps) {
  const themedStyles = useThemedStyles((colors) => ({
    userNotFoundContainer: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      alignItems: "center" as const,
      backgroundColor: colors.surface,
    },
    userNotFoundText: {
      color: colors.onSurfaceVariant as string,
      textAlign: "center" as const,
      fontSize: 13,
    },
    keyChangeBanner: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.outlineVariant,
      gap: 10,
    },
    keyChangeBannerText: {
      flex: 1,
      color: colors.onSurfaceVariant as string,
      fontSize: 13,
      lineHeight: 18,
    },
    keyChangeDismiss: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    keyChangeDismissText: {
      color: colors.primary as string,
      fontSize: 13,
      fontWeight: "600" as const,
    },
    blockedBanner: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.outlineVariant,
      gap: 10,
    },
    blockedBannerText: {
      flex: 1,
      color: colors.error as string,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "500" as const,
    },
    unblockButton: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 6,
      backgroundColor: colors.surfaceVariant,
    },
    unblockButtonText: {
      color: colors.onSurface as string,
      fontSize: 13,
      fontWeight: "600" as const,
    },
  }));

  return (
    <>
      {isBlocked && (
        <View style={themedStyles.blockedBanner}>
          <Ionicons name="ban" size={16} color="#FF453A" />
          <StyledText style={themedStyles.blockedBannerText}>
            You have blocked this contact.
          </StyledText>
          <Pressable
            style={themedStyles.unblockButton}
            onPress={onUnblock}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Unblock contact"
          >
            <StyledText style={themedStyles.unblockButtonText}>Unblock</StyledText>
          </Pressable>
        </View>
      )}

      {showKeyChangeBanner && (
        <View style={themedStyles.keyChangeBanner}>
          <Ionicons name="lock-closed" size={16} color="#8E8E93" />
          <StyledText style={themedStyles.keyChangeBannerText}>
            Security info changed for {contactName || "this contact"}. Messages
            will use a new session.
          </StyledText>
          <Pressable
            style={themedStyles.keyChangeDismiss}
            onPress={onDismissKeyChange}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss security change notice"
          >
            <StyledText style={themedStyles.keyChangeDismissText}>
              Dismiss
            </StyledText>
          </Pressable>
        </View>
      )}

      {isUserNotFound && (
        <View style={themedStyles.userNotFoundContainer}>
          <StyledText style={themedStyles.userNotFoundText}>
            This Contact isn&apos;t using Deez Chatz yet.
          </StyledText>
        </View>
      )}
    </>
  );
}
