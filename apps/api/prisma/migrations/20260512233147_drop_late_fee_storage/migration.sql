-- Drop late_fee_paise storage from rent_periods. Late fee is now computed on
-- read from amount_due_paise + daysOverdue (BL-13 formula in @gharsetu/shared).
--
-- `last_accrued_at` was BL-13 idempotency for the stored-value accrual cron;
-- no longer needed once the value is computed every time.
--
-- `outstanding_paise` semantics change: previously stored amount_due + late_fee - paid;
-- now stores amount_due - paid (no fee). The serialized response adds the computed
-- late fee back on read, so the API contract on the wire is unchanged.

BEGIN;

-- Rewrite outstanding_paise to the new semantics (drop the previously-included late_fee_paise).
UPDATE rent_periods
SET    outstanding_paise = GREATEST(amount_due_paise - paid_paise, 0);

ALTER TABLE rent_periods DROP COLUMN late_fee_paise;
ALTER TABLE rent_periods DROP COLUMN last_accrued_at;

COMMIT;
