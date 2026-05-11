/**
 * Next.js Edge Middleware — auth + role-based routing.
 *
 * Strategy:
 * 1. If no __loggedIn cookie → redirect to /login.
 * 2. If __role cookie exists, enforce cross-role redirect:
 *    /admin/* requires ADMIN, /pm/* requires PROPERTY_MANAGER, etc.
 *    This is NOT a security gate — the API enforces RBAC via JWT.
 *    The __role cookie only prevents accidental cross-role navigation (FOUC prevention).
 *
 * The __loggedIn + __role cookies are non-HttpOnly, SameSite=Strict and carry
 * no secret. Real auth enforcement is done server-side by the NestJS API.
 */

import { NextResponse, type NextRequest } from "next/server";

type AppRole = "ADMIN" | "PROPERTY_MANAGER" | "MAINTENANCE" | "TENANT";

/** Maps route prefix → required role. */
const ROLE_PREFIXES: Array<{ prefix: string; role: AppRole; home: string }> = [
  { prefix: "/admin", role: "ADMIN", home: "/admin/dashboard" },
  { prefix: "/pm", role: "PROPERTY_MANAGER", home: "/pm/dashboard" },
  { prefix: "/maintenance", role: "MAINTENANCE", home: "/maintenance/dashboard" },
  { prefix: "/tenant", role: "TENANT", home: "/tenant/dashboard" },
];

function homeForRole(role: AppRole): string {
  switch (role) {
    case "ADMIN": return "/admin/dashboard";
    case "PROPERTY_MANAGER": return "/pm/dashboard";
    case "MAINTENANCE": return "/maintenance/dashboard";
    case "TENANT": return "/tenant/dashboard";
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Find if this path is a protected prefix
  const matched = ROLE_PREFIXES.find(({ prefix }) => pathname.startsWith(prefix));

  if (!matched) {
    // Not a protected route — allow
    return NextResponse.next();
  }

  // Check presence indicator cookie
  const loggedIn = request.cookies.get("__loggedIn")?.value === "1";

  if (!loggedIn) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cross-role guard using the non-secret __role cookie
  const roleCookie = request.cookies.get("__role")?.value as AppRole | undefined;

  if (roleCookie && roleCookie !== matched.role) {
    // Logged in but wrong role — redirect to their actual dashboard
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = homeForRole(roleCookie);
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  /*
   * BUG-003 fix: tighten matcher to protected prefixes only.
   * The broad negative-lookahead regex was correct but fragile across
   * Next.js versions. Explicitly listing prefixes is simpler and guarantees
   * the middleware fires for every protected route.
   */
  matcher: [
    "/admin/:path*",
    "/pm/:path*",
    "/maintenance/:path*",
    "/tenant/:path*",
  ],
};
