-- Phase 5: Maintenance request lifecycle
-- Adds MaintenanceRequest, MaintenanceAlert models.
-- Enforces BL-14 via DB CHECK constraints.
-- Enforces BL-15 via BEFORE UPDATE trigger (closed requests are immutable).
-- Adds partial index on open/active statuses for fast queue queries.
-- Adds unique on (tenant_user_id, unit_id, month_key) for BL-17 idempotency.

-- ---------------------------------------------------------------------------
-- 1. Create enums
-- ---------------------------------------------------------------------------

CREATE TYPE "MaintenancePriority" AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'EMERGENCY'
);

CREATE TYPE "MaintenanceStatus" AS ENUM (
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED'
);

-- ---------------------------------------------------------------------------
-- 2. Create maintenance_requests table
-- ---------------------------------------------------------------------------

CREATE TABLE "maintenance_requests" (
  "id"                    TEXT          NOT NULL,
  "unit_id"               TEXT          NOT NULL,
  "lease_id"              TEXT,
  "raised_by_user_id"     TEXT          NOT NULL,
  "assigned_to_user_id"   TEXT,
  "title"                 VARCHAR(120)  NOT NULL,
  -- BL-14: description must be >= 30 characters.
  "description"           TEXT          NOT NULL,
  "priority"              "MaintenancePriority"  NOT NULL DEFAULT 'NORMAL',
  "status"                "MaintenanceStatus"    NOT NULL DEFAULT 'OPEN',
  -- BL-14: resolution_notes must be >= 20 chars when set.
  "resolution_notes"      TEXT,
  "assigned_at"           TIMESTAMPTZ,
  "in_progress_at"        TIMESTAMPTZ,
  "resolved_at"           TIMESTAMPTZ,
  "closed_at"             TIMESTAMPTZ,
  "closed_by_user_id"     TEXT,
  "created_at"            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT "maintenance_requests_pkey"          PRIMARY KEY ("id"),
  -- BL-14 DB-level enforcement:
  CONSTRAINT "maintenance_requests_desc_min_len"  CHECK (length("description") >= 30),
  CONSTRAINT "maintenance_requests_notes_min_len" CHECK ("resolution_notes" IS NULL OR length("resolution_notes") >= 20),

  CONSTRAINT "maintenance_requests_unit_id_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "maintenance_requests_lease_id_fkey"
    FOREIGN KEY ("lease_id") REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "maintenance_requests_raised_by_fkey"
    FOREIGN KEY ("raised_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "maintenance_requests_assigned_to_fkey"
    FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "maintenance_requests_closed_by_fkey"
    FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Index: unit_id + created_at DESC (for per-unit request history)
CREATE INDEX "maintenance_requests_unit_id_created_at_idx"
  ON "maintenance_requests" ("unit_id", "created_at" DESC);

-- Index: lease_id + created_at (for BL-17 monthly counting)
CREATE INDEX "maintenance_requests_lease_id_created_at_idx"
  ON "maintenance_requests" ("lease_id", "created_at")
  WHERE "lease_id" IS NOT NULL;

-- Partial index: open/active statuses (fast queue queries for MAINTENANCE role)
CREATE INDEX "maintenance_requests_open_statuses_idx"
  ON "maintenance_requests" ("status")
  WHERE "status" IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS');

-- Partial index: assigned_to for active assignments
CREATE INDEX "maintenance_requests_assigned_to_active_idx"
  ON "maintenance_requests" ("assigned_to_user_id")
  WHERE "status" IN ('ASSIGNED', 'IN_PROGRESS');

-- ---------------------------------------------------------------------------
-- 3. BL-15: BEFORE UPDATE trigger — closed requests are immutable.
--    Fires whenever ANY column changes on a row that already has closed_at set.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_closed_maintenance_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'closed maintenance_request is immutable (BL-15): id=%', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_maintenance_requests_closed_immutable
  BEFORE UPDATE ON "maintenance_requests"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_closed_maintenance_update();

-- ---------------------------------------------------------------------------
-- 4. Create maintenance_alerts table (BL-17)
-- ---------------------------------------------------------------------------

CREATE TABLE "maintenance_alerts" (
  "id"                    TEXT        NOT NULL,
  "tenant_user_id"        TEXT        NOT NULL,
  "unit_id"               TEXT        NOT NULL,
  -- YYYY-MM in Asia/Kolkata timezone
  "month_key"             TEXT        NOT NULL,
  "request_count"         INTEGER     NOT NULL,
  "triggered_at"          TIMESTAMPTZ NOT NULL,
  "dismissed_at"          TIMESTAMPTZ,
  "dismissed_by_user_id"  TEXT,
  "dismiss_note"          TEXT,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "maintenance_alerts_pkey" PRIMARY KEY ("id"),
  -- BL-17 idempotency: one alert per tenant/unit/month
  CONSTRAINT "maintenance_alerts_unique_triple"
    UNIQUE ("tenant_user_id", "unit_id", "month_key"),

  CONSTRAINT "maintenance_alerts_tenant_fkey"
    FOREIGN KEY ("tenant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "maintenance_alerts_unit_fkey"
    FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "maintenance_alerts_dismissed_by_fkey"
    FOREIGN KEY ("dismissed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Index: unit_id + month_key for BL-17 monthly lookups
CREATE INDEX "maintenance_alerts_unit_month_idx"
  ON "maintenance_alerts" ("unit_id", "month_key");
