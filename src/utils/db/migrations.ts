/**
 * SQLite database migrations for chat and primary databases.
 */

import * as SQLite from 'expo-sqlite';

/**
 * Schema migration for a per-chat encrypted database.
 */
export async function migrateChatDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY NOT NULL,
            content TEXT,
            sender_id TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            received_at INTEGER,
            status TEXT DEFAULT 'sent'
        );

        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

        CREATE TABLE IF NOT EXISTS sessions (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );
    `);

    // Self-healing: add type column to messages table if it doesn't exist
    try {
        await db.execAsync("ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'message';");
    } catch {}

    // Self-healing: add received_at column to messages table if it doesn't exist
    try {
        await db.execAsync("ALTER TABLE messages ADD COLUMN received_at INTEGER;");
    } catch {}

    await db.execAsync('PRAGMA user_version = 1;');
}

/**
 * Schema migration for the primary database.
 */
export async function migratePrimaryDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
    await db.execAsync(`
        CREATE TABLE IF NOT EXISTS chats (
            user_id       TEXT PRIMARY KEY NOT NULL,
            phone         TEXT,
            last_message  TEXT,
            last_message_at INTEGER NOT NULL,
            unread_count  INTEGER DEFAULT 0,
            updated_at    INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);

        CREATE TABLE IF NOT EXISTS inbox (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            topic       TEXT NOT NULL,
            payload     TEXT NOT NULL,
            received_at INTEGER NOT NULL,
            status      TEXT NOT NULL DEFAULT 'pending',
            retry_count INTEGER NOT NULL DEFAULT 0,
            processed_at INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox(status);

        CREATE TABLE IF NOT EXISTS outbox (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id      TEXT NOT NULL,
            message_id   TEXT NOT NULL,
            payload      TEXT NOT NULL,
            topic        TEXT NOT NULL,
            created_at   INTEGER NOT NULL,
            status       TEXT NOT NULL DEFAULT 'pending',
            retry_count  INTEGER NOT NULL DEFAULT 0,
            sent_at      INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);

        CREATE TABLE IF NOT EXISTS contacts (
            phone      TEXT PRIMARY KEY NOT NULL,
            user_id    TEXT NOT NULL UNIQUE,
            contact_id TEXT,
            name       TEXT,
            picture    TEXT,
            created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
    `);

    // Self-healing: add phone column to chats table if it doesn't exist
    try {
        await db.execAsync('ALTER TABLE chats ADD COLUMN phone TEXT;');
    } catch {
        // Column already exists or table doesn't support alter in this state, ignore
    }

    // Self-healing: add contact_id, name, and picture columns to contacts table if they don't exist
    try {
        await db.execAsync('ALTER TABLE contacts ADD COLUMN contact_id TEXT;');
    } catch {}
    try {
        await db.execAsync('ALTER TABLE contacts ADD COLUMN name TEXT;');
    } catch {}
    try {
        await db.execAsync('ALTER TABLE contacts ADD COLUMN picture TEXT;');
    } catch {}

    // Self-healing: add bundle sync columns to contacts table if they don't exist
    try {
        await db.execAsync('ALTER TABLE contacts ADD COLUMN identity_key TEXT;');
    } catch {}
    try {
        await db.execAsync('ALTER TABLE contacts ADD COLUMN identity_key_changed INTEGER DEFAULT 0;');
    } catch {}
    try {
        await db.execAsync('ALTER TABLE contacts ADD COLUMN last_synced_at INTEGER;');
    } catch {}

    // Self-healing: add blocked column to contacts table if it doesn't exist
    try {
        await db.execAsync('ALTER TABLE contacts ADD COLUMN blocked INTEGER DEFAULT 0;');
    } catch {}

    await db.execAsync('PRAGMA user_version = 1;');
}
