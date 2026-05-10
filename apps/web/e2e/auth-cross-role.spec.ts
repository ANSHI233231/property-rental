/**
 * E2E: auth-cross-role
 * Verify middleware behaviour for logged-in users across role prefixes.
 *
 * BLOCKED by BUG-001: CORS not configured — cannot complete browser login flow.
 * API-level role isolation is tested in auth-integration.spec.ts (TC-ROLE-003/006).
 *
 * Phase 2 will add client-side role guard in (app)/layout.tsx.
 */

import { test, expect } from "@playwright/test";

// Unauthenticated redirect tests — clear cookies before each
test.describe("auth-cross-role (unauthenticated)", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("middleware: missing __loggedIn cookie causes redirect to /login for all role prefixes", async ({ page }) => {
    // Without __loggedIn cookie, ALL protected paths redirect to /login
    const paths = ["/admin/dashboard", "/pm/dashboard", "/maintenance/dashboard", "/tenant/dashboard"];
    for (const prefix of paths) {
      await page.goto(prefix);
      await page.waitForURL(/\/login/, { timeout: 10_000 });
      expect(page.url()).toContain("/login");
    }
  });
});

// Cookie-based access tests — isolated describe block, NO beforeEach clearCookies
// Uses context.addCookies() (network-layer injection) to avoid document.cookie
// SameSite=Strict restrictions that can prevent cookies from being sent cross-navigation.
test.describe("auth-cross-role (authenticated via cookie)", () => {
  test("middleware: __loggedIn=1 cookie allows access to protected routes (no role check at middleware level)", async ({ page, context }) => {
    // Manual clean state
    await context.clearCookies();

    // Inject cookie directly at the network layer
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

    // Confirm cookie is present
    const cookies = await context.cookies("http://localhost:3000");
    expect(cookies.find((c) => c.name === "__loggedIn")?.value).toBe("1");

    // With __loggedIn set, middleware lets requests through.
    // Assert URL immediately after goto() — the server-side middleware decision.
    // Do NOT wait: client-side AuthProvider redirects to /login if /auth/refresh
    // fails (BUG-001 CORS blocks the refresh call in the dev environment).
    const response = await page.goto("/admin/dashboard");

    // Middleware returned 200 (cookie present)
    expect(response?.status()).toBe(200);
    // URL should NOT be redirected to /login (middleware only checks presence)
    expect(page.url()).toContain("/admin/dashboard");
    expect(page.url()).not.toContain("/login");
  });

  test("PHASE-1-GAP: client-side cross-role redirect not yet implemented — documented for Phase 2", async ({ page, context }) => {
    // Inject cookie for isolation — do not depend on prior test state
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

    // Assert immediately after goto() — middleware decision, before client-side redirect
    const response = await page.goto("/admin/dashboard");
    expect(response?.status()).toBe(200);

    // Phase 1: middleware allows ANY logged-in user to visit ANY role prefix
    // Phase 2 TODO: PM user should be redirected to /pm/dashboard when visiting /admin/dashboard
    expect(page.url()).toContain("/admin/dashboard"); // no client-side guard yet
  });
});
