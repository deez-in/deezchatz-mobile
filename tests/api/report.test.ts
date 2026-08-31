import { reportUser } from "@/src/utils/api/user";
import { apiRequest } from "@/src/clients/apiClient";
import useSession from "@/src/store/useSession";
import { Message } from "@/src/models/db";

jest.mock("@/src/clients/apiClient", () => ({
  apiRequest: jest.fn(),
}));

describe("reportUser API", () => {
  const mockReporterId = "11111111-1111-4111-8111-111111111111";
  const mockReportedId = "22222222-2222-4222-8222-222222222222";

  beforeEach(() => {
    jest.clearAllMocks();
    useSession.setState({
      userId: mockReporterId,
      isAuthenticated: true,
    });
  });

  it("should send authenticated POST request to /users/report with valid payload", async () => {
    (apiRequest as jest.Mock).mockResolvedValueOnce({
      status: "success",
      reportId: "rep_12345",
    });

    const messages: Message[] = [
      {
        id: "msg_1",
        content: "Hello there",
        sender_id: "me",
        created_at: 1000,
        status: "sent",
        type: "message",
      },
      {
        id: "msg_2",
        content: "Spam content",
        sender_id: mockReportedId,
        created_at: 2000,
        status: "read",
        type: "message",
      },
      {
        id: "msg_sys",
        content: "Security info changed",
        sender_id: "system",
        created_at: 3000,
        status: "sent",
        type: "system",
      },
    ];

    const result = await reportUser(mockReportedId, messages, "Harassment / Spam");

    expect(result).toEqual({
      status: "success",
      reportId: "rep_12345",
    });

    expect(apiRequest).toHaveBeenCalledWith("/users/report", {
      method: "POST",
      authenticated: true,
      body: {
        reportedUserId: mockReportedId,
        reason: "Harassment / Spam",
        messages: [
          {
            id: "msg_1",
            content: "Hello there",
            sender_id: mockReporterId, // 'me' replaced with reporter UUID
            created_at: 1000,
          },
          {
            id: "msg_2",
            content: "Spam content",
            sender_id: mockReportedId,
            created_at: 2000,
          },
        ], // system message excluded
      },
    });
  });

  it("should limit messages to the last 10", async () => {
    (apiRequest as jest.Mock).mockResolvedValueOnce({
      status: "success",
      reportId: "rep_12345",
    });

    const messages: Message[] = Array.from({ length: 15 }, (_, i) => ({
      id: `msg_${i}`,
      content: `Message ${i}`,
      sender_id: mockReportedId,
      created_at: 1000 + i,
      status: "read",
      type: "message",
    }));

    await reportUser(mockReportedId, messages);

    const callArgs = (apiRequest as jest.Mock).mock.calls[0][1];
    expect(callArgs.body.messages).toHaveLength(10);
    expect(callArgs.body.messages[0].id).toBe("msg_5");
    expect(callArgs.body.messages[9].id).toBe("msg_14");
  });

  it("should reject non-UUID v4 reported user ID", async () => {
    const invalidIds = ["+1234567890", "not-a-uuid", "12345"];

    for (const invalidId of invalidIds) {
      await expect(reportUser(invalidId, [])).rejects.toThrow(
        /Must be a valid UUID v4/
      );
    }
  });

  it("should reject self-reporting", async () => {
    await expect(reportUser(mockReporterId, [])).rejects.toThrow(
      "Self-reporting is not permitted."
    );
  });
});
