import { Alert, StyleSheet, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import StyledButton from "@/src/components/StyledButton";
import { Link, router } from "expo-router";
import { useTheme, useThemedStyles } from "@/src/hooks/useTheme";
import StyledText from "@/src/components/StyledText";
import { useEffect, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { Ionicons } from "@expo/vector-icons";
import { isGoogleSignInAvailable, GoogleAuthFlowError, startGoogleSignIn, verifyGoogleIdToken } from "@/src/utils/auth/google";
import useSession from "@/src/store/useSession";

export default function Register() {
  const { colors } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);

  useEffect(() => {
    let isMounted = true;

    isGoogleSignInAvailable()
      .then((available) => {
        if (isMounted) {
          setIsAvailable(available);
        }
      })
      .catch((_error) => {
        if (isMounted) {
          setIsAvailable(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleGoogleSignIn = async () => {
    if (isLoading || !tosAccepted) {
      return;
    }

    setIsLoading(true);
    try {
      const user = await startGoogleSignIn();
      const phase1 = await verifyGoogleIdToken(user.token);

      const { setAuthenticatedUser } = useSession.getState();
      setAuthenticatedUser({
        token: user.token,
        userId: phase1.userId,
        email: user.email || "",
        displayName: user.displayName || "",
        avatarUrl: user.avatarUrl || "",
      });

      router.push({
        pathname: "/register/verify",
        params: {
          token: user.token,
          userId: phase1.userId,
          stateToken: phase1.state,
          email: user.email || "",
          displayName: user.displayName || "",
          avatarUrl: user.avatarUrl || "",
        },
      });
    } catch (error) {
      console.error("[GoogleSignIn] Error occurred during sign-in flow:", error);
      const authError =
        error instanceof GoogleAuthFlowError
          ? error
          : new GoogleAuthFlowError(
            "ERR_GOOGLE_AUTH_UNKNOWN",
            "Something went wrong while signing in with Google.",
          );

      if (authError.code !== "ERR_GOOGLE_AUTH_CANCELLED") {
        Alert.alert("Google sign-in failed", authError.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const dynamicStyles = useThemedStyles((colors) => ({
    helpLink: {
      position: "absolute",
      bottom: 48,
      color: colors.primary,
    },
    heading: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.onBackground,
      textAlign: "center",
    },
    subheading: {
      color: colors.onSurfaceVariant,
      fontSize: 16,
      lineHeight: 24,
      textAlign: "center",
      maxWidth: 320,
      marginTop: 12,
    },
    tosContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: 10,
      marginVertical: 4,
      paddingHorizontal: 4,
    },
    tosText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: colors.onSurfaceVariant,
    },
    tosLink: {
      fontSize: 12,
      color: colors.primary,
      fontWeight: "600" as const,
      textDecorationLine: "underline" as const,
    },
    buttonText: {
      color: colors.onPrimary,
      fontSize: 17,
      fontWeight: "700",
    },
    badge: {
      backgroundColor: colors.primaryContainer,
      color: colors.onPrimaryContainer,
      borderRadius: 999,
      overflow: "hidden",
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontSize: 13,
      fontWeight: "600",
    },
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
      shadowOffset: {
        width: 0,
        height: 12,
      },
      elevation: 6,
    },
    button: {
      minHeight: 52,
      width: "100%",
      borderRadius: 16,
    },
  }));
  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.card}>
        <StyledText style={dynamicStyles.heading}>
          Welcome to <StyledText style={styles.branding}>Deez Chatz</StyledText>
        </StyledText>
        <StyledText style={styles.emoji}>💬</StyledText>
        <StyledText style={dynamicStyles.subheading}>
          Continue with your Google account to create or access your Deez Chatz profile.
        </StyledText>
        <StyledButton
          style={dynamicStyles.button}
          onPress={handleGoogleSignIn}
          disabled={isLoading || isAvailable === false || !tosAccepted}
        >
          <StyledText style={dynamicStyles.buttonText}>
            {isLoading ? "Signing in..." : "Continue with Google"}
          </StyledText>
        </StyledButton>

        <Pressable
          style={dynamicStyles.tosContainer}
          onPress={() => setTosAccepted((prev) => !prev)}
        >
          <Ionicons
            name={tosAccepted ? "checkbox" : "square-outline"}
            size={22}
            color={tosAccepted ? (colors.primary as string) : (colors.outline as string)}
          />
          <StyledText style={dynamicStyles.tosText}>
            I agree to the{" "}
            <StyledText
              style={dynamicStyles.tosLink}
              onPress={(e) => {
                e?.stopPropagation?.();
                WebBrowser.openBrowserAsync("https://chatz.deez.in/terms");
              }}
            >
              Terms of Service
            </StyledText>
            {" "}and{" "}
            <StyledText
              style={dynamicStyles.tosLink}
              onPress={(e) => {
                e?.stopPropagation?.();
                WebBrowser.openBrowserAsync("https://chatz.deez.in/privacy");
              }}
            >
              Privacy Policy
            </StyledText>
          </StyledText>
        </Pressable>
      </View>

      <Link style={dynamicStyles.helpLink} href="/">
        Need help?
      </Link>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  branding: { fontWeight: "700", fontSize: 32 },
  emoji: {
    fontSize: 36,
    textAlign: "center",
  },
});
