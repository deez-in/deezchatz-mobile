import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export const MESSAGES_CHANNEL_ID = 'messages';

// Configure global notification presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Initializes notification categories and channels.
 * Must be called as early as possible on app startup or before scheduling.
 */
export async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    // MAX importance needed to display heads-up notifications clearly in background
    await Notifications.setNotificationChannelAsync(MESSAGES_CHANNEL_ID, {
      name: 'Messages',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFCC00',
      showBadge: true,
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

/**
 * Present a local notification representing an incoming message.
 */
export async function showMessageNotification(
  sender: string,
  body: string,
  data: Record<string, any> = {}
) {
  // Ensure channel exists before scheduling on Android (critical for headless background tasks)
  await setupNotificationChannel();

  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(sender.trim());
  const displaySender = isUUID ? 'New message' : sender.trim();

  const title = displaySender.startsWith('Message from') || displaySender.toLowerCase() === 'new message'
    ? (displaySender.toLowerCase() === 'new message' ? 'New message' : displaySender)
    : `Message from ${displaySender}`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: { sender, ...data },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: Platform.OS === 'android' ? { channelId: MESSAGES_CHANNEL_ID } : null,
  });
}


