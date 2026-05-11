/**
 * E2E: admin-cross-role-redirect
 *
 * Verifies the middleware cross-role enforcement introduced in Phase 2.
 * A logged-in PM (cookie __role=PROPERTY_MANAGER) visiting /admin/* must be
 * redirected to /pm/dashboard, NOT allowed through.
 *
 * Uses cookie injection (context.addCookies) to simulate the logged-in state
 * without requiring a working browser → API login flow.
 *
 * TC coverage: BUG-003 fixed. Cross-role redirect fires correctly in Next.js 15.5.
 *
 * NOTE on response?.status(): page.goto() follows redirects by default and
 * returns the final response status (200). To assert the redirect happened we
 * check the final URL instead of the HTTP status code. The middleware's 307 is
 * confirmed by curl probes (see commit body); the Playwright tests assert the
 * end-state URL which is the user-observable behaviour.
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
   * BUG-003 (fixed): PM visiting /admin/dashboard must end up on /pm/dashboard.
   * page.goto() follows the 307 redirect automatically; we assert the final URL.
   * The raw 307 is verified by curl in the fix commit.
   */
  test("PM (__role=PROPERTY_MANAGER) visiting /admin/dashboard redirects to /pm/dashboard", async ({ page, context }) => {
    await context.clearCookies();
    await context.addCookies(injectRole("PROPERTY_MANAGER"));

    await page.goto("/admin/dashboard", { waitUntil: "commit" });
    await page.waitForURL(/\/pm\/dashboard/, { timeout: 8_000 });

    expect(page.url()).toContain("/pm/dashboard");
    expect(page.url()).not.toContain("/admin");
  });

  test("Tenant (__role=TENANT) visiting /admin/dashboard redirects away from /admin", async ({ page, context }) => {
    await context.clearCookies();
    await context.addCookies(injectRole("TENANT"));

    await page.goto("/admin/dashboard", { waitUntil: "commit" });
    await page.waitForURL(/\/tenant\/dashboard/, { timeout: 8_000 });

    expect(page.url()).not.toContain("/admin");
    expect(page.url()).toContain("/tenant/dashboard");
  });

  test("Admin (__role=ADMIN) visiting /admin/dashboard is allowed (no redirect)", async ({ page, context }) => {
    await context.clearCookies();
    await context.addCookies(injectRole("ADMIN"));

    const response = await page.goto("/admin/dashboard");
    // Admin on admin route — must be allowed (200)
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("/admin/dashboard");
  });

  test("Admin (__role=ADMIN) visiting /pm/dashboard redirects to /admin/dashboard", async ({ page, context }) => {
    await context.clearCookies();
    await context.addCookies(injectRole("ADMIN"));

    await page.goto("/pm/dashboard", { waitUntil: "commit" });
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 8_000 });

    expect(page.url()).toContain("/admin/dashboard");
    expect(page.url()).not.toContain("/pm");
  });

  test("Unauthenticated (no cookies) visiting /admin/dashboard → redirected to /login with next param", async ({ page, context }) => {
    await context.clearCookies();

    await page.goto("/admin/dashboard", { waitUntil: "commit" });
    await page.waitForURL(/\/login/, { timeout: 8_000 });

    expect(page.url()).toContain("/login");
    // next param must encode the original path
    expect(page.url()).toContain("next=");
  });

  test("Maintenance (__role=MAINTENANCE) visiting /admin/dashboard redirects to /maintenance/dashboard", async ({ page, context }) => {
    await context.clearCookies();
    await context.addCookies(injectRole("MAINTENANCE"));

    await page.goto("/admin/dashboard", { waitUntil: "commit" });
    await page.waitForURL(/\/maintenance\/dashboard/, { timeout: 8_000 });

    expect(page.url()).toContain("/maintenance/dashboard");
    expect(page.url()).not.toContain("/admin");
  });
});
