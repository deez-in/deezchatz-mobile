/**
 * Device contacts utilities.
 * Fetches contacts from the device's address book.
 */

import { Contact, ContactField, ContactsSortOrder, requestPermissionsAsync, getPermissionsAsync, PermissionStatus } from "expo-contacts";
import { SplitContact } from "@/src/models/contact";


export async function getContactsPermissionStatus(): Promise<PermissionStatus> {
    const { status } = await getPermissionsAsync();
    return status;
}

export async function requestContactsPermission(): Promise<PermissionStatus> {
    const { status } = await requestPermissionsAsync();
    return status;
}

/**
 * Fetches contacts from the device with phone numbers split into separate entries.
 */
export async function getContacts(): Promise<SplitContact[] | null> {
    const splitContacts: SplitContact[] = [];
    const { status } = await requestPermissionsAsync();

    if (status !== "granted") {
        return splitContacts;
    }

    const contacts = await Contact.getAllDetails(
        [ContactField.GIVEN_NAME, ContactField.FAMILY_NAME, ContactField.PHONES],
        { sortOrder: ContactsSortOrder.GivenName },
    );

    const seenNumbers = new Set<string>();

    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];

        if (!contact.phones || !Array.isArray(contact.phones) || contact.phones.length === 0) {
            continue;
        }

        for (let j = 0; j < contact.phones.length; j++) {
            const phone = contact.phones[j];
            if (!phone || !phone.number) continue;

            // Normalize phone number to eliminate duplicates
            const normalized = phone.number.replace(/[^0-9+]/g, "");
            if (!normalized) continue;

            if (seenNumbers.has(normalized)) continue;
            seenNumbers.add(normalized);

            splitContacts.push({
                firstName: contact.givenName ?? (phone.number as string),
                lastName: contact.familyName,
                id: contact.id + "/" + j,
                number: phone.number,
                label: phone.label ?? "mobile",
            });
        }
    }
    return splitContacts;
}
