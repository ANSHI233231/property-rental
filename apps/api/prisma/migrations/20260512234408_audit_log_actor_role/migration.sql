-- Add actor_role smallint to audit_log so every entry captures the actor's role
-- AT THE TIME OF THE EVENT (roles change over time; a JOIN at read time loses
-- historical context).
--
-- A BEFORE INSERT trigger looks up the role from `users` when actor_id is set.
-- This means existing audit code (47 writeLog call sites) needs no changes.

BEGIN;

ALTER TABLE audit_log ADD COLUMN actor_role SMALLINT;

CREATE OR REPLACE FUNCTION audit_log_fill_actor_role()
RETURNS trigger AS $$
BEGIN
  -- Only auto-fill when caller didn't explicitly provide one and actor_id is set.
  IF NEW.actor_role IS NULL AND NEW.actor_id IS NOT NULL THEN
    SELECT role INTO NEW.actor_role FROM users WHERE id = NEW.actor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_fill_actor_role
  BEFORE INSERT ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_fill_actor_role();

-- Backfill existing rows where actor_id is known.
UPDATE audit_log al
SET    actor_role = u.role
FROM   users u
WHERE  u.id = al.actor_id
  AND  al.actor_role IS NULL;

COMMIT;
