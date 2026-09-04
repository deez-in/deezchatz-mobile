import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { StyledText } from "@/src/components/ui";
import { BlockReportSheet } from "@/src/components/shared";
import {
  ChatBubble,
  ChatHeader,
  ChatBanners,
  ChatInputBar,
} from "@/src/components/chat";
import { useTheme, useThemedStyles } from "@/src/hooks/useTheme";
import { useChatSession } from "@/src/hooks/useChatSession";
import { useContactIdentity } from "@/src/hooks/useContactIdentity";
import { useVoiceRecording } from "@/src/hooks/useVoiceRecording";
import { Message } from "@/src/models/db";

export default function Chat() {
  const {
    userId,
    id,
    name: initialName,
  }: { userId: string; id?: string; name?: string } = useLocalSearchParams();
  const [message, setMessage] = useState<string>("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const flatListRef = useRef<FlatList<Message>>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  useEffect(() => {
    if (Platform.OS === "ios") return;

    const showSubscription = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height + 8);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent;
      setShowScrollButton(contentOffset.y > 150);
    },
    []
  );

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const {
    resolvedUUID,
    setResolvedUUID,
    chatMessages,
    dbError,
    isUserNotFound,
    handleSendMessage,
    handleSendVoice,
  } = useChatSession({
    userId,
    initialName,
    scrollToBottom,
  });

  const {
    name,
    picture,
    isBlocked,
    showBlockSheet,
    setShowBlockSheet,
    showKeyChangeBanner,
    dismissKeyChangeBanner,
    handleConfirmBlock,
    handleUnblock,
  } = useContactIdentity({
    userId,
    id,
    initialName,
    resolvedUUID,
    setResolvedUUID,
    chatMessages,
  });

  const {
    voiceState,
    recordingDuration,
    isPlayingPreview,
    voiceStateRef,
    isRecordingJustStoppedRef,
    startRecording,
    stopRecording,
    discardRecording,
    sendVoiceRecording,
    togglePlayPreview,
  } = useVoiceRecording({
    isBlocked,
    onSendVoice: async (cacheUri, duration) => {
      await handleSendVoice(cacheUri, duration, name);
    },
  });

  const onSendTextMessage = useCallback(
    (text: string) => {
      setMessage("");
      handleSendMessage(text, name, (draft) => setMessage(draft));
    },
    [handleSendMessage, name]
  );

  const onSendVoiceMessage = useCallback(() => {
    sendVoiceRecording();
  }, [sendVoiceRecording]);

  const themedStyles = useThemedStyles((themeColors) => ({
    container: {
      flex: 1,
      backgroundColor: themeColors.background,
    },
    messageContainer: {
      flex: 1,
      paddingHorizontal: 16,
    },
    scrollToBottomButton: {
      position: "absolute",
      right: 16,
      bottom: 80,
      width: 40,
      height: 40,
      borderRadius: 20,
      borderCurve: "continuous",
      backgroundColor: themeColors.surface,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    dbErrorContainer: {
      flex: 1,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      padding: 32,
    },
    dbErrorText: {
      color: themeColors.error,
      textAlign: "center" as const,
    },
  }));

  const inputBarPaddingBottom = useMemo(() => {
    return keyboardHeight > 0 && Platform.OS !== "ios" ? 8 : insets.bottom;
  }, [insets.bottom, keyboardHeight]);

  const content = (
    <>
      <ChatHeader
        displayName={name || userId}
        picture={picture}
        avatarUserId={resolvedUUID || userId}
        isBlocked={isBlocked}
        onOpenBlockReportSheet={() => setShowBlockSheet(true)}
      />

      <ChatBanners
        isBlocked={isBlocked}
        onUnblock={handleUnblock}
        showKeyChangeBanner={showKeyChangeBanner}
        onDismissKeyChange={dismissKeyChangeBanner}
        contactName={name}
        isUserNotFound={isUserNotFound}
      />

      {dbError ? (
        <View style={themedStyles.dbErrorContainer}>
          <StyledText style={themedStyles.dbErrorText}>{dbError}</StyledText>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          style={themedStyles.messageContainer}
          data={[...chatMessages].reverse()}
          inverted
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={{ paddingVertical: 16 }}
          onScroll={onScroll}
          scrollEventThrottle={100}
        />
      )}

      {showScrollButton && (
        <Pressable
          style={themedStyles.scrollToBottomButton}
          onPress={scrollToBottom}
          accessibilityRole="button"
          accessibilityLabel="Scroll to latest messages"
        >
          <Ionicons name="chevron-down" size={24} color={colors.onBackground} />
        </Pressable>
      )}

      <ChatInputBar
        message={message}
        onChangeMessage={setMessage}
        onSendMessage={onSendTextMessage}
        voiceState={voiceState}
        recordingDuration={recordingDuration}
        isPlayingPreview={isPlayingPreview}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onDiscardRecording={discardRecording}
        onSendVoiceRecording={onSendVoiceMessage}
        onTogglePlayPreview={togglePlayPreview}
        voiceStateRef={voiceStateRef}
        isRecordingJustStoppedRef={isRecordingJustStoppedRef}
        isBlocked={isBlocked}
        paddingBottom={inputBarPaddingBottom}
      />

      <BlockReportSheet
        isPresented={showBlockSheet}
        onDismiss={() => setShowBlockSheet(false)}
        contactName={name || userId}
        onConfirmBlock={handleConfirmBlock}
      />
    </>
  );

  return (
    <SafeAreaView style={themedStyles.container} edges={["top"]}>
      {Platform.OS === "ios" ? (
        <KeyboardAvoidingView
          style={themedStyles.container}
          behavior="padding"
          keyboardVerticalOffset={0}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        <View
          style={[themedStyles.container, { paddingBottom: keyboardHeight }]}
        >
          {content}
        </View>
      )}
    </SafeAreaView>
  );
}
