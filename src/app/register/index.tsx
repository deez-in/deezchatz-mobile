import { Alert, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import StyledButton from "@/src/components/StyledButton";
import { Link, router } from "expo-router";
import { useThemedStyles } from "@/src/hooks/useTheme";
import StyledText from "@/src/components/StyledText";
import { useEffect, useState } from "react";
import { isGoogleSignInAvailable, GoogleAuthFlowError, startGoogleSignIn, verifyGoogleIdToken } from "@/src/utils/auth/google";
import useSession from "@/src/store/useSession";

export default function Register() {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

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
    if (isLoading) {
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
    mutedText: {
      color: colors.onSurfaceVariant,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
  }));
  return (
    <SafeAreaView style={dynamicStyles.container}>
      <View style={dynamicStyles.card}>
        <StyledText style={dynamicStyles.badge}>Android native OAuth</StyledText>
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
          disabled={isLoading || isAvailable === false}
        >
          <StyledText style={dynamicStyles.buttonText}>
            {isLoading ? "Signing in..." : "Continue with Google"}
          </StyledText>
        </StyledButton>
        <StyledText style={dynamicStyles.mutedText}>
          {isAvailable === false
            ? "Google sign-in is unavailable in this build. Check the Android OAuth client IDs and rebuild the app."
            : "Phone sign-up is being rebuilt and will come back later."}
        </StyledText>
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
