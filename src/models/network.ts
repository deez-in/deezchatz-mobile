;

export type MqttMessageEvent = {
    topic: string;
    payloadBase64: string;
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