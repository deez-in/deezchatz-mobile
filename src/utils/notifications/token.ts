import * as Notifications from 'expo-notifications';
import useSession from '@/src/store/useSession';
import { apiRequest, ApiError } from '@/src/clients/apiClient';
import { withRetry, BailoutError } from '@/src/utils/helpers/retry';

/**
 * Retrieves the raw FCM or APNs device push token.
 * This does NOT use the Expo push token relay service.
 */
export async function fetchDeviceToken(): Promise<string | null> {
  try {
    // Explicitly getting the device push token, not ExpoPushToken
    const tokenData = await Notifications.getDevicePushTokenAsync();
    return tokenData.data;
  } catch (error) {
    console.warn('Failed to get device push token:', error);
    return null;
  }
}

export async function registerTokenWithBackend(
  deviceToken: string
): Promise<boolean> {
  const session = useSession.getState();
  if (!session.deviceId || !session.userId) {
    return false;
  }
  try {
    await withRetry(
      async () => {
        try {
          return await apiRequest("/register/device/fcm", {
            method: "POST",
            authenticated: true,
            body: {
              deviceId: session.deviceId,
              fcmToken: deviceToken,
            },
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            throw new BailoutError(error);
          }
          throw error;
        }
      },
      { maxAttempts: 5, initialDelay: 1000, backoffFactor: 2 }
    );
    return true;
  } catch (e) {
    console.error("[Push Token] Failed to register FCM token:", e);
    return false;
  }
}
