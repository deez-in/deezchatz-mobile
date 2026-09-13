import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { StyledTextInput, Card, StyledText, StyledButton } from "@/src/components/ui";
import {
  getContacts,
  getContactsPermissionStatus,
  requestContactsPermission,
} from "@/src/utils/helpers/contacts";
import { SplitContact } from "@/src/models/contact";
import { useTheme, useThemedStyles } from "@/src/hooks/useTheme";

export default function Contacts() {
  const { colors } = useTheme();
  const [contacts, setContacts] = useState<SplitContact[] | undefined>();
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [permissionStatus, setPermissionStatus] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    const fetched = await getContacts();
    setContacts(fetched ?? []);
  }, []);

  const handleAllowAccessPress = useCallback(async () => {
    const status = await requestContactsPermission();
    setPermissionStatus(status);
    if (status === "granted") {
      await loadContacts();
    } else {
      setContacts([]);
      if (status === "denied") {
        Linking.openSettings().catch(() => {});
      }
    }
  }, [loadContacts]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const currentStatus = await getContactsPermissionStatus();
      if (!isMounted) return;

      if (currentStatus === "granted") {
        setPermissionStatus("granted");
        const fetched = await getContacts();
        if (isMounted) setContacts(fetched ?? []);
      } else {
        setPermissionStatus(currentStatus);
        setContacts([]);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const insets = useSafeAreaInsets();

  const themedStyles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: Platform.OS === "ios" ? 16 : 12,
    },
    headingView: {
      marginTop: Platform.OS === "ios" ? 24 : 8,
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
            DeezChatz accesses your contacts on-device so you can start conversations with friends. When you start a chat, only that recipient&apos;s phone number is queried securely to discover their encryption keys. Your contacts are not uploaded in bulk and are never stored on our servers.
          </StyledText>
          <View style={themedStyles.grantButton}>
            <StyledButton onPress={handleAllowAccessPress} style={{ paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}>
              <StyledText style={{ color: colors.onPrimary, fontWeight: "600", fontSize: 16 }}>
                Allow Access
              </StyledText>
            </StyledButton>
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

    </SafeAreaView>
  );
}
