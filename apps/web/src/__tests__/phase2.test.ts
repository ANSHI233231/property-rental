/**
 * Phase 2 unit tests:
 * 1. Currency rendering — formatINR wired from @gharsetu/shared
 * 2. Error-code mapping — each known code maps correctly
 * 3. Properties create form — zod schema errors
 * 4. DataTable concept — rows render / empty state
 */

import { describe, it, expect } from "vitest";
import { formatINR } from "@gharsetu/shared";
import { mapApiErrorCode, friendlyError } from "../lib/api/errors";
import { PropertyInputSchema } from "@gharsetu/shared";

// ---------------------------------------------------------------------------
// 1. Currency rendering
// ---------------------------------------------------------------------------

describe("formatINR — @gharsetu/shared wired correctly", () => {
  it("formats 1_200_000_00 paise as ₹12,00,000", () => {
    // 1_200_000_00 paise = ₹12,00,000
    const result = formatINR(120000000);
    expect(result).toMatch(/12,00,000/);
    expect(result).toContain("₹");
  });

  it("formats 1_800_000 paise as ₹18,000 (typical unit rent)", () => {
    const result = formatINR(1800000);
    expect(result).toMatch(/18,000/);
    expect(result).toContain("₹");
  });

  it("formats 0 paise as ₹0", () => {
    const result = formatINR(0);
    expect(result).toContain("0");
    expect(result).toContain("₹");
  });

  it("formats 100 paise as ₹1", () => {
    const result = formatINR(100);
    expect(result).toContain("₹");
    expect(result).toContain("1");
  });
});

// ---------------------------------------------------------------------------
// 2. Error-code mapping
// ---------------------------------------------------------------------------

describe("mapApiErrorCode", () => {
  it("maps PM_ALREADY_ASSIGNED", () => {
    expect(mapApiErrorCode("PM_ALREADY_ASSIGNED")).toContain("already assigned");
  });

  it("maps UNIT_RENT_LOCKED", () => {
    expect(mapApiErrorCode("UNIT_RENT_LOCKED")).toContain("Available or Listed");
  });

  it("maps LAST_ADMIN_PROTECTED", () => {
    expect(mapApiErrorCode("LAST_ADMIN_PROTECTED")).toContain("Admin must remain");
  });

  it("maps PM_HAS_PROPERTY", () => {
    expect(mapApiErrorCode("PM_HAS_PROPERTY")).toContain("assigned to a property");
  });

  it("maps INVALID_PM_ROLE", () => {
    expect(mapApiErrorCode("INVALID_PM_ROLE")).toContain("Property Manager");
  });

  it("returns a safe fallback for unknown codes", () => {
    const msg = mapApiErrorCode("TOTALLY_UNKNOWN_CODE_XYZ");
    expect(msg).toBe("Something went wrong. Please try again.");
  });
});

describe("friendlyError", () => {
  it("uses the error code if known", () => {
    const err = { code: "LAST_ADMIN_PROTECTED", message: "raw server msg" };
    expect(friendlyError(err)).toContain("Admin must remain");
  });

  it("falls back to .message if code is unknown", () => {
    const err = { code: "UNKNOWN_CODE", message: "Something specific happened" };
    expect(friendlyError(err)).toBe("Something specific happened");
  });

  it("returns default for null/undefined", () => {
    expect(friendlyError(null)).toBe("Something went wrong. Please try again.");
    expect(friendlyError(undefined)).toBe("Something went wrong. Please try again.");
  });
});

// ---------------------------------------------------------------------------
// 3. Property create form — zod schema validation
// ---------------------------------------------------------------------------

describe("PropertyInputSchema", () => {
  it("passes with all required fields", () => {
    const result = PropertyInputSchema.safeParse({
      name: "Green Valley Apartments",
      address: "Sector 12, Dwarka",
      city: "Delhi",
      state: "Delhi",
      pincode: "110075",
    });
    expect(result.success).toBe(true);
  });

  it("fails when name is empty", () => {
    const result = PropertyInputSchema.safeParse({
      name: "",
      address: "Sector 12, Dwarka",
      city: "Delhi",
      state: "Delhi",
      pincode: "110075",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errs = result.error.flatten().fieldErrors;
      expect(errs.name?.length).toBeGreaterThan(0);
    }
  });

  it("fails when pincode is not 6 digits", () => {
    const result = PropertyInputSchema.safeParse({
      name: "Test Property",
      address: "Some address",
      city: "Delhi",
      state: "Delhi",
      pincode: "11007", // 5 digits — invalid
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errs = result.error.flatten().fieldErrors;
      expect(errs.pincode?.length).toBeGreaterThan(0);
    }
  });

  it("fails when city is missing", () => {
    const result = PropertyInputSchema.safeParse({
      name: "Test Property",
      address: "Some address",
      city: "",
      state: "Delhi",
      pincode: "110075",
    });
    expect(result.success).toBe(false);
  });

  it("defaults timezone to Asia/Kolkata", () => {
    const result = PropertyInputSchema.safeParse({
      name: "Test",
      address: "Addr",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe("Asia/Kolkata");
    }
  });
});

// ---------------------------------------------------------------------------
// 4. UserCreateSchema — renders errors below field (schema layer test)
// ---------------------------------------------------------------------------

import { UserCreateSchema } from "@gharsetu/shared";

describe("UserCreateSchema", () => {
  // F1 changes the shape: name → firstName + lastName, password is required,
  // and specialization is required iff role === MAINTENANCE.
  const validPm = {
    email: "pm@gharsetu.in",
    firstName: "Sunita",
    lastName: "Arora",
    role: "PROPERTY_MANAGER" as const,
    password: "Password123!",
    phone: "9876543210",
  };

  it("passes with valid PM create input", () => {
    const result = UserCreateSchema.safeParse(validPm);
    expect(result.success).toBe(true);
  });

  it("fails when email is invalid", () => {
    const result = UserCreateSchema.safeParse({ ...validPm, email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.email?.length).toBeGreaterThan(0);
    }
  });

  it("fails when phone is not a valid Indian mobile number", () => {
    const result = UserCreateSchema.safeParse({ ...validPm, phone: "123" });
    expect(result.success).toBe(false);
  });

  it("fails when firstName is empty", () => {
    const result = UserCreateSchema.safeParse({ ...validPm, firstName: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.firstName?.length).toBeGreaterThan(0);
    }
  });

  it("MAINTENANCE without specialization fails", () => {
    const result = UserCreateSchema.safeParse({
      ...validPm,
      role: "MAINTENANCE",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.specialization?.length).toBeGreaterThan(0);
    }
  });

  it("non-MAINTENANCE with specialization fails", () => {
    const result = UserCreateSchema.safeParse({
      ...validPm,
      specialization: "Plumber",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.specialization?.length).toBeGreaterThan(0);
    }
  });

  it("normalises email to lowercase", () => {
    const result = UserCreateSchema.safeParse({ ...validPm, email: "PM@GHARSETU.IN" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("pm@gharsetu.in");
    }
  });
});
