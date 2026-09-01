import { useState, useEffect } from "react";
import { View, Pressable, Dimensions } from "react-native";

import { BottomSheet, Button, RNHostView, Host } from "@expo/ui";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

import { useTheme, useThemedStyles } from "@/src/hooks/useTheme";
import { StyledText } from "@/src/components/ui";

export interface DeleteAccountSheetProps {
    isPresented: boolean;
    onDismiss: () => void;
    onConfirmDelete: () => void;
    isDeleting?: boolean;
}


export default function DeleteAccountSheet({
  isPresented,
  onDismiss,
  onConfirmDelete,
  isDeleting = false,
}: DeleteAccountSheetProps) {
  const { colors } = useTheme();
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [countdown, setCountdown] = useState(10);

  // Asynchronous countdown timer when confirmation is checked
  useEffect(() => {
    if (!isPresented || !isConfirmed || countdown <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearTimeout(timer);
  }, [isPresented, isConfirmed, countdown]);

  const handleDismiss = () => {
    setIsConfirmed(false);
    setCountdown(10);
    onDismiss();
  };

  const handleToggleConfirm = () => {
    if (isDeleting) return;
    setIsConfirmed((prev) => {
      const next = !prev;
      if (next) {
        setCountdown(10);
      }
      return next;
    });
  };

  const styles = useThemedStyles((colors) => ({
    container: {
      width: Dimensions.get("window").width,
      paddingHorizontal: 20,
      backgroundColor: colors.surface,
      paddingTop: 16,
      paddingBottom: 28,
      gap: 16,
    },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 14,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surfaceVariant,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    headerText: {
      flex: 1,
      gap: 3,
    },
    title: {
      fontSize: 19,
      fontWeight: "700" as const,
      color: colors.onSurface,
    },
    description: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      lineHeight: 18,
    },
    warningCard: {
      backgroundColor: colors.surfaceVariant,
      padding: 14,
      borderRadius: 14,
      borderLeftWidth: 4,
      borderLeftColor: colors.error,
      gap: 6,
    },
    warningTitle: {
      fontSize: 13,
      fontWeight: "700" as const,
      color: colors.error,
      textTransform: "uppercase" as const,
      letterSpacing: 0.5,
    },
    warningBody: {
      fontSize: 13,
      color: colors.onSurfaceVariant,
      lineHeight: 18,
    },
    checkboxRow: {
      flexDirection: "row" as const,
      alignItems: "flex-start" as const,
      gap: 12,
      paddingVertical: 4,
    },
    checkboxText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      color: colors.onSurface,
    },
    buttonRow: {
      flexDirection: "row" as const,
      gap: 12,
      width: "100%" as const,
      marginTop: 4,
    },
    cancelButton: {
      width: (Dimensions.get("window").width - 52) / 2,
    },
    deleteButton: {
      width: (Dimensions.get("window").width - 52) / 2,
    },
  }));

  const isDeleteDisabled = !isConfirmed || countdown > 0 || isDeleting;

  const deleteButtonLabel = isDeleting
    ? "Deleting..."
    : isConfirmed && countdown > 0
    ? `Delete (${countdown}s)`
    : "Delete Account";

  return (
    <BottomSheet
      isPresented={isPresented}
      onDismiss={handleDismiss}
      showDragIndicator={true}
    >
      <RNHostView matchContents>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons
                name="alert-octagon-outline"
                size={26}
                color={colors.error as string}
              />
            </View>
            <View style={styles.headerText}>
              <StyledText style={styles.title}>Delete Account?</StyledText>
              <StyledText style={styles.description}>
                This action is permanent and cannot be undone.
              </StyledText>
            </View>
          </View>

          {/* Destructive Explanation Card */}
          <View style={styles.warningCard}>
            <StyledText style={styles.warningTitle}>Permanent Deletion</StyledText>
            <StyledText style={styles.warningBody}>
              All your messages, chat threads, encryption keys, and account details
              will be permanently removed. There is no way to recover your account once deleted.
            </StyledText>
          </View>

          {/* Confirmation Checkbox */}
          <Pressable
            testID="delete-account-checkbox"
            style={styles.checkboxRow}
            onPress={handleToggleConfirm}
          >
            <Ionicons
              name={isConfirmed ? "checkbox" : "square-outline"}
              size={22}
              color={
                isConfirmed
                  ? (colors.error as string)
                  : (colors.outline as string)
              }
            />
            <StyledText style={styles.checkboxText}>
              I understand that this action is irreversible and I want to permanently delete my account.
            </StyledText>
          </Pressable>

          {/* Action buttons side-by-side */}
          <View style={styles.buttonRow}>
            <Host matchContents>
              <Button
                testID="cancel-delete-button"
                variant="outlined"
                label="Cancel"
                onPress={handleDismiss}
                disabled={isDeleting}
                style={styles.cancelButton}
              />
            </Host>
            <Host matchContents seedColor={colors.error}>
              <Button
                testID="confirm-delete-button"
                variant="filled"
                label={deleteButtonLabel}
                onPress={onConfirmDelete}
                disabled={isDeleteDisabled}
                style={styles.deleteButton}
              />
            </Host>
          </View>
        </View>
      </RNHostView>
    </BottomSheet>
  );
}
