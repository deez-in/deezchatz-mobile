import * as SQLite from 'expo-sqlite';
import { Paths } from 'expo-file-system';

import { getOrCreateDatabaseCredentials, deleteDatabaseCredentials } from '@/src/utils/db/keys';
import { migrateChatDatabase, migratePrimaryDatabase } from '@/src/utils/db/migrations';

jest.mock('@/src/utils/db/keys', () => ({
    getOrCreateDatabaseCredentials: jest.fn(),
    deleteDatabaseCredentials: jest.fn(),
}));

jest.mock('@/src/utils/db/migrations', () => ({
    migrateChatDatabase: jest.fn(),
    migratePrimaryDatabase: jest.fn(),
}));

function createDatabaseMock() {
    return {
        execAsync: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
        getFirstAsync: jest.fn<Promise<{ count: number } | null>, [string]>()
            .mockResolvedValue({ count: 0 }),
        closeAsync: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    };
}

describe.each(['chat', 'primary'] as const)('%s database initialization', (databaseKind) => {
    const chatId = 'test-chat';
    const credentialId = databaseKind === 'chat' ? chatId : '__primary__';
    const mockOpen = jest.mocked(SQLite.openDatabaseAsync);
    const mockCredentials = jest.mocked(getOrCreateDatabaseCredentials);
    const mockMigration = jest.mocked(
        databaseKind === 'chat' ? migrateChatDatabase : migratePrimaryDatabase
    );

    let client: typeof import('@/src/clients/sqliteClient');
    let errors: typeof import('@/src/utils/db/errors');
    let database: ReturnType<typeof createDatabaseMock>;
    let warnSpy: jest.SpyInstance;

    const openDatabase = (): Promise<SQLite.SQLiteDatabase> => databaseKind === 'chat'
        ? client.openChatDatabase(chatId)
        : client.openPrimaryDatabase();

    beforeEach(() => {
        jest.resetAllMocks();
        jest.isolateModules(() => {
            client = jest.requireActual<typeof client>('@/src/clients/sqliteClient');
            errors = jest.requireActual<typeof errors>('@/src/utils/db/errors');
        });

        database = createDatabaseMock();
        mockOpen.mockResolvedValue(database as unknown as SQLite.SQLiteDatabase);
        mockCredentials.mockResolvedValue({ key: 'test-key', dbId: 'test-database' });
        jest.mocked(migrateChatDatabase).mockResolvedValue(undefined);
        jest.mocked(migratePrimaryDatabase).mockResolvedValue(undefined);
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        expect(deleteDatabaseCredentials).not.toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    async function expectSuccessfulRetry(): Promise<void> {
        const replacement = createDatabaseMock();
        mockOpen.mockResolvedValueOnce(replacement as unknown as SQLite.SQLiteDatabase);

        await expect(openDatabase()).resolves.toBe(replacement);
        await expect(openDatabase()).resolves.toBe(replacement);
        expect(mockOpen).toHaveBeenCalledTimes(2);
        expect(replacement.closeAsync).not.toHaveBeenCalled();
    }

    it('initializes and caches the connection without closing it', async () => {
        await expect(openDatabase()).resolves.toBe(database);
        await expect(openDatabase()).resolves.toBe(database);

        expect(mockCredentials).toHaveBeenCalledWith(credentialId);
        expect(mockOpen).toHaveBeenCalledTimes(1);
        expect(mockOpen).toHaveBeenCalledWith('test-database.db', {}, Paths.document.uri);
        expect(mockMigration).toHaveBeenCalledWith(database);
        expect(database.closeAsync).not.toHaveBeenCalled();
    });

    it('coalesces concurrent successful opens', async () => {
        await expect(Promise.all([openDatabase(), openDatabase()]))
            .resolves.toEqual([database, database]);

        expect(mockCredentials).toHaveBeenCalledTimes(1);
        expect(mockOpen).toHaveBeenCalledTimes(1);
        expect(mockMigration).toHaveBeenCalledTimes(1);
        expect(database.closeAsync).not.toHaveBeenCalled();
    });

    it.each([
        "PRAGMA key = 'test-key';",
        'PRAGMA foreign_keys = ON;',
        'PRAGMA journal_mode = WAL;',
    ])('closes once and allows retry when %s fails', async (statement) => {
        const failure = new Error('Database setup failed');
        database.execAsync.mockImplementation(async (sql) => {
            if (sql === statement) throw failure;
        });

        await expect(openDatabase()).rejects.toBe(failure);

        expect(database.closeAsync).toHaveBeenCalledTimes(1);
        expect(mockMigration).not.toHaveBeenCalled();
        await expectSuccessfulRetry();
    });

    it('closes once and preserves key mismatch errors when verification fails', async () => {
        database.getFirstAsync.mockRejectedValueOnce(new Error('Verification failed'));

        await expect(openDatabase()).rejects.toBeInstanceOf(errors.DatabaseKeyMismatchError);

        expect(database.closeAsync).toHaveBeenCalledTimes(1);
        expect(mockMigration).not.toHaveBeenCalled();
        await expectSuccessfulRetry();
    });

    it('closes once and allows retry when migration fails', async () => {
        const failure = new Error('Migration failed');
        mockMigration.mockRejectedValueOnce(failure);

        await expect(openDatabase()).rejects.toBe(failure);

        expect(database.closeAsync).toHaveBeenCalledTimes(1);
        await expectSuccessfulRetry();
    });

    it('preserves the initialization error if closing also fails', async () => {
        const failure = new Error('Migration failed');
        const closeFailure = new Error('Close failed');
        mockMigration.mockRejectedValueOnce(failure);
        database.closeAsync.mockRejectedValueOnce(closeFailure);

        await expect(openDatabase()).rejects.toBe(failure);

        expect(database.closeAsync).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(expect.any(String), closeFailure);
        await expectSuccessfulRetry();
    });

    it('coalesces concurrent failures and closes the shared handle once', async () => {
        const failure = new Error('Migration failed');
        mockMigration.mockRejectedValueOnce(failure);

        await expect(Promise.allSettled([openDatabase(), openDatabase()])).resolves.toEqual([
            { status: 'rejected', reason: failure },
            { status: 'rejected', reason: failure },
        ]);

        expect(mockOpen).toHaveBeenCalledTimes(1);
        expect(mockMigration).toHaveBeenCalledTimes(1);
        expect(database.closeAsync).toHaveBeenCalledTimes(1);
        await expectSuccessfulRetry();
    });

    it('preserves native-open error handling without closing an unopened handle', async () => {
        mockOpen.mockRejectedValueOnce(new Error('Native open failed'));

        await expect(openDatabase()).rejects.toBeInstanceOf(errors.DatabaseCorruptedError);

        expect(database.closeAsync).not.toHaveBeenCalled();
        expect(mockMigration).not.toHaveBeenCalled();
        await expectSuccessfulRetry();
    });
});
