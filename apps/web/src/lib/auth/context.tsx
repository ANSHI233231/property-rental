"use client";

/**
 * Auth context + token store.
 *
 * Rules:
 * - Access token lives in module-level memory only — NEVER localStorage / sessionStorage.
 * - Refresh is done via HttpOnly cookie automatically sent by the browser.
 * - On 401, we call /auth/refresh once; if that fails we clear state + redirect to /login.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { rawFetch, parseResponse, API_BASE_URL, ApiError } from "../api/client";
import { RoleEnum } from "@gharsetu/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Numeric role — matches the SMALLINT column in the DB (Step 3 migration). */
export type UserRole = RoleEnum;

export interface AuthUser {
  id: number;
  role: UserRole;
  name: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
}

interface AuthContextValue extends AuthState {
  /** Call POST /auth/login and store the result. */
  login: (email: string, password: string) => Promise<void>;
  /** Call POST /auth/logout and clear state. */
  logout: () => Promise<void>;
  /**
   * apiFetch attaches Bearer token and handles a single 401→refresh retry.
   * Use this instead of fetch() for all authenticated requests.
   */
  apiFetch: <T>(input: string, init?: RequestInit) => Promise<T>;
  /** True while the initial session restore is running. */
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Module-level token store (survives re-renders, not serialised anywhere)
// ---------------------------------------------------------------------------

let _accessToken: string | null = null;

function setToken(t: string | null) {
  _accessToken = t;
}

/**
 * Set or clear the lightweight __loggedIn=1 cookie.
 * This carries NO secret — it only lets the Edge middleware know
 * that an HttpOnly refresh cookie likely exists (avoids FOUC redirect).
 */
function setLoggedInCookie(value: boolean) {
  if (typeof document === "undefined") return;
  if (value) {
    document.cookie =
      "__loggedIn=1; Path=/; SameSite=Strict; Max-Age=604800";
  } else {
    document.cookie =
      "__loggedIn=; Path=/; SameSite=Strict; Max-Age=0";
  }
}

/**
 * Set or clear the __role cookie.
 * Non-HttpOnly, SameSite=Strict, NOT a security gate.
 * Used by Edge middleware for cross-role redirect only.
 * Stores the numeric role code as a string (e.g. "0" for ADMIN).
 */
function setRoleCookie(role: UserRole | null) {
  if (typeof document === "undefined") return;
  if (role !== null && role !== undefined) {
    document.cookie = `__role=${role}; Path=/; SameSite=Strict; Max-Age=604800`;
  } else {
    document.cookie = "__role=; Path=/; SameSite=Strict; Max-Age=0";
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
  });
  const [loading, setLoading] = useState(true);
  // Guard against concurrent refresh calls
  const refreshingRef = useRef<Promise<string | null> | null>(null);

  // ------------------------------------------------------------------
  // Restore session on mount via /auth/refresh (reads HttpOnly cookie)
  // ------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const res = await rawFetch("/auth/refresh", { method: "POST" });
        if (!res.ok) throw new Error("no session");
        const data = (await res.json()) as { accessToken: string };
        setToken(data.accessToken);

        // Fetch user info
        const meRes = await rawFetch("/users/me", {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        });
        if (!meRes.ok) throw new Error("me failed");
        const user = (await meRes.json()) as AuthUser;

        if (!cancelled) {
          setState({ user, accessToken: data.accessToken });
          setLoggedInCookie(true);
          setRoleCookie(user.role);
        }
      } catch {
        // No valid session — stay logged out
        setToken(null);
        setLoggedInCookie(false);
        setRoleCookie(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------------------
  // Refresh token (deduplicated)
  // ------------------------------------------------------------------
  const doRefresh = useCallback((): Promise<string | null> => {
    if (refreshingRef.current) return refreshingRef.current;

    const p = rawFetch("/auth/refresh", { method: "POST" })
      .then(async (res) => {
        if (!res.ok) {
          setLoggedInCookie(false);
          setRoleCookie(null);
          return null;
        }
        const data = (await res.json()) as { accessToken: string };
        setToken(data.accessToken);
        setState((prev) => ({ ...prev, accessToken: data.accessToken }));
        setLoggedInCookie(true);
        return data.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshingRef.current = null;
      });

    refreshingRef.current = p;
    return p;
  }, []);

  // ------------------------------------------------------------------
  // apiFetch — attaches Bearer token, retries once on 401
  // ------------------------------------------------------------------
  const apiFetch = useCallback(
    async function apiFetchInner<T>(input: string, init?: RequestInit): Promise<T> {
      const token = _accessToken;
      const res = await rawFetch(input, {
        ...init,
        headers: {
          ...(init?.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (res.status === 401) {
        const newToken = await doRefresh();
        if (!newToken) {
          setToken(null);
          setState({ user: null, accessToken: null });
          setLoggedInCookie(false);
          setRoleCookie(null);
          router.replace("/login");
          throw new ApiError(401, "UNAUTHORIZED", "Session expired");
        }

        // Retry with new token
        const retry = await rawFetch(input, {
          ...init,
          headers: {
            ...(init?.headers ?? {}),
            Authorization: `Bearer ${newToken}`,
          },
        });
        return parseResponse<T>(retry);
      }

      return parseResponse<T>(res);
    },
    [doRefresh, router],
  );

  // ------------------------------------------------------------------
  // login
  // ------------------------------------------------------------------
  const login = useCallback(
    async (email: string, password: string) => {
      const res = await rawFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let message = "Invalid credentials. Please try again.";
        try {
          const body = await res.json();
          if (body?.error?.message) message = body.error.message as string;
        } catch { /* ignore */ }
        throw new ApiError(res.status, "LOGIN_FAILED", message);
      }

      const data = (await res.json()) as {
        accessToken: string;
        user: AuthUser;
      };

      setToken(data.accessToken);
      setState({ user: data.user, accessToken: data.accessToken });
      setLoggedInCookie(true);
      setRoleCookie(data.user.role);
    },
    [],
  );

  // ------------------------------------------------------------------
  // logout
  // ------------------------------------------------------------------
  const logout = useCallback(async () => {
    try {
      await rawFetch("/auth/logout", {
        method: "POST",
        headers: _accessToken
          ? { Authorization: `Bearer ${_accessToken}` }
          : {},
      });
    } catch { /* best-effort */ }
    setToken(null);
    setState({ user: null, accessToken: null });
    setLoggedInCookie(false);
    setRoleCookie(null);
    router.replace("/login");
  }, [router]);

  const value: AuthContextValue = {
    user: state.user,
    accessToken: state.accessToken,
    login,
    logout,
    apiFetch,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Role-based redirect helper
// ---------------------------------------------------------------------------

export function dashboardPathForRole(role: UserRole): string {
  switch (role) {
    case RoleEnum.ADMIN:
      return "/admin/dashboard";
    case RoleEnum.PROPERTY_MANAGER:
      return "/pm/dashboard";
    case RoleEnum.MAINTENANCE:
      return "/maintenance/dashboard";
    case RoleEnum.TENANT:
      return "/tenant/dashboard";
    default:
      return "/login";
  }
}
