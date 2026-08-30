/**
 * API client for user reporting.
 */

import { Message } from '../storage/messages';

export interface ReportPayload {
    reportedUserId: string;
    reason?: string;
    messages: {
        id: string;
        content: string;
        sender_id: string;
        created_at: number;
    }[];
}

/**
 * Reports a user and uploads the last 10 messages for review.
 * Currently a stub ready for backend endpoint integration.
 */
export async function reportUser(
    reportedUserId: string,
    messages: Message[],
    reason: string = 'User reported via chat'
): Promise<boolean> {
    const payload: ReportPayload = {
        reportedUserId,
        reason,
        messages: messages.slice(0, 10).map((m) => ({
            id: m.id,
            content: m.content,
            sender_id: m.sender_id,
            created_at: m.created_at,
        })),
    };

    console.info(`[Report] Reporting user ${reportedUserId} with ${payload.messages.length} messages:`, payload);

    // TODO: Connect to backend API endpoint once available, e.g.:
    // await apiRequest('/users/report', { method: 'POST', body: JSON.stringify(payload) });

    return true;
}
