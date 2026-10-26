import { deleteAccount } from "@/src/utils/api/user";
import { apiRequest } from "@/src/clients/apiClient";
import { REST_REQUEST_TIMEOUT_MS } from "@/src/config";

jest.mock("@/src/clients/apiClient", () => ({
  apiRequest: jest.fn(),
}));

describe("deleteAccount API", () => {
  beforeEach(() => {
    jest.mocked(apiRequest).mockReset();
  });

  it("should call apiRequest with DELETE method and authenticated flag", async () => {
    const confirmation = { status: "success", message: "Account deleted" };
    jest.mocked(apiRequest).mockResolvedValueOnce(confirmation);

    await expect(deleteAccount()).resolves.toEqual(confirmation);

    expect(apiRequest).toHaveBeenCalledWith("/users/me", {
      method: "DELETE",
      authenticated: true,
      expectedStatus: 200,
      timeoutMs: REST_REQUEST_TIMEOUT_MS,
    });
  });

  it.each([
    undefined,
    null,
    {},
    [],
    "success",
    { status: "pending", message: "Deletion requested" },
    { status: "error", message: "Deletion failed" },
    { status: "success" },
    { status: "success", message: null },
  ])("rejects an unconfirmed response: %p", async (response) => {
    jest.mocked(apiRequest).mockResolvedValueOnce(response);

    await expect(deleteAccount()).rejects.toThrow("Server did not confirm account deletion");
  });

  it("should propagate error if apiRequest fails", async () => {
    const error = new Error("API network error");
    (apiRequest as jest.Mock).mockRejectedValueOnce(error);

    await expect(deleteAccount()).rejects.toThrow("API network error");
  });
});
