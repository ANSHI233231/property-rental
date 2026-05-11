/**
 * Unit tests for CodeErrorFilter — verifies BUG-PHASE-4-1 contract.
 *
 * Each test simulates a thrown exception, runs it through the filter,
 * and asserts { error: { code, message[, details] } } on the wire.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { CodeErrorFilter } from "./code-error.filter";

// ---------------------------------------------------------------------------
// Minimal mocks for ArgumentsHost + Express Response
// ---------------------------------------------------------------------------
function makeHost(responseJson: jest.Mock, responseStatus: jest.Mock) {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        status: responseStatus,
        json: responseJson,
      }),
    }),
  } as never;
}

function runFilter(exception: unknown): { status: number; body: unknown } {
  const filter = new CodeErrorFilter();
  let capturedStatus = 0;
  let capturedBody: unknown = null;

  const json = jest.fn((body: unknown) => {
    capturedBody = body;
  });
  const status = jest.fn((s: number) => {
    capturedStatus = s;
    return { json };
  });

  filter.catch(exception, makeHost(json, status));
  return { status: capturedStatus, body: capturedBody };
}

// ---------------------------------------------------------------------------
// 1. Convention 2 (dominant): { error: { code, message } }
//    BL_10_TENANT_CANNOT_RECORD_PAYMENT
// ---------------------------------------------------------------------------
describe("Convention 2 — wrapped { error: { code, message } }", () => {
  it("BL_10: ForbiddenException with wrapped code preserves code on wire", () => {
    const ex = new ForbiddenException({
      error: {
        code: "BL_10_TENANT_CANNOT_RECORD_PAYMENT",
        message: "Only Property Managers and Admins may record payments (BL-10)",
      },
    });
    const { status, body } = runFilter(ex);
    expect(status).toBe(403);
    expect((body as { error: { code: string; message: string } }).error.code).toBe(
      "BL_10_TENANT_CANNOT_RECORD_PAYMENT",
    );
    expect((body as { error: { code: string; message: string } }).error.message).toContain(
      "BL-10",
    );
  });

  it("UNIT_HAS_ACTIVE_LEASE: ConflictException with wrapped code preserves code", () => {
    const ex = new ConflictException({
      error: {
        code: "UNIT_HAS_ACTIVE_LEASE",
        message: "Unit already has an active lease",
      },
    });
    const { status, body } = runFilter(ex);
    expect(status).toBe(409);
    expect((body as { error: { code: string } }).error.code).toBe("UNIT_HAS_ACTIVE_LEASE");
  });

  it("PM_ALREADY_ASSIGNED: ConflictException preserves code", () => {
    const ex = new ConflictException({
      error: {
        code: "PM_ALREADY_ASSIGNED",
        message: "Property already has an active property manager",
      },
    });
    const { status, body } = runFilter(ex);
    expect(status).toBe(409);
    expect((body as { error: { code: string } }).error.code).toBe("PM_ALREADY_ASSIGNED");
  });

  it("LAST_ADMIN_PROTECTED: ConflictException preserves code", () => {
    const ex = new ConflictException({
      error: {
        code: "LAST_ADMIN_PROTECTED",
        message: "Cannot deactivate the only active admin",
      },
    });
    const { status, body } = runFilter(ex);
    expect(status).toBe(409);
    expect((body as { error: { code: string } }).error.code).toBe("LAST_ADMIN_PROTECTED");
  });

  it("TURNOVER_GAP_REQUIRED: ConflictException preserves code", () => {
    const ex = new ConflictException({
      error: {
        code: "TURNOVER_GAP_REQUIRED",
        message: "A gap of at least 1 day is required between consecutive leases",
      },
    });
    const { status, body } = runFilter(ex);
    expect(status).toBe(409);
    expect((body as { error: { code: string } }).error.code).toBe("TURNOVER_GAP_REQUIRED");
  });

  it("TERMINATION_NOT_FULLY_APPROVED with named details key hoists details correctly", () => {
    const ex = new ConflictException({
      error: {
        code: "TERMINATION_NOT_FULLY_APPROVED",
        message: "Cannot finalize: approvals pending",
        details: {
          pending_tenant_ids: ["t1"],
          rejected_tenant_ids: ["t2"],
        },
      },
    });
    const { status, body } = runFilter(ex);
    const b = body as { error: { code: string; message: string; details: { rejected_tenant_ids: string[] } } };
    expect(status).toBe(409);
    expect(b.error.code).toBe("TERMINATION_NOT_FULLY_APPROVED");
    expect(b.error.details.rejected_tenant_ids).toContain("t2");
  });

  it("PAYMENT_VOID_CASCADE_BLOCKED with named details key", () => {
    const ex = new ConflictException({
      error: {
        code: "PAYMENT_VOID_CASCADE_BLOCKED",
        message: "Cannot void: credit already consumed",
        details: {
          prepaid_credit_id: "pc-1",
          consumed_at: "2026-05-01T00:00:00Z",
          consumed_by_payment_id: "pay-2",
        },
      },
    });
    const { status, body } = runFilter(ex);
    const b = body as { error: { code: string; details: { prepaid_credit_id: string } } };
    expect(status).toBe(409);
    expect(b.error.code).toBe("PAYMENT_VOID_CASCADE_BLOCKED");
    expect(b.error.details.prepaid_credit_id).toBe("pc-1");
  });
});

// ---------------------------------------------------------------------------
// 2. Convention 1 — direct { code, message } (plain string body variants)
// ---------------------------------------------------------------------------
describe("Convention 1 — plain string and direct-code bodies", () => {
  it("plain string body → code derived from status", () => {
    const ex = new UnauthorizedException("Refresh token invalid or expired");
    const { status, body } = runFilter(ex);
    expect(status).toBe(401);
    expect((body as { error: { code: string; message: string } }).error.code).toBe("UNAUTHORIZED");
    expect((body as { error: { code: string; message: string } }).error.message).toBe(
      "Refresh token invalid or expired",
    );
  });

  it("403 plain string → code = FORBIDDEN", () => {
    const ex = new ForbiddenException("Insufficient role");
    const { status, body } = runFilter(ex);
    expect(status).toBe(403);
    expect((body as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("404 plain string → code = NOT_FOUND", () => {
    const ex = new NotFoundException("User not found");
    const { status, body } = runFilter(ex);
    expect(status).toBe(404);
    expect((body as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });
});

// ---------------------------------------------------------------------------
// 3. Validation pipe shape — { message: string[], error: 'Bad Request', statusCode: 400 }
// ---------------------------------------------------------------------------
describe("Validation pipe errors → VALIDATION_FAILED", () => {
  it("array message → code = VALIDATION_FAILED, details = full array", () => {
    const ex = new BadRequestException({
      message: [
        "description must be longer than or equal to 30 characters",
        "unit_id must be a UUID",
      ],
      error: "Bad Request",
      statusCode: 400,
    });
    const { status, body } = runFilter(ex);
    const b = body as { error: { code: string; message: string; details: string[] } };
    expect(status).toBe(400);
    expect(b.error.code).toBe("VALIDATION_FAILED");
    expect(b.error.message).toContain("description must be longer");
    expect(b.error.details).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// 4. Non-HttpException (raw Error) — INTERNAL_ERROR
// ---------------------------------------------------------------------------
describe("Raw Error → INTERNAL_ERROR", () => {
  it("Error instance produces 500 INTERNAL_ERROR", () => {
    const ex = new Error("Something broke");
    const { status, body } = runFilter(ex);
    expect(status).toBe(500);
    expect((body as { error: { code: string } }).error.code).toBe("INTERNAL_ERROR");
  });
});

// ---------------------------------------------------------------------------
// 5. HttpException with explicit status code derived codes
// ---------------------------------------------------------------------------
describe("Status-derived codes for all handled statuses", () => {
  const cases: [number, string][] = [
    [400, "BAD_REQUEST"],
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [404, "NOT_FOUND"],
    [405, "METHOD_NOT_ALLOWED"],
    [409, "CONFLICT"],
    [422, "UNPROCESSABLE_ENTITY"],
    [429, "TOO_MANY_REQUESTS"],
    [500, "INTERNAL_ERROR"],
    [503, "INTERNAL_ERROR"],
  ];

  test.each(cases)("HTTP %i → code %s", (httpStatus, expectedCode) => {
    const ex = new HttpException("test", httpStatus);
    const { status, body } = runFilter(ex);
    expect(status).toBe(httpStatus);
    expect((body as { error: { code: string } }).error.code).toBe(expectedCode);
  });
});

// ---------------------------------------------------------------------------
// 6. Output shape invariants — error wrapper always present
// ---------------------------------------------------------------------------
describe("Output shape invariants", () => {
  it("every error response has { error: { code, message } } at root", () => {
    const exceptions: unknown[] = [
      new ForbiddenException("plain"),
      new ConflictException({ error: { code: "X", message: "Y" } }),
      new BadRequestException({
        message: ["fail"],
        error: "Bad Request",
        statusCode: 400,
      }),
      new Error("raw"),
    ];

    for (const ex of exceptions) {
      const { body } = runFilter(ex);
      const b = body as { error?: { code?: unknown; message?: unknown } };
      expect(b).toHaveProperty("error");
      expect(typeof b.error?.code).toBe("string");
      expect(typeof b.error?.message).toBe("string");
      // No raw NestJS shape leaked
      expect(b).not.toHaveProperty("statusCode");
      expect(b).not.toHaveProperty("error.error"); // no double-wrapping
    }
  });
});
