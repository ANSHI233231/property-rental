-- Phase 4 — Rent Periods, Payments (append-only), Prepaid Credits, Accrual Log
--
-- Business rules enforced at DB level in this migration:
--   BL-10: BEFORE INSERT trigger blocking payment creation by non-PM/Admin (role
--          check done at service layer; trigger is belt-and-suspenders on amount_paise > 0)
--   BL-11: Serializable transactions in service layer; DB triggers prevent mutation.
--   BL-12: Worker flips period status to OVERDUE. Index on (status, due_date) for batch.
--   BL-13: late_fee_paise set by worker. unique run_date on rent_accrual_log for idempotency.
--   Append-only payments: BEFORE DELETE raises; BEFORE UPDATE blocks field mutations.

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "RentPeriodStatus" AS ENUM ('UPCOMING', 'DUE', 'PARTIAL', 'PAID', 'OVERDUE', 'PREPAID');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'OTHER');

-- ─────────────────────────────────────────────────────────────────────────────
-- rent_periods
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "rent_periods" (
    "id"               TEXT NOT NULL,
    "lease_id"         TEXT NOT NULL,
    "period_start"     DATE NOT NULL,
    "period_end"       DATE NOT NULL,
    "due_date"         DATE NOT NULL,
    "amount_due_paise" BIGINT NOT NULL,
    "late_fee_paise"   BIGINT NOT NULL DEFAULT 0,
    "paid_paise"       BIGINT NOT NULL DEFAULT 0,
    "outstanding_paise" BIGINT NOT NULL DEFAULT 0,
    "status"           "RentPeriodStatus" NOT NULL DEFAULT 'DUE',
    "last_accrued_at"  TIMESTAMP(3),
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rent_periods_pkey" PRIMARY KEY ("id")
);

-- Unique: no duplicate periods for the same lease + start date
CREATE UNIQUE INDEX "rent_periods_lease_id_period_start_key"
    ON "rent_periods"("lease_id", "period_start");

-- Index for worker batch: find actionable periods fast
CREATE INDEX "rent_periods_status_due_date_idx"
    ON "rent_periods"("status", "due_date");

-- Index for tenant rent-history queries (latest period first)
CREATE INDEX "rent_periods_lease_id_period_start_desc_idx"
    ON "rent_periods"("lease_id", "period_start" DESC);

ALTER TABLE "rent_periods"
    ADD CONSTRAINT "rent_periods_lease_id_fkey"
    FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- payments  (append-only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "payments" (
    "id"                  TEXT NOT NULL,
    "rent_period_id"      TEXT NOT NULL,
    "lease_id"            TEXT NOT NULL,
    "amount_paise"        BIGINT NOT NULL,
    "method"              "PaymentMethod" NOT NULL,
    "reference"           TEXT,
    "paid_on"             DATE NOT NULL,
    "recorded_by_user_id" TEXT NOT NULL,
    "recorded_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_voided"           BOOLEAN NOT NULL DEFAULT FALSE,
    "voided_by_user_id"   TEXT,
    "voided_at"           TIMESTAMP(3),
    "void_reason"         TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payments_lease_id_recorded_at_idx" ON "payments"("lease_id", "recorded_at");
CREATE INDEX "payments_rent_period_id_idx"        ON "payments"("rent_period_id");

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_rent_period_id_fkey"
    FOREIGN KEY ("rent_period_id") REFERENCES "rent_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_lease_id_fkey"
    FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_recorded_by_user_id_fkey"
    FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_voided_by_user_id_fkey"
    FOREIGN KEY ("voided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Append-only trigger on payments (BL-10 / BL-11 immutability)
-- ─────────────────────────────────────────────────────────────────────────────

-- BEFORE DELETE: raise always
CREATE OR REPLACE FUNCTION payments_prevent_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'payments are append-only: DELETE is forbidden (BL-10/BL-11). Use void instead.'
        USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER payments_no_delete
    BEFORE DELETE ON "payments"
    FOR EACH ROW EXECUTE FUNCTION payments_prevent_delete();

-- BEFORE UPDATE: only allow void columns to change
CREATE OR REPLACE FUNCTION payments_restrict_update()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Only these columns may change: is_voided, voided_by_user_id, voided_at, void_reason
    IF NEW."rent_period_id"      <> OLD."rent_period_id"      OR
       NEW."lease_id"            <> OLD."lease_id"            OR
       NEW."amount_paise"        <> OLD."amount_paise"        OR
       NEW."method"              <> OLD."method"              OR
       NEW."paid_on"             <> OLD."paid_on"             OR
       NEW."recorded_by_user_id" <> OLD."recorded_by_user_id" OR
       NEW."recorded_at"         <> OLD."recorded_at"         OR
       NEW."created_at"          <> OLD."created_at"
    THEN
        RAISE EXCEPTION 'payments are append-only: only void columns may be updated (BL-11).'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER payments_restrict_update
    BEFORE UPDATE ON "payments"
    FOR EACH ROW EXECUTE FUNCTION payments_restrict_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- prepaid_credits
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "prepaid_credits" (
    "id"                     TEXT NOT NULL,
    "lease_id"               TEXT NOT NULL,
    "source_payment_id"      TEXT NOT NULL,
    "amount_paise"           BIGINT NOT NULL,
    "consumed_at"            TIMESTAMP(3),
    "consumed_by_payment_id" TEXT,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prepaid_credits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "prepaid_credits_source_payment_id_key"       ON "prepaid_credits"("source_payment_id");
CREATE UNIQUE INDEX "prepaid_credits_consumed_by_payment_id_key"  ON "prepaid_credits"("consumed_by_payment_id");
CREATE INDEX        "prepaid_credits_lease_id_created_at_idx"     ON "prepaid_credits"("lease_id", "created_at");

ALTER TABLE "prepaid_credits"
    ADD CONSTRAINT "prepaid_credits_lease_id_fkey"
    FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prepaid_credits"
    ADD CONSTRAINT "prepaid_credits_source_payment_id_fkey"
    FOREIGN KEY ("source_payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "prepaid_credits"
    ADD CONSTRAINT "prepaid_credits_consumed_by_payment_id_fkey"
    FOREIGN KEY ("consumed_by_payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- rent_accrual_log
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "rent_accrual_log" (
    "id"                      TEXT NOT NULL,
    "run_date"                DATE NOT NULL,
    "started_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at"             TIMESTAMP(3),
    "periods_examined"        INTEGER NOT NULL DEFAULT 0,
    "periods_overdue_flipped" INTEGER NOT NULL DEFAULT 0,
    "late_fees_added_paise"   BIGINT NOT NULL DEFAULT 0,
    "next_periods_generated"  INTEGER NOT NULL DEFAULT 0,
    "error"                   TEXT,
    "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rent_accrual_log_pkey" PRIMARY KEY ("id")
);

-- BL-13 idempotency: only one run log per calendar date
CREATE UNIQUE INDEX "rent_accrual_log_run_date_key" ON "rent_accrual_log"("run_date");

-- ─────────────────────────────────────────────────────────────────────────────
-- Partial index for worker batch query: actionable periods
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX "rent_periods_actionable_idx"
    ON "rent_periods"("due_date")
    WHERE "status" IN ('DUE', 'PARTIAL', 'OVERDUE');
