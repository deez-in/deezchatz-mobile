/**
 * Chat session persistence.
 * Handles saving and loading per-chat session state (ratchet state + identity key)
 * in the per-chat SQLite database.
 *
 * Errors propagate to callers — do not silently swallow failures.
 */

import { openChatDatabase } from '@/src/clients/sqliteClient';
import { ChatSession } from '@/src/models/db';

const SESSION_KEY = 'chat_session';

/**
 * Saves a chat session to the SQLite database.
 *
 * @throws StorageError on write failure
 */
export async function saveChatSession(userId: string, session: ChatSession): Promise<void> {
    const db = await openChatDatabase(userId);
    await db.runAsync(
        `INSERT OR REPLACE INTO sessions (key, value, updated_at) VALUES (?, ?, ?)`,
        SESSION_KEY,
        JSON.stringify(session),
        Date.now()
    );
}

/**
 * Loads a chat session from the SQLite database.
 * Returns undefined if no session has been stored yet.
 *
 * @throws StorageError on read failure
 */
export async function loadChatSession(userId: string): Promise<ChatSession | undefined> {
    const db = await openChatDatabase(userId);
    const row = await db.getFirstAsync<{ value: string }>(
        `SELECT value FROM sessions WHERE key = ?`,
        SESSION_KEY
    );
    if (row) {
        return JSON.parse(row.value) as ChatSession;
    }
    return undefined;
}

/**
 * Deletes a chat session from the SQLite database.
 *
 * @throws StorageError on write failure
 */
export async function deleteChatSession(userId: string): Promise<void> {
    const db = await openChatDatabase(userId);
    await db.runAsync(
        `DELETE FROM sessions WHERE key = ?`,
        SESSION_KEY
    );
}
