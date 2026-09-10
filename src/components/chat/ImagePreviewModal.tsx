import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/hooks/useTheme";

export interface ImagePreviewModalProps {
  visible: boolean;
  imageUri: string | null;
  onSend: (imageUri: string, caption: string) => void;
  onClose: () => void;
}

export default function ImagePreviewModal({
  visible,
  imageUri,
  onSend,
  onClose,
}: ImagePreviewModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [caption, setCaption] = useState("");

  if (!visible || !imageUri) return null;

  const handleClose = () => {
    setCaption("");
    onClose();
  };

  const handleSend = () => {
    onSend(imageUri, caption.trim());
    setCaption("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0B0B0E" />

        {/* Top bar with close button */}
        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.buttonPressed,
            ]}
            hitSlop={12}
            accessibilityLabel="Cancel sending image"
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Image preview */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUri }}
            style={styles.previewImage}
            contentFit="contain"
          />
        </View>

        {/* Bottom bar with caption input and send button */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          <View
            style={[
              styles.bottomBar,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            <View style={styles.inputRow}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Add a caption..."
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                style={styles.captionInput}
                multiline
                maxLength={1000}
                returnKeyType="default"
              />
              <Pressable
                onPress={handleSend}
                style={({ pressed }) => [
                  styles.sendButton,
                  { backgroundColor: colors.primary },
                  pressed && styles.buttonPressed,
                ]}
                hitSlop={8}
                accessibilityLabel="Send photo"
              >
                <Ionicons name="send" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0B0E",
  },
  topBar: {
    position: "absolute",
    left: 16,
    zIndex: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  bottomBar: {
    backgroundColor: "rgba(18, 18, 22, 0.95)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  captionInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 22,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
});
