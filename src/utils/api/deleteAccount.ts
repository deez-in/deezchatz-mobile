import { apiRequest } from "@/src/utils/transport/api";

/**
 * Sends authenticated request to delete the current user's profile and account.
 */
export async function deleteAccount(): Promise<void> {
  try {
    await apiRequest("/users/me", {
      method: "DELETE",
      authenticated: true,
    });
  } catch (error) {
    // If backend endpoint is not yet implemented (e.g. 404), log warning and proceed
    console.warn("[deleteAccount] API delete request completed with warning/error:", error);
    // Rethrow if needed, or allow caller to handle. We'll rethrow unless it's a 404/not found.
    throw error;
  }
}
