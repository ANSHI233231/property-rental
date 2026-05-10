/**
 * Login form validation — unit tests for the zod schema used by the login page.
 *
 * These tests verify the validation contract (prototype/assets/validation.js):
 *   - Required fields produce errors when empty
 *   - Invalid email format produces an error
 *   - Valid credentials pass schema validation
 *   - No native browser tooltips (enforced by React Hook Form noValidate — verified in E2E)
 *
 * We test the schema directly (no DOM needed) to keep these fast and isolated.
 */

import { describe, it, expect } from "vitest";
import { LoginInputSchema, ForgotPasswordInputSchema, ResetPasswordInputSchema } from "@gharsetu/shared";

// ---------------------------------------------------------------------------
// LoginInputSchema
// ---------------------------------------------------------------------------

describe("LoginInputSchema", () => {
  it("passes with valid email + password", () => {
    const result = LoginInputSchema.safeParse({
      email: "admin@gharsetu.in",
      password: "anypassword",
    });
    expect(result.success).toBe(true);
  });

  it("fails when email is empty", () => {
    const result = LoginInputSchema.safeParse({ email: "", password: "secret" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailError = result.error.flatten().fieldErrors.email;
      expect(emailError).toBeDefined();
      expect(emailError?.length).toBeGreaterThan(0);
    }
  });

  it("fails when email is not a valid address", () => {
    const result = LoginInputSchema.safeParse({
      email: "not-an-email",
      password: "secret",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const emailError = result.error.flatten().fieldErrors.email;
      expect(emailError).toBeDefined();
    }
  });

  it("fails when password is empty", () => {
    const result = LoginInputSchema.safeParse({
      email: "admin@gharsetu.in",
      password: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordError = result.error.flatten().fieldErrors.password;
      expect(passwordError).toBeDefined();
      expect(passwordError?.length).toBeGreaterThan(0);
    }
  });

  it("normalises email to lowercase", () => {
    const result = LoginInputSchema.safeParse({
      email: "ADMIN@GHARSETU.IN",
      password: "secret",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("admin@gharsetu.in");
    }
  });

  it("produces the correct error message for missing email (⚠ UX contract)", () => {
    const result = LoginInputSchema.safeParse({ email: "", password: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      // The error message must be human-readable and rendered below the field
      const msgs = result.error.flatten().fieldErrors.email ?? [];
      expect(msgs.some((m) => m.length > 0)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// ForgotPasswordInputSchema
// ---------------------------------------------------------------------------

describe("ForgotPasswordInputSchema", () => {
  it("passes with valid email", () => {
    const result = ForgotPasswordInputSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("fails when email is empty", () => {
    const result = ForgotPasswordInputSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });

  it("fails when email is malformed", () => {
    const result = ForgotPasswordInputSchema.safeParse({ email: "notanemail" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ResetPasswordInputSchema
// ---------------------------------------------------------------------------

describe("ResetPasswordInputSchema", () => {
  it("passes with valid token and password meeting policy", () => {
    const result = ResetPasswordInputSchema.safeParse({
      token: "abc123",
      newPassword: "securePass1",
    });
    expect(result.success).toBe(true);
  });

  it("fails when newPassword is shorter than 10 characters", () => {
    const result = ResetPasswordInputSchema.safeParse({
      token: "abc123",
      newPassword: "short1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.flatten().fieldErrors.newPassword ?? [];
      expect(msgs.some((m) => m.includes("10"))).toBe(true);
    }
  });

  it("fails when newPassword has no digit", () => {
    const result = ResetPasswordInputSchema.safeParse({
      token: "abc123",
      newPassword: "onlyletters",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.flatten().fieldErrors.newPassword ?? [];
      expect(msgs.some((m) => m.toLowerCase().includes("number"))).toBe(true);
    }
  });

  it("fails when newPassword has no letter", () => {
    const result = ResetPasswordInputSchema.safeParse({
      token: "abc123",
      newPassword: "1234567890",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.flatten().fieldErrors.newPassword ?? [];
      expect(msgs.some((m) => m.toLowerCase().includes("letter"))).toBe(true);
    }
  });

  it("fails when token is empty", () => {
    const result = ResetPasswordInputSchema.safeParse({
      token: "",
      newPassword: "validPass1",
    });
    expect(result.success).toBe(false);
  });
});
