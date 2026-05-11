-- Phase 7: Security hardening migration
--
-- 1. audit_log.actor_id → nullable (supports auth.login.failure where no user is identified)
--    Foreign key updated to ON DELETE SET NULL.
--
-- 2. payments.idempotency_key → nullable text column with index
--    Unique partial index (WHERE idempotency_key IS NOT NULL) prevents duplicate
--    payments on network retry without violating uniqueness for non-keyed payments.
--
-- 3. audit_log action+created_at index for efficient action prefix filtering in GET /audit-log.

-- DropForeignKey (need to drop before altering column)
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_actor_id_fkey";

-- AlterTable: make actor_id nullable
ALTER TABLE "audit_log" ALTER COLUMN "actor_id" DROP NOT NULL;

-- AddForeignKey with SET NULL on delete
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: add idempotency_key to payments
ALTER TABLE "payments" ADD COLUMN "idempotency_key" TEXT;

-- CreateIndex: standard index for lookup by key
CREATE INDEX "payments_idempotency_key_idx" ON "payments"("idempotency_key");

-- CreateIndex: unique partial index — only enforces uniqueness when key is present
CREATE UNIQUE INDEX "payments_idempotency_key_unique"
  ON "payments"("idempotency_key")
  WHERE "idempotency_key" IS NOT NULL;

-- CreateIndex: action+created_at for efficient prefix filtering in GET /audit-log
CREATE INDEX "audit_log_action_created_at_idx" ON "audit_log"("action", "created_at");
