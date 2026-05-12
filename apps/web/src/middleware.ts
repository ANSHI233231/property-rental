/**
 * Next.js Edge Middleware — auth + role-based routing.
 *
 * Strategy:
 * 1. If no __loggedIn cookie → redirect to /login.
 * 2. If __role cookie exists, enforce cross-role redirect:
 *    /admin/* requires role 0 (ADMIN), /pm/* requires role 1 (PROPERTY_MANAGER), etc.
 *    This is NOT a security gate — the API enforces RBAC via JWT.
 *    The __role cookie only prevents accidental cross-role navigation (FOUC prevention).
 *
 * The __loggedIn + __role cookies are non-HttpOnly, SameSite=Strict and carry
 * no secret. Real auth enforcement is done server-side by the NestJS API.
 *
 * Cookie stores the numeric role code as a string (e.g. "0" for ADMIN,
 * "1" for PROPERTY_MANAGER, "2" for MAINTENANCE, "3" for TENANT).
 * Matches RoleEnum in packages/shared/src/enums.ts.
 */

import { NextResponse, type NextRequest } from "next/server";

// Numeric role codes — must match RoleEnum in packages/shared/src/enums.ts
const ROLE_ADMIN = 0;
const ROLE_PROPERTY_MANAGER = 1;
const ROLE_MAINTENANCE = 2;
const ROLE_TENANT = 3;

type NumericRole = 0 | 1 | 2 | 3;

/** Maps route prefix → required numeric role code. */
const ROLE_PREFIXES: Array<{ prefix: string; role: NumericRole; home: string }> = [
  { prefix: "/admin", role: ROLE_ADMIN, home: "/admin/dashboard" },
  { prefix: "/pm", role: ROLE_PROPERTY_MANAGER, home: "/pm/dashboard" },
  { prefix: "/maintenance", role: ROLE_MAINTENANCE, home: "/maintenance/dashboard" },
  { prefix: "/tenant", role: ROLE_TENANT, home: "/tenant/dashboard" },
];

function homeForRole(role: NumericRole): string {
  switch (role) {
    case ROLE_ADMIN: return "/admin/dashboard";
    case ROLE_PROPERTY_MANAGER: return "/pm/dashboard";
    case ROLE_MAINTENANCE: return "/maintenance/dashboard";
    case ROLE_TENANT: return "/tenant/dashboard";
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

  // Cross-role guard using the non-secret __role cookie.
  // Cookie value is the numeric role code as a string: "0", "1", "2", "3".
  const roleCookieRaw = request.cookies.get("__role")?.value;

  if (roleCookieRaw !== undefined && roleCookieRaw !== "") {
    const roleCode = parseInt(roleCookieRaw, 10) as NumericRole;

    if (!isNaN(roleCode) && roleCode !== matched.role) {
      // Logged in but wrong role — redirect to their actual dashboard
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = homeForRole(roleCode);
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }
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
