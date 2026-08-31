/**
 * Encryption key and database identity management.
 * Handles secure generation and storage of database encryption keys
 * and UUID-based database identifiers.
 */

import * as SecureStore from 'expo-secure-store';
import { getRandomValues } from 'expo-crypto';
import { v4 as uuidv4 } from 'uuid';

import { DatabaseCredentials } from '@/src/models/db';
import "@/src/polyfills/crypto";


/**
 * Sanitizes a chat ID for use in SecureStore keys.
 * SecureStore keys can only contain alphanumeric characters, ".", "-", and "_".
 */
function sanitizeChatId(chatId: string): string {
    return chatId.replace(/[^a-z0-9.\-_]/gi, '_');
}

/**
 * Retrieves or generates database credentials (encryption key + UUID) for a chat.
 * Both are stored together in SecureStore.
 */
export async function getOrCreateDatabaseCredentials(chatId: string): Promise<DatabaseCredentials> {
    const safeChatId = sanitizeChatId(chatId);
    const alias = `chat_creds_${safeChatId}`;
    const stored = await SecureStore.getItemAsync(alias);

    if (stored) {
        return JSON.parse(stored) as DatabaseCredentials;
    }

    // Generate a 32-byte key (256-bit) for SQLCipher
    const randomBytes = new Uint8Array(32);
    getRandomValues(randomBytes);
    const key = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

    // Generate a UUID for the database filename
    const dbId = uuidv4();

    const credentials: DatabaseCredentials = { key, dbId };
    await SecureStore.setItemAsync(alias, JSON.stringify(credentials), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });

    return credentials;
}

/**
 * Deletes database credentials from SecureStore for a chat.
 */
export async function deleteDatabaseCredentials(chatId: string): Promise<void> {
    const safeChatId = sanitizeChatId(chatId);
    const alias = `chat_creds_${safeChatId}`;
    await SecureStore.deleteItemAsync(alias);
}
