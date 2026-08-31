/**
 * Chat list operations.
 * CRUD and pub/sub for the chats table in the primary database.
 *
 * Errors propagate to callers — do not silently return empty arrays.
 * The UI layer is responsible for catching StorageError and showing
 * appropriate feedback.
 */

import { openPrimaryDatabase } from '@/src/clients/sqliteClient';
import { ChatThread, ChatListListener } from '@/src/models/db';

const chatListListeners: Set<ChatListListener> = new Set();

/**
 * Subscribe to chat list updates.
 * Returns an unsubscribe function.
 */
export function subscribeToChatList(listener: ChatListListener): () => void {
    chatListListeners.add(listener);
    return () => chatListListeners.delete(listener);
}

/**
 * Notify all chat list listeners of an update.
 */
export function notifyChatListListeners(): void {
    chatListListeners.forEach(l => l());
}

/**
 * Inserts or updates a chat thread when a message is sent/received.
 *
 * @throws StorageError on write failure
 */
export async function upsertChatThread(userId: string, lastMessage: string, phone?: string | null): Promise<void> {
    const db = await openPrimaryDatabase();
    const now = Date.now();

    let resolvedPhone = phone || null;
    if (!resolvedPhone) {
        const contactRow = await db.getFirstAsync<{ phone: string }>(
            'SELECT phone FROM contacts WHERE user_id = ?',
            userId
        );
        resolvedPhone = contactRow?.phone || null;
    }

    await db.runAsync(
        `INSERT INTO chats (user_id, phone, last_message, last_message_at, unread_count, updated_at)
         VALUES (?, ?, ?, ?, 0, ?)
         ON CONFLICT(user_id) DO UPDATE SET
             phone = COALESCE(excluded.phone, chats.phone),
             last_message = excluded.last_message,
             last_message_at = excluded.last_message_at,
             updated_at = excluded.updated_at`,
        userId,
        resolvedPhone,
        lastMessage,
        now,
        now
    );

    notifyChatListListeners();
}

/**
 * Returns all chat threads ordered by most recent first.
 *
 * @throws StorageError on read failure
 */
export async function getChatThreads(): Promise<ChatThread[]> {
    const db = await openPrimaryDatabase();
    return db.getAllAsync<ChatThread>(
        `SELECT c.user_id, c.phone, c.last_message, c.last_message_at, 
                c.unread_count, c.updated_at,
                ct.name, ct.picture
         FROM chats c
         LEFT JOIN contacts ct ON c.user_id = ct.user_id
         ORDER BY c.updated_at DESC`
    );
}
