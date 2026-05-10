import { describe, it, expect } from "vitest";
import { Role, ROLES, isRole } from "../role.js";

describe("Role enum", () => {
  it("exposes the four roles from SRS §10", () => {
    expect(Object.keys(Role).sort()).toEqual(
      ["ADMIN", "MAINTENANCE", "MANAGER", "TENANT"].sort(),
    );
  });

  it("ROLES is an exhaustive readonly tuple", () => {
    expect(ROLES.length).toBe(4);
    expect(ROLES).toContain(Role.ADMIN);
  });

  it("isRole narrows correctly", () => {
    expect(isRole("ADMIN")).toBe(true);
    expect(isRole("TENANT")).toBe(true);
    expect(isRole("OWNER")).toBe(false);
    expect(isRole(42)).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
