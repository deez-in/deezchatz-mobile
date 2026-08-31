/**
 * Contact blocking and reporting storage operations.
 */

import { openPrimaryDatabase } from '@/src/clients/sqliteClient';

/**
 * Blocks a contact by user UUID.
 */
export async function blockContact(userId: string): Promise<void> {
    const db = await openPrimaryDatabase();
    await db.runAsync(
        'UPDATE contacts SET blocked = 1 WHERE user_id = ?',
        userId
    );
}

/**
 * Unblocks a contact by user UUID.
 */
export async function unblockContact(userId: string): Promise<void> {
    const db = await openPrimaryDatabase();
    await db.runAsync(
        'UPDATE contacts SET blocked = 0 WHERE user_id = ?',
        userId
    );
}

/**
 * Checks if a contact is currently blocked.
 */
export async function isContactBlocked(userId: string): Promise<boolean> {
    const db = await openPrimaryDatabase();
    const row = await db.getFirstAsync<{ blocked: number | null }>(
        'SELECT blocked FROM contacts WHERE user_id = ?',
        userId
    );
    return Boolean(row?.blocked === 1);
}
