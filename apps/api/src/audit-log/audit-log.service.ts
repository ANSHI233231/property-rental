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
  cursor?: number;
  limit?: number;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /audit-log — Admin-only paginated audit log with filters.
   *
   * Supports:
   * - actorId (actor user id as number string or number)
   * - action (prefix match via startsWith)
   * - entityType (exact match)
   * - from / to date range (ISO 8601)
   * - cursor-based pagination (cursor = last seen `id` as number)
   * - limit (default 50, max 100)
   *
   * Returns `before`/`after` fields with sensitive keys redacted.
   */
  async findMany(filters: AuditLogFilter) {
    const useOffset = filters.page !== undefined;
    const ps = filters.pageSize !== undefined ? Math.min(Math.max(filters.pageSize, 1), 100) : undefined;
    const take = useOffset ? (ps ?? 10) : Math.min(filters.limit ?? 50, 100);
    const currentPage = filters.page ?? 1;

    // Build Prisma where clause
    const where: Record<string, unknown> = {};

    if (filters.actorId !== undefined) {
      // actor_id is Int? in DB; accept numeric string or number
      const actorIdNum = typeof filters.actorId === "string"
        ? parseInt(filters.actorId, 10)
        : filters.actorId;
      if (!isNaN(Number(actorIdNum))) {
        where["actor_id"] = Number(actorIdNum);
      }
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

    // FE table needs actor name + role. Join the actor relation so each
    // row carries actorName/actorRole without a separate user lookup.
    const auditSelect = {
      id: true,
      actor_id: true,
      actor_role: true,
      action: true,
      entity_type: true,
      entity_id: true,
      before: true,
      after: true,
      created_at: true,
      actor: { select: { id: true, name: true, role: true } },
    } as const;

    // Explicit-branch findMany — avoids TS conditional-spread inference issue.
    const findManyPromise = useOffset
      ? this.prisma.auditLog.findMany({
          where: where as import("@prisma/client").Prisma.AuditLogWhereInput,
          select: auditSelect,
          orderBy: { created_at: "desc" },
          skip: (currentPage - 1) * take,
          take,
        })
      : this.prisma.auditLog.findMany({
          where: where as import("@prisma/client").Prisma.AuditLogWhereInput,
          select: auditSelect,
          orderBy: { created_at: "desc" },
          take: take + 1,
          ...(filters.cursor
            ? { cursor: { id: filters.cursor }, skip: 1 }
            : {}),
        });

    const [rawItems, total] = await Promise.all([
      findManyPromise,
      this.prisma.auditLog.count({
        where: where as import("@prisma/client").Prisma.AuditLogWhereInput,
      }),
    ]);

    let hasMore: boolean;
    let data: typeof rawItems;
    let nextCursor: number | undefined;

    if (useOffset) {
      data = rawItems;
      hasMore = currentPage * take < total;
      nextCursor = undefined;
    } else {
      hasMore = rawItems.length > take;
      data = hasMore ? rawItems.slice(0, take) : rawItems;
      nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
    }

    const totalPages = total === 0 ? 0 : Math.ceil(total / take);

    // Redact sensitive fields + remap to FE-friendly camelCase contract.
    const ROLE_NAME: Record<number, string> = {
      0: "ADMIN",
      1: "PROPERTY_MANAGER",
      2: "MAINTENANCE",
      3: "TENANT",
    };
    const reshaped = data.map((row) => ({
      id: String(row.id),
      createdAt: row.created_at.toISOString(),
      actorId: row.actor_id != null ? String(row.actor_id) : null,
      actorName: row.actor?.name ?? null,
      actorRole:
        row.actor_role != null
          ? ROLE_NAME[row.actor_role] ?? String(row.actor_role)
          : row.actor?.role != null
            ? ROLE_NAME[row.actor.role] ?? String(row.actor.role)
            : null,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      before: redactSnapshot(row.before),
      after: redactSnapshot(row.after),
    }));

    return {
      data: reshaped,
      meta: {
        cursor: nextCursor ?? null,
        next_cursor: nextCursor ?? null,
        has_more: hasMore,
        total,
        page: currentPage,
        page_size: take,
        total_pages: totalPages,
      },
    };
  }
}
