import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

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
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
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
    await tx.auditLog.create({
      data: {
        actor_id: entry.actorId,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        before: (entry.before as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        after: (entry.after as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }
}
