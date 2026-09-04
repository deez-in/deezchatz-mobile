;

export type MqttMessageEvent = {
    topic: string;
    payload: Uint8Array;
};

export type BundleSyncResult = {
    keyChanged: boolean;
    pictureChanged: boolean;
};

export type DeviceContactSyncEntry = {
    phone: string;
    contactId: string;
    name: string;
};