export type NotificationPayloadData = {
    topic?: string;
    payload?: string;
    sender?: string;
    sender_id?: string;
    [key: string]: unknown;
};

export type PushNotificationEvent = {
    notification?: {
        request?: {
            content?: {
                data?: NotificationPayloadData;
            };
        };
    };
    data?: NotificationPayloadData;
};
