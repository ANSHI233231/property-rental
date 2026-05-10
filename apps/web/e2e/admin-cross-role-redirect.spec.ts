/**
 * E2E: admin-cross-role-redirect
 *
 * Verifies the middleware cross-role enforcement introduced in Phase 2.
 * A logged-in PM (cookie __role=PROPERTY_MANAGER) visiting /admin/* must be
 * redirected to /pm/dashboard, NOT allowed through.
 *
 * Uses cookie injection (context.addCookies) to simulate the logged-in state
 * without requiring a working browser → API login flow (BUG-001 CORS caveat).
 *
 * TC coverage: PHASE-1-GAP resolved (cross-role redirect now live).
 */

import { test, expect } from "@playwright/test";

test.describe("admin-cross-role-redirect", () => {
  const expires = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

  function injectRole(roleName: string) {
    return [
      {
        name: "__loggedIn",
        value: "1",
        domain: "localhost",
        path: "/",
        expires,
        httpOnly: false,
        secure: false,
        sameSite: "Strict" as const,
      },
      {
        name: "__role",
        value: roleName,
        domain: "localhost",
        path: "/",
        expires,
        httpOnly: false,
        secure: false,
        sameSite: "Strict" as const,
      },
    ];
  }

  /**
   * BUG-003: Cross-role redirect via __role cookie does NOT fire in the live Next.js middleware.
   * curl confirms: `Cookie: __loggedIn=1; __role=PROPERTY_MANAGER` on `/admin/dashboard` → 200 OK
   * Expected: 307 redirect to /pm/dashboard.
   * This is a production bug in middleware.ts — the __role guard branch at line 60 is not
   * evaluating correctly in the live runtime. Repro: curl -v -H "Cookie: __loggedIn=1; __role=PROPERTY_MANAGER" http://localhost:3000/admin/dashboard
   * The test below is a FAILING REGRESSION TEST that documents BUG-003.
   */
  test("BUG-003 REGRESSION: PM (__role=PROPERTY_MANAGER) visiting /admin/dashboard should redirect to /pm/dashboard — CURRENTLY FAILS", async ({ page, context }) => {
    await context.clearCookies();
    await context.addCookies(injectRole("PROPERTY_MANAGER"));

    const response = await page.goto("/admin/dashboard");

    // Expected (after fix): 307 redirect to /pm/dashboard
    // Actual (BUG-003): 200 OK — middleware cross-role guard not firing
    // This test is intentionally left to FAIL until BUG-003 is fixed by FE team.
    expect(response?.status()).toBe(307); // will fail — documents the bug
  });

  test("BUG-003 REGRESSION: Tenant (__role=TENANT) visiting /admin/dashboard should redirect — CURRENTLY FAILS", async ({ page, context }) => {
    await context.clearCookies();
    await context.addCookies(injectRole("TENANT"));

    const response = await page.goto("/admin/dashboard");
    // Expected: redirect away from /admin
    // Actual (BUG-003): 200 stays on /admin
    expect(page.url()).not.toContain("/admin"); // will fail — documents the bug
  });

  test("Admin (__role=ADMIN) visiting /admin/dashboard → 200 allowed (no redirect)", async ({ page, context }) => {
    await context.clearCookies();
    await context.addCookies(injectRole("ADMIN"));

    const response = await page.goto("/admin/dashboard");
    // Admin on admin route — must be allowed (200)
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("/admin/dashboard");
  });

  test("BUG-003 REGRESSION: Admin (__role=ADMIN) visiting /pm/dashboard should redirect — CURRENTLY FAILS", async ({ page, context }) => {
    await context.clearCookies();
    await context.addCookies(injectRole("ADMIN"));

    const response = await page.goto("/pm/dashboard");
    // Expected: 307 to /admin/dashboard
    // Actual (BUG-003): 200 — cross-role guard not firing
    expect(response?.status()).toBe(307); // will fail — documents the bug
  });

  test("Unauthenticated (no cookies) visiting /admin/dashboard → redirected to /login with next param", async ({ page, context }) => {
    await context.clearCookies();

    await page.goto("/admin/dashboard", { waitUntil: "commit" });
    await page.waitForURL(/\/login/, { timeout: 8_000 });

    expect(page.url()).toContain("/login");
    // next param must encode the original path
    expect(page.url()).toContain("next=");
  });

  test("BUG-003 REGRESSION: Maintenance visiting /admin/dashboard should redirect — CURRENTLY FAILS", async ({ page, context }) => {
    await context.clearCookies();
    await context.addCookies(injectRole("MAINTENANCE"));

    const response = await page.goto("/admin/dashboard");
    // Expected: redirect to /maintenance/dashboard
    // Actual (BUG-003): 200
    expect(response?.status()).toBe(307); // will fail — documents the bug
  });
});
