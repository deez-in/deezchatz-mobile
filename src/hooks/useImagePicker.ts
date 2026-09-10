import { useState, useCallback } from "react";
import { Alert } from "react-native";

import {
  pickImageFromGallery,
  compressImage,
  type CompressedImageResult,
} from "@/src/utils/image";

export interface UseImagePickerReturn {
  pickAndCompressImage: () => Promise<CompressedImageResult | null>;
  isProcessing: boolean;
}

export function useImagePicker(): UseImagePickerReturn {
  const [isProcessing, setIsProcessing] = useState(false);

  const pickAndCompressImage = useCallback(async (): Promise<CompressedImageResult | null> => {
    try {
      const picked = await pickImageFromGallery();
      if (!picked) {
        return null;
      }

      setIsProcessing(true);
      const compressed = await compressImage(picked.uri, {
        originalWidth: picked.width,
        originalHeight: picked.height,
      });
      return compressed;
    } catch (error) {
      console.warn("Failed to pick or compress image:", error);
      Alert.alert("Error", "Failed to process the selected image. Please try again.");
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return {
    pickAndCompressImage,
    isProcessing,
  };
}
