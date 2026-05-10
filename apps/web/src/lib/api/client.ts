/**
 * Low-level API fetch wrapper.
 *
 * - Base URL from NEXT_PUBLIC_API_BASE_URL env (default: http://localhost:3001/api/v1)
 * - credentials: "include" so HttpOnly refresh cookie travels with requests
 * - Callers pass an optional access token for Bearer auth
 * - 401 handling (refresh + retry) lives in the AuthContext / apiFetch helper
 */

export const API_BASE_URL =
  (typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE_URL
    : undefined) ?? "http://localhost:3001/api/v1";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Raw fetch that always includes credentials (for the refresh cookie). */
export async function rawFetch(
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const url = input.startsWith("http") ? input : `${API_BASE_URL}${input}`;
  return fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * Parse a response, throwing ApiError on non-2xx.
 * The backend always wraps errors as { error: { code, message } }.
 */
export async function parseResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  let code = `HTTP_${res.status}`;
  let message = `Request failed with status ${res.status}`;

  try {
    const body = (await res.json()) as ApiErrorBody;
    code = body.error?.code ?? code;
    message = body.error?.message ?? message;
  } catch {
    // body is not JSON — keep defaults
  }

  throw new ApiError(res.status, code, message);
}
