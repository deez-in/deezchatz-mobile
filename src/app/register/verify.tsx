import React, { useState } from "react";
import { View, Alert, TextInput, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";

import StyledButton from "@/src/components/StyledButton";
import StyledText from "@/src/components/StyledText";
import { useTheme, useThemedStyles } from "@/src/hooks/useTheme";
import useSession from "@/src/store/useSession";
import { registerDevice } from "@/src/utils/auth/google";

export default function Verify() {
  const params = useLocalSearchParams<{
    token: string;
    userId: string;
    stateToken: string;
    email: string;
    displayName: string;
    avatarUrl: string;
  }>();

  const { token, userId, stateToken, email, displayName, avatarUrl } = params;


  const [isLoading, setIsLoading] = useState(false);
  const [countryCode, setCountryCode] = useState("+91");
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleCompleteRegistration = async () => {
    if (!phoneNumber) {
      Alert.alert("Required", "Please enter your phone number.");
      return;
    }

    if (!token) {
      Alert.alert("Error", "Authentication token is missing.");
      return;
    }

    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const session = useSession.getState();
      const response = await registerDevice(
        stateToken as string,
        { countryCode, number: Number(phoneNumber) },
        null,
        userId as string
      );
      session.markDeviceRegistered(response.deviceId);

      router.replace("/");
    } catch (error) {
      console.error("Error verifying profile", error);
      Alert.alert(
        "Registration failed",
        error instanceof Error ? error.message : "Something went wrong."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const dynamicStyles = useThemedStyles((colors) => ({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    card: {
      width: "88%",
      maxWidth: 420,
      borderRadius: 24,
      paddingHorizontal: 22,
      paddingVertical: 28,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outlineVariant,
      gap: 18,
      shadowColor: colors.shadow,
      shadowOpacity: 0.14,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 6,
      alignItems: "center",
    },
    heading: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.onBackground,
      textAlign: "center",
    },
    subheading: {
      color: colors.onSurfaceVariant,
      fontSize: 16,
      lineHeight: 24,
      textAlign: "center",
      marginTop: 4,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.surfaceVariant,
      marginBottom: 8,
    },
    inputContainer: {
      flexDirection: "row",
      width: "100%",
      gap: 12,
      marginTop: 8,
    },
    countryCodeInput: {
      width: 70,
      height: 52,
      borderRadius: 12,
      backgroundColor: colors.surfaceVariant,
      color: colors.onSurface,
      paddingHorizontal: 12,
      fontSize: 16,
      textAlign: "center",
    },
    phoneInput: {
      flex: 1,
      height: 52,
      borderRadius: 12,
      backgroundColor: colors.surfaceVariant,
      color: colors.onSurface,
      paddingHorizontal: 16,
      fontSize: 16,
    },
    button: {
      minHeight: 52,
      width: "100%",
      borderRadius: 16,
      marginTop: 12,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 17,
      fontWeight: "700",
    },
  }));

  const { colors } = useTheme();

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.card}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl as string }} style={dynamicStyles.avatar} />
        ) : (
          <View style={dynamicStyles.avatar} />
        )}
        
        <StyledText style={dynamicStyles.heading}>Verify Profile</StyledText>
        <StyledText style={dynamicStyles.subheading}>
          {displayName}
          {"\n"}
          {email}
        </StyledText>

        <View style={dynamicStyles.inputContainer}>
          <TextInput
            style={dynamicStyles.countryCodeInput}
            value={countryCode}
            onChangeText={setCountryCode}
            placeholder="+91"
            placeholderTextColor={colors.onSurfaceVariant}
            keyboardType="phone-pad"
          />
          <TextInput
            style={dynamicStyles.phoneInput}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Phone Number"
            placeholderTextColor={colors.onSurfaceVariant}
            keyboardType="phone-pad"
          />
        </View>

        <StyledButton
          style={dynamicStyles.button}
          onPress={handleCompleteRegistration}
          disabled={isLoading}
        >
          <StyledText style={dynamicStyles.buttonText}>
            {isLoading ? "Completing..." : "Complete Registration"}
          </StyledText>
        </StyledButton>
      </View>
    </SafeAreaView>
  );
}
