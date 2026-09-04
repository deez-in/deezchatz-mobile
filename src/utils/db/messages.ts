/**
 * Message CRUD operations.
 * Handles reading and writing messages to the per-chat database.
 *
 * DB lifecycle contract:
 *   - getMessages / saveMessage: require the DB to already be open.
 *     Use these in the chat screen which manages its own DB connection.
 *   - saveMessageWithAutoOpen: opens/closes the DB itself.
 *     Use this in background contexts (MQTT handler, inbox retry).
 */

import { openChatDatabase, closeChatDatabase, isDatabaseOpen, requireChatDatabase } from '@/src/clients/sqliteClient';
import { generateMessageId } from '../helpers/formatting';
import { upsertChatThread } from './chatList';
import { Message, MessageListener } from '@/src/models/db';

const listeners: MessageListener[] = [];

/**
 * Subscribe to message updates.
 */
export function subscribeToMessages(listener: MessageListener): () => void {
    listeners.push(listener);
    return () => {
        const index = listeners.indexOf(listener);
        if (index > -1) listeners.splice(index, 1);
    };
}

/**
 * Notify all listeners of a message update.
 */
function notifyListeners(chatId: string): void {
    listeners.forEach(l => l(chatId));
}

/**
 * Retrieves all messages for a chat, ordered by time.
 * REQUIRES the chat DB to already be open (call openChatDatabase first).
 *
 * @throws DatabaseConnectionError if the DB is not open
 */
export async function getMessages(chatId: string): Promise<Message[]> {
    const db = requireChatDatabase(chatId);
    const rows = await db.getAllAsync<Message>(
        'SELECT * FROM messages ORDER BY created_at ASC'
    );
    return rows;
}

/**
 * Saves a message to the chat database.
 * REQUIRES the chat DB to already be open (the chat screen manages this).
 *
 * @throws DatabaseConnectionError if the DB is not open
 * @throws StorageError on write failure
 */
export async function saveMessage(
    chatId: string,
    message: {
        id?: string;
        content: string;
        sender_id: string;
        status?: Message['status'];
        created_at?: number;
        received_at?: number | null;
        type?: Message['type'];
    }
): Promise<string> {
    const db = requireChatDatabase(chatId);
    const id = message.id ?? generateMessageId();
    const created_at = message.created_at ?? Date.now();
    const received_at = message.received_at ?? null;

    await db.runAsync(
        'INSERT INTO messages (id, content, sender_id, created_at, received_at, status, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
        id,
        message.content,
        message.sender_id,
        created_at,
        received_at,
        message.status ?? 'sent',
        message.type ?? 'message'
    );

    // Update chat list in primary DB
    const preview = message.type === 'voice' ? '🎤 Voice message' : message.content;
    await upsertChatThread(chatId, preview);
    notifyListeners(chatId);
    return id;
}

/**
 * Updates the status of a message in the per-chat database.
 * REQUIRES the chat DB to already be open.
 *
 * @throws DatabaseConnectionError if the DB is not open
 */
export async function updateMessageStatus(
    chatId: string,
    messageId: string,
    status: Message['status']
): Promise<void> {
    const db = requireChatDatabase(chatId);
    await db.runAsync(
        'UPDATE messages SET status = ? WHERE id = ?',
        status,
        messageId
    );
    notifyListeners(chatId);
}

/**
 * Updates a message status, opening/closing the DB itself.
 * Use in background contexts (outbox retry) where the chat screen
 * may not be managing the DB lifecycle.
 */
export async function updateMessageStatusWithAutoOpen(
    chatId: string,
    messageId: string,
    status: Message['status']
): Promise<void> {
    const wasAlreadyOpen = isDatabaseOpen(chatId);
    await openChatDatabase(chatId);

    try {
        const db = requireChatDatabase(chatId);
        await db.runAsync(
            'UPDATE messages SET status = ? WHERE id = ?',
            status,
            messageId
        );
        notifyListeners(chatId);
    } finally {
        if (!wasAlreadyOpen) {
            await closeChatDatabase(chatId);
        }
    }
}

/**
 * Saves a message using auto-open/close lifecycle.
 * Use in background contexts (MQTT handler, inbox retry).
 *
 * @throws StorageError on write failure
 */
export async function saveMessageWithAutoOpen(
    chatId: string,
    message: {
        id?: string;
        content: string;
        sender_id: string;
        status?: Message['status'];
        created_at?: number;
        received_at?: number | null;
        type?: Message['type'];
    }
): Promise<string> {
    const wasAlreadyOpen = isDatabaseOpen(chatId);
    const db = await openChatDatabase(chatId);

    try {
        const id = message.id ?? generateMessageId();
        const created_at = message.created_at ?? Date.now();
        const received_at = message.received_at ?? null;

        await db.runAsync(
            'INSERT INTO messages (id, content, sender_id, created_at, received_at, status, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
            id,
            message.content,
            message.sender_id,
            created_at,
            received_at,
            message.status ?? 'sent',
            message.type ?? 'message'
        );

        const preview = message.type === 'voice' ? '🎤 Voice message' : message.content;
        await upsertChatThread(chatId, preview);
        notifyListeners(chatId);
        return id;
    } finally {
        // Only close if we opened it ourselves — don't close a DB the chat screen is using
        if (!wasAlreadyOpen) {
            await closeChatDatabase(chatId);
        }
    }
}

/**
 * Saves a system message (e.g., "security info changed") to the chat database.
 * Uses auto-open/close lifecycle so it works from any context.
 */
export async function saveSystemMessage(
    chatId: string,
    content: string
): Promise<string> {
    const wasAlreadyOpen = isDatabaseOpen(chatId);
    const db = await openChatDatabase(chatId);

    try {
        const id = generateMessageId();
        // Subtract 1ms to guarantee it appears before the immediately following user message
        const created_at = Date.now() - 1;

        await db.runAsync(
            "INSERT INTO messages (id, content, sender_id, created_at, status, type) VALUES (?, ?, ?, ?, ?, ?)",
            id,
            content,
            'system',
            created_at,
            'sent',
            'system'
        );

        notifyListeners(chatId);
        return id;
    } finally {
        if (!wasAlreadyOpen) {
            await closeChatDatabase(chatId);
        }
    }
}
