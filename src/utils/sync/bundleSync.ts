/**
 * Bundle sync engine.
 * Fetches a contact's latest identity key and profile picture from the server
 * and updates local state. Detects identity key changes, invalidates ratchet
 * sessions, and inserts system messages into chat history.
 *
 * Uses `GET /bundle/sync/:userId` — a read-only endpoint that does NOT consume OPKs.
 */

import { apiRequest } from '../transport/api';
import { updateContactBundle, shouldSyncContact } from '../storage/contacts';
import { saveSystemMessage } from '../storage/messages';
import { clearSession } from '../crypto/ratchet';
import { notifyChatListListeners } from '../storage/chatList';

export interface UserSyncInfo {
    userId: string;
    identityKey: string;
    picture?: string | null;
    displayName?: string | null;
}

/**
 * Fetches the latest bundle info for a contact and updates local state.
 *
 * - Respects a 15-minute per-contact cooldown (skips if recently synced).
 * - On identity key change: clears the ratchet session and inserts a system message.
 * - On picture change: notifies chat list listeners for UI refresh.
 * - Returns null if the sync was skipped (cooldown) or failed (offline/error).
 *
 * @param userId  The server-assigned UUID of the contact.
 * @param force   If true, ignores the cooldown and always syncs.
 */
export async function syncContactBundle(
    userId: string,
    force = false
): Promise<{
    keyChanged: boolean;
    pictureChanged: boolean;
} | null> {
    // Check cooldown unless forced
    if (!force) {
        const shouldSync = await shouldSyncContact(userId);
        if (!shouldSync) return null;
    }

    // Fetch from server — failures are non-critical
    let info: UserSyncInfo;
    try {
        info = await apiRequest<UserSyncInfo>(
            `/bundle/sync/${encodeURIComponent(userId)}`,
            { authenticated: true }
        );
    } catch (e) {
        console.warn(`[BundleSync] Failed to fetch bundle for ${userId}:`, e);
        return null;
    }

    if (!info || !info.identityKey) {
        console.warn(`[BundleSync] Invalid response for ${userId}`);
        return null;
    }

    // Compare and update local state
    const result = await updateContactBundle(userId, info.identityKey, info.picture ?? null);
    if (!result) {
        // Contact not found in local DB
        return null;
    }

    if (result.keyChanged) {
        // Invalidate the ratchet session — next send will re-do X3DH
        await clearSession(userId).catch((e) =>
            console.warn(`[BundleSync] Failed to clear session for ${userId}:`, e)
        );

        // Insert a system message into chat history
        await saveSystemMessage(
            userId,
            '🔒 Security info has changed. Messages will use a new session.'
        ).catch((e) =>
            console.warn(`[BundleSync] Failed to save system message for ${userId}:`, e)
        );

        notifyChatListListeners();
    } else if (result.pictureChanged) {
        notifyChatListListeners();
    }

    return result;
}
