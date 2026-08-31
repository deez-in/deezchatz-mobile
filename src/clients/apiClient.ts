import LibsignalDezireModule from "expo-libsignal-dezire";
import useSession from "@/src/store/useSession";
import { toBase64, toBytes } from "@/src/utils/helpers/encoding";
import { API_BASE_URL } from "@/src/config";

export type RequestOptions = {
    method?: string;
    body?: object;
    authenticated?: boolean;
}



export class ApiError extends Error {
  status: number;
  path: string;
  constructor(status: number, message: string, path: string) {
    super(`API ${status} on ${path}: ${message}`);
    this.status = status;
    this.path = path;
  }
}

/**
 * Central API request function with optional stateless signature auth.
 *
 * WARNING: For authenticated requests, session must have userId and preKey
 * already persisted (i.e., registration must be complete). Calling this
 * during initSession or before keys are stored will fail or produce
 * invalid signatures.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, authenticated = false } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authenticated) {
    const session = useSession.getState();
    if (!session.userId || !session.preKey || session.preKey.byteLength === 0) {
      throw new Error("Cannot authenticate: missing userId or preKey");
    }

    const timestamp = Date.now().toString();
    const payload = `${session.userId}${timestamp}`;
    const { signature, vrf } = await LibsignalDezireModule.vxeddsaSign(
      session.preKey,
      toBytes(payload)
    );

    headers["X-User-Id"] = session.userId;
    headers["X-Timestamp"] = timestamp;
    headers["X-Signature"] = toBase64(signature);
    headers["X-Vrf"] = toBase64(vrf);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(res.status, text, path);
  }

  // Handle empty responses (204 No Content, etc.)
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}
