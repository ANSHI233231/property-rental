-- F1: Add first_name + last_name (split name input) and specialization
-- (MAINTENANCE role only). `name` stays for back-compat — auto-populated by
-- the service from first_name + last_name on every write. Existing rows get
-- backfilled by splitting `name` on the first space (best-effort).
--
-- specialization is nullable + enforced by application logic
-- (only set when role = 2 / MAINTENANCE; service rejects otherwise).

BEGIN;

ALTER TABLE users ADD COLUMN first_name    TEXT;
ALTER TABLE users ADD COLUMN last_name     TEXT;
ALTER TABLE users ADD COLUMN specialization TEXT;

-- Backfill: split `name` on first space. Single-word names → first_name only.
UPDATE users
SET    first_name = COALESCE(NULLIF(split_part(name, ' ', 1), ''), name),
       last_name  = CASE
                      WHEN position(' ' IN name) > 0
                      THEN substring(name FROM position(' ' IN name) + 1)
                      ELSE NULL
                    END
WHERE  first_name IS NULL;

COMMIT;
