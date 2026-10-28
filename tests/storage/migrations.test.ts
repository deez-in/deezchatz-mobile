import { DatabaseSync } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateChatDatabase, migratePrimaryDatabase } from '@/src/utils/db/migrations';

function createMigrationConnection(sqlite: DatabaseSync) {
    return {
        getFirstAsync: jest.fn(async (sql: string) => sqlite.prepare(sql).get() ?? null),
        execAsync: jest.fn(async (sql: string): Promise<void> => {
            sqlite.exec(sql);
        }),
        withTransactionAsync: jest.fn(async (task: () => Promise<void>): Promise<void> => {
            sqlite.exec('BEGIN');
            try {
                await task();
                sqlite.exec('COMMIT');
            } catch (error) {
                sqlite.exec('ROLLBACK');
                throw error;
            }
        }),
    };
}

describe.each([
    { kind: 'chat', migrate: migrateChatDatabase, tables: ['messages', 'sessions'] },
    { kind: 'primary', migrate: migratePrimaryDatabase, tables: ['chats', 'contacts', 'inbox', 'outbox'] },
])('$kind database migrations', ({ kind, migrate, tables }) => {
    let sqlite: DatabaseSync;
    let connection: ReturnType<typeof createMigrationConnection>;

    const runMigration = (): Promise<void> => migrate(connection as unknown as SQLiteDatabase);

    beforeEach(() => {
        sqlite = new DatabaseSync(':memory:');
        connection = createMigrationConnection(sqlite);
    });

    afterEach(() => {
        sqlite.close();
    });

    it('creates the complete baseline and commits version 1 in one transaction', async () => {
        await runMigration();

        const rows = sqlite.prepare(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).all();
        expect(rows.map((row) => row.name)).toEqual(tables);
        expect(sqlite.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 });
        expect(connection.withTransactionAsync).toHaveBeenCalledTimes(1);
        expect(connection.execAsync).toHaveBeenLastCalledWith('PRAGMA user_version = 1;');
    });

    it('does not write or start a transaction when the schema is current', async () => {
        await runMigration();
        connection.execAsync.mockClear();
        connection.withTransactionAsync.mockClear();

        await runMigration();

        expect(connection.execAsync).not.toHaveBeenCalled();
        expect(connection.withTransactionAsync).not.toHaveBeenCalled();
    });

    it('rejects a newer version without changing its schema or data', async () => {
        sqlite.exec(`
            PRAGMA user_version = 2;
            CREATE TABLE future_data (value TEXT);
            INSERT INTO future_data VALUES ('preserve-me');
        `);

        await expect(runMigration()).rejects.toThrow(`Unsupported ${kind} database schema version 2`);

        expect(sqlite.prepare('PRAGMA user_version').get()).toEqual({ user_version: 2 });
        expect(sqlite.prepare('SELECT * FROM future_data').all()).toEqual([{ value: 'preserve-me' }]);
        expect(connection.execAsync).not.toHaveBeenCalled();
        expect(connection.withTransactionAsync).not.toHaveBeenCalled();
    });

    it.each([null, { user_version: -1 }, { user_version: 0.5 }])(
        'rejects an unreadable or invalid schema version: %p',
        async (row) => {
            connection.getFirstAsync.mockResolvedValueOnce(row);

            await expect(runMigration()).rejects.toThrow(`Unable to read ${kind} database schema version`);

            expect(connection.execAsync).not.toHaveBeenCalled();
            expect(connection.withTransactionAsync).not.toHaveBeenCalled();
        }
    );

    it('propagates version-read failures without starting a transaction', async () => {
        const failure = new Error('Version read failed');
        connection.getFirstAsync.mockRejectedValueOnce(failure);

        await expect(runMigration()).rejects.toBe(failure);

        expect(connection.withTransactionAsync).not.toHaveBeenCalled();
    });

    it('rolls back schema changes after a SQL error and allows a retry', async () => {
        connection.execAsync.mockImplementationOnce(async (sql) => {
            sqlite.exec(`${sql}\nSELECT * FROM missing_migration_table;`);
        });

        await expect(runMigration()).rejects.toThrow('no such table');

        expect(sqlite.prepare('SELECT name FROM sqlite_master').all()).toEqual([]);
        expect(sqlite.prepare('PRAGMA user_version').get()).toEqual({ user_version: 0 });

        await runMigration();
        expect(sqlite.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 });
    });

    it('rolls back schema changes if the version update fails', async () => {
        const failure = new Error('Version update failed');
        connection.execAsync.mockImplementationOnce(async (sql) => {
            sqlite.exec(sql);
        }).mockRejectedValueOnce(failure);

        await expect(runMigration()).rejects.toBe(failure);

        expect(sqlite.prepare('SELECT name FROM sqlite_master').all()).toEqual([]);
        expect(sqlite.prepare('PRAGMA user_version').get()).toEqual({ user_version: 0 });

        await runMigration();
        expect(sqlite.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 });
    });

    it('does not erase existing tables when a version-0 database is not empty', async () => {
        sqlite.exec(`CREATE TABLE ${tables[0]} (value TEXT);`);
        sqlite.prepare(`INSERT INTO ${tables[0]} VALUES (?)`).run('preserve-me');

        await expect(runMigration()).rejects.toThrow('already exists');

        expect(sqlite.prepare(`SELECT * FROM ${tables[0]}`).all()).toEqual([{ value: 'preserve-me' }]);
        expect(sqlite.prepare('PRAGMA user_version').get()).toEqual({ user_version: 0 });
    });
});

describe('clean-install schema behavior', () => {
    let sqlite: DatabaseSync;

    beforeEach(() => {
        sqlite = new DatabaseSync(':memory:');
    });

    afterEach(() => {
        sqlite.close();
    });

    async function createChatSchema(): Promise<void> {
        await migrateChatDatabase(createMigrationConnection(sqlite) as unknown as SQLiteDatabase);
    }

    async function createPrimarySchema(): Promise<void> {
        await migratePrimaryDatabase(createMigrationConnection(sqlite) as unknown as SQLiteDatabase);
    }

    it('creates all message columns with defaults and nullable metadata', async () => {
        await createChatSchema();
        sqlite.exec("INSERT INTO messages (id, content, sender_id, created_at) VALUES ('message-1', 'hello', 'me', 100)");

        expect(sqlite.prepare('SELECT * FROM messages').get()).toEqual({
            id: 'message-1', content: 'hello', sender_id: 'me', created_at: 100,
            received_at: null, status: 'sent', type: 'message', caption: null,
        });
    });

    it('preserves messages and ratchet session data on subsequent opens', async () => {
        await createChatSchema();
        sqlite.exec(`
            INSERT INTO messages VALUES ('message-1', 'hello', 'sender', 100, 101, 'delivered', 'message', NULL);
            INSERT INTO sessions VALUES ('chat_session', '{"ratchetState":"opaque-state"}', 100);
        `);
        const messages = sqlite.prepare('SELECT * FROM messages').all();
        const sessions = sqlite.prepare('SELECT * FROM sessions').all();

        await createChatSchema();

        expect(sqlite.prepare('SELECT * FROM messages').all()).toEqual(messages);
        expect(sqlite.prepare('SELECT * FROM sessions').all()).toEqual(sessions);
    });

    it.each(['message', 'system', 'voice', 'image'])('accepts the %s message type', async (messageType) => {
        await createChatSchema();

        expect(() => sqlite.prepare(
            'INSERT INTO messages (id, content, sender_id, created_at, type) VALUES (?, ?, ?, ?, ?)'
        ).run('message-1', 'content-or-uri', 'me', 100, messageType)).not.toThrow();
    });

    it.each(['pending', 'sent', 'delivered', 'read', 'failed'])('accepts the %s message status', async (status) => {
        await createChatSchema();

        expect(() => sqlite.prepare(
            'INSERT INTO messages (id, content, sender_id, created_at, status) VALUES (?, ?, ?, ?, ?)'
        ).run('message-1', 'hello', 'me', 100, status)).not.toThrow();
    });

    it.each([
        "INSERT INTO messages (id, content, sender_id, created_at, status) VALUES ('id', 'hello', 'me', 1, 'invalid')",
        "INSERT INTO messages (id, content, sender_id, created_at, type) VALUES ('id', 'hello', 'me', 1, 'invalid')",
        "INSERT INTO messages (id, content, sender_id, created_at) VALUES ('id', NULL, 'me', 1)",
    ])('rejects invalid message data: %s', async (sql) => {
        await createChatSchema();

        expect(() => sqlite.exec(sql)).toThrow(/constraint/i);
    });

    it('creates every contact column without additional alterations', async () => {
        await createPrimarySchema();
        sqlite.exec("INSERT INTO contacts (phone, user_id, created_at) VALUES ('+91123', 'user-1', 100)");

        expect(sqlite.prepare('SELECT * FROM contacts').get()).toEqual({
            phone: '+91123', user_id: 'user-1', contact_id: null, name: null, picture: null,
            identity_key: null, identity_key_changed: 0, last_synced_at: null, blocked: 0, created_at: 100,
        });
    });

    it('creates queue rows with the expected defaults and nullable completion timestamps', async () => {
        await createPrimarySchema();
        sqlite.exec(`
            INSERT INTO inbox (topic, payload, received_at) VALUES ('in', 'ciphertext', 100);
            INSERT INTO outbox (chat_id, message_id, payload, topic, created_at)
                VALUES ('chat-1', 'message-1', 'ciphertext', 'out', 100);
        `);

        expect(sqlite.prepare('SELECT * FROM inbox').get()).toEqual({
            id: 1, topic: 'in', payload: 'ciphertext', received_at: 100,
            status: 'pending', retry_count: 0, processed_at: null,
        });
        expect(sqlite.prepare('SELECT * FROM outbox').get()).toEqual({
            id: 1, chat_id: 'chat-1', message_id: 'message-1', topic: 'out', payload: 'ciphertext',
            created_at: 100, status: 'pending', retry_count: 0, sent_at: null,
        });
    });

    it('preserves every queue status, ciphertext, ID, counter, and timestamp on subsequent opens', async () => {
        await createPrimarySchema();
        sqlite.exec(`
            INSERT INTO inbox VALUES (10, 'in', 'ciphertext-pending', 100, 'pending', 2, NULL);
            INSERT INTO inbox VALUES (11, 'in', 'ciphertext-processed', 101, 'processed', 0, 200);
            INSERT INTO inbox VALUES (12, 'in', 'ciphertext-failed', 102, 'failed', 5, NULL);
            INSERT INTO outbox VALUES (20, 'chat-1', 'message-1', 'ciphertext-pending', 'out', 100, 'pending', 2, NULL);
            INSERT INTO outbox VALUES (21, 'chat-1', 'message-2', 'ciphertext-sent', 'out', 101, 'sent', 0, 200);
            INSERT INTO outbox VALUES (22, 'chat-1', 'message-3', 'ciphertext-failed', 'out', 102, 'failed', 5, NULL);
        `);
        const inbox = sqlite.prepare('SELECT * FROM inbox ORDER BY id').all();
        const outbox = sqlite.prepare('SELECT * FROM outbox ORDER BY id').all();

        await createPrimarySchema();

        expect(sqlite.prepare('SELECT * FROM inbox ORDER BY id').all()).toEqual(inbox);
        expect(sqlite.prepare('SELECT * FROM outbox ORDER BY id').all()).toEqual(outbox);
    });

    it.each([
        "INSERT INTO inbox (topic, payload, received_at, status) VALUES ('in', 'ciphertext', 1, 'invalid')",
        "INSERT INTO inbox (topic, payload, received_at, retry_count) VALUES ('in', 'ciphertext', 1, -1)",
        "INSERT INTO outbox (chat_id, message_id, payload, topic, created_at, status) VALUES ('chat', 'id', 'ciphertext', 'out', 1, 'processed')",
        "INSERT INTO outbox (chat_id, message_id, payload, topic, created_at, retry_count) VALUES ('chat', 'id', 'ciphertext', 'out', 1, -1)",
        "INSERT INTO contacts (phone, user_id, created_at, blocked) VALUES ('+91123', 'user', 1, 2)",
        "INSERT INTO contacts (phone, user_id, created_at, identity_key_changed) VALUES ('+91123', 'user', 1, -1)",
        "INSERT INTO chats (user_id, last_message_at, updated_at, unread_count) VALUES ('user', 1, 1, -1)",
    ])('rejects invalid primary data: %s', async (sql) => {
        await createPrimarySchema();

        expect(() => sqlite.exec(sql)).toThrow(/constraint/i);
    });

    it.each([
        { table: 'inbox', timestamp: 'received_at', index: 'idx_inbox_status_received_at' },
        { table: 'outbox', timestamp: 'created_at', index: 'idx_outbox_status_created_at' },
    ])('uses the $table index for pending retrieval without a temporary sort', async ({ table, timestamp, index }) => {
        await createPrimarySchema();
        const plan = sqlite.prepare(
            `EXPLAIN QUERY PLAN SELECT * FROM ${table} WHERE status = 'pending' ORDER BY ${timestamp} ASC`
        ).all().map((row) => String(row.detail)).join('\n');

        expect(plan).toContain(index);
        expect(plan).not.toContain('TEMP B-TREE');
    });

    it('uses the unique contact index without creating a duplicate lookup index', async () => {
        await createPrimarySchema();
        const indexes = sqlite.prepare("PRAGMA index_list('contacts')").all();
        const plan = sqlite.prepare(
            "EXPLAIN QUERY PLAN SELECT phone FROM contacts WHERE user_id = 'user-1'"
        ).all().map((row) => String(row.detail)).join('\n');

        expect(indexes).toHaveLength(2);
        expect(indexes.every((index) => index.unique === 1)).toBe(true);
        expect(plan).toContain('USING INDEX');
        expect(plan).not.toContain('SCAN contacts');
    });
});
