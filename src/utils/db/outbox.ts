/**
 * MQTT Outbox — ciphertext-first outgoing message persistence.
 *
 * Mirrors the inbox pattern: messages are encrypted and saved to the outbox
 * BEFORE attempting MQTT publish. If the publish fails (offline, error, etc.),
 * the entry stays 'pending' and is retried when connectivity is restored.
 *
 * Strategy:
 *   1. On send: encrypt message, save plaintext to per-chat DB (status 'pending'),
 *      save ciphertext payload to outbox.
 *   2. Attempt MQTT publish.
 *   3. On success: mark outbox entry as 'sent', update message status.
 *   4. On failure: entry stays 'pending', retried on next MQTT connect.
 *
 * The outbox stores encrypted ciphertext — no additional plaintext exposure.
 */

import { openPrimaryDatabase } from '@/src/clients/sqliteClient';
import { OutboxEntry } from '@/src/models/db';

const MAX_RETRIES = 5;

// ---------------------------------------------------------------------------
// Write side (called from send flow)
// ---------------------------------------------------------------------------

/**
 * Saves an encrypted payload to the outbox table.
 * Called AFTER encryption but BEFORE MQTT publish.
 * Returns the new row id.
 */
export async function saveToOutbox(
    chatId: string,
    messageId: string,
    topic: string,
    payload: string
): Promise<number> {
    const db = await openPrimaryDatabase();
    const result = await db.runAsync(
        `INSERT INTO outbox (chat_id, message_id, payload, topic, created_at, status, retry_count)
         VALUES (?, ?, ?, ?, ?, 'pending', 0)`,
        chatId,
        messageId,
        payload,
        topic,
        Date.now()
    );
    return result.lastInsertRowId;
}

/**
 * Marks an outbox entry as successfully sent.
 */
export async function markOutboxSent(id: number): Promise<void> {
    const db = await openPrimaryDatabase();
    await db.runAsync(
        `UPDATE outbox SET status = 'sent', sent_at = ? WHERE id = ?`,
        Date.now(),
        id
    );
}

/**
 * Marks an outbox entry as permanently failed (exceeded max retries).
 */
export async function markOutboxFailed(id: number): Promise<void> {
    const db = await openPrimaryDatabase();
    await db.runAsync(
        `UPDATE outbox SET status = 'failed', sent_at = ? WHERE id = ?`,
        Date.now(),
        id
    );
}

/**
 * Increments the retry counter for a pending entry.
 * Automatically marks as 'failed' if MAX_RETRIES is exceeded.
 */
export async function incrementOutboxRetry(id: number): Promise<void> {
    const db = await openPrimaryDatabase();
    await db.runAsync(
        `UPDATE outbox
         SET retry_count = retry_count + 1,
             status = CASE WHEN retry_count + 1 >= ${MAX_RETRIES} THEN 'failed' ELSE 'pending' END
         WHERE id = ?`,
        id
    );
}

// ---------------------------------------------------------------------------
// Read side (called for retry on MQTT reconnect)
// ---------------------------------------------------------------------------

/**
 * Returns all outbox entries that are pending retry.
 */
export async function getPendingOutboxEntries(): Promise<OutboxEntry[]> {
    const db = await openPrimaryDatabase();
    return db.getAllAsync<OutboxEntry>(
        `SELECT * FROM outbox WHERE status = 'pending'
         ORDER BY created_at ASC`
    );
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

/**
 * Deletes sent/failed entries older than the given age in milliseconds.
 * Call periodically (e.g., on app launch) to prevent outbox from growing.
 * Default: prune entries older than 7 days.
 */
export async function pruneOutbox(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const db = await openPrimaryDatabase();
    const cutoff = Date.now() - olderThanMs;
    await db.runAsync(
        `DELETE FROM outbox
         WHERE status IN ('sent', 'failed') AND created_at < ?`,
        cutoff
    );
}
