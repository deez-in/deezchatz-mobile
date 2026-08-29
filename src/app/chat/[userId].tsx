import StyledButton from "@/src/components/StyledButton";
import StyledText from "@/src/components/StyledText";
import StyledTextInput from "@/src/components/StyledTextInput";
import { useTheme, useThemedStyles } from "@/src/hooks/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Contact, ContactField } from "expo-contacts";
import { View, StyleSheet, FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, KeyboardAvoidingView, Platform, Keyboard, Alert } from "react-native";
import { sendInitialMessage, sendMessage } from '@/src/utils/messaging';
import {
  openChatDatabase,
  closeChatDatabase,
  getMessages,
  subscribeToMessages,
  Message,
  DatabaseKeyMismatchError,
  StorageError,
  BundleFetchError,
  EncryptionError,
  OutboxPersistError,
  UserNotFoundError,
  getContactByPhone,
  getContactByUserId,
} from '@/src/utils/storage';
import ChatBubble from "@/src/components/ChatBubble";
import { ContactAvatar } from "@/src/components/ContactAvatar";
import { getContactInfo, acknowledgeKeyChange } from "@/src/utils/storage/contacts";
import { syncContactBundle } from "@/src/utils/sync/bundleSync";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import useSession from "@/src/store/useSession";
import {
  initSender,
  encryptMessage,
  isRatchetInitialized,
  getIdentityKey,
  getDeviceId,
  loadRatchetSession,
  clearSession
} from "@/src/utils/crypto";
import { withRetry, BailoutError } from "@/src/utils/helpers/retry";


export default function Chat() {
  const [name, setName] = useState<string>();
  const [picture, setPicture] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isUserNotFound, setIsUserNotFound] = useState(false);
  const [showKeyChangeBanner, setShowKeyChangeBanner] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') return;

    const showSubscription = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height + 8);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const flatListRef = useRef<FlatList<Message>>(null);

  // Track scroll position — in inverted list, offset 0 = bottom (latest messages)
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    // In inverted list, scrolling "up" (to older messages) increases offset
    setShowScrollButton(contentOffset.y > 150);
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const { userId, id, name: initialName }: { userId: string; id?: string; name?: string } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const session = useSession();

  const [resolvedUUID, setResolvedUUID] = useState<string | null>(null);

  // Auto-resolve UUID on mount
  useEffect(() => {
    let isMounted = true;
    const resolveChat = async () => {
      const isPhone = userId.startsWith("+") || /^\d+$/.test(userId);
      if (isPhone) {
        const uuid = await getContactByPhone(userId);
        if (isMounted && uuid) {
          setResolvedUUID(uuid);
        }
      } else {
        if (isMounted) {
          setResolvedUUID(userId);
        }
      }
    };
    resolveChat();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    let isMounted = true;

    const initChat = async (attempt = 0) => {
      if (!resolvedUUID) {
        if (isMounted) setChatMessages([]);
        return;
      }
      try {
        await openChatDatabase(resolvedUUID);
        if (!isMounted) return;

        const msgs = await getMessages(resolvedUUID);
        if (isMounted) {
          setChatMessages(msgs);
          setDbError(null);
        }
      } catch (error) {
        if (!isMounted) return;
        if (error instanceof DatabaseKeyMismatchError) {
          setDbError(
            'Chat history could not be decrypted and may be unrecoverable.'
          );
        } else if (error instanceof StorageError && error.recoverable && attempt < 3) {
          // Transient error — retry with backoff
          setTimeout(() => initChat(attempt + 1), 500 * (attempt + 1));
        } else {
          setDbError('Failed to load chat history. Please try again.');
          console.error('Failed to init chat DB:', error);
        }
      }
    };

    initChat();

    // Subscribe to live message updates
    const unsubscribe = subscribeToMessages((updatedChatId) => {
      if (updatedChatId === resolvedUUID && isMounted) {
        getMessages(resolvedUUID)
          .then(setChatMessages)
          .catch(e => console.error('Failed to refresh messages:', e));
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (resolvedUUID) {
        closeChatDatabase(resolvedUUID).catch(() => { });
      }
    };
  }, [resolvedUUID]);

  const resolveSessionAndSend = async (msg: string) => {
    if (!resolvedUUID) {
      // Initial Message Flow
      const isPhone = userId.startsWith("+") || /^\d+$/.test(userId);
      if (!isPhone) {
        throw new Error("Invalid state: resolvedUUID is null but userId is not a phone number");
      }

      const result = await sendInitialMessage({
        session,
        recipientIdentifier: userId, // phone number
        message: msg,
        name: initialName || name,
        initSender: (userIdParam, sharedSecret, receiverPub, identityKey, deviceId) =>
          initSender(userIdParam, sharedSecret, receiverPub, identityKey, deviceId),
        encrypt: (userIdParam, plaintext, ad) => encryptMessage(userIdParam, plaintext, ad),
      });

      if (result && result.userId) {
        setResolvedUUID(result.userId);
      }
      return;
    }

    // Existing Session Flow
    let hasSession = await isRatchetInitialized(resolvedUUID);
    if (!hasSession) {
      await loadRatchetSession(resolvedUUID);
      hasSession = await isRatchetInitialized(resolvedUUID);
    }

    if (hasSession) {
      let identityKey = await getIdentityKey(resolvedUUID);
      let deviceId = await getDeviceId(resolvedUUID);
      
      if (!identityKey || !deviceId) {
        try {
          await openChatDatabase(resolvedUUID);
          identityKey = await getIdentityKey(resolvedUUID);
          deviceId = await getDeviceId(resolvedUUID);
        } catch (e) {
          console.warn('Failed to re-open database during session recovery check:', e);
        }
      }

      if (identityKey && deviceId) {
        await sendMessage({
          session,
          recipientUserId: resolvedUUID,
          recipientDeviceId: deviceId,
          message: msg,
          encrypt: (userIdParam, plaintext, ad) => encryptMessage(userIdParam, plaintext, ad),
          recipientIdentityKey: identityKey,
        });
        return;
      }
      
      console.warn('Session broken: missing identity key or device ID after retry. Clearing session and retrying.');
      await clearSession(resolvedUUID);
    }

    // Re-initialize session using phone lookup if needed
    const phone = await getContactByUserId(resolvedUUID);
    if (!phone) {
      throw new Error("Cannot re-initialize session: contact phone not found");
    }
    const result = await sendInitialMessage({
      session,
      recipientIdentifier: phone,
      message: msg,
      initSender: (userIdParam, sharedSecret, receiverPub, identityKey, deviceId) =>
        initSender(userIdParam, sharedSecret, receiverPub, identityKey, deviceId),
      encrypt: (userIdParam, plaintext, ad) => encryptMessage(userIdParam, plaintext, ad),
    });
    if (result && result.userId) {
      setResolvedUUID(result.userId);
    }
  };

  const handleSendMessage = async (msg: string) => {
    setIsUserNotFound(false);
    if (!msg.trim()) return;
    if (dbError) {
      Alert.alert('Cannot Send', 'Chat history is unavailable. Please restart the app.');
      return;
    }

    setMessage("");
    scrollToBottom();

    try {
      await withRetry(
        async () => {
          try {
            await resolveSessionAndSend(msg);
          } catch (error: any) {
            const isRecoverableStorageError = error instanceof StorageError && error.recoverable;
            const isRetryableError = error instanceof OutboxPersistError || isRecoverableStorageError;

            if (isRetryableError) {
              throw error; // Let withRetry handle it
            } else {
              throw new BailoutError(error); // Wrap to stop withRetry
            }
          }
        },
        { maxAttempts: 3, initialDelay: 500, backoffFactor: 1 }
      );
    } catch (error: any) {
      if (error instanceof UserNotFoundError) {
        setIsUserNotFound(true);
        setMessage(msg); // restore drafted message
      } else if (error instanceof BundleFetchError) {
        Alert.alert(
          'Offline',
          'You must be online to start a new conversation. Please check your connection and try again.',
          [{ text: 'OK', style: 'cancel' }]
        );
        setMessage(msg);
      } else if (error instanceof EncryptionError) {
        console.error('Encryption failed:', error);
        Alert.alert(
          'Encryption Error',
          'Could not encrypt your message. The session may be corrupted.',
          [{ text: 'OK', style: 'cancel' }]
        );
        setMessage(msg);
      } else {
        console.error('Failed to send message:', error);
        Alert.alert(
          'Send Failed',
          error?.message || 'Your message could not be sent. Please try again.',
          [{ text: 'OK', style: 'cancel' }]
        );
        setMessage(msg);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;
    const resolveIdentity = async () => {
      if (resolvedUUID) {
        const info = await getContactInfo(resolvedUUID);
        if (info && isMounted) {
          if (info.name) setName(info.name);
          if (info.picture) setPicture(info.picture);

          // Check for pre-existing unacknowledged key changes
          if (info.identity_key_changed === 1) {
            setShowKeyChangeBanner(true);
          }
        }

        // Fire-and-forget bundle sync (respects 15-min cooldown)
        syncContactBundle(resolvedUUID)
          .then((result) => {
            if (!isMounted || !result) return;
            if (result.keyChanged) setShowKeyChangeBanner(true);
            if (result.pictureChanged) {
              // Re-read updated picture from DB
              getContactInfo(resolvedUUID).then((updated) => {
                if (isMounted && updated?.picture) setPicture(updated.picture);
              });
            }
          })
          .catch((e) => console.warn('Bundle sync failed:', e));

        return;
      }

      if (id) {
        try {
          const contact = new Contact(id.split("/")[0]);
          const details = await contact.getDetails([ContactField.FULL_NAME]);
          if (isMounted && details) {
            setName(details.fullName || "");
          }
        } catch (e) {
          console.warn("Failed to fetch contact by device ID:", e);
        }
      } else {
        const isPhone = userId.startsWith("+") || /^\d+$/.test(userId);
        if (isPhone) {
          if (isMounted) setName(userId);
        } else if (resolvedUUID) {
          const phone = await getContactByUserId(resolvedUUID);
          if (isMounted) setName(phone || userId);
        }
      }
    };

    resolveIdentity();
    return () => {
      isMounted = false;
    };
  }, [id, userId, resolvedUUID]);

  // Theme-dependent styles (memoized by theme)
  const themedStyles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    messageContainer: {
      flex: 1,
      paddingHorizontal: 16,
    },
    scrollToBottomButton: {
      position: 'absolute',
      right: 16,
      bottom: 80,
      width: 40,
      height: 40,
      borderRadius: 20,
      borderCurve: 'continuous',
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    dbErrorContainer: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      padding: 32,
    },
    dbErrorText: {
      color: colors.error,
      textAlign: 'center' as const,
    },
    userNotFoundContainer: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      alignItems: 'center' as const,
      backgroundColor: colors.surface,
    },
    userNotFoundText: {
      color: colors.onSurfaceVariant as string,
      textAlign: 'center' as const,
      fontSize: 13,
    },
    keyChangeBanner: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
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
      fontWeight: '600' as const,
    },
  }));

  // Insets-dependent styles (memoized by insets)
  const messageBarInsetStyle = useMemo(() => ({
    paddingBottom: keyboardHeight > 0 && Platform.OS !== 'ios' ? 8 : insets.bottom,
  }), [insets.bottom, keyboardHeight]);

  const content = (
    <>
      <View style={styles.header}>
        <StyledButton onPress={() => router.back()} variant="link">
          <Ionicons
            color={colors.primary}
            name="chevron-back"
            size={24}
          />
        </StyledButton>
        <View style={styles.avatarWrapper}>
          <ContactAvatar
            name={name || userId}
            picture={picture}
            userId={resolvedUUID || userId}
            size={36}
          />
        </View>
        <StyledText style={styles.headerTitle}>{name || userId}</StyledText>
      </View>

      {showKeyChangeBanner && (
        <View style={themedStyles.keyChangeBanner}>
          <Ionicons name="lock-closed" size={16} color={colors.onSurfaceVariant} />
          <StyledText style={themedStyles.keyChangeBannerText}>
            Security info changed for {name || 'this contact'}. Messages will use a new session.
          </StyledText>
          <Pressable
            style={themedStyles.keyChangeDismiss}
            onPress={() => {
              setShowKeyChangeBanner(false);
              if (resolvedUUID) {
                acknowledgeKeyChange(resolvedUUID).catch(() => {});
              }
            }}
            hitSlop={8}
          >
            <StyledText style={themedStyles.keyChangeDismissText}>Dismiss</StyledText>
          </Pressable>
        </View>
      )}

      {dbError ? (
        <View style={themedStyles.dbErrorContainer}>
          <StyledText style={themedStyles.dbErrorText}>
            {dbError}
          </StyledText>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          style={themedStyles.messageContainer}
          data={[...chatMessages].reverse()}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ChatBubble message={item} />
          )}
          contentContainerStyle={{ paddingVertical: 16 }}
          onScroll={onScroll}
          scrollEventThrottle={100}
        />
      )}

      {showScrollButton && (
        <Pressable
          style={themedStyles.scrollToBottomButton}
          onPress={scrollToBottom}
        >
          <Ionicons name="chevron-down" size={24} color={colors.onBackground} />
        </Pressable>
      )}
      {isUserNotFound && (
        <View style={themedStyles.userNotFoundContainer}>
          <StyledText style={themedStyles.userNotFoundText}>
            This Contact isn&apos;t using Deez Chatz yet.
          </StyledText>
        </View>
      )}

      <View
        style={StyleSheet.flatten([
          messageBarInsetStyle,
          styles.messageBar,
          { backgroundColor: colors.background }
        ])}
      >
        <StyledTextInput
          style={styles.messageInput}
          placeholder={"Send message"}
          value={message}
          onChangeText={setMessage}
          multiline
        />
        <StyledButton
          onPress={() => handleSendMessage(message)}
          style={styles.messageButton}
        >
          <Ionicons name="send" size={24} color={colors.onPrimary as string} />
        </StyledButton>
      </View>
    </>
  );

  return (
    <SafeAreaView style={themedStyles.container} edges={['top']}>
      {Platform.OS === 'ios' ? (
        <KeyboardAvoidingView
          style={themedStyles.container}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        <View style={[themedStyles.container, { paddingBottom: keyboardHeight }]}>
          {content}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatarWrapper: {
    margin: 4,
  },
  image: {
    margin: 8,
  },
  header: {
    flex: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  messageButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    margin: 4,
    borderRadius: 25,
  },
  messageBar: {
    flex: 0,
    width: '100%', // Constrain width to prevent horizontal overflow
    alignItems: "center",
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)', // Optional separation line
  },
  messageInput: {
    borderRadius: 25,
    padding: 12,
    flex: 1, // Ensure shrinking when content overflows
    margin: 4,
    maxHeight: 120, // Prevent infinite growth
    alignSelf: 'center', // Keep centered vertically within input bar
  },
});
