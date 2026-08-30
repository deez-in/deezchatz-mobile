/**
 * MQTT Inbox — ciphertext-first message persistence.
 *
 * Because CocoaMQTT auto-ACKs QoS 1 messages at the protocol level before
 * the JS layer sees them, the broker will never redeliver a message if our
 * app-level processing (crypto + per-chat DB save) fails.
 *
 * Strategy:
 *   1. On MQTT message received: immediately write raw payload to inbox (fast,
 *      no crypto, uses primary DB which is always open).
 *   2. Attempt full processing (decrypt + save to per-chat DB).
 *   3. On success: mark inbox entry as processed.
 *   4. On failure: entry stays 'pending' and is retried on next app foreground.
 *
 * The inbox stores encrypted ciphertext — it cannot be read without the
 * ratchet session, so there is no additional plaintext exposure risk.
 */

import { openPrimaryDatabase } from './database';

const MAX_RETRIES = 5;

export type InboxStatus = 'pending' | 'processed' | 'failed';

export interface InboxEntry {
    id: number;
    topic: string;
    payload: string;    // raw JSON from MQTT (encrypted ciphertext)
    received_at: number;
    status: InboxStatus;
    retry_count: number;
    processed_at: number | null;
}

// ---------------------------------------------------------------------------
// Write side (called from MQTT handler)
// ---------------------------------------------------------------------------

/**
 * Writes a raw MQTT payload to the inbox table.
 * This is the FIRST thing called on message receipt, before any crypto.
 * Returns the new row id.
 */
export async function saveToInbox(topic: string, payload: string): Promise<number> {
    const db = await openPrimaryDatabase();
    const result = await db.runAsync(
        `INSERT INTO inbox (topic, payload, received_at, status, retry_count)
         VALUES (?, ?, ?, 'pending', 0)`,
        topic,
        payload,
        Date.now()
    );
    return result.lastInsertRowId;
}

/**
 * Marks an inbox entry as successfully processed.
 */
export async function markInboxProcessed(id: number): Promise<void> {
    const db = await openPrimaryDatabase();
    await db.runAsync(
        `UPDATE inbox SET status = 'processed', processed_at = ? WHERE id = ?`,
        Date.now(),
        id
    );
}

/**
 * Deletes an inbox entry by id (e.g. if the message sender is blocked).
 */
export async function deleteFromInbox(id: number): Promise<void> {
    const db = await openPrimaryDatabase();
    await db.runAsync('DELETE FROM inbox WHERE id = ?', id);
}


/**
 * Increments the retry counter for a pending entry.
 * Automatically marks as 'failed' if MAX_RETRIES is exceeded.
 */
export async function incrementInboxRetry(id: number): Promise<void> {
    const db = await openPrimaryDatabase();
    await db.runAsync(
        `UPDATE inbox
         SET retry_count = retry_count + 1,
             status = CASE WHEN retry_count + 1 >= ${MAX_RETRIES} THEN 'failed' ELSE 'pending' END
         WHERE id = ?`,
        id
    );
}

// ---------------------------------------------------------------------------
// Read side (called for retry on foreground resume)
// ---------------------------------------------------------------------------

/**
 * Returns all inbox entries that are pending retry.
 */
export async function getPendingInboxEntries(): Promise<InboxEntry[]> {
    const db = await openPrimaryDatabase();
    return db.getAllAsync<InboxEntry>(
        `SELECT * FROM inbox WHERE status = 'pending'
         ORDER BY received_at ASC`
    );
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

/**
 * Deletes processed/failed entries older than the given age in milliseconds.
 * Call periodically (e.g., on app launch) to prevent inbox from growing.
 * Default: prune entries older than 7 days.
 */
export async function pruneInbox(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const db = await openPrimaryDatabase();
    const cutoff = Date.now() - olderThanMs;
    await db.runAsync(
        `DELETE FROM inbox
         WHERE status IN ('processed', 'failed') AND received_at < ?`,
        cutoff
    );
}
