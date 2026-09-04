import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";

import useSession from "@/src/store/useSession";
import { Message } from "@/src/models/db";
import { sendInitialMessage, sendMessage } from "@/src/utils/messaging";
import {
  openChatDatabase,
  closeChatDatabase,
  getMessages,
  subscribeToMessages,
  DatabaseKeyMismatchError,
  StorageError,
  BundleFetchError,
  EncryptionError,
  OutboxPersistError,
  UserNotFoundError,
  getContactByPhone,
  getContactByUserId,
} from "@/src/utils/db";
import {
  initSender,
  encryptMessage,
  isRatchetInitialized,
  getIdentityKey,
  getDeviceId,
  loadRatchetSession,
  clearSession,
} from "@/src/utils/crypto";
import { withRetry, BailoutError } from "@/src/utils/helpers/retry";

export interface UseChatSessionOptions {
  userId: string;
  initialName?: string;
  scrollToBottom?: () => void;
}

export function useChatSession({
  userId,
  initialName,
  scrollToBottom,
}: UseChatSessionOptions) {
  const session = useSession();
  const [resolvedUUID, setResolvedUUID] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [isUserNotFound, setIsUserNotFound] = useState(false);

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

  // Database initialization and message subscription
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
            "Chat history could not be decrypted and may be unrecoverable."
          );
        } else if (
          ((error instanceof StorageError && error.recoverable) ||
            (error as Error)?.message?.includes("closed resource")) &&
          attempt < 3
        ) {
          setTimeout(() => initChat(attempt + 1), 300 * (attempt + 1));
        } else {
          setDbError("Failed to load chat history. Please try again.");
          console.error("Failed to init chat DB:", error);
        }
      }
    };

    initChat();

    const unsubscribe = subscribeToMessages((updatedChatId) => {
      if (updatedChatId === resolvedUUID && isMounted) {
        getMessages(resolvedUUID)
          .then(setChatMessages)
          .catch((e) => console.error("Failed to refresh messages:", e));
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (resolvedUUID) {
        closeChatDatabase(resolvedUUID).catch(() => {});
      }
    };
  }, [resolvedUUID]);

  const resolveSessionAndSend = useCallback(
    async (msg: string, contactName?: string) => {
      if (!resolvedUUID) {
        const isPhone = userId.startsWith("+") || /^\d+$/.test(userId);
        if (!isPhone) {
          throw new Error(
            "Invalid state: resolvedUUID is null but userId is not a phone number"
          );
        }

        const result = await sendInitialMessage({
          session,
          recipientIdentifier: userId,
          message: msg,
          name: contactName || initialName || "",
          initSender: (userIdParam, sharedSecret, receiverPub, identityKey, deviceId) =>
            initSender(userIdParam, sharedSecret, receiverPub, identityKey, deviceId),
          encrypt: (userIdParam, plaintext, ad) =>
            encryptMessage(userIdParam, plaintext, ad),
        });

        if (result && result.userId) {
          setResolvedUUID(result.userId);
        }
        return;
      }

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
            console.warn(
              "Failed to re-open database during session recovery check:",
              e
            );
          }
        }

        if (identityKey && deviceId) {
          await sendMessage({
            session,
            recipientUserId: resolvedUUID,
            recipientDeviceId: deviceId,
            message: msg,
            encrypt: (userIdParam, plaintext, ad) =>
              encryptMessage(userIdParam, plaintext, ad),
            recipientIdentityKey: identityKey,
          });
          return;
        }

        console.warn(
          "Session broken: missing identity key or device ID after retry. Clearing session and retrying."
        );
        await clearSession(resolvedUUID);
      }

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
        encrypt: (userIdParam, plaintext, ad) =>
          encryptMessage(userIdParam, plaintext, ad),
      });
      if (result && result.userId) {
        setResolvedUUID(result.userId);
      }
    },
    [resolvedUUID, userId, session, initialName]
  );

  const handleSendMessage = useCallback(
    async (
      msg: string,
      contactName?: string,
      onRestoreDraft?: (text: string) => void
    ) => {
      setIsUserNotFound(false);
      if (!msg.trim()) return;
      if (dbError) {
        Alert.alert(
          "Cannot Send",
          "Chat history is unavailable. Please restart the app."
        );
        return;
      }

      scrollToBottom?.();

      try {
        await withRetry(
          async () => {
            try {
              await resolveSessionAndSend(msg, contactName);
            } catch (error: any) {
              const isRecoverableStorageError =
                error instanceof StorageError && error.recoverable;
              const isRetryableError =
                error instanceof OutboxPersistError || isRecoverableStorageError;

              if (isRetryableError) {
                throw error;
              } else {
                throw new BailoutError(error);
              }
            }
          },
          { maxAttempts: 3, initialDelay: 500, backoffFactor: 1 }
        );
      } catch (error: any) {
        if (error instanceof UserNotFoundError) {
          setIsUserNotFound(true);
          onRestoreDraft?.(msg);
        } else if (error instanceof BundleFetchError) {
          Alert.alert(
            "Offline",
            "You must be online to start a new conversation. Please check your connection and try again.",
            [{ text: "OK", style: "cancel" }]
          );
          onRestoreDraft?.(msg);
        } else if (error instanceof EncryptionError) {
          console.error("Encryption failed:", error);
          Alert.alert(
            "Encryption Error",
            "Could not encrypt your message. The session may be corrupted.",
            [{ text: "OK", style: "cancel" }]
          );
          onRestoreDraft?.(msg);
        } else {
          console.error("Failed to send message:", error);
          Alert.alert(
            "Send Failed",
            error?.message || "Your message could not be sent. Please try again.",
            [{ text: "OK", style: "cancel" }]
          );
          onRestoreDraft?.(msg);
        }
      }
    },
    [dbError, scrollToBottom, resolveSessionAndSend]
  );

  return {
    resolvedUUID,
    setResolvedUUID,
    chatMessages,
    dbError,
    isUserNotFound,
    handleSendMessage,
  };
}

export default useChatSession;
