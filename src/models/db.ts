export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MessageType = 'message' | 'system';

export interface Message {
    id: string;
    content: string;
    sender_id: string;
    created_at: number;
    received_at?: number;
    status: MessageStatus;
    type?: MessageType;
}

export type ChatSession = {
    identityKey?: string;
    deviceId?: string;
    ratchetState?: string;
};

export interface ChatThread {
    user_id: string;
    phone?: string;
    name?: string;
    picture?: string;
    last_message?: string;
    last_message_at: number;
    unread_count: number;
}

export type OutboxStatus = "pending" | "sent" | "failed";

export interface OutboxEntry {
    id: number;
    chat_id: string;
    message_id: string;
    topic: string;
    payload: string;
    status: OutboxStatus;
    retry_count: number;
    created_at: number;
    updated_at: number;
}

export type InboxStatus = "pending" | "processed" | "failed";

export interface InboxEntry {
    id: number;
    topic: string;
    payload: string;
    status: InboxStatus;
    retry_count: number;
    created_at: number;
    processed_at?: number;
}

export interface ContactMapping {
    phone: string;
    user_id: string;
    contact_id?: string;
    name?: string;
    picture?: string;
    identity_key?: string;
    identity_key_changed?: number;
    last_synced_at?: number;
    created_at: number;
}

export type DatabaseCredentials = {
    key: string;    // 32-byte hex encryption key
    dbId: string;   // UUID used as the database filename
};

export type ChatListListener = () => void;
export type MessageListener = (chatId: string) => void;

export type BatchSyncContactEntry = {
    phone: string;
    contactId: string;
    name: string;
};

export type ContactBundleUpdateResult = {
    keyChanged: boolean;
    pictureChanged: boolean;
};
