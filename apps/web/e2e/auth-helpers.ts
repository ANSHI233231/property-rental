/**
 * E2E helper utilities shared across auth test files.
 */

import type { Page } from "@playwright/test";

export const ADMIN_EMAIL = "admin@gharsetu.local";
export const ADMIN_PASSWORD = "Admin@gharsetu2026!";
export const PM_EMAIL = "pm.test@gharsetu.local";
export const PM_PASSWORD = "Test@gharsetu2026!";
export const MAINTENANCE_EMAIL = "maintenance.test@gharsetu.local";
export const MAINTENANCE_PASSWORD = "Test@gharsetu2026!";
export const TENANT_EMAIL = "tenant.test@gharsetu.local";
export const TENANT_PASSWORD = "Test@gharsetu2026!";

/** Helper: fill in the login form and submit. */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.fill('input[type="text"][placeholder*="raj@"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

/** Helper: clear the __loggedIn cookie (simulate logged-out state). */
export async function clearSession(page: Page): Promise<void> {
  await page.context().clearCookies();
}
