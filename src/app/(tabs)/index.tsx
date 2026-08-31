import { StyledButton, StyledText, StyledTextInput } from "@/src/components/ui";
import { ContactAvatar } from "@/src/components/shared";
import { useTheme, useThemedStyles } from "@/src/hooks/useTheme";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { View, StyleSheet, Platform, FlatList, Pressable } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { getChatThreads, subscribeToChatList, DatabaseKeyMismatchError, StorageError } from "@/src/utils/db";
import { ChatThread } from "@/src/models/db";
import { syncDeviceContacts } from "@/src/utils/network/sync/contactSync";
import useSession from "@/src/store/useSession";

export default function Index() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { displayName, avatarUrl, userId } = useSession();
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<string | null>(null);

  // Filter threads based on search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    const query = searchQuery.toLowerCase();
    return threads.filter(
      (t) =>
        (t.name && t.name.toLowerCase().includes(query)) ||
        (t.phone && t.phone.toLowerCase().includes(query)) ||
        t.user_id.toLowerCase().includes(query) ||
        (t.last_message && t.last_message.toLowerCase().includes(query))
    );
  }, [threads, searchQuery]);

  // Load chat threads and subscribe to updates
  useEffect(() => {
    let isMounted = true;

    const loadThreads = async () => {
      try {
        await syncDeviceContacts();
        const t = await getChatThreads();
        if (isMounted) {
          setThreads(t);
          setStorageError(null);
        }
      } catch (e) {
        if (!isMounted) return;
        if (e instanceof DatabaseKeyMismatchError) {
          setStorageError(
            'Chat history could not be decrypted. This can happen after a reinstall.'
          );
        } else if (e instanceof StorageError && e.recoverable) {
          // Transient — retry once after a short delay
          setTimeout(() => {
            if (isMounted) loadThreads();
          }, 1000);
        } else {
          setStorageError('Failed to load chats. Please restart the app.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadThreads();

    const unsubscribe = subscribeToChatList(() => {
      getChatThreads()
        .then(t => { if (isMounted) setThreads(t); })
        .catch(e => console.error('Failed to refresh chat list:', e));
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const formatTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }, []);

  // Theme-dependent styles
  const themedStyles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerSection: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTopRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      marginTop: 8,
      marginBottom: 12,
    },
    chatTitle: {
      fontSize: 32,
      fontWeight: "700" as const,
      color: colors.onBackground,
    },
    profileButton: {
      borderRadius: 20,
    },
    searchContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      borderWidth: 0,
      paddingVertical: 8,
    },
    threadItem: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.outlineVariant,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.surface,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginRight: 12,
    },
    emptyContainer: {
      flex: 1,
    },
    emptyContent: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
    },
    errorText: {
      color: colors.error,
      textAlign: 'center' as const,
      paddingHorizontal: 32,
    },
    statusText: {
      color: colors.outline,
    },
  }));

  // FAB position style
  const contactButtonStyle = {
    position: "absolute" as const,
    bottom: Platform.OS === "ios" ? insets.bottom + 16 : 16,
    right: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 50,
  };

  const renderThread = useCallback(({ item }: { item: ChatThread }) => (
    <Pressable
      style={themedStyles.threadItem}
      onPress={() => router.push({ pathname: "/chat/[userId]", params: { userId: item.phone || item.user_id } })}
    >
      <View style={styles.avatarWrapper}>
        <ContactAvatar
          name={item.name}
          picture={item.picture}
          userId={item.user_id}
          size={48}
        />
      </View>
      <View style={styles.threadContent}>
        <View style={styles.threadHeader}>
          <StyledText style={styles.threadName} numberOfLines={1}>
            {item.name || item.phone || item.user_id}
          </StyledText>
          <StyledText style={[styles.threadTime, { color: colors.outline }]}>
            {formatTime(item.last_message_at)}
          </StyledText>
        </View>
        <StyledText
          style={[styles.threadPreview, { color: colors.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {item.last_message || ''}
        </StyledText>
      </View>
    </Pressable>
  ), [themedStyles, colors, formatTime]);

  const ListHeader = useMemo(() => (
    <View style={themedStyles.headerSection}>
      <View style={themedStyles.headerTopRow}>
        <StyledText style={themedStyles.chatTitle}>Chat</StyledText>
        <Pressable
          style={themedStyles.profileButton}
          onPress={() => router.push("/profile")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <ContactAvatar
            name={displayName}
            picture={avatarUrl}
            userId={userId || "me"}
            size={38}
          />
        </Pressable>
      </View>
      <View style={themedStyles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={colors.outline as string} />
        <StyledTextInput
          style={themedStyles.searchInput}
          placeholder="Search chats..."
          placeholderTextColor={colors.outline as string}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.outline as string} />
          </Pressable>
        )}
      </View>
    </View>
  ), [themedStyles, colors, searchQuery, displayName, avatarUrl, userId]);

  const emptyContent = storageError ? (
    <View style={themedStyles.emptyContent}>
      <StyledText style={themedStyles.errorText}>
        {storageError}
      </StyledText>
    </View>
  ) : isLoading ? (
    <View style={themedStyles.emptyContent}>
      <StyledText style={themedStyles.statusText}>Loading chats...</StyledText>
    </View>
  ) : (
    <View style={themedStyles.emptyContent}>
      <StyledText style={themedStyles.statusText}>No conversations yet</StyledText>
    </View>
  );

  return (
    <SafeAreaView style={themedStyles.container} edges={['top']}>
      {threads.length === 0 ? (
        <View style={themedStyles.emptyContainer}>
          {ListHeader}
          {emptyContent}
        </View>
      ) : (
        <FlatList
          data={filteredThreads}
          keyExtractor={(item) => item.user_id}
          renderItem={renderThread}
          ListHeaderComponent={ListHeader}
          keyboardShouldPersistTaps="handled"
        />
      )}
      <StyledButton
        style={contactButtonStyle}
        onPress={() => router.push("/contacts")}
      >
        <MaterialCommunityIcons name="contacts" size={28} />
      </StyledButton>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatarWrapper: {
    marginRight: 12,
  },
  threadContent: {
    flex: 1,
  },
  threadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  threadName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  threadTime: {
    fontSize: 12,
  },
  threadPreview: {
    fontSize: 14,
  },
});
