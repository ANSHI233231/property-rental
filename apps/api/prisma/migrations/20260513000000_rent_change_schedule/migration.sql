-- Migration: 20260513000000_rent_change_schedule
-- Creates rent_change_schedules table for Change 5: scheduled rent changes.
--
-- status codes: PENDING=0  CANCELLED=1  APPLIED=2
-- Business rule: at most one PENDING schedule per unit at a time.
-- Enforced by: partial unique index rent_change_schedules_one_pending_per_unit
--              (unit_id WHERE status = 0).

CREATE TABLE "rent_change_schedules" (
    "id"                   SERIAL PRIMARY KEY,
    "unit_id"              INTEGER NOT NULL,
    "new_amount_paise"     BIGINT NOT NULL,
    "effective_date"       DATE NOT NULL,
    -- 0=PENDING 1=CANCELLED 2=APPLIED
    "status"               SMALLINT NOT NULL DEFAULT 0,
    "created_by_user_id"   INTEGER NOT NULL,
    "created_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at"           TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_at"           TIMESTAMPTZ,
    "cancelled_at"         TIMESTAMPTZ,

    CONSTRAINT "rent_change_schedules_unit_id_fkey"
        FOREIGN KEY ("unit_id") REFERENCES "units"("id"),
    CONSTRAINT "rent_change_schedules_created_by_user_id_fkey"
        FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
);

-- Regular composite index for fast lookups by unit + status
CREATE INDEX "idx_rent_change_schedules_unit_id_status"
    ON "rent_change_schedules" ("unit_id", "status");

-- Partial unique index: only one PENDING (status=0) per unit at a time.
-- This is the DB-level enforcement of the "one pending per unit" rule.
CREATE UNIQUE INDEX "rent_change_schedules_one_pending_per_unit"
    ON "rent_change_schedules" ("unit_id")
    WHERE "status" = 0;

-- updated_at trigger (matches pattern used in other tables)
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rent_change_schedules_updated_at
  BEFORE UPDATE ON "rent_change_schedules"
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
