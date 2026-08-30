import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, View, Dimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheet, Button, RNHostView, Host } from "@expo/ui";
import { router } from "expo-router";

import StyledTextInput from "@/src/components/StyledTextInput";
import Card from "@/src/components/Card";
import StyledText from "@/src/components/StyledText";
import {
  getContacts,
  getContactsPermissionStatus,
  requestContactsPermission,
  SplitContact,
} from "@/src/utils/helpers/contacts";
import { useTheme, useThemedStyles } from "@/src/hooks/useTheme";

export default function Contacts() {
  const { colors } = useTheme();
  const [contacts, setContacts] = useState<SplitContact[] | undefined>();
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showDisclosureSheet, setShowDisclosureSheet] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    const fetched = await getContacts();
    setContacts(fetched ?? []);
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const status = await getContactsPermissionStatus();
      if (!isMounted) return;
      setPermissionStatus(status);
      if (status === "granted") {
        const fetched = await getContacts();
        if (isMounted) setContacts(fetched ?? []);
      } else {
        if (isMounted) {
          setContacts([]);
          setShowDisclosureSheet(true);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleProceed = async () => {
    setShowDisclosureSheet(false);
    const status = await requestContactsPermission();
    setPermissionStatus(status);
    if (status === "granted") {
      await loadContacts();
    }
  };

  const insets = useSafeAreaInsets();

  const themedStyles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: Platform.OS === "ios" ? 16 : 12,
    },
    headingView: {
      marginTop: 8,
      marginBottom: 12,
    },
    titleRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
    },
    heading: {
      fontSize: 32,
      fontWeight: "700" as const,
      color: colors.onBackground,
    },
    closeButton: {
      padding: 4,
    },
    searchBar: {
      borderRadius: 25,
      marginVertical: 8,
    },
    contactList: {
      paddingBottom: Platform.OS === "ios" ? insets.bottom + 20 : 20,
      flexGrow: 1,
    },
    pressableCard: {
      marginVertical: 4,
      borderRadius: 12,
      overflow: "hidden" as const,
    },
    cardPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    cards: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      padding: 12,
      marginVertical: 0,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.outlineVariant,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 1,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primaryContainer,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginRight: 14,
    },
    avatarText: {
      color: colors.onPrimaryContainer,
      fontSize: 15,
      fontWeight: "700" as const,
    },
    cardContent: {
      flex: 1,
      flexDirection: "column" as const,
      justifyContent: "center" as const,
    },
    contactName: {
      fontSize: 16,
      fontWeight: "600" as const,
      color: colors.onBackground,
    },
    phoneNumber: {
      fontSize: 13,
      fontWeight: "400" as const,
      color: colors.onSurfaceVariant,
      marginTop: 2,
    },
    chevronIcon: {
      opacity: 0.6,
      marginLeft: 8,
    },
    centerContainer: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      paddingVertical: 48,
      paddingHorizontal: 24,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600" as const,
      color: colors.onBackground,
      marginBottom: 6,
      textAlign: "center" as const,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      textAlign: "center" as const,
      marginBottom: 16,
      lineHeight: 20,
    },
    emptyText: {
      fontSize: 15,
      color: colors.onSurfaceVariant,
      textAlign: "center" as const,
      marginTop: 12,
    },
    grantButton: {
      marginTop: 8,
    },
    sheetContainer: {
      width: Dimensions.get("window").width,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: Platform.OS === "ios" ? insets.bottom + 20 : 24,
      backgroundColor: colors.surface,
      gap: 16,
    },
    sheetHeader: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 14,
    },
    sheetIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.primaryContainer,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    sheetHeaderText: {
      flex: 1,
      gap: 4,
    },
    sheetTitle: {
      fontSize: 18,
      fontWeight: "700" as const,
      color: colors.onSurface,
    },
    sheetDescription: {
      fontSize: 14,
      color: colors.onSurfaceVariant,
      lineHeight: 20,
    },
    sheetButtonRow: {
      flexDirection: "row" as const,
      gap: 12,
      width: "100%" as const,
      marginTop: 8,
    },
    cancelButton: {
      width: (Dimensions.get("window").width - 52) / 2,
    },
    proceedButton: {
      width: (Dimensions.get("window").width - 52) / 2,
    },
  }));

  const getInitials = (contact: SplitContact) => {
    const first = contact.firstName?.[0] || "";
    const last = contact.lastName?.[0] || "";
    if (first && /[^a-zA-Z]/.test(first) && !contact.lastName) {
      return "?";
    }
    const initials = (first + last).trim().toUpperCase();
    return initials || "?";
  };

  const filteredContacts = useMemo(() => {
    if (!contacts) return undefined;
    if (!searchTerm.trim()) return contacts;
    const query = searchTerm.trim().toLowerCase();
    return contacts.filter((contact) => {
      const first = contact.firstName ? contact.firstName.toLowerCase() : "";
      const last = contact.lastName ? contact.lastName.toLowerCase() : "";
      const full = `${first} ${last}`.trim();
      const num = contact.number ? contact.number.toLowerCase() : "";
      return full.includes(query) || num.includes(query);
    });
  }, [contacts, searchTerm]);

  const renderEmptyList = () => {
    if (contacts === undefined) {
      return (
        <View style={themedStyles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary as string} />
          <StyledText style={themedStyles.emptyText}>Loading contacts...</StyledText>
        </View>
      );
    }

    if (permissionStatus !== "granted") {
      return (
        <View style={themedStyles.centerContainer}>
          <Ionicons
            name="people-outline"
            size={48}
            color={colors.outline as string}
            style={{ marginBottom: 12 }}
          />
          <StyledText style={themedStyles.emptyTitle}>Contacts Access Needed</StyledText>
          <StyledText style={themedStyles.emptySubtext}>
            Allow access to contacts to find your friends on DeezChatz.
          </StyledText>
          <View style={themedStyles.grantButton}>
            <Host matchContents>
              <Button
                variant="filled"
                label="Allow Access"
                onPress={() => setShowDisclosureSheet(true)}
              />
            </Host>
          </View>
        </View>
      );
    }

    return (
      <View style={themedStyles.centerContainer}>
        <StyledText style={themedStyles.emptyText}>
          {searchTerm ? "No matching contacts found" : "No contacts on device"}
        </StyledText>
      </View>
    );
  };

  return (
    <SafeAreaView style={themedStyles.container} edges={["top"]}>
      <View style={themedStyles.headingView} collapsable={false}>
        <View style={themedStyles.titleRow}>
          <StyledText style={themedStyles.heading}>Contacts</StyledText>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={themedStyles.closeButton}
          >
            <Ionicons name="close-circle" size={28} color={colors.onSurfaceVariant as string} />
          </Pressable>
        </View>
        <StyledTextInput
          value={searchTerm}
          onChangeText={(text) => setSearchTerm(text)}
          style={themedStyles.searchBar}
          placeholder="Search contacts"
        />
      </View>
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={themedStyles.contactList}
        scrollEnabled={true}
        ListEmptyComponent={renderEmptyList}
        renderItem={({ item }) => {
          const initials = getInitials(item);
          return (
            <Pressable
              onPress={() => {
                const phone = item.number.replace(/[^0-9+]/g, "");
                const fullName = [item.firstName, item.lastName].filter(Boolean).join(" ");
                router.replace({ pathname: "/chat/[userId]", params: { userId: phone, id: item.id, name: fullName } });
              }}
              style={({ pressed }) => [
                themedStyles.pressableCard,
                pressed && themedStyles.cardPressed,
              ]}
            >
              <Card styles={themedStyles.cards}>
                <View style={themedStyles.avatar}>
                  {initials === "?" ? (
                    <Ionicons name="person" size={18} color={colors.onPrimaryContainer as string} />
                  ) : (
                    <StyledText style={themedStyles.avatarText}>{initials}</StyledText>
                  )}
                </View>
                <View style={themedStyles.cardContent}>
                  <StyledText style={themedStyles.contactName}>
                    {item.firstName} {item.lastName || ""}
                  </StyledText>
                  <StyledText style={themedStyles.phoneNumber}>
                    {item.number} {item.label ? `• ${item.label}` : ""}
                  </StyledText>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.onSurfaceVariant as string}
                  style={themedStyles.chevronIcon}
                />
              </Card>
            </Pressable>
          );
        }}
      />

      <BottomSheet
        isPresented={showDisclosureSheet}
        onDismiss={() => setShowDisclosureSheet(false)}
        showDragIndicator={true}
      >
        <RNHostView matchContents>
          <View style={themedStyles.sheetContainer}>
            {/* Header: icon + title/description side-by-side */}
            <View style={themedStyles.sheetHeader}>
              <View style={themedStyles.sheetIconContainer}>
                <Ionicons
                  name="people"
                  size={24}
                  color={colors.onPrimaryContainer as string}
                />
              </View>
              <View style={themedStyles.sheetHeaderText}>
                <StyledText style={themedStyles.sheetTitle}>Contacts Access</StyledText>
                <StyledText style={themedStyles.sheetDescription}>
                  DeezChatz accesses your contacts on-device so you can start conversations with friends. When you start a chat, only that recipient&apos;s phone number is queried securely to discover their encryption keys. Your contacts are not uploaded in bulk and are never stored on our servers.
                </StyledText>
              </View>
            </View>

            {/* Action buttons side-by-side */}
            <View style={themedStyles.sheetButtonRow}>
              <Host matchContents>
                <Button
                  variant="outlined"
                  label="Not Now"
                  onPress={() => setShowDisclosureSheet(false)}
                  style={themedStyles.cancelButton}
                />
              </Host>
              <Host matchContents>
                <Button
                  variant="filled"
                  label="Proceed"
                  onPress={handleProceed}
                  style={themedStyles.proceedButton}
                />
              </Host>
            </View>
          </View>
        </RNHostView>
      </BottomSheet>
    </SafeAreaView>
  );
}
