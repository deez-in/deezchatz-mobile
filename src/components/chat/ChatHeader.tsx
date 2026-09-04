import React from "react";
import { View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MenuView } from "@expo/ui/community/menu";

import { StyledButton, StyledText } from "@/src/components/ui";
import { ContactAvatar } from "@/src/components/shared";
import { useTheme } from "@/src/hooks/useTheme";

export interface ChatHeaderProps {
  displayName: string;
  picture: string | null;
  avatarUserId: string;
  isBlocked: boolean;
  onOpenBlockReportSheet: () => void;
  onBack?: () => void;
}

export default function ChatHeader({
  displayName,
  picture,
  avatarUserId,
  isBlocked,
  onOpenBlockReportSheet,
  onBack,
}: ChatHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.header}>
      <StyledButton
        onPress={onBack || (() => router.back())}
        variant="link"
        accessibilityLabel="Go back"
      >
        <Ionicons color={colors.primary} name="chevron-back" size={24} />
      </StyledButton>

      <View style={styles.avatarWrapper}>
        <ContactAvatar
          name={displayName}
          picture={picture}
          userId={avatarUserId}
          size={36}
        />
      </View>

      <StyledText
        style={styles.headerTitle}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {displayName}
      </StyledText>

      <View style={styles.headerRight}>
        <MenuView
          style={styles.menuView}
          title="Options"
          onPressAction={({ nativeEvent }) => {
            if (nativeEvent.event === "block_report") {
              onOpenBlockReportSheet();
            }
          }}
          actions={[
            {
              id: "block_report",
              title: isBlocked ? "Report" : "Block / Report",
              attributes: {
                destructive: true,
              },
            },
          ]}
        >
          <View style={styles.menuTrigger}>
            <Ionicons
              name="ellipsis-vertical"
              size={20}
              color={colors.onBackground as string}
            />
          </View>
        </MenuView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flex: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarWrapper: {
    margin: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
  },
  headerRight: {
    marginLeft: "auto",
    marginRight: 4,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  menuView: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  menuTrigger: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
