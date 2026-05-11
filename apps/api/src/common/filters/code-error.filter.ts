import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";

/**
 * Global error serializer. Produces the contract the FE error-mapper
 * (apps/web/src/lib/api/errors.ts) consumes:
 *
 *   { error: { code: string, message: string } }
 *
 * `code` is a stable machine-readable identifier (e.g. BL_10_TENANT_CANNOT_RECORD_PAYMENT,
 * UNIT_HAS_ACTIVE_LEASE, VALIDATION_FAILED). When a thrown exception carries an
 * explicit `code` in its response body, we preserve it. Otherwise we derive one
 * from the HTTP status (e.g. 404 -> NOT_FOUND, 403 -> FORBIDDEN, 400 -> BAD_REQUEST).
 *
 * Two throw conventions exist in the codebase:
 *  1. Direct:  throw new ForbiddenException({ code: 'X', message: 'Y' })
 *  2. Wrapped: throw new ForbiddenException({ error: { code: 'X', message: 'Y' } })
 *
 * Both are handled. Convention (2) is the dominant pattern established in Phase 1–4.
 *
 * Validation errors (class-validator) — array of constraint messages — collapse
 * into `code: 'VALIDATION_FAILED'` with `message` being a semicolon-joined summary,
 * and `details` carrying the full array.
 */
@Catch()
export class CodeErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(CodeErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_ERROR";
    let message = "An unexpected error occurred.";
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === "string") {
        // throw new ForbiddenException("plain string")
        message = body;
        code = this.codeFromStatus(status);
      } else if (body && typeof body === "object") {
        const b = body as Record<string, unknown>;

        // Convention 2 (dominant): { error: { code, message, details?, ...extras } }
        if (b.error && typeof b.error === "object") {
          const inner = b.error as Record<string, unknown>;
          code =
            typeof inner.code === "string"
              ? inner.code
              : this.codeFromStatus(status);
          message =
            typeof inner.message === "string" ? inner.message : message;
          // If a named `details` key exists, hoist it directly; otherwise collect
          // remaining keys (e.g. rejected_tenant_ids on termination errors).
          if (inner.details !== undefined) {
            details = inner.details;
          } else {
            const { code: _c, message: _m, ...rest } = inner;
            void _c;
            void _m;
            if (Object.keys(rest).length > 0) {
              details = rest;
            }
          }
        } else {
          // Convention 1 (validation pipe + direct): { code?, message, error?, statusCode? }
          if (typeof b.code === "string") {
            code = b.code;
          } else {
            code = this.codeFromStatus(status);
          }

          // Validation pipe shape: { message: string[], error: 'Bad Request', statusCode: 400 }
          if (Array.isArray(b.message)) {
            details = b.message;
            message = (b.message as string[]).slice(0, 3).join("; ");
            if (code === this.codeFromStatus(status)) code = "VALIDATION_FAILED";
          } else if (typeof b.message === "string") {
            message = b.message;
          }
        }
      }
    } else if (exception instanceof Error) {
      // Handle Express body-parser PayloadTooLargeError (not an HttpException).
      // These have a `type` property of 'entity.too.large'.
      const errWithType = exception as Error & { type?: string; status?: number };
      if (errWithType.type === "entity.too.large" || errWithType.status === 413) {
        status = 413;
        code = "PAYLOAD_TOO_LARGE";
        message = "Request body exceeds the 100 KB limit.";
      } else {
        this.logger.error(exception.message, exception.stack);
        message =
          process.env.NODE_ENV === "production"
            ? "An unexpected error occurred."
            : exception.message;
      }
    }

    res
      .status(status)
      .json({ error: { code, message, ...(details ? { details } : {}) } });
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return "BAD_REQUEST";
      case 401:
        return "UNAUTHORIZED";
      case 403:
        return "FORBIDDEN";
      case 404:
        return "NOT_FOUND";
      case 405:
        return "METHOD_NOT_ALLOWED";
      case 409:
        return "CONFLICT";
      case 422:
        return "UNPROCESSABLE_ENTITY";
      case 429:
        return "TOO_MANY_REQUESTS";
      default:
        return status >= 500 ? "INTERNAL_ERROR" : "ERROR";
    }
  }
}
