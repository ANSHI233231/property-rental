-- Phase 2 — DB-level guards migration
--
-- 1. BL-19: Replace Prisma's standard unique on properties(active_pm_id) with a
--    PARTIAL unique index WHERE active_pm_id IS NOT NULL.
--    This allows multiple properties to have active_pm_id = NULL (unassigned),
--    while still guaranteeing each PROPERTY_MANAGER is assigned to at most one property.
--
-- 2. BL-05: Add a BEFORE UPDATE trigger on units that raises an exception if
--    old.is_retired = TRUE and new.is_retired = FALSE.
--    Retirement is one-way — no code path should be able to un-retire a unit.

-- ─────────────────────────────────────────────────────────────────────────────
-- BL-19: Partial unique index on properties(active_pm_id)
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the full unique constraint Prisma created (allows NULL duplicates anyway
-- in PG, but we want to be explicit about intent and replace with partial index).
DROP INDEX IF EXISTS "properties_active_pm_id_key";

-- Create the partial unique index. NULL values are excluded, so multiple
-- unassigned properties are fine. A PM can only appear once when non-null.
CREATE UNIQUE INDEX "properties_active_pm_id_partial_unique"
  ON "properties"("active_pm_id")
  WHERE "active_pm_id" IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- BL-05: Prevent un-retiring a unit via DB trigger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prevent_unit_unretire()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If the row was already retired and the update tries to set is_retired = false,
  -- raise an exception to block the update at the DB level regardless of who calls it.
  IF OLD.is_retired = TRUE AND NEW.is_retired = FALSE THEN
    RAISE EXCEPTION 'UNIT_ALREADY_RETIRED: Unit % is permanently retired and cannot be reactivated. Create a new unit record instead.', OLD.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unit_unretire ON "units";

CREATE TRIGGER trg_prevent_unit_unretire
  BEFORE UPDATE ON "units"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_unit_unretire();
