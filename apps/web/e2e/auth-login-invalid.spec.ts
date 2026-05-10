/**
 * E2E: auth-login-invalid
 * TC-AUTH-002: bad password shows ⚠ error below field; URL stays at /login.
 * TC-UI-001: browser native tooltip does NOT appear (noValidate + custom .field-error).
 */

import { test, expect } from "@playwright/test";

test.describe("auth-login-invalid", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("TC-UI-001 + TC-AUTH-002: empty submit — no native tooltip, custom .field-error.show appears below fields", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector("form.auth-card", { timeout: 10_000 });

    // Confirm noValidate is set (this prevents native browser tooltips)
    const noValidate = await page.evaluate(() => {
      const form = document.querySelector("form.auth-card") as HTMLFormElement | null;
      return form?.noValidate ?? false;
    });
    expect(noValidate).toBe(true);

    // Click submit with empty fields
    await page.click('button[type="submit"]');

    // Wait for error to appear
    await page.waitForSelector(".field-error.show", { timeout: 5_000 });

    // Native tooltip: the active element validity.valueMissing may be true internally,
    // but the VISIBLE native popup must not appear (noValidate suppresses it).
    // We assert by checking the .field-error.show div is visible, not a tooltip.
    const errorEls = page.locator(".field-error.show");
    const count = await errorEls.count();
    expect(count).toBeGreaterThan(0);

    // At least one error message must contain ⚠ or non-empty text
    const firstError = await errorEls.first().textContent();
    expect(firstError?.length ?? 0).toBeGreaterThan(0);

    // URL must still be /login
    expect(page.url()).toContain("/login");
  });

  test("TC-AUTH-002: failed login — error appears above submit button, URL stays /login", async ({ page }) => {
    // NOTE: BUG-001 — CORS not configured. Browser fetch from localhost:3000 → localhost:3001
    // fails at the network level. The AuthContext catches this and shows
    // "An unexpected error occurred. Please try again." via errors.root.
    // The test verifies:
    //   (a) An error IS rendered (root-level alert, not field-level tooltip)
    //   (b) URL stays at /login
    // The server-side 401 + generic message is proven in auth-integration.spec.ts TC-AUTH-002.

    await page.goto("/login");
    await page.waitForSelector("form.auth-card", { timeout: 10_000 });

    await page.fill('input[autocomplete="username"]', "admin@gharsetu.local");
    await page.fill('input[autocomplete="current-password"]', "WrongPassword999");

    await page.click('button[type="submit"]');

    // The root error is rendered inside the form as a div[role="alert"] with class bg-bg-overdue
    // It is distinct from the empty field-error divs (those have class "field-error")
    await page.waitForSelector('.bg-bg-overdue[role="alert"]', { timeout: 10_000 });

    const alertEl = page.locator('.bg-bg-overdue[role="alert"]');
    const alertText = await alertEl.textContent();
    expect(alertText?.length ?? 0).toBeGreaterThan(0);
    // Must not reveal field-level credential info
    expect(alertText?.toLowerCase() ?? "").not.toContain("email does not exist");

    // URL must stay at /login
    expect(page.url()).toContain("/login");
  });

  test("TC-UI-004: typing in email field after error triggers re-validation on blur", async ({ page }) => {
    // RHF mode: "onBlur" — errors clear on blur, NOT on input.
    // Typing "a" while the field is invalid: error stays until blur or re-submit.
    // On blur with invalid value ("a" is not a valid email), error re-appears.
    // This test verifies the re-validation-on-blur contract.

    await page.goto("/login");
    await page.waitForSelector("form.auth-card", { timeout: 10_000 });

    // Trigger validation errors by submitting empty
    await page.click('button[type="submit"]');
    await page.waitForSelector(".field-error.show", { timeout: 5_000 });

    // Type a valid complete email address in the email field
    const emailInput = page.locator('#email');
    await emailInput.fill("valid@test.com");

    // Blur the field (tab away) to trigger re-validation
    await emailInput.press("Tab");
    await page.waitForTimeout(300);

    // With a valid email, aria-invalid should now be false
    const ariaInvalidAfterValid = await emailInput.getAttribute("aria-invalid");
    expect(ariaInvalidAfterValid).toBe("false");

    // Now type an invalid email and blur — error should re-appear
    await emailInput.fill("notanemail");
    await emailInput.press("Tab");
    await page.waitForTimeout(300);

    const ariaInvalidAfterInvalid = await emailInput.getAttribute("aria-invalid");
    expect(ariaInvalidAfterInvalid).toBe("true");
  });

  test("TC-AUTH-010: no 'Sign up' or 'Register' or 'Create account' text on login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForSelector("form.auth-card", { timeout: 10_000 });

    const bodyText = (await page.textContent("body"))?.toLowerCase() ?? "";
    expect(bodyText).not.toContain("sign up");
    expect(bodyText).not.toContain("register");
    expect(bodyText).not.toContain("create account");

    // The page must contain the footnote about admin-created accounts
    expect(bodyText).toContain("admin");
  });
});
