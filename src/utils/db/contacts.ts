/**
 * Contacts mapping operations.
 * Maps phone numbers to server-assigned UUIDs (user_id) and device contacts (contact_id).
 */

import { openPrimaryDatabase } from '@/src/clients/sqliteClient';
import { ContactMapping } from '@/src/models/db';

/**
 * Saves or updates a mapping between phone number and UUID, along with optional server picture and contact name.
 */
export async function saveContact(phone: string, userId: string, picture?: string | null, name?: string | null): Promise<void> {
    const db = await openPrimaryDatabase();
    const now = Date.now();

    await db.runAsync(
        `INSERT INTO contacts (phone, user_id, picture, name, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(phone) DO UPDATE SET
             user_id = excluded.user_id,
             picture = COALESCE(excluded.picture, contacts.picture),
             name = COALESCE(excluded.name, contacts.name),
             created_at = excluded.created_at`,
        phone,
        userId,
        picture || null,
        name || null,
        now
    );
}

import { normalizePhone } from '@/src/utils/helpers/phone';

/**
 * Resolves a phone number to a server UUID.
 */
export async function getContactByPhone(phone: string): Promise<string | undefined> {
    const db = await openPrimaryDatabase();
    const rows = await db.getAllAsync<{ user_id: string, phone: string }>(
        'SELECT user_id, phone FROM contacts'
    );
    const normalizedTarget = normalizePhone(phone);
    const match = rows.find(r => r.phone && normalizePhone(r.phone) === normalizedTarget);
    return match?.user_id;
}

/**
 * Resolves a server UUID to a phone number.
 */
export async function getContactByUserId(userId: string): Promise<string | undefined> {
    const db = await openPrimaryDatabase();
    const row = await db.getFirstAsync<{ phone: string }>(
        'SELECT phone FROM contacts WHERE user_id = ?',
        userId
    );
    return row?.phone;
}

/**
 * Loads full contact mapping info by server UUID.
 */
export async function getContactInfo(userId: string): Promise<ContactMapping | undefined> {
    const db = await openPrimaryDatabase();
    const row = await db.getFirstAsync<ContactMapping>(
        'SELECT phone, user_id, contact_id, name, picture, created_at FROM contacts WHERE user_id = ?',
        userId
    );
    return row || undefined;
}

/**
 * Loads all known contacts from the database.
 */
export async function getAllContacts(): Promise<ContactMapping[]> {
    const db = await openPrimaryDatabase();
    return db.getAllAsync<ContactMapping>(
        'SELECT phone, user_id, contact_id, name, picture, created_at FROM contacts'
    );
}

/**
 * Batch updates device contact IDs and names.
 */
export async function batchSyncDeviceContacts(
    entries: { phone: string; contactId: string; name: string }[]
): Promise<void> {
    if (entries.length === 0) return;
    const db = await openPrimaryDatabase();
    
    await db.withTransactionAsync(async () => {
        for (const entry of entries) {
            await db.runAsync(
                `UPDATE contacts 
                 SET contact_id = ?, name = ? 
                 WHERE phone = ?`,
                entry.contactId,
                entry.name,
                entry.phone
            );
        }
    });
}

/** Bundle sync cooldown in milliseconds (15 minutes). */
const SYNC_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Updates a contact's identity key and picture from a bundle sync.
 * Detects identity key changes — first-time population (null → value) is NOT a change.
 *
 * @returns Whether the key or picture changed, or undefined if the contact was not found.
 */
export async function updateContactBundle(
    userId: string,
    identityKey: string,
    picture: string | null
): Promise<{ keyChanged: boolean; pictureChanged: boolean } | undefined> {
    const db = await openPrimaryDatabase();
    const now = Date.now();

    // Read current values
    const current = await db.getFirstAsync<{
        identity_key: string | null;
        picture: string | null;
    }>(
        'SELECT identity_key, picture FROM contacts WHERE user_id = ?',
        userId
    );

    if (!current) return undefined;

    const keyChanged = current.identity_key !== null && current.identity_key !== identityKey;
    const pictureChanged = current.picture !== picture;

    await db.runAsync(
        `UPDATE contacts
         SET identity_key = ?,
             picture = COALESCE(?, contacts.picture),
             identity_key_changed = CASE WHEN ? = 1 THEN 1 ELSE identity_key_changed END,
             last_synced_at = ?
         WHERE user_id = ?`,
        identityKey,
        picture,
        keyChanged ? 1 : 0,
        now,
        userId
    );

    return { keyChanged, pictureChanged };
}

/**
 * Resets the identity_key_changed flag for a contact.
 * Called when the user dismisses the key-change banner.
 */
export async function acknowledgeKeyChange(userId: string): Promise<void> {
    const db = await openPrimaryDatabase();
    await db.runAsync(
        'UPDATE contacts SET identity_key_changed = 0 WHERE user_id = ?',
        userId
    );
}

/**
 * Checks whether a contact should be synced (15-minute cooldown).
 * Returns true if the contact has never been synced or was last synced more than 15 minutes ago.
 */
export async function shouldSyncContact(userId: string): Promise<boolean> {
    const db = await openPrimaryDatabase();
    const row = await db.getFirstAsync<{ last_synced_at: number | null }>(
        'SELECT last_synced_at FROM contacts WHERE user_id = ?',
        userId
    );

    if (!row || row.last_synced_at === null) return true;
    return Date.now() - row.last_synced_at > SYNC_COOLDOWN_MS;
}
