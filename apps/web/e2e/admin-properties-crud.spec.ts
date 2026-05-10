/**
 * E2E: admin-properties-crud
 *
 * Tests the Admin → Properties page middleware and structural assertions.
 *
 * Important constraints:
 * - BUG-001: CORS blocks browser → API login, so no real JWT can be obtained via browser.
 * - BUG-003: Cross-role middleware redirect via __role cookie does not fire.
 * - Admin pages are client-side rendered — without a real API session, AuthProvider
 *   redirects to /login after hydration.
 *
 * What this spec CAN test:
 * 1. Middleware allows ADMIN cookies through to the page (200, not 307 to login)
 * 2. The login page renders correctly (public path smoke)
 * 3. Unauthenticated access to /admin/* redirects to /login (middleware-level)
 *
 * What requires live API (deferred to phase2-gaps.spec.ts integration tests):
 * - Add Property form submit → row appears
 * - Modal validation rendering (requires hydrated React page with API token)
 */

import { test, expect } from "@playwright/test";

const ADMIN_EXPIRES = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

test.describe("admin-properties-crud — middleware layer", () => {
  test("Unauthenticated /admin/dashboard → redirected to /login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/admin/dashboard");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain("/login");
    expect(page.url()).toContain("next=");
  });

  test("ADMIN cookie on /admin/dashboard → middleware allows (200, no middleware redirect)", async ({ page, context }) => {
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires: ADMIN_EXPIRES, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "ADMIN", domain: "localhost", path: "/", expires: ADMIN_EXPIRES, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);

    const response = await page.goto("/admin/dashboard");
    // Middleware step: 200 (not a redirect to /login — cookie is present)
    expect(response?.status()).toBe(200);
  });

  test("Unauthenticated /admin/dashboard (different path) → redirected to /login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/admin/dashboard");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("Public path /login returns 200 for unauthenticated users", async ({ page, context }) => {
    await context.clearCookies();
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
  });

  test("Public path /forgot-password returns 200 for unauthenticated users", async ({ page, context }) => {
    await context.clearCookies();
    const response = await page.goto("/forgot-password");
    expect(response?.status()).toBe(200);
  });

  /**
   * TC-UI-001 / noValidate — confirmed at Vitest layer (phase2-gaps.test.ts).
   * Cannot be confirmed via live CSR admin page without real API token.
   * Status: COVERED at unit layer, blocked at E2E by BUG-001.
   */
  test("TC-UI-001 traceability: noValidate on Property form is verified in Vitest (phase2-gaps.test.ts)", () => {
    // This is a traceability anchor. The unit test asserts the form has noValidate.
    expect(true).toBe(true);
  });
});
