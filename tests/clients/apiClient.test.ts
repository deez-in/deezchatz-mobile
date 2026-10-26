import { apiRequest, ApiError } from "@/src/clients/apiClient";
import { REST_REQUEST_TIMEOUT_MS } from "@/src/config";

describe("apiRequest confirmation and deadlines", () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    fetchSpy = jest.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.useRealTimers();
  });

  it("accepts the expected HTTP status and clears the deadline", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "success" }),
    });

    await expect(apiRequest("/users/me", {
      expectedStatus: 200,
      timeoutMs: REST_REQUEST_TIMEOUT_MS,
    })).resolves.toEqual({ status: "success" });

    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([202, 204, 401, 404, 500])("rejects HTTP %s instead of confirmation", async (status) => {
    fetchSpy.mockResolvedValueOnce({
      ok: status < 300,
      status,
      text: async () => "",
    });

    await expect(apiRequest("/users/me", {
      expectedStatus: 200,
      timeoutMs: REST_REQUEST_TIMEOUT_MS,
    })).rejects.toMatchObject({ status, path: "/users/me" });

    expect(jest.getTimerCount()).toBe(0);
  });

  it("aborts an unanswered request after five seconds", async () => {
    let requestSignal: AbortSignal | undefined;
    fetchSpy.mockImplementationOnce((_url: string, options: RequestInit) => {
      requestSignal = options.signal ?? undefined;
      return new Promise((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () => reject(new Error("Request aborted")));
      });
    });

    const request = apiRequest("/users/me", {
      expectedStatus: 200,
      timeoutMs: REST_REQUEST_TIMEOUT_MS,
    });
    const rejection = expect(request).rejects.toThrow("Request aborted");

    await jest.advanceTimersByTimeAsync(4_999);
    expect(requestSignal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);

    await rejection;
    expect(requestSignal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it("keeps the deadline active while reading the response body", async () => {
    fetchSpy.mockImplementationOnce((_url: string, options: RequestInit) => Promise.resolve({
      ok: true,
      status: 200,
      text: () => new Promise((_resolve, reject) => {
        options.signal?.addEventListener("abort", () => reject(new Error("Body aborted")));
      }),
    }));

    const request = apiRequest("/users/me", {
      expectedStatus: 200,
      timeoutMs: REST_REQUEST_TIMEOUT_MS,
    });
    const rejection = expect(request).rejects.toThrow("Body aborted");
    await jest.advanceTimersByTimeAsync(REST_REQUEST_TIMEOUT_MS);

    await rejection;
    expect(jest.getTimerCount()).toBe(0);
  });

  it("rejects malformed JSON and clears the deadline", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, status: 200, text: async () => "not JSON" });

    await expect(apiRequest("/users/me", {
      expectedStatus: 200,
      timeoutMs: REST_REQUEST_TIMEOUT_MS,
    })).rejects.toBeInstanceOf(SyntaxError);

    expect(jest.getTimerCount()).toBe(0);
  });

  it("preserves default handling for other API requests", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, status: 204, text: async () => "" });

    await expect(apiRequest("/another-endpoint")).resolves.toBeUndefined();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("preserves API errors", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Server error" });

    await expect(apiRequest("/users/me")).rejects.toBeInstanceOf(ApiError);
  });
});
