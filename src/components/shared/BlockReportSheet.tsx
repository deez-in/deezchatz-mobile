import React, { useState } from "react";
import { View, Pressable, Platform, Switch, Dimensions } from "react-native";

import { BottomSheet, Button, RNHostView, Host } from "@expo/ui";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { useTheme, useThemedStyles } from "@/src/hooks/useTheme";
import { StyledText } from "@/src/components/ui";

export interface BlockReportSheetProps {
    isPresented: boolean;
    onDismiss: () => void;
    contactName: string;
    onConfirmBlock: (shouldReport: boolean) => void;
}


export default function BlockReportSheet({
  isPresented,
  onDismiss,
  contactName,
  onConfirmBlock,
}: BlockReportSheetProps) {
  const { colors } = useTheme();
  const [reportUser, setReportUser] = useState(false);

  const styles = useThemedStyles((colors) => ({
    container: {
      width: Dimensions.get("window").width,
      paddingHorizontal: 20,
      backgroundColor: colors.surface,
      paddingTop: 16,
      paddingBottom: 24,
      gap: 16
    },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 12,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surfaceVariant,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    title: {
      fontSize: 18,
      fontWeight: "700" as const,
      color: colors.onSurface,
    },
    description: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      lineHeight: 18,
    },
    reportCard: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      marginBottom: 4,
      backgroundColor: colors.surfaceVariant,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      width: "100%" as const,
    },
    reportCardTextContainer: {
      flex: 1,
      marginRight: 12,
      gap: 1,
    },
    reportLabel: {
      fontSize: 14,
      fontWeight: "600" as const,
      color: colors.onSurface,
    },
    reportSubtext: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      lineHeight: 16,
    },
    buttonRow: {
      flexDirection: "row" as const,
      gap: 12,
      width: "100%" as const,
    },
    blockButton: {
      width: (Dimensions.get("window").width - 52) / 2,
    },
    blockButtonText: {
      color: colors.onError,
      fontSize: 15,
      fontWeight: "700" as const,
    },
    cancelButton: {
      width: (Dimensions.get("window").width - 52) / 2,
    },
    cancelButtonText: {
      color: colors.onSurfaceVariant,
      fontSize: 15,
      fontWeight: "600" as const,
    },
  }));

  const handleConfirm = () => {
    onConfirmBlock(reportUser);
    onDismiss();
  };

  return (
    <BottomSheet
      isPresented={isPresented}
      onDismiss={onDismiss}
      showDragIndicator={true}
    >
      <RNHostView matchContents>
        <View style={styles.container}>
          {/* Header: icon + title/description side-by-side */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="shield-alert-outline"
                size={24}
                color={colors.error as string}
              />
            </View>
            <View style={styles.headerText}>
              <StyledText style={styles.title}>Block {contactName}?</StyledText>
              <StyledText style={styles.description}>
                They won&apos;t receive your messages or know they&apos;re blocked.
              </StyledText>
            </View>
          </View>

          {/* Report toggle card */}
          <Pressable
            style={styles.reportCard}
            onPress={() => setReportUser((prev) => !prev)}
          >
            <View style={styles.reportCardTextContainer}>
              <StyledText style={styles.reportLabel}>Report User</StyledText>
              <StyledText style={styles.reportSubtext}>
                Upload the last 10 messages for review.
              </StyledText>
            </View>
            <Switch
              value={reportUser}
              onValueChange={setReportUser}
              trackColor={{
                false: colors.outlineVariant as string,
                true: colors.error as string,
              }}
              thumbColor={
                Platform.OS === "android"
                  ? (colors.surface as string)
                  : undefined
              }
            />
          </Pressable>

          {/* Action buttons side-by-side */}
          <View style={styles.buttonRow}>
            <Host matchContents>
              <Button
                variant="outlined"
                label="Cancel"
                onPress={onDismiss}
                style={styles.cancelButton}
              />
            </Host>
            <Host matchContents seedColor={colors.error}>
              <Button
                variant="filled"
                label={reportUser ? "Block & Report" : "Block"}
                onPress={handleConfirm}
                style={styles.blockButton}
              />
            </Host>
          </View>
        </View>
      </RNHostView>
    </BottomSheet>
  );
}
