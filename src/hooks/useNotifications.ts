import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import useSession from '@/src/store/useSession';
import { getContactByUserId } from '@/src/utils/storage';
import {
  requestNotificationPermission,
  fetchDeviceToken,
  registerTokenWithBackend,
  setupNotificationChannel,
  BACKGROUND_NOTIFICATION_TASK,
} from '@/src/utils/notifications';



export default function useNotifications(isAuthenticated: boolean) {
  const { pushToken, pushTokenRegistered, setPushToken, setPushTokenRegistered, googleOauthToken } = useSession((s) => s);

  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  // 1. One-time setup: Permissions, Background Task, and Listeners
  useEffect(() => {
    setupNotificationChannel();
    if (!isAuthenticated) return;

    async function setupCore() {
      const status = await requestNotificationPermission();
      if (status !== 'granted') return;

      try {
        await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      } catch (e) {
        console.error('Error registering push background task:', e);
      }
    }
    setupCore();

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      // no-op for foreground data pushes handled by MQTT
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      const senderId = (data?.sender_id || data?.sender) as string | undefined;
      if (senderId) {
        getContactByUserId(senderId)
          .then(phone => {
            router.push(`/chat/${phone || senderId}`);
          })
          .catch(() => {
            router.push(`/chat/${senderId}`);
          });
      }
    });

    return () => {
      if (notificationListener.current) notificationListener.current.remove();
      if (responseListener.current) responseListener.current.remove();
    };
  }, [isAuthenticated]);

  // 2. Token Sync: Listens to state changes and syncs token safely
  useEffect(() => {
    if (!isAuthenticated || !googleOauthToken) return;

    let isMounted = true;

    async function syncToken() {
      if (!googleOauthToken) return;
      const token = await fetchDeviceToken();
      if (!token) return;

      if (isMounted && pushToken !== token) {
        setPushToken(token);
      }

      if (!pushTokenRegistered || pushToken !== token) {
        const success = await registerTokenWithBackend(token);
        if (isMounted && success) {
          setPushTokenRegistered(true);
        }
      }
    }
    syncToken();

    return () => { isMounted = false; };
  }, [isAuthenticated, googleOauthToken, pushToken, pushTokenRegistered, setPushToken, setPushTokenRegistered]);
}
