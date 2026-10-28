import type { SQLiteDatabase } from 'expo-sqlite';

const CHAT_MIGRATIONS: readonly string[] = [
    `
        CREATE TABLE messages (
            id          TEXT PRIMARY KEY NOT NULL,
            content     TEXT NOT NULL,
            sender_id   TEXT NOT NULL,
            created_at  INTEGER NOT NULL,
            received_at INTEGER,
            status      TEXT NOT NULL DEFAULT 'sent'
                        CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
            type        TEXT NOT NULL DEFAULT 'message'
                        CHECK (type IN ('message', 'system', 'voice', 'image')),
            caption     TEXT
        );

        CREATE INDEX idx_messages_created_at ON messages(created_at);

        CREATE TABLE sessions (
            key        TEXT PRIMARY KEY NOT NULL,
            value      TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        );
    `,
];

const PRIMARY_MIGRATIONS: readonly string[] = [
    `
        CREATE TABLE chats (
            user_id         TEXT PRIMARY KEY NOT NULL,
            phone           TEXT,
            last_message    TEXT,
            last_message_at INTEGER NOT NULL,
            unread_count    INTEGER NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
            updated_at      INTEGER NOT NULL
        );

        CREATE INDEX idx_chats_updated ON chats(updated_at DESC);

        CREATE TABLE inbox (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            topic        TEXT NOT NULL,
            payload      TEXT NOT NULL,
            received_at  INTEGER NOT NULL,
            status       TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'processed', 'failed')),
            retry_count  INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
            processed_at INTEGER
        );

        CREATE INDEX idx_inbox_status_received_at ON inbox(status, received_at);

        CREATE TABLE outbox (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id     TEXT NOT NULL,
            message_id  TEXT NOT NULL,
            payload     TEXT NOT NULL,
            topic       TEXT NOT NULL,
            created_at  INTEGER NOT NULL,
            status      TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'sent', 'failed')),
            retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
            sent_at     INTEGER
        );

        CREATE INDEX idx_outbox_status_created_at ON outbox(status, created_at);

        CREATE TABLE contacts (
            phone                TEXT PRIMARY KEY NOT NULL,
            user_id              TEXT NOT NULL UNIQUE,
            contact_id           TEXT,
            name                 TEXT,
            picture              TEXT,
            identity_key         TEXT,
            identity_key_changed INTEGER NOT NULL DEFAULT 0
                                 CHECK (identity_key_changed IN (0, 1)),
            last_synced_at       INTEGER,
            blocked              INTEGER NOT NULL DEFAULT 0 CHECK (blocked IN (0, 1)),
            created_at           INTEGER NOT NULL
        );
    `,
];

async function migrateDatabase(
    db: SQLiteDatabase,
    migrations: readonly string[],
    databaseKind: 'chat' | 'primary'
): Promise<void> {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
    if (!row || !Number.isInteger(row.user_version) || row.user_version < 0) {
        throw new Error(`Unable to read ${databaseKind} database schema version`);
    }

    const currentVersion = row.user_version;
    const latestVersion = migrations.length;

    if (currentVersion > latestVersion) {
        throw new Error(
            `Unsupported ${databaseKind} database schema version ${currentVersion}; ` +
            `this app supports up to version ${latestVersion}`
        );
    }

    if (currentVersion === latestVersion) return;

    await db.withTransactionAsync(async () => {
        for (const migration of migrations.slice(currentVersion)) {
            await db.execAsync(migration);
        }
        await db.execAsync(`PRAGMA user_version = ${latestVersion};`);
    });
}

export async function migrateChatDatabase(db: SQLiteDatabase): Promise<void> {
    await migrateDatabase(db, CHAT_MIGRATIONS, 'chat');
}

export async function migratePrimaryDatabase(db: SQLiteDatabase): Promise<void> {
    await migrateDatabase(db, PRIMARY_MIGRATIONS, 'primary');
}
