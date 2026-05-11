import {
  Controller,
  Get,
  Query,
  UseGuards,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { AuditLogService } from "./audit-log.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

/**
 * AuditLogController — Phase 7.
 *
 * GET /audit-log — Admin-only endpoint to query the audit trail.
 *
 * BL compliance: audit log is append-only; this controller exposes read-only access.
 * Only ADMIN role may access. Response sanitizes before/after JSON to redact any
 * accidentally-included sensitive fields (password_hash, token, etc.).
 */
// GET /audit-log is ADMIN-only and read-only — exempt from rate limiting.
// The JWT auth guard is the primary protection.
@SkipThrottle()
@Controller("audit-log")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * GET /audit-log
   *
   * Query params:
   *   actorId     - filter by actor user ID (exact)
   *   action      - filter by action prefix (e.g., "auth.login" matches "auth.login.success")
   *   entityType  - filter by entity type (exact)
   *   from        - ISO 8601 date start (inclusive)
   *   to          - ISO 8601 date end (inclusive)
   *   cursor      - opaque cursor from previous response meta.cursor
   *   limit       - page size (default 50, max 100)
   */
  @Get()
  @SkipThrottle()
  async findMany(
    @Query("actorId") actorId?: string,
    @Query("action") action?: string,
    @Query("entityType") entityType?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limitStr?: string,
  ) {
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 50, 100) : 50;
    return this.auditLogService.findMany({
      actorId,
      action,
      entityType,
      from,
      to,
      cursor,
      limit,
    });
  }
}
