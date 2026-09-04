/**
 * Device contacts synchronization engine.
 * Syncs device contact names and IDs with registered contacts in our database.
 */

import { Contact, ContactField, getPermissionsAsync } from "expo-contacts";

import { getAllContacts, batchSyncDeviceContacts } from "@/src/utils/db/contacts";
import { notifyChatListListeners } from "@/src/utils/db/chatList";
import { normalizePhone } from "@/src/utils/helpers/phone";
import useSession from "@/src/store/useSession";

// Store last sync time in memory to debounce sync queries
let lastSyncTime = 0;
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Syncs device contact names and IDs with registered contacts in our database.
 * Does not request permissions, only performs sync if permission has already been granted.
 */
export async function syncDeviceContacts(force = false): Promise<void> {
    const now = Date.now();

    try {
        const { status } = await getPermissionsAsync();
        if (status !== "granted") {
            return;
        }

        const dbContacts = await getAllContacts();
        if (dbContacts.length === 0) {
            return;
        }

        const hasUnnamedContacts = dbContacts.some((c) => !c.name);
        if (!force && !hasUnnamedContacts && now - lastSyncTime < SYNC_COOLDOWN_MS) {
            return;
        }

        const deviceContacts = await Contact.getAllDetails([
            ContactField.FULL_NAME,
            ContactField.GIVEN_NAME,
            ContactField.FAMILY_NAME,
            ContactField.PHONES,
        ]);

        if (!deviceContacts || deviceContacts.length === 0) {
            return;
        }

        const userCountryCode = useSession.getState().phone?.countryCode;

        // Build mapping of normalizedPhone -> { contactId, name }
        const phoneToContactMap = new Map<string, { contactId: string; name: string }>();

        for (const contact of deviceContacts) {
            if (!contact.phones || !Array.isArray(contact.phones)) {
                continue;
            }

            // @ts-ignore - fallback to legacy name property in case native module hasn't updated
            const rawName = contact.fullName || contact.name || [contact.givenName, contact.familyName].filter(Boolean).join(' ');
            const fullName = rawName?.trim();
            if (!fullName) continue;

            for (const phone of contact.phones) {
                if (!phone || !phone.number) continue;

                const normalized = normalizePhone(phone.number, userCountryCode);
                if (!normalized) continue;

                phoneToContactMap.set(normalized, {
                    contactId: contact.id,
                    name: fullName,
                });
            }
        }

        // Identify which DB contacts need updating
        const updates: { phone: string; contactId: string; name: string }[] = [];

        for (const dbContact of dbContacts) {
            const match = phoneToContactMap.get(normalizePhone(dbContact.phone, userCountryCode));
            if (match) {
                // If contact_id or name changed, queue an update
                if (dbContact.contact_id !== match.contactId || dbContact.name !== match.name) {
                    updates.push({
                        phone: dbContact.phone,
                        contactId: match.contactId,
                        name: match.name,
                    });
                }
            }
        }

        if (updates.length > 0) {
            await batchSyncDeviceContacts(updates);
            notifyChatListListeners();
        }

        lastSyncTime = now;
    } catch (e) {
        console.error("[SyncContacts] Failed to sync contacts:", e);
    }
}
