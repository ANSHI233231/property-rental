import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Sensitive field paths that must be redacted from audit log `before`/`after`
 * JSONB snapshots on the read boundary. The writes should never include these,
 * but this is a defensive second layer per Phase 7 spec §7.
 */
const REDACTED_KEYS = new Set([
  "password",
  "password_hash",
  "token",
  "token_hash",
  "refreshToken",
  "accessToken",
  "secret",
  "cookie",
  "id_proof_number",
  "dob",
]);

const REDACT_SENTINEL = "[REDACTED]";

/** Recursively redact known-sensitive keys from a JSONB snapshot. */
function redactSnapshot(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;

  if (Array.isArray(value)) {
    return value.map(redactSnapshot);
  }

  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (REDACTED_KEYS.has(key)) {
      result[key] = REDACT_SENTINEL;
    } else {
      result[key] = redactSnapshot(obj[key]);
    }
  }
  return result;
}

export interface AuditLogFilter {
  actorId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /audit-log — Admin-only paginated audit log with filters.
   *
   * Supports:
   * - actorId (exact match)
   * - action (prefix match via LIKE 'action%')
   * - entityType (exact match)
   * - from / to date range (ISO 8601)
   * - cursor-based pagination (cursor = last seen `id`)
   * - limit (default 50, max 100)
   *
   * Returns `before`/`after` fields with sensitive keys redacted.
   */
  async findMany(filters: AuditLogFilter) {
    const take = Math.min(filters.limit ?? 50, 100);

    // Build Prisma where clause
    const where: Record<string, unknown> = {};

    if (filters.actorId) {
      where["actor_id"] = filters.actorId;
    }

    if (filters.entityType) {
      where["entity_type"] = filters.entityType;
    }

    // Prefix match on action: "auth.login" matches "auth.login.success"
    if (filters.action) {
      where["action"] = { startsWith: filters.action };
    }

    // Date range on created_at
    if (filters.from || filters.to) {
      const dateFilter: Record<string, Date> = {};
      if (filters.from) dateFilter["gte"] = new Date(filters.from);
      if (filters.to) dateFilter["lte"] = new Date(filters.to);
      where["created_at"] = dateFilter;
    }

    const items = await this.prisma.auditLog.findMany({
      where: where as import("@prisma/client").Prisma.AuditLogWhereInput,
      orderBy: { created_at: "desc" },
      take: take + 1,
      ...(filters.cursor
        ? { cursor: { id: filters.cursor }, skip: 1 }
        : {}),
    });

    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    // Redact sensitive fields from snapshots at the read boundary (defensive).
    const redacted = data.map((row) => ({
      ...row,
      before: redactSnapshot(row.before),
      after: redactSnapshot(row.after),
    }));

    return {
      data: redacted,
      meta: { cursor: nextCursor ?? null, has_more: hasMore },
    };
  }
}
