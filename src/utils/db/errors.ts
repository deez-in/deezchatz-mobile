/**
 * Storage error hierarchy.
 * Allows callers to distinguish recoverable vs unrecoverable failures
 * and show appropriate UI instead of silently returning empty data.
 */

/**
 * Base class for all storage errors.
 * - recoverable: true  → transient failure, caller may retry
 * - recoverable: false → data is unrecoverable, inform the user
 */
export class StorageError extends Error {
    readonly code: string;
    readonly recoverable: boolean;

    constructor(code: string, message: string, recoverable: boolean) {
        super(message);
        this.name = 'StorageError';
        this.code = code;
        this.recoverable = recoverable;
    }
}

/**
 * The PRAGMA key did not decrypt the database file.
 * Happens when SecureStore is wiped (e.g. Android reinstall) but the
 * DB file still exists on disk, or when credentials are corrupted.
 * NOT recoverable — data cannot be decrypted without the original key.
 */
export class DatabaseKeyMismatchError extends StorageError {
    readonly chatId: string;

    constructor(chatId: string) {
        super(
            'DB_KEY_MISMATCH',
            `Encryption key does not match the database for "${chatId}".` +
            ` This can happen after a reinstall. Chat history may be unrecoverable.`,
            false
        );
        this.name = 'DatabaseKeyMismatchError';
        this.chatId = chatId;
    }
}

/**
 * The database file is corrupted and cannot be read.
 * NOT recoverable without deleting and recreating the database.
 */
export class DatabaseCorruptedError extends StorageError {
    readonly chatId: string;

    constructor(chatId: string, cause?: unknown) {
        super(
            'DB_CORRUPTED',
            `Database for "${chatId}" is corrupted.`,
            false
        );
        this.name = 'DatabaseCorruptedError';
        this.chatId = chatId;
        if (cause instanceof Error) {
            this.stack = this.stack + '\nCaused by: ' + cause.stack;
        }
    }
}

/**
 * Transient connection failure — the DB handle is stale or the DB is not
 * open yet. IS recoverable — caller should retry after reopening.
 */
export class DatabaseConnectionError extends StorageError {
    readonly chatId: string;

    constructor(chatId: string, cause?: unknown) {
        super(
            'DB_CONNECTION_ERROR',
            `Database connection for "${chatId}" is not available.`,
            true
        );
        this.name = 'DatabaseConnectionError';
        this.chatId = chatId;
        if (cause instanceof Error) {
            this.stack = this.stack + '\nCaused by: ' + cause.stack;
        }
    }
}

/**
 * Failed to fetch the recipient's pre-key bundle from the identity server.
 * IS recoverable — network may be temporarily unavailable.
 */
export class BundleFetchError extends StorageError {
    readonly recipient: string;

    constructor(recipient: string, cause?: unknown) {
        super(
            'BUNDLE_FETCH_ERROR',
            `Failed to fetch pre-key bundle for "${recipient}".`,
            true
        );
        this.name = 'BundleFetchError';
        this.recipient = recipient;
        if (cause instanceof Error) {
            this.stack = this.stack + '\nCaused by: ' + cause.stack;
        }
    }
}

/**
 * The recipient is not registered on Deez Chatz (server returned 404 for bundle).
 * NOT recoverable — user must be invited or register.
 */
export class UserNotFoundError extends StorageError {
    readonly recipient: string;

    constructor(recipient: string, cause?: unknown) {
        super(
            'USER_NOT_FOUND',
            `Requested user "${recipient}" is not using Deez Chatz.`,
            false
        );
        this.name = 'UserNotFoundError';
        this.recipient = recipient;
        if (cause instanceof Error) {
            this.stack = this.stack + '\nCaused by: ' + cause.stack;
        }
    }
}

/**
 * Encryption failed — ratchet may be corrupted or uninitialized.
 * NOT recoverable for this message — ratchet state may need to be reset.
 */
export class EncryptionError extends StorageError {
    readonly recipient: string;

    constructor(recipient: string, cause?: unknown) {
        super(
            'ENCRYPTION_ERROR',
            `Failed to encrypt message for "${recipient}".`,
            false
        );
        this.name = 'EncryptionError';
        this.recipient = recipient;
        if (cause instanceof Error) {
            this.stack = this.stack + '\nCaused by: ' + cause.stack;
        }
    }
}

/**
 * Failed to persist message or outbox entry to the database before publish.
 * IS recoverable — transient DB issue.
 */
export class OutboxPersistError extends StorageError {
    readonly recipient: string;

    constructor(recipient: string, cause?: unknown) {
        super(
            'OUTBOX_PERSIST_ERROR',
            `Failed to save outgoing message for "${recipient}" to the database.`,
            true
        );
        this.name = 'OutboxPersistError';
        this.recipient = recipient;
        if (cause instanceof Error) {
            this.stack = this.stack + '\nCaused by: ' + cause.stack;
        }
    }
}

/**
 * The sender of an incoming message is in the user's blocked contacts list.
 * NOT recoverable — the message must be deleted from inbox and dropped immediately.
 */
export class BlockedContactError extends StorageError {
    readonly senderUserId: string;

    constructor(senderUserId: string) {
        super(
            'BLOCKED_CONTACT',
            `Message dropped because sender "${senderUserId}" is blocked.`,
            false
        );
        this.name = 'BlockedContactError';
        this.senderUserId = senderUserId;
    }
}
