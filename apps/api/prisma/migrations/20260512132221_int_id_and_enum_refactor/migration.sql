-- ============================================================================
-- GharSetu schema refactor — v2 (DRAFT, NOT YET APPLIED)
--   text CUID IDs    → BIGSERIAL int IDs
--   string enum cols → smallint codes
--
-- v2 changes from v1 (review notes):
--   • Disable 5 triggers (BL-02/09/10/11/15 immutability) for the migration.
--   • Drop+recreate every UNIQUE / partial / multi-col index lost when old
--     text columns are dropped. Partial indexes that reference enum strings
--     get rewritten to reference the new smallint codes.
--   • Fix ON DELETE actions on 3 FKs to match the live schema.
--   • One BIG transaction — any failure rolls back the entire migration.
--
-- BEFORE RUNNING:
--   1.  Fresh dump (REQUIRED — only safety net besides the transaction):
--         pg_dump -h 127.0.0.1 -p 5432 -U gharsetu -d gharsetu \
--           --no-owner --no-privileges --clean --if-exists \
--           > backups/pre-int-id-refactor-$(date +%Y%m%d-%H%M%S).sql
--   2.  Stop the API server (Nest start:dev → bkk7po1t5).
--   3.  Acknowledge: every JWT becomes invalid; users must re-login.
--   4.  audit_log.entity_id keeps text type; legacy rows reference CUIDs,
--       new rows reference int-as-text. Mixed-format history is accepted.
--
-- Enum code conventions (these become the app contract forever):
--   UnitState:                 AVAILABLE=0 LISTED=1 OCCUPIED=2 MAINTENANCE=3
--   LeaseStatus:               ACTIVE=0 EXPIRED=1 RENEWED=2 TERMINATED=3
--   RentPeriodStatus:          UPCOMING=0 DUE=1 PARTIAL=2 PAID=3 OVERDUE=4 PREPAID=5
--   MaintenanceStatus:         OPEN=0 ASSIGNED=1 IN_PROGRESS=2 RESOLVED=3 CLOSED=4
--   MaintenancePriority:       LOW=0 NORMAL=1 HIGH=2 EMERGENCY=3
--   PaymentMethod:             CASH=0 BANK_TRANSFER=1 UPI=2 CHEQUE=3 OTHER=4
--   TerminationApprovalStatus: PENDING=0 APPROVED=1 REJECTED=2
--   Role:                      ADMIN=0 PROPERTY_MANAGER=1 MAINTENANCE=2 TENANT=3
-- ============================================================================

BEGIN;

-- ============================================================================
-- PHASE 0 — Disable BL-enforcing triggers for the duration of the migration
-- ----------------------------------------------------------------------------
-- These triggers block UPDATE/DELETE on financial rows by design. Migration
-- needs to UPDATE rows to populate new_* columns; without DISABLE the triggers
-- would either fire (and ROLLBACK us) or no-op silently.
-- Re-enabled in PHASE I.
-- ============================================================================
ALTER TABLE leases               DISABLE TRIGGER trg_prevent_lease_rent_change;
ALTER TABLE maintenance_requests DISABLE TRIGGER trg_maintenance_requests_closed_immutable;
ALTER TABLE payments             DISABLE TRIGGER payments_no_delete;
ALTER TABLE payments             DISABLE TRIGGER payments_restrict_update;
ALTER TABLE units                DISABLE TRIGGER trg_prevent_unit_unretire;


-- ============================================================================
-- PHASE A — Enum columns → smallint codes
-- ----------------------------------------------------------------------------
-- Pattern per (table, column):
--   1. ADD COLUMN <c>_int SMALLINT
--   2. UPDATE ... SET <c>_int = CASE <c> WHEN '<label>' THEN <code> END
--   3. SET NOT NULL on <c>_int
--   4. DROP COLUMN <c>     ← also drops any partial index whose WHERE
--                            clause references the enum type
--   5. RENAME COLUMN <c>_int → <c>
--   6. SET DEFAULT
--   7. DROP TYPE "<EnumName>"
--
-- Indexes auto-dropped here (recreated in PHASE H):
--   leases_unit_active_unique         (partial on status='ACTIVE')
--   leases_unit_id_status_idx         (on (unit_id, status))
--   rent_periods_actionable_idx       (partial on status IN (...))
--   rent_periods_status_due_date_idx  (on (status, due_date))
--   maintenance_requests_open_statuses_idx          (partial on status)
--   maintenance_requests_assigned_to_active_idx     (partial on status)
--   units_state_idx                   (on state)
-- ============================================================================

-- users.role
ALTER TABLE users ADD COLUMN role_int SMALLINT;
UPDATE users SET role_int = CASE role
  WHEN 'ADMIN' THEN 0
  WHEN 'PROPERTY_MANAGER' THEN 1
  WHEN 'MAINTENANCE' THEN 2
  WHEN 'TENANT' THEN 3
END;
ALTER TABLE users ALTER COLUMN role_int SET NOT NULL;
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users RENAME COLUMN role_int TO role;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 3;
DROP TYPE "Role";

-- units.state
ALTER TABLE units ADD COLUMN state_int SMALLINT;
UPDATE units SET state_int = CASE state
  WHEN 'AVAILABLE'   THEN 0
  WHEN 'LISTED'      THEN 1
  WHEN 'OCCUPIED'    THEN 2
  WHEN 'MAINTENANCE' THEN 3
END;
ALTER TABLE units ALTER COLUMN state_int SET NOT NULL;
ALTER TABLE units DROP COLUMN state;
ALTER TABLE units RENAME COLUMN state_int TO state;
ALTER TABLE units ALTER COLUMN state SET DEFAULT 0;
DROP TYPE "UnitState";

-- leases.status
ALTER TABLE leases ADD COLUMN status_int SMALLINT;
UPDATE leases SET status_int = CASE status
  WHEN 'ACTIVE'     THEN 0
  WHEN 'EXPIRED'    THEN 1
  WHEN 'RENEWED'    THEN 2
  WHEN 'TERMINATED' THEN 3
END;
ALTER TABLE leases ALTER COLUMN status_int SET NOT NULL;
ALTER TABLE leases DROP COLUMN status;
ALTER TABLE leases RENAME COLUMN status_int TO status;
ALTER TABLE leases ALTER COLUMN status SET DEFAULT 0;
DROP TYPE "LeaseStatus";

-- rent_periods.status
ALTER TABLE rent_periods ADD COLUMN status_int SMALLINT;
UPDATE rent_periods SET status_int = CASE status
  WHEN 'UPCOMING' THEN 0
  WHEN 'DUE'      THEN 1
  WHEN 'PARTIAL'  THEN 2
  WHEN 'PAID'     THEN 3
  WHEN 'OVERDUE'  THEN 4
  WHEN 'PREPAID'  THEN 5
END;
ALTER TABLE rent_periods ALTER COLUMN status_int SET NOT NULL;
ALTER TABLE rent_periods DROP COLUMN status;
ALTER TABLE rent_periods RENAME COLUMN status_int TO status;
ALTER TABLE rent_periods ALTER COLUMN status SET DEFAULT 1;
DROP TYPE "RentPeriodStatus";

-- maintenance_requests.status + priority
ALTER TABLE maintenance_requests ADD COLUMN status_int SMALLINT;
UPDATE maintenance_requests SET status_int = CASE status
  WHEN 'OPEN'        THEN 0
  WHEN 'ASSIGNED'    THEN 1
  WHEN 'IN_PROGRESS' THEN 2
  WHEN 'RESOLVED'    THEN 3
  WHEN 'CLOSED'      THEN 4
END;
ALTER TABLE maintenance_requests ALTER COLUMN status_int SET NOT NULL;
ALTER TABLE maintenance_requests DROP COLUMN status;
ALTER TABLE maintenance_requests RENAME COLUMN status_int TO status;
ALTER TABLE maintenance_requests ALTER COLUMN status SET DEFAULT 0;
DROP TYPE "MaintenanceStatus";

ALTER TABLE maintenance_requests ADD COLUMN priority_int SMALLINT;
UPDATE maintenance_requests SET priority_int = CASE priority
  WHEN 'LOW'       THEN 0
  WHEN 'NORMAL'    THEN 1
  WHEN 'HIGH'      THEN 2
  WHEN 'EMERGENCY' THEN 3
END;
ALTER TABLE maintenance_requests ALTER COLUMN priority_int SET NOT NULL;
ALTER TABLE maintenance_requests DROP COLUMN priority;
ALTER TABLE maintenance_requests RENAME COLUMN priority_int TO priority;
ALTER TABLE maintenance_requests ALTER COLUMN priority SET DEFAULT 1;
DROP TYPE "MaintenancePriority";

-- payments.method
ALTER TABLE payments ADD COLUMN method_int SMALLINT;
UPDATE payments SET method_int = CASE method
  WHEN 'CASH'          THEN 0
  WHEN 'BANK_TRANSFER' THEN 1
  WHEN 'UPI'           THEN 2
  WHEN 'CHEQUE'        THEN 3
  WHEN 'OTHER'         THEN 4
END;
ALTER TABLE payments ALTER COLUMN method_int SET NOT NULL;
ALTER TABLE payments DROP COLUMN method;
ALTER TABLE payments RENAME COLUMN method_int TO method;
DROP TYPE "PaymentMethod";

-- lease_termination_approvals.status
ALTER TABLE lease_termination_approvals ADD COLUMN status_int SMALLINT;
UPDATE lease_termination_approvals SET status_int = CASE status
  WHEN 'PENDING'  THEN 0
  WHEN 'APPROVED' THEN 1
  WHEN 'REJECTED' THEN 2
END;
ALTER TABLE lease_termination_approvals ALTER COLUMN status_int SET NOT NULL;
ALTER TABLE lease_termination_approvals DROP COLUMN status;
ALTER TABLE lease_termination_approvals RENAME COLUMN status_int TO status;
ALTER TABLE lease_termination_approvals ALTER COLUMN status SET DEFAULT 0;
DROP TYPE "TerminationApprovalStatus";


-- ============================================================================
-- PHASE B — Add new_id BIGSERIAL on every table
-- ============================================================================
ALTER TABLE users                       ADD COLUMN new_id BIGSERIAL;
ALTER TABLE properties                  ADD COLUMN new_id BIGSERIAL;
ALTER TABLE units                       ADD COLUMN new_id BIGSERIAL;
ALTER TABLE tenants                     ADD COLUMN new_id BIGSERIAL;
ALTER TABLE leases                      ADD COLUMN new_id BIGSERIAL;
ALTER TABLE lease_tenants               ADD COLUMN new_id BIGSERIAL;
ALTER TABLE lease_terminations          ADD COLUMN new_id BIGSERIAL;
ALTER TABLE lease_termination_approvals ADD COLUMN new_id BIGSERIAL;
ALTER TABLE rent_periods                ADD COLUMN new_id BIGSERIAL;
ALTER TABLE payments                    ADD COLUMN new_id BIGSERIAL;
ALTER TABLE prepaid_credits             ADD COLUMN new_id BIGSERIAL;
ALTER TABLE deposit_refunds             ADD COLUMN new_id BIGSERIAL;
ALTER TABLE maintenance_requests        ADD COLUMN new_id BIGSERIAL;
ALTER TABLE maintenance_alerts          ADD COLUMN new_id BIGSERIAL;
ALTER TABLE property_transfer_logs      ADD COLUMN new_id BIGSERIAL;
ALTER TABLE audit_log                   ADD COLUMN new_id BIGSERIAL;
ALTER TABLE password_reset_tokens       ADD COLUMN new_id BIGSERIAL;
ALTER TABLE refresh_tokens              ADD COLUMN new_id BIGSERIAL;
ALTER TABLE rent_accrual_log            ADD COLUMN new_id BIGSERIAL;


-- ============================================================================
-- PHASE C — Add new_<fk> BIGINT + backfill via JOIN on old text id
-- ============================================================================

ALTER TABLE users ADD COLUMN new_created_by_user_id BIGINT;
UPDATE users c SET new_created_by_user_id = p.new_id
  FROM users p WHERE c.created_by_user_id = p.id;

ALTER TABLE tenants ADD COLUMN new_user_id BIGINT;
UPDATE tenants t SET new_user_id = u.new_id FROM users u WHERE t.user_id = u.id;

ALTER TABLE properties ADD COLUMN new_active_pm_id       BIGINT;
ALTER TABLE properties ADD COLUMN new_created_by_user_id BIGINT;
UPDATE properties p SET new_active_pm_id       = u.new_id FROM users u WHERE p.active_pm_id       = u.id;
UPDATE properties p SET new_created_by_user_id = u.new_id FROM users u WHERE p.created_by_user_id = u.id;

ALTER TABLE units ADD COLUMN new_property_id        BIGINT;
ALTER TABLE units ADD COLUMN new_retired_by_user_id  BIGINT;
UPDATE units x SET new_property_id        = p.new_id FROM properties p WHERE x.property_id        = p.id;
UPDATE units x SET new_retired_by_user_id = u.new_id FROM users      u WHERE x.retired_by_user_id = u.id;

ALTER TABLE leases ADD COLUMN new_unit_id          BIGINT;
ALTER TABLE leases ADD COLUMN new_signed_by_pm_id  BIGINT;
UPDATE leases l SET new_unit_id         = u.new_id FROM units u WHERE l.unit_id         = u.id;
UPDATE leases l SET new_signed_by_pm_id = u.new_id FROM users u WHERE l.signed_by_pm_id = u.id;

ALTER TABLE lease_tenants ADD COLUMN new_lease_id  BIGINT;
ALTER TABLE lease_tenants ADD COLUMN new_tenant_id BIGINT;
UPDATE lease_tenants lt SET new_lease_id  = l.new_id FROM leases  l WHERE lt.lease_id  = l.id;
UPDATE lease_tenants lt SET new_tenant_id = t.new_id FROM tenants t WHERE lt.tenant_id = t.id;

ALTER TABLE lease_terminations ADD COLUMN new_lease_id               BIGINT;
ALTER TABLE lease_terminations ADD COLUMN new_requested_by_tenant_id BIGINT;
UPDATE lease_terminations lt SET new_lease_id               = l.new_id FROM leases  l WHERE lt.lease_id               = l.id;
UPDATE lease_terminations lt SET new_requested_by_tenant_id = t.new_id FROM tenants t WHERE lt.requested_by_tenant_id = t.id;

ALTER TABLE lease_termination_approvals ADD COLUMN new_termination_id BIGINT;
ALTER TABLE lease_termination_approvals ADD COLUMN new_tenant_id      BIGINT;
UPDATE lease_termination_approvals a SET new_termination_id = lt.new_id FROM lease_terminations lt WHERE a.termination_id = lt.id;
UPDATE lease_termination_approvals a SET new_tenant_id      = t.new_id  FROM tenants            t  WHERE a.tenant_id      = t.id;

ALTER TABLE rent_periods ADD COLUMN new_lease_id BIGINT;
UPDATE rent_periods r SET new_lease_id = l.new_id FROM leases l WHERE r.lease_id = l.id;

ALTER TABLE payments ADD COLUMN new_lease_id             BIGINT;
ALTER TABLE payments ADD COLUMN new_recorded_by_user_id  BIGINT;
ALTER TABLE payments ADD COLUMN new_voided_by_user_id    BIGINT;
ALTER TABLE payments ADD COLUMN new_rent_period_id       BIGINT;
UPDATE payments p SET new_lease_id            = l.new_id FROM leases       l WHERE p.lease_id            = l.id;
UPDATE payments p SET new_recorded_by_user_id = u.new_id FROM users        u WHERE p.recorded_by_user_id = u.id;
UPDATE payments p SET new_voided_by_user_id   = u.new_id FROM users        u WHERE p.voided_by_user_id   = u.id;
UPDATE payments p SET new_rent_period_id      = r.new_id FROM rent_periods r WHERE p.rent_period_id      = r.id;

ALTER TABLE prepaid_credits ADD COLUMN new_lease_id               BIGINT;
ALTER TABLE prepaid_credits ADD COLUMN new_source_payment_id      BIGINT;
ALTER TABLE prepaid_credits ADD COLUMN new_consumed_by_payment_id BIGINT;
UPDATE prepaid_credits c SET new_lease_id               = l.new_id FROM leases   l WHERE c.lease_id               = l.id;
UPDATE prepaid_credits c SET new_source_payment_id      = p.new_id FROM payments p WHERE c.source_payment_id      = p.id;
UPDATE prepaid_credits c SET new_consumed_by_payment_id = p.new_id FROM payments p WHERE c.consumed_by_payment_id = p.id;

ALTER TABLE deposit_refunds ADD COLUMN new_lease_id            BIGINT;
ALTER TABLE deposit_refunds ADD COLUMN new_paid_to_tenant_id   BIGINT;
ALTER TABLE deposit_refunds ADD COLUMN new_processed_by_pm_id  BIGINT;
UPDATE deposit_refunds d SET new_lease_id            = l.new_id FROM leases  l WHERE d.lease_id            = l.id;
UPDATE deposit_refunds d SET new_paid_to_tenant_id   = t.new_id FROM tenants t WHERE d.paid_to_tenant_id   = t.id;
UPDATE deposit_refunds d SET new_processed_by_pm_id  = u.new_id FROM users   u WHERE d.processed_by_pm_id  = u.id;

ALTER TABLE maintenance_requests ADD COLUMN new_unit_id              BIGINT;
ALTER TABLE maintenance_requests ADD COLUMN new_lease_id             BIGINT;
ALTER TABLE maintenance_requests ADD COLUMN new_raised_by_user_id    BIGINT;
ALTER TABLE maintenance_requests ADD COLUMN new_assigned_to_user_id  BIGINT;
ALTER TABLE maintenance_requests ADD COLUMN new_closed_by_user_id    BIGINT;
UPDATE maintenance_requests m SET new_unit_id             = u.new_id FROM units  u WHERE m.unit_id             = u.id;
UPDATE maintenance_requests m SET new_lease_id            = l.new_id FROM leases l WHERE m.lease_id            = l.id;
UPDATE maintenance_requests m SET new_raised_by_user_id   = u.new_id FROM users  u WHERE m.raised_by_user_id   = u.id;
UPDATE maintenance_requests m SET new_assigned_to_user_id = u.new_id FROM users  u WHERE m.assigned_to_user_id = u.id;
UPDATE maintenance_requests m SET new_closed_by_user_id   = u.new_id FROM users  u WHERE m.closed_by_user_id   = u.id;

ALTER TABLE maintenance_alerts ADD COLUMN new_unit_id              BIGINT;
ALTER TABLE maintenance_alerts ADD COLUMN new_tenant_user_id       BIGINT;
ALTER TABLE maintenance_alerts ADD COLUMN new_dismissed_by_user_id BIGINT;
UPDATE maintenance_alerts a SET new_unit_id              = u.new_id FROM units u WHERE a.unit_id              = u.id;
UPDATE maintenance_alerts a SET new_tenant_user_id       = u.new_id FROM users u WHERE a.tenant_user_id       = u.id;
UPDATE maintenance_alerts a SET new_dismissed_by_user_id = u.new_id FROM users u WHERE a.dismissed_by_user_id = u.id;

ALTER TABLE property_transfer_logs ADD COLUMN new_property_id BIGINT;
ALTER TABLE property_transfer_logs ADD COLUMN new_from_pm_id  BIGINT;
ALTER TABLE property_transfer_logs ADD COLUMN new_to_pm_id    BIGINT;
ALTER TABLE property_transfer_logs ADD COLUMN new_actor_id    BIGINT;
UPDATE property_transfer_logs t SET new_property_id = p.new_id FROM properties p WHERE t.property_id = p.id;
UPDATE property_transfer_logs t SET new_from_pm_id  = u.new_id FROM users      u WHERE t.from_pm_id  = u.id;
UPDATE property_transfer_logs t SET new_to_pm_id    = u.new_id FROM users      u WHERE t.to_pm_id    = u.id;
UPDATE property_transfer_logs t SET new_actor_id    = u.new_id FROM users      u WHERE t.actor_id    = u.id;

ALTER TABLE audit_log ADD COLUMN new_actor_id BIGINT;
UPDATE audit_log a SET new_actor_id = u.new_id FROM users u WHERE a.actor_id = u.id;

ALTER TABLE password_reset_tokens ADD COLUMN new_user_id BIGINT;
ALTER TABLE refresh_tokens        ADD COLUMN new_user_id BIGINT;
UPDATE password_reset_tokens p SET new_user_id = u.new_id FROM users u WHERE p.user_id = u.id;
UPDATE refresh_tokens        r SET new_user_id = u.new_id FROM users u WHERE r.user_id = u.id;


-- ============================================================================
-- PHASE D — Drop all FK constraints (dynamic — no dependence on Prisma names)
-- ============================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;


-- ============================================================================
-- PHASE E — Drop old text FK + PK columns
-- ----------------------------------------------------------------------------
-- Each DROP COLUMN also auto-drops dependent UNIQUE constraints / indexes.
-- Recreated in PHASE H.
-- ============================================================================

ALTER TABLE users                       DROP COLUMN created_by_user_id;
ALTER TABLE tenants                     DROP COLUMN user_id;
ALTER TABLE properties                  DROP COLUMN active_pm_id, DROP COLUMN created_by_user_id;
ALTER TABLE units                       DROP COLUMN property_id, DROP COLUMN retired_by_user_id;
ALTER TABLE leases                      DROP COLUMN unit_id, DROP COLUMN signed_by_pm_id;
ALTER TABLE lease_tenants               DROP COLUMN lease_id, DROP COLUMN tenant_id;
ALTER TABLE lease_terminations          DROP COLUMN lease_id, DROP COLUMN requested_by_tenant_id;
ALTER TABLE lease_termination_approvals DROP COLUMN termination_id, DROP COLUMN tenant_id;
ALTER TABLE rent_periods                DROP COLUMN lease_id;
ALTER TABLE payments                    DROP COLUMN lease_id, DROP COLUMN recorded_by_user_id, DROP COLUMN voided_by_user_id, DROP COLUMN rent_period_id;
ALTER TABLE prepaid_credits             DROP COLUMN lease_id, DROP COLUMN source_payment_id, DROP COLUMN consumed_by_payment_id;
ALTER TABLE deposit_refunds             DROP COLUMN lease_id, DROP COLUMN paid_to_tenant_id, DROP COLUMN processed_by_pm_id;
ALTER TABLE maintenance_requests        DROP COLUMN unit_id, DROP COLUMN lease_id, DROP COLUMN raised_by_user_id, DROP COLUMN assigned_to_user_id, DROP COLUMN closed_by_user_id;
ALTER TABLE maintenance_alerts          DROP COLUMN unit_id, DROP COLUMN tenant_user_id, DROP COLUMN dismissed_by_user_id;
ALTER TABLE property_transfer_logs      DROP COLUMN property_id, DROP COLUMN from_pm_id, DROP COLUMN to_pm_id, DROP COLUMN actor_id;
ALTER TABLE audit_log                   DROP COLUMN actor_id;
ALTER TABLE password_reset_tokens       DROP COLUMN user_id;
ALTER TABLE refresh_tokens              DROP COLUMN user_id;


-- ============================================================================
-- PHASE F — Rename new_* → original; drop old text PK; ADD PRIMARY KEY
-- ============================================================================

ALTER TABLE users                       RENAME COLUMN new_created_by_user_id      TO created_by_user_id;
ALTER TABLE tenants                     RENAME COLUMN new_user_id                 TO user_id;
ALTER TABLE properties                  RENAME COLUMN new_active_pm_id            TO active_pm_id;
ALTER TABLE properties                  RENAME COLUMN new_created_by_user_id      TO created_by_user_id;
ALTER TABLE units                       RENAME COLUMN new_property_id             TO property_id;
ALTER TABLE units                       RENAME COLUMN new_retired_by_user_id      TO retired_by_user_id;
ALTER TABLE leases                      RENAME COLUMN new_unit_id                 TO unit_id;
ALTER TABLE leases                      RENAME COLUMN new_signed_by_pm_id         TO signed_by_pm_id;
ALTER TABLE lease_tenants               RENAME COLUMN new_lease_id                TO lease_id;
ALTER TABLE lease_tenants               RENAME COLUMN new_tenant_id               TO tenant_id;
ALTER TABLE lease_terminations          RENAME COLUMN new_lease_id                TO lease_id;
ALTER TABLE lease_terminations          RENAME COLUMN new_requested_by_tenant_id  TO requested_by_tenant_id;
ALTER TABLE lease_termination_approvals RENAME COLUMN new_termination_id          TO termination_id;
ALTER TABLE lease_termination_approvals RENAME COLUMN new_tenant_id               TO tenant_id;
ALTER TABLE rent_periods                RENAME COLUMN new_lease_id                TO lease_id;
ALTER TABLE payments                    RENAME COLUMN new_lease_id                TO lease_id;
ALTER TABLE payments                    RENAME COLUMN new_recorded_by_user_id     TO recorded_by_user_id;
ALTER TABLE payments                    RENAME COLUMN new_voided_by_user_id       TO voided_by_user_id;
ALTER TABLE payments                    RENAME COLUMN new_rent_period_id          TO rent_period_id;
ALTER TABLE prepaid_credits             RENAME COLUMN new_lease_id                TO lease_id;
ALTER TABLE prepaid_credits             RENAME COLUMN new_source_payment_id       TO source_payment_id;
ALTER TABLE prepaid_credits             RENAME COLUMN new_consumed_by_payment_id  TO consumed_by_payment_id;
ALTER TABLE deposit_refunds             RENAME COLUMN new_lease_id                TO lease_id;
ALTER TABLE deposit_refunds             RENAME COLUMN new_paid_to_tenant_id       TO paid_to_tenant_id;
ALTER TABLE deposit_refunds             RENAME COLUMN new_processed_by_pm_id      TO processed_by_pm_id;
ALTER TABLE maintenance_requests        RENAME COLUMN new_unit_id                 TO unit_id;
ALTER TABLE maintenance_requests        RENAME COLUMN new_lease_id                TO lease_id;
ALTER TABLE maintenance_requests        RENAME COLUMN new_raised_by_user_id       TO raised_by_user_id;
ALTER TABLE maintenance_requests        RENAME COLUMN new_assigned_to_user_id     TO assigned_to_user_id;
ALTER TABLE maintenance_requests        RENAME COLUMN new_closed_by_user_id       TO closed_by_user_id;
ALTER TABLE maintenance_alerts          RENAME COLUMN new_unit_id                 TO unit_id;
ALTER TABLE maintenance_alerts          RENAME COLUMN new_tenant_user_id          TO tenant_user_id;
ALTER TABLE maintenance_alerts          RENAME COLUMN new_dismissed_by_user_id    TO dismissed_by_user_id;
ALTER TABLE property_transfer_logs      RENAME COLUMN new_property_id             TO property_id;
ALTER TABLE property_transfer_logs      RENAME COLUMN new_from_pm_id              TO from_pm_id;
ALTER TABLE property_transfer_logs      RENAME COLUMN new_to_pm_id                TO to_pm_id;
ALTER TABLE property_transfer_logs      RENAME COLUMN new_actor_id                TO actor_id;
ALTER TABLE audit_log                   RENAME COLUMN new_actor_id                TO actor_id;
ALTER TABLE password_reset_tokens       RENAME COLUMN new_user_id                 TO user_id;
ALTER TABLE refresh_tokens              RENAME COLUMN new_user_id                 TO user_id;

DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'users','tenants','properties','units','leases','lease_tenants',
  'lease_terminations','lease_termination_approvals','rent_periods',
  'payments','prepaid_credits','deposit_refunds','maintenance_requests',
  'maintenance_alerts','property_transfer_logs','audit_log',
  'password_reset_tokens','refresh_tokens','rent_accrual_log'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I DROP COLUMN id', t);
    EXECUTE format('ALTER TABLE %I RENAME COLUMN new_id TO id', t);
    EXECUTE format('ALTER TABLE %I ADD PRIMARY KEY (id)', t);
  END LOOP;
END $$;

-- NOT NULL on FKs that are non-nullable in the live schema.
-- The complete list was sanity-checked against information_schema.columns.
-- Nullable FKs (intentionally left nullable):
--   properties.active_pm_id              (orphan properties allowed)
--   audit_log.actor_id                   (system / cron actions)
--   users.created_by_user_id             (bootstrap admin has no creator)
--   units.retired_by_user_id             (not yet retired)
--   maintenance_alerts.dismissed_by_user_id
--   maintenance_requests.assigned_to_user_id, .closed_by_user_id, .lease_id
--   payments.voided_by_user_id
--   prepaid_credits.consumed_by_payment_id
--   property_transfer_logs.from_pm_id, .to_pm_id
ALTER TABLE tenants                     ALTER COLUMN user_id                SET NOT NULL;
ALTER TABLE properties                  ALTER COLUMN created_by_user_id     SET NOT NULL;
ALTER TABLE units                       ALTER COLUMN property_id            SET NOT NULL;
ALTER TABLE leases                      ALTER COLUMN unit_id                SET NOT NULL;
ALTER TABLE leases                      ALTER COLUMN signed_by_pm_id        SET NOT NULL;
ALTER TABLE lease_tenants               ALTER COLUMN lease_id               SET NOT NULL;
ALTER TABLE lease_tenants               ALTER COLUMN tenant_id              SET NOT NULL;
ALTER TABLE lease_terminations          ALTER COLUMN lease_id               SET NOT NULL;
ALTER TABLE lease_terminations          ALTER COLUMN requested_by_tenant_id SET NOT NULL;
ALTER TABLE lease_termination_approvals ALTER COLUMN termination_id         SET NOT NULL;
ALTER TABLE lease_termination_approvals ALTER COLUMN tenant_id              SET NOT NULL;
ALTER TABLE rent_periods                ALTER COLUMN lease_id               SET NOT NULL;
ALTER TABLE payments                    ALTER COLUMN lease_id               SET NOT NULL;
ALTER TABLE payments                    ALTER COLUMN recorded_by_user_id    SET NOT NULL;
ALTER TABLE payments                    ALTER COLUMN rent_period_id         SET NOT NULL;
ALTER TABLE prepaid_credits             ALTER COLUMN lease_id               SET NOT NULL;
ALTER TABLE prepaid_credits             ALTER COLUMN source_payment_id      SET NOT NULL;
ALTER TABLE deposit_refunds             ALTER COLUMN lease_id               SET NOT NULL;
ALTER TABLE deposit_refunds             ALTER COLUMN paid_to_tenant_id      SET NOT NULL;
ALTER TABLE deposit_refunds             ALTER COLUMN processed_by_pm_id     SET NOT NULL;
ALTER TABLE maintenance_requests        ALTER COLUMN unit_id                SET NOT NULL;
ALTER TABLE maintenance_requests        ALTER COLUMN raised_by_user_id      SET NOT NULL;
ALTER TABLE maintenance_alerts          ALTER COLUMN unit_id                SET NOT NULL;
ALTER TABLE maintenance_alerts          ALTER COLUMN tenant_user_id         SET NOT NULL;
ALTER TABLE property_transfer_logs      ALTER COLUMN property_id            SET NOT NULL;
ALTER TABLE property_transfer_logs      ALTER COLUMN actor_id               SET NOT NULL;
ALTER TABLE password_reset_tokens       ALTER COLUMN user_id                SET NOT NULL;
ALTER TABLE refresh_tokens              ALTER COLUMN user_id                SET NOT NULL;


-- ============================================================================
-- PHASE G — Re-add FK constraints with correct ON DELETE actions
-- ----------------------------------------------------------------------------
-- ON DELETE actions verified table-by-table against the live `\d` output.
-- Fixes vs v1 draft:
--   payments_voided_by_fkey                : SET NULL → RESTRICT
--   maintenance_alerts unit_fkey           : CASCADE  → RESTRICT
--   maintenance_alerts tenant_user_fkey    : CASCADE  → RESTRICT
-- ============================================================================
ALTER TABLE users
  ADD CONSTRAINT users_created_by_fkey
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_user_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE properties
  ADD CONSTRAINT properties_active_pm_fkey   FOREIGN KEY (active_pm_id)       REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT properties_created_by_fkey  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE units
  ADD CONSTRAINT units_property_fkey         FOREIGN KEY (property_id)        REFERENCES properties(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT units_retired_by_fkey       FOREIGN KEY (retired_by_user_id) REFERENCES users(id)      ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE leases
  ADD CONSTRAINT leases_unit_fkey            FOREIGN KEY (unit_id)            REFERENCES units(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT leases_signed_by_pm_fkey    FOREIGN KEY (signed_by_pm_id)    REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE lease_tenants
  ADD CONSTRAINT lease_tenants_lease_fkey    FOREIGN KEY (lease_id)           REFERENCES leases(id)  ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT lease_tenants_tenant_fkey   FOREIGN KEY (tenant_id)          REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE lease_terminations
  ADD CONSTRAINT lease_terminations_lease_fkey  FOREIGN KEY (lease_id)               REFERENCES leases(id)  ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT lease_terminations_tenant_fkey FOREIGN KEY (requested_by_tenant_id) REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE lease_termination_approvals
  ADD CONSTRAINT lta_termination_fkey FOREIGN KEY (termination_id) REFERENCES lease_terminations(id) ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT lta_tenant_fkey      FOREIGN KEY (tenant_id)      REFERENCES tenants(id)            ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE rent_periods
  ADD CONSTRAINT rent_periods_lease_fkey FOREIGN KEY (lease_id) REFERENCES leases(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE payments
  ADD CONSTRAINT payments_lease_fkey        FOREIGN KEY (lease_id)            REFERENCES leases(id)       ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT payments_recorded_by_fkey  FOREIGN KEY (recorded_by_user_id) REFERENCES users(id)        ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT payments_voided_by_fkey    FOREIGN KEY (voided_by_user_id)   REFERENCES users(id)        ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT payments_rent_period_fkey  FOREIGN KEY (rent_period_id)      REFERENCES rent_periods(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE prepaid_credits
  ADD CONSTRAINT prepaid_credits_lease_fkey               FOREIGN KEY (lease_id)               REFERENCES leases(id)   ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT prepaid_credits_source_payment_fkey      FOREIGN KEY (source_payment_id)      REFERENCES payments(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT prepaid_credits_consumed_by_payment_fkey FOREIGN KEY (consumed_by_payment_id) REFERENCES payments(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE deposit_refunds
  ADD CONSTRAINT deposit_refunds_lease_fkey        FOREIGN KEY (lease_id)           REFERENCES leases(id)  ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT deposit_refunds_tenant_fkey       FOREIGN KEY (paid_to_tenant_id)  REFERENCES tenants(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT deposit_refunds_processed_by_fkey FOREIGN KEY (processed_by_pm_id) REFERENCES users(id)   ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE maintenance_requests
  ADD CONSTRAINT mr_unit_fkey         FOREIGN KEY (unit_id)             REFERENCES units(id)  ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT mr_lease_fkey        FOREIGN KEY (lease_id)            REFERENCES leases(id) ON UPDATE CASCADE ON DELETE SET NULL,
  ADD CONSTRAINT mr_raised_by_fkey    FOREIGN KEY (raised_by_user_id)   REFERENCES users(id)  ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT mr_assigned_to_fkey  FOREIGN KEY (assigned_to_user_id) REFERENCES users(id)  ON UPDATE CASCADE ON DELETE SET NULL,
  ADD CONSTRAINT mr_closed_by_fkey    FOREIGN KEY (closed_by_user_id)   REFERENCES users(id)  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE maintenance_alerts
  ADD CONSTRAINT ma_unit_fkey              FOREIGN KEY (unit_id)              REFERENCES units(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT ma_tenant_user_fkey       FOREIGN KEY (tenant_user_id)       REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT ma_dismissed_by_user_fkey FOREIGN KEY (dismissed_by_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE property_transfer_logs
  ADD CONSTRAINT ptl_property_fkey FOREIGN KEY (property_id) REFERENCES properties(id) ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT ptl_from_pm_fkey  FOREIGN KEY (from_pm_id)  REFERENCES users(id)      ON UPDATE CASCADE ON DELETE SET NULL,
  ADD CONSTRAINT ptl_to_pm_fkey    FOREIGN KEY (to_pm_id)    REFERENCES users(id)      ON UPDATE CASCADE ON DELETE SET NULL,
  ADD CONSTRAINT ptl_actor_fkey    FOREIGN KEY (actor_id)    REFERENCES users(id)      ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE audit_log
  ADD CONSTRAINT audit_log_actor_fkey FOREIGN KEY (actor_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE password_reset_tokens
  ADD CONSTRAINT prt_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE refresh_tokens
  ADD CONSTRAINT rt_user_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE;


-- ============================================================================
-- PHASE H — Recreate every UNIQUE constraint / index lost during PHASE A and E
-- ----------------------------------------------------------------------------
-- Partial indexes whose WHERE clauses originally referenced enum strings are
-- rewritten to use smallint codes (lookup the contract at the top of this file).
-- ============================================================================

-- users
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

-- tenants
CREATE UNIQUE INDEX tenants_user_id_key ON tenants(user_id);

-- properties
CREATE UNIQUE INDEX properties_active_pm_id_partial_unique
  ON properties(active_pm_id) WHERE active_pm_id IS NOT NULL;

-- units
CREATE UNIQUE INDEX units_property_id_unit_number_key
  ON units(property_id, unit_number);
CREATE INDEX units_state_idx ON units(state);

-- leases  (status='ACTIVE' is now status=0)
CREATE UNIQUE INDEX leases_unit_active_unique
  ON leases(unit_id) WHERE status = 0;
CREATE INDEX leases_unit_id_status_idx ON leases(unit_id, status);
-- leases_end_date_idx survived (end_date column not touched).

-- lease_tenants
CREATE UNIQUE INDEX lease_tenants_lease_id_tenant_id_key
  ON lease_tenants(lease_id, tenant_id);

-- lease_terminations  (open = NOT finalized AND NOT withdrawn)
CREATE INDEX lease_terminations_lease_id_idx ON lease_terminations(lease_id);
CREATE UNIQUE INDEX lease_terminations_lease_open_unique
  ON lease_terminations(lease_id)
  WHERE finalized_at IS NULL AND withdrawn_at IS NULL;

-- lease_termination_approvals
CREATE INDEX lease_termination_approvals_termination_id_idx
  ON lease_termination_approvals(termination_id);
CREATE UNIQUE INDEX lease_termination_approvals_termination_id_tenant_id_key
  ON lease_termination_approvals(termination_id, tenant_id);

-- rent_periods  (status IN ('DUE','PARTIAL','OVERDUE') → status IN (1, 2, 4))
CREATE INDEX rent_periods_lease_id_period_start_desc_idx
  ON rent_periods(lease_id, period_start DESC);
CREATE UNIQUE INDEX rent_periods_lease_id_period_start_key
  ON rent_periods(lease_id, period_start);
CREATE INDEX rent_periods_status_due_date_idx ON rent_periods(status, due_date);
CREATE INDEX rent_periods_actionable_idx
  ON rent_periods(due_date) WHERE status IN (1, 2, 4);

-- payments  (idempotency_key indexes survived — column untouched)
CREATE INDEX payments_lease_id_recorded_at_idx
  ON payments(lease_id, recorded_at);
CREATE INDEX payments_rent_period_id_idx ON payments(rent_period_id);

-- prepaid_credits
CREATE UNIQUE INDEX prepaid_credits_consumed_by_payment_id_key
  ON prepaid_credits(consumed_by_payment_id);
CREATE UNIQUE INDEX prepaid_credits_source_payment_id_key
  ON prepaid_credits(source_payment_id);
CREATE INDEX prepaid_credits_lease_id_created_at_idx
  ON prepaid_credits(lease_id, created_at);

-- deposit_refunds
CREATE UNIQUE INDEX deposit_refunds_lease_id_key ON deposit_refunds(lease_id);

-- maintenance_requests  (open: 0,1,2; active assigned: 1,2)
CREATE INDEX maintenance_requests_unit_id_created_at_idx
  ON maintenance_requests(unit_id, created_at DESC);
CREATE INDEX maintenance_requests_lease_id_created_at_idx
  ON maintenance_requests(lease_id, created_at) WHERE lease_id IS NOT NULL;
CREATE INDEX maintenance_requests_open_statuses_idx
  ON maintenance_requests(status) WHERE status IN (0, 1, 2);
CREATE INDEX maintenance_requests_assigned_to_active_idx
  ON maintenance_requests(assigned_to_user_id) WHERE status IN (1, 2);

-- maintenance_alerts
CREATE UNIQUE INDEX maintenance_alerts_unique_triple
  ON maintenance_alerts(tenant_user_id, unit_id, month_key);
CREATE INDEX maintenance_alerts_unit_month_idx
  ON maintenance_alerts(unit_id, month_key);

-- property_transfer_logs
CREATE INDEX property_transfer_logs_property_id_created_at_idx
  ON property_transfer_logs(property_id, created_at);

-- audit_log  (entity_type_entity_id_idx survived — entity_id stays text)
CREATE INDEX audit_log_actor_id_created_at_idx ON audit_log(actor_id, created_at);

-- refresh_tokens
CREATE INDEX refresh_tokens_user_id_revoked_at_idx
  ON refresh_tokens(user_id, revoked_at);


-- ============================================================================
-- PHASE I — Re-enable the 5 triggers disabled in PHASE 0
-- ============================================================================
ALTER TABLE leases               ENABLE TRIGGER trg_prevent_lease_rent_change;
ALTER TABLE maintenance_requests ENABLE TRIGGER trg_maintenance_requests_closed_immutable;
ALTER TABLE payments             ENABLE TRIGGER payments_no_delete;
ALTER TABLE payments             ENABLE TRIGGER payments_restrict_update;
ALTER TABLE units                ENABLE TRIGGER trg_prevent_unit_unretire;


COMMIT;

-- ============================================================================
-- POST-COMMIT TASKS (outside this transaction; run manually after success):
-- ============================================================================
--   1. Truncate sessions (every JWT is now invalid anyway):
--        DELETE FROM refresh_tokens;
--        DELETE FROM password_reset_tokens;
--   2. Update schema.prisma — Int @id @default(autoincrement()) for all models;
--      Int for every former-enum column; remove `enum` blocks.
--   3. Build @gharsetu/shared with the new enums.ts (Step 3 deliverable).
--   4. Tell Prisma the migration is applied:
--        pnpm prisma migrate resolve --applied "<new-migration-name>"
--   5. pnpm prisma generate
-- ============================================================================
