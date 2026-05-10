/**
 * E2E: auth-protected-route
 * Visiting /admin/dashboard while logged out redirects to /login?next=/admin/dashboard.
 * Also verifies the middleware PROTECTED_PREFIXES list is enforced.
 */

import { test, expect } from "@playwright/test";

const PROTECTED_PATHS = [
  "/admin/dashboard",
  "/pm/dashboard",
  "/maintenance/dashboard",
  "/tenant/dashboard",
];

// Unauthenticated redirect tests — all clear cookies first
test.describe("auth-protected-route (unauthenticated)", () => {
  test.beforeEach(async ({ context }) => {
    // Ensure logged-out state (no __loggedIn cookie)
    await context.clearCookies();
  });

  for (const path of PROTECTED_PATHS) {
    test(`unauthenticated access to ${path} redirects to /login?next=${path}`, async ({ page }) => {
      await page.goto(path);

      // Middleware should redirect to /login?next=<path>
      await page.waitForURL(/\/login/, { timeout: 10_000 });

      expect(page.url()).toContain("/login");
      expect(page.url()).toContain(`next=${encodeURIComponent(path)}`);
    });
  }

  test("public paths /login, /forgot-password are accessible without auth", async ({ page }) => {
    // /login must be publicly accessible
    await page.goto("/login");
    await page.waitForSelector("form.auth-card", { timeout: 10_000 });
    expect(page.url()).toContain("/login");
    expect(page.url()).not.toContain("next=");

    // /forgot-password must be publicly accessible
    await page.goto("/forgot-password");
    await page.waitForSelector("form.auth-card", { timeout: 10_000 });
    expect(page.url()).toContain("/forgot-password");
  });
});

// Cookie-based access test — isolated describe block, NO beforeEach clearCookies
// Uses context.addCookies() (network-layer injection) to avoid document.cookie
// SameSite=Strict restrictions that can prevent cookies from being sent cross-navigation.
test.describe("auth-protected-route (authenticated via cookie)", () => {
  test("__loggedIn=1 cookie prevents middleware redirect on protected routes", async ({ page, context }) => {
    // Start from a clean state manually (not via beforeEach)
    await context.clearCookies();

    // Inject cookie directly at the network layer (bypasses SameSite restrictions in Playwright)
    // expires: now + 7 days in epoch seconds
    const expiresEpoch = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    await context.addCookies([
      {
        name: "__loggedIn",
        value: "1",
        domain: "localhost",
        path: "/",
        expires: expiresEpoch,
        httpOnly: false,
        secure: false,
        sameSite: "Strict",
      },
    ]);

    // Verify the cookie was set in this context
    const cookies = await context.cookies("http://localhost:3000");
    const loggedInCookie = cookies.find((c) => c.name === "__loggedIn");
    expect(loggedInCookie?.value).toBe("1");

    // Navigate to protected route — middleware should allow through.
    // We assert the URL immediately after goto() (server-side middleware decision).
    // We do NOT wait after goto because client-side AuthProvider redirects to /login
    // when it cannot reach /auth/refresh (BUG-001: CORS not configured).
    // This test verifies middleware behavior only, not client-side session restoration.
    const response = await page.goto("/admin/dashboard");

    // Middleware returned 200 (cookie present) — URL is /admin/dashboard at this point
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain("/admin/dashboard");
    expect(page.url()).not.toContain("/login");
  });
});
