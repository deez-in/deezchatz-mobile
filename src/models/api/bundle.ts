export interface Opk {
  id: number;
  key: string;
}

export interface PreKeyBundleResponse {
  userId: string;
  deviceId: string;
  identityKey: string;
  spkId: number;
  signedPreKey: string;
  signature: string;
  phone?: string | null;
  picture?: string | null;
  opk?: Opk | null;
}

export interface SyncBundleResponse {
  userId: string;
  identityKey: string;
  picture?: string | null;
  displayName?: string | null;
}
