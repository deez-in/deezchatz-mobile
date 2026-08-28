import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { saveToInbox, markInboxProcessed, getContactInfo } from '@/src/utils/storage';
import useSession, { Session } from '@/src/store/useSession';
import { processIncomingMessage } from '@/src/utils/messaging';
import { showMessageNotification } from './local';

export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

/**
 * Registering background tasks must happen synchronously outside a React component.
 * We register with Notifications.registerTaskAsync at module scope to ensure native
 * background push receivers can immediately route headless executions to this handler.
 */
Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK).catch((e) => {
  console.debug('[Background Task] Register task status:', e?.message || e);
});

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
  if (error) {
    console.error(`[Background Task] ${BACKGROUND_NOTIFICATION_TASK} error:`, error);
    return;
  }

  if (!data) {
    return;
  }

  try {
    const pushEvent = data as { notification?: any; data?: any };
    const payloadData = pushEvent.notification?.request?.content?.data || pushEvent.data;

    if (!payloadData) {
      return;
    }

    const topic = payloadData.topic as string | undefined;
    const payload = payloadData.payload as string | undefined;
    const senderId = (payloadData.sender_id || payloadData.sender) as string | undefined;

    // Resolve sender display name from local contacts if available
    let displaySender = 'New message';
    if (senderId) {
      displaySender = senderId;
      try {
        const contact = await getContactInfo(senderId);
        if (contact?.name) {
          displaySender = contact.name;
        } else if (contact?.phone) {
          displaySender = contact.phone;
        }
      } catch {
        // Storage might not be open if app is completely closed — fallback to senderId
      }
    }

    // Zero-ciphertext wake-up push from backend: notify user immediately
    if (!topic || !payload) {
      await showMessageNotification(displaySender, 'New message', {
        topic,
        sender: senderId,
        sender_id: senderId,
      });
      return;
    }

    const session = useSession.getState() as Session;

    if (!session || !session.iKey || session.iKey.length === 0) {
      await showMessageNotification(displaySender, 'New message', {
        topic,
        sender: senderId,
        sender_id: senderId,
      });
      return;
    }

    const inboxId = await saveToInbox(topic, payload);

    try {
      const decryptedPlaintext = await processIncomingMessage(session, topic, payload);
      if (inboxId) {
        await markInboxProcessed(inboxId);
      }

      await showMessageNotification(displaySender, decryptedPlaintext, {
        topic,
        sender: senderId,
        sender_id: senderId,
      });
    } catch {
      await showMessageNotification(displaySender, 'New message received', {
        topic,
        sender: senderId,
        sender_id: senderId,
      });
    }
  } catch (err) {
    console.error('[Background Task] Error executing processing:', err);
  }
});

