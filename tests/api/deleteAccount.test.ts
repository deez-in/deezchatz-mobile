import { deleteAccount } from "@/src/utils/api/deleteAccount";
import { apiRequest } from "@/src/utils/transport/api";

jest.mock("@/src/utils/transport/api", () => ({
  apiRequest: jest.fn(),
}));

describe("deleteAccount API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call apiRequest with DELETE method and authenticated flag", async () => {
    (apiRequest as jest.Mock).mockResolvedValueOnce({});

    await deleteAccount();

    expect(apiRequest).toHaveBeenCalledWith("/users/me", {
      method: "DELETE",
      authenticated: true,
    });
  });

  it("should propagate error if apiRequest fails", async () => {
    const error = new Error("API network error");
    (apiRequest as jest.Mock).mockRejectedValueOnce(error);

    await expect(deleteAccount()).rejects.toThrow("API network error");
  });
});
