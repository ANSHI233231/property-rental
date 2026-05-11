-- Phase 3 — Tenants, Leases, co-tenant termination flow, deposit refunds
--
-- Business rules enforced at DB level in this migration:
--   BL-01: Partial unique index on leases(unit_id) WHERE status = 'ACTIVE'
--   BL-02: BEFORE UPDATE trigger blocking monthly_rent_paise / security_deposit_paise changes
--   Partial unique index on lease_terminations for open terminations
--   Unique constraint on deposit_refunds(lease_id) — one refund per lease max

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE "LeaseStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RENEWED', 'TERMINATED');
CREATE TYPE "TerminationApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- ─────────────────────────────────────────────────────────────────────────────
-- tenants
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "dob" DATE,
    "id_proof_type" TEXT,
    "id_proof_number" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_user_id_key" ON "tenants"("user_id");

ALTER TABLE "tenants"
  ADD CONSTRAINT "tenants_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- leases
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "leases" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "monthly_rent_paise" BIGINT NOT NULL,
    "security_deposit_paise" BIGINT NOT NULL,
    "late_fee_per_day_paise" BIGINT NOT NULL DEFAULT 0,
    "status" "LeaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "signed_by_pm_id" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "leases_unit_id_status_idx" ON "leases"("unit_id", "status");
CREATE INDEX "leases_end_date_idx" ON "leases"("end_date");

ALTER TABLE "leases"
  ADD CONSTRAINT "leases_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leases"
  ADD CONSTRAINT "leases_signed_by_pm_id_fkey"
  FOREIGN KEY ("signed_by_pm_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- BL-01: Partial unique index — at most one ACTIVE lease per unit.
-- This is the database-level guarantee. The service layer also checks,
-- but this index ensures even direct DB writes (bypassing the service) fail.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "leases_unit_active_unique"
  ON "leases"("unit_id")
  WHERE status = 'ACTIVE';

-- ─────────────────────────────────────────────────────────────────────────────
-- BL-02: BEFORE UPDATE trigger blocking rent/deposit mutations on leases.
-- monthly_rent_paise and security_deposit_paise are immutable after creation.
-- Attempting to change them via any UPDATE raises an exception.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prevent_lease_rent_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.monthly_rent_paise <> NEW.monthly_rent_paise THEN
    RAISE EXCEPTION 'BL_02_RENT_IMMUTABLE: monthly_rent_paise cannot be changed on an existing lease (lease_id: %). Create a new lease via the renew endpoint instead.', OLD.id
      USING ERRCODE = 'P0001';
  END IF;

  IF OLD.security_deposit_paise <> NEW.security_deposit_paise THEN
    RAISE EXCEPTION 'BL_02_DEPOSIT_IMMUTABLE: security_deposit_paise cannot be changed on an existing lease (lease_id: %). Create a new lease via the renew endpoint instead.', OLD.id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_lease_rent_change ON "leases";

CREATE TRIGGER trg_prevent_lease_rent_change
  BEFORE UPDATE ON "leases"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_lease_rent_change();

-- ─────────────────────────────────────────────────────────────────────────────
-- lease_tenants
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "lease_tenants" (
    "id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "lease_tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lease_tenants_lease_id_tenant_id_key"
  ON "lease_tenants"("lease_id", "tenant_id");

ALTER TABLE "lease_tenants"
  ADD CONSTRAINT "lease_tenants_lease_id_fkey"
  FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lease_tenants"
  ADD CONSTRAINT "lease_tenants_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- lease_terminations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "lease_terminations" (
    "id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "requested_by_tenant_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,
    "withdrawn_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "effective_date" DATE NOT NULL,

    CONSTRAINT "lease_terminations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lease_terminations_lease_id_idx" ON "lease_terminations"("lease_id");

ALTER TABLE "lease_terminations"
  ADD CONSTRAINT "lease_terminations_lease_id_fkey"
  FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lease_terminations"
  ADD CONSTRAINT "lease_terminations_requested_by_tenant_id_fkey"
  FOREIGN KEY ("requested_by_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Partial unique index for open terminations.
-- Only one open (finalized_at IS NULL AND withdrawn_at IS NULL) termination
-- is allowed per lease at any given time.
-- This enforces the business rule at the DB level (BL-08 supplement).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX "lease_terminations_lease_open_unique"
  ON "lease_terminations"("lease_id")
  WHERE finalized_at IS NULL AND withdrawn_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- lease_termination_approvals
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "lease_termination_approvals" (
    "id" TEXT NOT NULL,
    "termination_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "status" "TerminationApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "responded_at" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "lease_termination_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lease_termination_approvals_termination_id_idx"
  ON "lease_termination_approvals"("termination_id");

CREATE UNIQUE INDEX "lease_termination_approvals_termination_id_tenant_id_key"
  ON "lease_termination_approvals"("termination_id", "tenant_id");

ALTER TABLE "lease_termination_approvals"
  ADD CONSTRAINT "lease_termination_approvals_termination_id_fkey"
  FOREIGN KEY ("termination_id") REFERENCES "lease_terminations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lease_termination_approvals"
  ADD CONSTRAINT "lease_termination_approvals_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- deposit_refunds
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE "deposit_refunds" (
    "id" TEXT NOT NULL,
    "lease_id" TEXT NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "deductions_paise" BIGINT NOT NULL DEFAULT 0,
    "deduction_reason" TEXT,
    "paid_to_tenant_id" TEXT NOT NULL,
    "processed_by_pm_id" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_refunds_pkey" PRIMARY KEY ("id")
);

-- One refund per lease maximum (idempotency constraint).
CREATE UNIQUE INDEX "deposit_refunds_lease_id_key" ON "deposit_refunds"("lease_id");

ALTER TABLE "deposit_refunds"
  ADD CONSTRAINT "deposit_refunds_lease_id_fkey"
  FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "deposit_refunds"
  ADD CONSTRAINT "deposit_refunds_paid_to_tenant_id_fkey"
  FOREIGN KEY ("paid_to_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "deposit_refunds"
  ADD CONSTRAINT "deposit_refunds_processed_by_pm_id_fkey"
  FOREIGN KEY ("processed_by_pm_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
