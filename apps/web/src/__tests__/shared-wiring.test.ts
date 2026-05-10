import { describe, it, expect } from "vitest";
import { APP_NAME, ROLES, SHARED_PACKAGE_VERSION, BusinessRules } from "@gharsetu/shared";

/**
 * Phase 0 smoke test: proves apps/web can import from the compiled
 * @gharsetu/shared/dist output. If this passes, the P1 contract holds.
 */
describe("@gharsetu/shared (consumed from apps/web)", () => {
  it("exposes the app name", () => {
    expect(APP_NAME).toBe("GharSetu");
  });

  it("exposes a version string", () => {
    expect(typeof SHARED_PACKAGE_VERSION).toBe("string");
  });

  it("exposes all four roles", () => {
    expect(ROLES.length).toBe(4);
  });

  it("exposes all 23 business rule IDs", () => {
    expect(Object.keys(BusinessRules).length).toBe(23);
  });
});
