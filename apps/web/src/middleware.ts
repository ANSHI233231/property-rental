/**
 * Next.js Edge Middleware — auth + role-based routing.
 *
 * The refresh token is HttpOnly and not readable from middleware JS.
 * Strategy: protect (app)/* routes by redirecting to /login when no
 * __loggedIn=1 cookie is present. The client-side AuthProvider restores
 * the session via POST /auth/refresh on mount.
 *
 * The __loggedIn cookie is a non-HttpOnly, SameSite=Strict, Secure=true
 * cookie set by the client after a successful login (see AuthProvider).
 * It carries no secret — its sole purpose is to let middleware know a
 * refresh cookie exists, so we can avoid a FOUC redirect for auth'd users.
 *
 * If __loggedIn is absent we redirect to /login?next=<path> immediately.
 * If __loggedIn is present but the refresh token is actually expired,
 * the client-side AuthProvider handles the redirect after the failed refresh.
 */

import { NextResponse, type NextRequest } from "next/server";

/** Paths that require authentication (starts-with match). */
const PROTECTED_PREFIXES = [
  "/admin",
  "/pm",
  "/maintenance",
  "/tenant",
];

/** Public paths — never redirect. */
const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (!isProtected) return NextResponse.next();

  // Check for the lightweight presence indicator cookie.
  const loggedIn = request.cookies.get("__loggedIn")?.value === "1";

  if (!loggedIn) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next (Next.js internals)
     *   - static files (images, fonts, etc.)
     *   - api routes (handled server-side)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
