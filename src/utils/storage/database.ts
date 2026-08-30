/**
 * Database connection management.
 * Handles opening, closing, migrating, and health-checking SQLite databases.
 */

import * as SQLite from 'expo-sqlite';
import { Paths } from 'expo-file-system';
import { getOrCreateDatabaseCredentials } from './keys';
import {
    DatabaseKeyMismatchError,
    DatabaseCorruptedError,
    DatabaseConnectionError,
} from './errors';
import { withRetry } from '../helpers/retry';
const PRIMARY_CHAT_ID = '__primary__';

/**
 * Active database connections pool.
 * Avoids opening duplicate connections for the same chat.
 */
const activeDatabases = new Map<string, SQLite.SQLiteDatabase>();
let primaryDb: SQLite.SQLiteDatabase | null = null;

/**
 * In-flight open promises — coalesces concurrent callers so only one
 * native connection is created at a time for a given database.
 */
let primaryDbPending: Promise<SQLite.SQLiteDatabase> | null = null;
const chatDbPending = new Map<string, Promise<SQLite.SQLiteDatabase>>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Applies encryption key and WAL mode to an already-open DB handle.
 * Verifies the key actually works — SQLCipher does not throw on wrong key,
 * it silently returns empty results, which causes "missing history" bugs.
 */
async function applyKeyAndVerify(
    db: SQLite.SQLiteDatabase,
    key: string,
    chatId: string
): Promise<void> {
    await db.execAsync(`PRAGMA key = '${key}';`);
    await db.execAsync('PRAGMA foreign_keys = ON;');
    await db.execAsync('PRAGMA journal_mode = WAL;');

    // Verify the key actually decrypted the file.
    // sqlite_master is always present in a valid/empty DB after correct decryption.
    try {
        await db.getFirstAsync<{ count: number }>(
            'SELECT count(*) as count FROM sqlite_master;'
        );
    } catch {
        await db.closeAsync().catch(() => { });
        throw new DatabaseKeyMismatchError(chatId);
    }
}

/**
 * Runs a lightweight health-check query on a DB handle.
 * Returns false if the handle is stale or the connection is closed.
 */
async function isConnectionHealthy(db: SQLite.SQLiteDatabase): Promise<boolean> {
    try {
        await db.getFirstAsync('SELECT 1;');
        return true;
    } catch {
        return false;
    }
}

// ---------------------------------------------------------------------------
// Per-chat databases
// ---------------------------------------------------------------------------

/**
 * Opens a per-chat database with encryption.
 * Safe to call multiple times — returns the cached connection.
 * Concurrent calls for the same chatId are coalesced into a single open.
 *
 * @throws DatabaseKeyMismatchError  — PRAGMA key does not match the DB file
 * @throws DatabaseCorruptedError    — DB file is unreadable
 */
export async function openChatDatabase(chatId: string): Promise<SQLite.SQLiteDatabase> {
    if (activeDatabases.has(chatId)) {
        return activeDatabases.get(chatId)!;
    }

    // Coalesce concurrent callers
    const pending = chatDbPending.get(chatId);
    if (pending) {
        return pending;
    }

    const openPromise = (async () => {
        const { key, dbId } = await getOrCreateDatabaseCredentials(chatId);

        let db: SQLite.SQLiteDatabase;
        try {
            db = await SQLite.openDatabaseAsync(`${dbId}.db`, {}, Paths.document.uri);
        } catch (e) {
            throw new DatabaseCorruptedError(chatId, e);
        }

        await applyKeyAndVerify(db, key, chatId);
        await migrateDatabase(db);

        activeDatabases.set(chatId, db);
        return db;
    })();

    chatDbPending.set(chatId, openPromise);
    try {
        return await openPromise;
    } finally {
        chatDbPending.delete(chatId);
    }
}

/**
 * Closes the database connection for a specific chat.
 */
export async function closeChatDatabase(chatId: string): Promise<void> {
    const db = activeDatabases.get(chatId);
    if (db) {
        activeDatabases.delete(chatId);
        try {
            await db.closeAsync();
        } catch (e) {
            console.warn(`Failed to close database for chat ${chatId}`, e);
        }
    }
}

/**
 * Checks if a database connection is already open for a chat.
 */
export function isDatabaseOpen(chatId: string): boolean {
    return activeDatabases.has(chatId);
}

/**
 * Returns the cached DB for a chat, or throws DatabaseConnectionError if not open.
 * Use this in functions that REQUIRE callers to manage the DB lifecycle.
 */
export function requireChatDatabase(chatId: string): SQLite.SQLiteDatabase {
    const db = activeDatabases.get(chatId);
    if (!db) {
        throw new DatabaseConnectionError(chatId);
    }
    return db;
}

// ---------------------------------------------------------------------------
// Primary database
// ---------------------------------------------------------------------------

/**
 * Opens the primary database with encryption and WAL mode.
 * Safe to call multiple times — returns the cached connection.
 * Concurrent calls are coalesced into a single open.
 *
 * @throws DatabaseKeyMismatchError  — PRAGMA key does not match the DB file
 * @throws DatabaseCorruptedError    — DB file is unreadable
 */
export async function openPrimaryDatabase(): Promise<SQLite.SQLiteDatabase> {
    if (primaryDb) {
        return primaryDb;
    }

    // Coalesce concurrent callers — if an open is already in flight, join it
    if (primaryDbPending) {
        return primaryDbPending;
    }

    const openPromise = (async () => {
        const { key, dbId } = await getOrCreateDatabaseCredentials(PRIMARY_CHAT_ID);

        let db: SQLite.SQLiteDatabase;
        try {
            db = await SQLite.openDatabaseAsync(`${dbId}.db`, {}, Paths.document.uri);
        } catch (e) {
            throw new DatabaseCorruptedError(PRIMARY_CHAT_ID, e);
        }

        await applyKeyAndVerify(db, key, PRIMARY_CHAT_ID);
        await migratePrimaryDatabase(db);

        primaryDb = db;
        return db;
    })();

    primaryDbPending = openPromise;
    try {
        return await openPromise;
    } finally {
        primaryDbPending = null;
    }
}


// ---------------------------------------------------------------------------
// Health management (AppState resume)
// ---------------------------------------------------------------------------

/**
 * Re-validates all open database connections after the app resumes.
 * Stale handles (process restored by OS) are dropped so they are
 * re-opened on next access.
 *
 * The native SQLite handle can become null after the OS reclaims memory
 * while the app is backgrounded. In that state, ANY call on the handle
 * (including a simple `SELECT 1` health-check) throws a NullPointerException.
 * We must catch that and force a fresh connection.
 *
 * Call this in an AppState 'active' listener in the root layout.
 */
export async function reopenAllDatabases(): Promise<void> {
    // Re-validate primary DB
    if (primaryDb) {
        let healthy = false;
        try {
            healthy = await isConnectionHealthy(primaryDb);
        } catch {
            // Native handle is null — treat as unhealthy
            healthy = false;
        }

        if (!healthy) {
            // Try to close the stale handle (best-effort)
            try { await primaryDb.closeAsync(); } catch (e) { console.debug('Primary DB already dead', e); }
            primaryDb = null;
            
            try {
                await withRetry(
                    async () => {
                        await openPrimaryDatabase();
                    },
                    { maxAttempts: 3, initialDelay: 150, backoffFactor: 1 }
                );
            } catch (e) {
                console.error('Failed to reopen primary database after resume:', e);
            }
        }
    } else {
        // Primary DB was never opened or was closed — ensure it's available
        try {
            await withRetry(
                async () => {
                    await openPrimaryDatabase();
                },
                { maxAttempts: 3, initialDelay: 150, backoffFactor: 1 }
            );
        } catch (e) {
            console.error('Failed to open primary database on resume:', e);
        }
    }

    // Re-validate per-chat DBs — drop stale handles; let screens reopen them
    for (const [chatId, db] of activeDatabases.entries()) {
        let healthy = false;
        try {
            healthy = await isConnectionHealthy(db);
        } catch {
            healthy = false;
        }

        if (!healthy) {
            try { await db.closeAsync(); } catch (e) { console.debug('Per-chat DB already dead', e); }
            activeDatabases.delete(chatId);
        }
    }
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

async function migrateDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
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
async function migratePrimaryDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
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
