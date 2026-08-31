/**
 * API client for user reporting, moderation, and profile operations.
 */

import { apiRequest } from "@/src/clients/apiClient";
import useSession from "@/src/store/useSession";
import { Message } from "@/src/models/db";
import {
  DeleteAccountResponse,
  ReportUserRequest,
  ReportUserResponse,
} from "@/src/models/api";

/**
 * Validates whether a string is a valid UUID v4.
 */
function isValidUUIDv4(uuid: string): boolean {
  const uuidv4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidv4Regex.test(uuid);
}

/**
 * Reports a user and uploads up to 10 recent decrypted messages for moderation audit.
 *
 * @param reportedUserId  The UUID v4 of the user being reported.
 * @param messages        List of chat messages to sample from.
 * @param reason          Abuse reason (defaults to 'Harassment / Spam / Abuse').
 */
export async function reportUser(
  reportedUserId: string,
  messages: Message[],
  reason: string = "Harassment / Spam / Abuse"
): Promise<ReportUserResponse> {
  const session = useSession.getState();
  const currentUserId = session.userId;

  if (!isValidUUIDv4(reportedUserId)) {
    throw new Error(`Invalid reported user ID format: ${reportedUserId}. Must be a valid UUID v4.`);
  }

  if (currentUserId && reportedUserId === currentUserId) {
    throw new Error("Self-reporting is not permitted.");
  }

  const trimmedReason = reason.trim() || "Harassment / Spam / Abuse";

  // Filter out system messages and map 'me' to active user's UUID
  const auditMessages = messages
    .filter((m) => m.type !== "system" && m.content)
    .slice(-10) // Take up to the 10 most recent messages
    .map((m) => ({
      id: m.id,
      content: m.content,
      sender_id: m.sender_id === "me" && currentUserId ? currentUserId : m.sender_id,
      created_at: m.created_at,
    }));

  const payload: ReportUserRequest = {
    reportedUserId,
    reason: trimmedReason,
    messages: auditMessages,
  };

  return apiRequest<ReportUserResponse>("/users/report", {
    method: "POST",
    authenticated: true,
    body: payload,
  });
}

/**
 * Sends authenticated request to delete the current user's profile and account.
 */
export async function deleteAccount(): Promise<DeleteAccountResponse | void> {
  try {
    return await apiRequest<DeleteAccountResponse>("/users/me", {
      method: "DELETE",
      authenticated: true,
    });
  } catch (error) {
    // If backend endpoint is not yet implemented (e.g. 404), log warning and proceed
    console.warn("[deleteAccount] API delete request completed with warning/error:", error);
    throw error;
  }
}
