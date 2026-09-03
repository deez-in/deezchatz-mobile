import { normalizePhone } from "@/src/utils/helpers/phone";

describe("normalizePhone", () => {
  it("normalizes 10-digit Indian number without country code using default country", () => {
    expect(normalizePhone("9876543210", "+91")).toBe("+919876543210");
  });

  it("normalizes Indian number with leading zero using default country", () => {
    expect(normalizePhone("09876543210", "+91")).toBe("+919876543210");
  });

  it("normalizes already prefixed number with spaces and formatting", () => {
    expect(normalizePhone("+91 98765 43210", "+91")).toBe("+919876543210");
  });

  it("normalizes 8-digit Singapore number without country code when user country is +65", () => {
    expect(normalizePhone("81234567", "+65")).toBe("+6581234567");
  });

  it("preserves international country code when contact already has a different country code", () => {
    expect(normalizePhone("+1 415 555 2671", "+91")).toBe("+14155552671");
    expect(normalizePhone("+65 8123 4567", "+91")).toBe("+6581234567");
  });

  it("handles UK number with leading 0 when user country is +44", () => {
    expect(normalizePhone("07123 456789", "+44")).toBe("+447123456789");
  });

  it("handles empty or blank string gracefully", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("   ")).toBe("");
  });
});
