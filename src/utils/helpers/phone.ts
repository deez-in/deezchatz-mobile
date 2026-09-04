import { parsePhoneNumberFromString } from "libphonenumber-js";
import useSession from "@/src/store/useSession";

/**
 * Normalizes a phone number to standard E.164 format (e.g. +919876543210, +6581234567).
 * If the number does not include an international calling code, it prepends the user's
 * own country code (from session or fallback parameter).
 */
export function normalizePhone(phone: string, defaultCountryCode?: string): string {
  if (!phone || typeof phone !== "string") return "";
  const trimmed = phone.trim();
  if (!trimmed) return "";

  // Determine default calling code (strip non-digits)
  const sessionCountry = useSession.getState()?.phone?.countryCode;
  const userCountry = defaultCountryCode || sessionCountry || "91";
  const callingCode = userCountry.replace(/\D/g, "") || "91";

  try {
    const parsed = parsePhoneNumberFromString(trimmed, {
      defaultCallingCode: callingCode,
    });
    if (parsed) {
      return parsed.format("E.164");
    }
  } catch {
    // Ignore parsing errors and fall back to manual formatting
  }

  if (trimmed.startsWith("+")) {
    const digits = trimmed.replace(/\D/g, "");
    return digits ? `+${digits}` : "";
  }

  const digits = trimmed.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `+${callingCode}${digits}` : "";
}
