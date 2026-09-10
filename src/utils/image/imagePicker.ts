/**
 * Image picker utility using expo-image-picker.
 * Handles photo library permissions and launches gallery picker for single image selection.
 */

import { Alert } from "react-native";

import {
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  getMediaLibraryPermissionsAsync,
  type ImagePickerAsset,
} from "expo-image-picker";

export interface PickedImageResult {
  uri: string;
  width: number;
  height: number;
}

/**
 * Requests photo library permissions and launches the gallery picker.
 * Returns the selected image asset or null if cancelled / permission denied.
 */
export async function pickImageFromGallery(): Promise<PickedImageResult | null> {
  const currentPermission = await getMediaLibraryPermissionsAsync();

  if (!currentPermission.granted && currentPermission.canAskAgain) {
    const requested = await requestMediaLibraryPermissionsAsync();
    if (!requested.granted) {
      Alert.alert(
        "Permission Required",
        "Please grant photo library access to choose and send photos.",
        [{ text: "OK", style: "cancel" }]
      );
      return null;
    }
  } else if (!currentPermission.granted && !currentPermission.canAskAgain) {
    Alert.alert(
      "Permission Denied",
      "Photo library access is disabled. Please enable it in your device settings to select photos.",
      [{ text: "OK", style: "cancel" }]
    );
    return null;
  }

  const result = await launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset: ImagePickerAsset = result.assets[0];
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
  };
}
