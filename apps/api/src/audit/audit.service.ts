import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * AuditService — centralized audit log writer.
 *
 * Every Phase-2 mutation calls writeLog() within the same Prisma $transaction
 * as the mutation itself. This guarantees audit atomicity: if the mutation
 * rolls back, the audit entry also rolls back (and vice versa).
 *
 * The audit_log table is append-only — no UPDATE or DELETE ever issued here.
 * BL-22: timestamp stored UTC (Prisma default); rendered IST at API boundary or FE.
 */

export interface AuditEntry {
  /**
   * null for unauthenticated events (e.g. auth.login.failure).
   * Accepts number (new int ID) or string (legacy CUID) — normalised to number
   * at the DB boundary. entity_id always stored as text (polymorphic column).
   */
  actorId: number | string | null;
  action: string;
  entityType: string;
  /** Always stored as text — pass number or string; stringified internally. */
  entityId: number | string;
  before?: object | null;
  after?: object | null;
}

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

@Injectable()
export class AuditService {
  /**
   * Write an audit log entry using the provided Prisma transaction client.
   * Always call this inside a $transaction — never outside.
   *
   * @param tx  - Prisma transaction client (from $transaction callback).
   * @param entry - Audit entry data.
   */
  async writeLog(tx: TransactionClient, entry: AuditEntry): Promise<void> {
    const actorId = entry.actorId === null
      ? null
      : typeof entry.actorId === "number"
        ? entry.actorId
        : Number(entry.actorId) || null;
    await tx.auditLog.create({
      data: {
        actor_id: actorId,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: String(entry.entityId),
        before: (entry.before as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        after: (entry.after as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  /**
   * Write an audit log entry WITHOUT a transaction — for fire-and-forget events
   * (auth failures, etc.) where there is no mutation transaction to join.
   * Uses the root PrismaService directly.
   *
   * NOTE: Only use this for non-transactional audit writes. For mutation audits,
   * always use writeLog() inside a $transaction for atomicity.
   */
  async writeLogDirect(prisma: PrismaService, entry: AuditEntry): Promise<void> {
    const actorId = entry.actorId === null
      ? null
      : typeof entry.actorId === "number"
        ? entry.actorId
        : Number(entry.actorId) || null;
    await prisma.auditLog.create({
      data: {
        actor_id: actorId,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: String(entry.entityId),
        before: (entry.before as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        after: (entry.after as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }
}
