/**
 * API client for key bundle discovery and synchronization.
 */

import { apiRequest } from "@/src/clients/apiClient";
import { SyncBundleResponse } from "@/src/models/api";
import { PreKeyBundle } from "@/src/models/crypto";

/**
 * Fetches a contact's pre-key bundle for X3DH initialization.
 */
export async function fetchPreKeyBundle(recipientIdentifier: string): Promise<PreKeyBundle> {
  return apiRequest<PreKeyBundle>(
    `/bundle/${encodeURIComponent(recipientIdentifier)}`,
    { method: "POST", authenticated: true }
  );
}

/**
 * Fetches a contact's latest bundle sync info (read-only, does not consume OPK).
 */
export async function fetchSyncBundle(userId: string): Promise<SyncBundleResponse> {
  return apiRequest<SyncBundleResponse>(
    `/bundle/sync/${encodeURIComponent(userId)}`,
    { authenticated: true }
  );
}
