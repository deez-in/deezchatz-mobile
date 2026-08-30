import { blockContact, unblockContact, isContactBlocked } from "@/src/utils/storage/blockContact";
import { openPrimaryDatabase } from "@/src/utils/storage/database";
import { BlockedContactError } from "@/src/utils/storage/errors";

jest.mock("@/src/utils/storage/database", () => ({
  openPrimaryDatabase: jest.fn(),
}));

describe("Block / Report Contact Storage Operations", () => {
  let mockDb: {
    runAsync: jest.Mock;
    getFirstAsync: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb = {
      runAsync: jest.fn().mockResolvedValue({ lastInsertRowId: 1, changes: 1 }),
      getFirstAsync: jest.fn(),
    };
    (openPrimaryDatabase as jest.Mock).mockResolvedValue(mockDb);
  });

  it("should set blocked = 1 when blocking a contact", async () => {
    await blockContact("user-123");
    expect(openPrimaryDatabase).toHaveBeenCalled();
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      "UPDATE contacts SET blocked = 1 WHERE user_id = ?",
      "user-123"
    );
  });

  it("should set blocked = 0 when unblocking a contact", async () => {
    await unblockContact("user-123");
    expect(openPrimaryDatabase).toHaveBeenCalled();
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      "UPDATE contacts SET blocked = 0 WHERE user_id = ?",
      "user-123"
    );
  });

  it("should return true if contact is blocked", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ blocked: 1 });
    const result = await isContactBlocked("user-123");
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      "SELECT blocked FROM contacts WHERE user_id = ?",
      "user-123"
    );
    expect(result).toBe(true);
  });

  it("should return false if contact is not blocked", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({ blocked: 0 });
    const result = await isContactBlocked("user-456");
    expect(result).toBe(false);
  });

  it("should return false if contact row does not exist", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);
    const result = await isContactBlocked("unknown-user");
    expect(result).toBe(false);
  });

  it("should create BlockedContactError with senderUserId", () => {
    const error = new BlockedContactError("user-789");
    expect(error.name).toBe("BlockedContactError");
    expect(error.code).toBe("BLOCKED_CONTACT");
    expect(error.senderUserId).toBe("user-789");
    expect(error.recoverable).toBe(false);
  });
});
