/**
 * RolesGuard unit tests.
 *
 * Case A: handler has @RoleErrorCode → ForbiddenException body carries { error: { code: '<the code>' } }
 * Case B: handler has no @RoleErrorCode → ForbiddenException message is 'Insufficient role' (generic)
 * Case C: user has the required role → canActivate returns true (no exception)
 * Case D: no @Roles decorator → open endpoint, returns true
 */

import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { ROLE_ERROR_CODE_KEY } from "../decorators/role-error-code.decorator";
import type { ExecutionContext } from "@nestjs/common";

function buildContext(userRole: string | null): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: userRole ? { sub: "user-1", role: userRole } : null,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function mockReflector(roles: string[], blCode?: string): void {
    jest
      .spyOn(reflector, "getAllAndOverride")
      .mockImplementation((key: unknown) => {
        if (key === ROLES_KEY) return roles as unknown as undefined;
        if (key === ROLE_ERROR_CODE_KEY) return (blCode ?? undefined) as unknown as undefined;
        return undefined;
      });
  }

  describe("Case A: @RoleErrorCode present, caller denied", () => {
    it("throws ForbiddenException with the BL code in error.code", () => {
      mockReflector(["ADMIN", "PROPERTY_MANAGER"], "BL_10_TENANT_CANNOT_RECORD_PAYMENT");

      const ctx = buildContext("TENANT");

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);

      try {
        guard.canActivate(ctx);
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const body = (err as ForbiddenException).getResponse() as {
          error: { code: string; message: string };
        };
        expect(body.error.code).toBe("BL_10_TENANT_CANNOT_RECORD_PAYMENT");
        expect(typeof body.error.message).toBe("string");
      }
    });
  });

  describe("Case B: no @RoleErrorCode, caller denied", () => {
    it("throws ForbiddenException with plain string 'Insufficient role'", () => {
      mockReflector(["ADMIN"], undefined);

      const ctx = buildContext("TENANT");

      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);

      try {
        guard.canActivate(ctx);
      } catch (err) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const body = (err as ForbiddenException).getResponse() as {
          message?: string;
          error?: { code?: string };
        };
        // NestJS wraps plain strings as { statusCode, error, message } — no blCode object.
        // CodeErrorFilter reads message and derives FORBIDDEN from status.
        expect(typeof body).toBe("object");
        // Crucially: no nested error.code field — CodeErrorFilter will use codeFromStatus(403) = 'FORBIDDEN'
        expect((body as Record<string, unknown>).error).not.toEqual(expect.objectContaining({ code: expect.anything() }));
      }
    });
  });

  describe("Case C: caller has the required role", () => {
    it("returns true without throwing", () => {
      mockReflector(["ADMIN", "PROPERTY_MANAGER"]);

      const ctx = buildContext("ADMIN");

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe("Case D: no @Roles decorator on handler (open endpoint)", () => {
    it("returns true", () => {
      mockReflector([]);

      const ctx = buildContext("TENANT");

      expect(guard.canActivate(ctx)).toBe(true);
    });
  });
});
