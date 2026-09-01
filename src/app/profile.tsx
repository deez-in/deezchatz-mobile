import { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { setStringAsync } from "expo-clipboard";

import { useTheme, useThemedStyles } from "@/src/hooks/useTheme";
import useSession from "@/src/store/useSession";
import { StyledText, StyledButton } from "@/src/components/ui";
import { ContactAvatar, DeleteAccountSheet } from "@/src/components/shared";
import { deleteAccount } from "@/src/utils/api/user";
import { wipeAllDatabases } from "@/src/utils/db";

export default function ProfileScreen() {
  const { colors } = useTheme();
  const session = useSession();
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState(false);

  const handleCopyUserId = useCallback(async () => {
    if (session.userId) {
      await setStringAsync(session.userId);
      setCopiedUserId(true);
      setTimeout(() => setCopiedUserId(false), 2000);
    }
  }, [session.userId]);

  const handleDeleteAccount = useCallback(async () => {
    setIsDeleting(true);
    try {
      // 1. Send authenticated delete request to backend API
      try {
        await deleteAccount();
      } catch (apiError) {
        console.warn("[Profile] API delete account encountered error:", apiError);
      }

      // 2. Wipe local SQLite databases & storage
      try {
        await wipeAllDatabases();
      } catch (dbError) {
        console.warn("[Profile] Failed to wipe local databases:", dbError);
      }

      // 3. Clear local session & authentication state
      await session.clearSession();
      setShowDeleteSheet(false);
    } catch (error) {
      console.error("[Profile] Failed to delete account:", error);
      Alert.alert(
        "Error",
        "An error occurred while deleting your account. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsDeleting(false);
    }
  }, [session]);

  const styles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "space-between" as const,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.outlineVariant,
    },
    backButton: {
      padding: 6,
      borderRadius: 20,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700" as const,
      color: colors.onBackground,
    },
    headerPlaceholder: {
      width: 36,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 40,
      gap: 24,
    },
    avatarSection: {
      alignItems: "center" as const,
      gap: 12,
    },
    avatarContainer: {
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    displayName: {
      fontSize: 22,
      fontWeight: "700" as const,
      color: colors.onBackground,
      textAlign: "center" as const,
    },
    emailText: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      marginTop: -8,
      textAlign: "center" as const,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      overflow: "hidden" as const,
    },
    cardSectionTitle: {
      fontSize: 12,
      fontWeight: "700" as const,
      color: colors.outline,
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    infoRow: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outlineVariant,
    },
    infoIconContainer: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surfaceVariant,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginRight: 14,
    },
    infoContent: {
      flex: 1,
      gap: 2,
    },
    infoLabel: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
    },
    infoValue: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: colors.onSurface,
    },
    copyBadge: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: colors.surfaceVariant,
    },
    copyBadgeText: {
      fontSize: 12,
      fontWeight: "600" as const,
      color: colors.primary,
    },
    deleteSection: {
      marginTop: 8,
      gap: 12,
    },
    deleteButton: {
      backgroundColor: colors.error,
      minHeight: 50,
      borderRadius: 14,
      flexDirection: "row" as const,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      gap: 8,
    },
    deleteButtonText: {
      color: colors.onError,
      fontSize: 16,
      fontWeight: "700" as const,
    },
    deleteDisclaimer: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      textAlign: "center" as const,
      lineHeight: 16,
      paddingHorizontal: 16,
    },
  }));

  const formattedPhone = session.phone?.number
    ? `${session.phone.countryCode} ${session.phone.number}`
    : "Not linked";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Ionicons
            name={Platform.OS === "ios" ? "chevron-back" : "arrow-back"}
            size={24}
            color={colors.onBackground as string}
          />
        </Pressable>
        <StyledText style={styles.headerTitle}>Profile</StyledText>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar & Name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <ContactAvatar
              name={session.displayName}
              picture={session.avatarUrl}
              userId={session.userId || "me"}
              size={96}
            />
          </View>
          <StyledText style={styles.displayName}>
            {session.displayName || "User"}
          </StyledText>
          {session.email ? (
            <StyledText style={styles.emailText}>{session.email}</StyledText>
          ) : null}
        </View>

        {/* Account Details Card */}
        <View style={styles.card}>
          <StyledText style={styles.cardSectionTitle}>Account Details</StyledText>

          {/* Phone */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <MaterialCommunityIcons
                name="phone-outline"
                size={20}
                color={colors.primary as string}
              />
            </View>
            <View style={styles.infoContent}>
              <StyledText style={styles.infoLabel}>Phone Number</StyledText>
              <StyledText style={styles.infoValue}>{formattedPhone}</StyledText>
            </View>
          </View>

          {/* User ID */}
          <Pressable style={styles.infoRow} onPress={handleCopyUserId}>
            <View style={styles.infoIconContainer}>
              <MaterialCommunityIcons
                name="identifier"
                size={20}
                color={colors.primary as string}
              />
            </View>
            <View style={styles.infoContent}>
              <StyledText style={styles.infoLabel}>User ID</StyledText>
              <StyledText
                style={[styles.infoValue, { fontSize: 13, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" }]}
                numberOfLines={1}
              >
                {session.userId || "Unknown"}
              </StyledText>
            </View>
            <View style={styles.copyBadge}>
              <MaterialCommunityIcons
                name={copiedUserId ? "check" : "content-copy"}
                size={14}
                color={colors.primary as string}
              />
              <StyledText style={styles.copyBadgeText}>
                {copiedUserId ? "Copied" : "Copy"}
              </StyledText>
            </View>
          </Pressable>

          {/* Auth Provider */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
              <MaterialCommunityIcons
                name="google"
                size={20}
                color={colors.primary as string}
              />
            </View>
            <View style={styles.infoContent}>
              <StyledText style={styles.infoLabel}>Authentication</StyledText>
              <StyledText style={styles.infoValue}>Google Account</StyledText>
            </View>
          </View>
        </View>

        {/* Delete Account Section */}
        <View style={styles.deleteSection}>
          <StyledButton
            style={styles.deleteButton}
            onPress={() => setShowDeleteSheet(true)}
          >
            <MaterialCommunityIcons
              name="delete-forever-outline"
              size={22}
              color={colors.onError as string}
            />
            <StyledText style={styles.deleteButtonText}>Delete Profile</StyledText>
          </StyledButton>
          <StyledText style={styles.deleteDisclaimer}>
            Deleting your profile will remove your account and all associated encrypted chats permanently.
          </StyledText>
        </View>
      </ScrollView>

      {/* Delete Confirmation Bottom Sheet */}
      <DeleteAccountSheet
        isPresented={showDeleteSheet}
        onDismiss={() => setShowDeleteSheet(false)}
        onConfirmDelete={handleDeleteAccount}
        isDeleting={isDeleting}
      />
    </SafeAreaView>
  );
}
