import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, AppStateStatus, Alert, Platform } from "react-native";
import useSession from "./../store/useSession";
import { ThemeProvider, useTheme } from "@/src/hooks/useTheme";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import useMqtt, { processInboxRetries, processOutboxRetries } from "@/src/hooks/useMqtt";
import {
  openPrimaryDatabase,
  reopenAllDatabases,
  DatabaseKeyMismatchError,
  pruneInbox,
  pruneOutbox,
} from "@/src/utils/storage";
import useNotifications from "@/src/hooks/useNotifications";

// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isAuthenticated } = useSession();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider>
      <InnerLayout isAuthenticated={isAuthenticated} />
    </ThemeProvider>
  );
}

function InnerLayout({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { colors } = useTheme();
  const session = useSession();
  const hasMessagingIdentity = Boolean(session.userId);
  const topic = hasMessagingIdentity ? session.userId : "";
  const [isDbReady, setIsDbReady] = useState(false);

  // Consolidated hook handles connection + store sync + message listening
  useMqtt(isAuthenticated && hasMessagingIdentity && isDbReady ? topic! : "");

  // Handles push notification permissions, tokens, and local scheduling
  useNotifications(isAuthenticated && isDbReady);

  // Open primary database on auth, with proper error handling
  useEffect(() => {
    let isMounted = true;
    if (!isAuthenticated) {
      Promise.resolve().then(() => {
        if (isMounted) setIsDbReady(false);
      });
      return;
    }

    openPrimaryDatabase()
      .then(() => {
        setIsDbReady(true);
        // Prune stale inbox/outbox entries (processed/failed older than 7 days)
        pruneInbox().catch(e =>
          console.warn('Failed to prune inbox:', e)
        );
        pruneOutbox().catch(e =>
          console.warn('Failed to prune outbox:', e)
        );
      })
      .catch((e) => {
        if (e instanceof DatabaseKeyMismatchError) {
          Alert.alert(
            "Data Unavailable",
            "Your chat data could not be decrypted. This can happen after reinstalling the app. " +
            "Your messages may be unrecoverable.",
            [{ text: "OK", style: "cancel" }]
          );
        } else {
          console.error('Failed to open primary database:', e);
        }
      });
  }, [isAuthenticated]);

  // Re-validate DB connections and retry failed inbox entries on foreground resume
  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === 'active' && isAuthenticated && isDbReady) {
        try {
          await reopenAllDatabases();
        } catch (e) {
          console.error('Failed to reopen databases on resume:', e);
        }

        // Retry pending inbox/outbox entries — errors are non-fatal
        try {
          await processInboxRetries(session);
        } catch (e) {
          console.error('Failed to process inbox retries on resume:', e);
        }

        try {
          await processOutboxRetries();
        } catch (e) {
          console.error('Failed to process outbox retries on resume:', e);
        }
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [isAuthenticated, isDbReady, session]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[userId]" />
        <Stack.Screen
          name="contacts"
          options={{
            sheetGrabberVisible: true,
            sheetAllowedDetents: Platform.OS === "ios" ? [0.7, 0.95] : [1],
            presentation: Platform.OS === "ios" ? "formSheet" : "modal",
            contentStyle: {
              backgroundColor: isLiquidGlassAvailable()
                ? "transparent"
                : colors.background as string,
            },
            headerStyle: {
              backgroundColor:
                Platform.OS === "ios"
                  ? "transparent"
                  : colors.background as string,
            },
            headerBlurEffect: isLiquidGlassAvailable() ? undefined : "dark",
          }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="register/index" />
      </Stack.Protected>
    </Stack>
  );
}
