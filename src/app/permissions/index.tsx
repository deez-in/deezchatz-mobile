import { useState, useEffect } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";

import { StyledButton, StyledText } from "@/src/components/ui";
import { useTheme, useThemedStyles } from "@/src/hooks/useTheme";
import { requestNotificationPermission } from "@/src/utils/notifications/permissions";

export default function NotificationsPermission() {
  const [isLoading, setIsLoading] = useState(true);
  const { colors } = useTheme();

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status === "granted") {
        if (isMounted) router.replace("/permissions/contacts");
      } else {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAllow = async () => {
    await requestNotificationPermission();
    router.replace("/permissions/contacts");
  };

  const handleSkip = () => {
    router.replace("/permissions/contacts");
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
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primaryContainer,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
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
      marginBottom: 16,
    },
    buttonContainer: {
      width: "100%",
      gap: 12,
    },
    allowButton: {
      minHeight: 52,
      width: "100%",
      borderRadius: 16,
    },
    allowButtonText: {
      color: colors.onPrimary,
      fontSize: 17,
      fontWeight: "700",
    },
    skipButton: {
      minHeight: 52,
      width: "100%",
      borderRadius: 16,
      backgroundColor: "transparent",
    },
    skipButtonText: {
      color: colors.primary,
      fontSize: 17,
      fontWeight: "600",
    },
  }));

  if (isLoading) {
    return <View style={dynamicStyles.container} />;
  }

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.card}>
        <View style={dynamicStyles.iconContainer}>
          <Ionicons name="notifications" size={40} color={colors.onPrimaryContainer as string} />
        </View>
        
        <StyledText style={dynamicStyles.heading}>Turn on Notifications</StyledText>
        <StyledText style={dynamicStyles.subheading}>
          Stay in the loop. Get notified when you receive new messages and calls from your friends.
        </StyledText>

        <View style={dynamicStyles.buttonContainer}>
          <StyledButton style={dynamicStyles.allowButton} onPress={handleAllow}>
            <StyledText style={dynamicStyles.allowButtonText}>Allow Notifications</StyledText>
          </StyledButton>
          
          <StyledButton style={dynamicStyles.skipButton} onPress={handleSkip}>
            <StyledText style={dynamicStyles.skipButtonText}>Skip for now</StyledText>
          </StyledButton>
        </View>
      </View>
    </SafeAreaView>
  );
}
