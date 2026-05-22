---
name: gharsetu-backend
description: "GharSetu backend system — NestJS + Prisma + PostgreSQL contract for the property-rental platform. Use when adding/modifying any REST endpoint, Prisma model, migration, guard, DTO, service, business-rule enforcement, audit-log write, scheduled job, or auth flow in apps/api; when wiring tenants/leases/units/rent/maintenance/payments; when debugging role-scope leaks or 401/403/409 responses; when designing idempotent writes; when adding append-only audit entries. Covers: 4-role RBAC (ADMIN=0, PROPERTY_MANAGER=1, MAINTENANCE=2, TENANT=3), numeric smallint enums for all states, int autoincrement IDs (no CUIDs), Argon2id hashing, JWT 15min + opaque refresh in HttpOnly cookie at /api/v1/auth (7d), BL-01..BL-23 enforcement points, BullMQ jobs (daily overdue / weekly late-fee / 5+-alert), Prisma migrations (append-only, reversible), DD/MM/YYYY ISO boundary, en-IN locale, ₹ currency. Out-of-scope: 2FA, multi-session UI, public sign-up, online payments, SMS/Email/WhatsApp business notifications, file uploads, owner/vendor logins."
---

# GharSetu Backend System

Authoritative backend contract for `apps/api`. Use this skill whenever you touch NestJS code, Prisma schema, migrations, guards, or business-rule enforcement. The **23 business rules (BL-01 → BL-23)** in [SRS_Document.md](../../../docs/product/SRS_Document.md) §5 are sacrosanct — every endpoint must respect every applicable rule.

## Hard rules — never violate

1. **No public sign-up.** No `POST /auth/register` for self-service. Accounts created only by ADMIN (any role) or PROPERTY_MANAGER (TENANT/MAINTENANCE only).
2. **No DELETE.** Use status/state columns for soft-retire (`retired`, `closed`, `terminated`). Audit log is permanent — no UPDATE, no DELETE on `audit_log`.
3. **Tenants cannot write payments.** **BL-10** is non-negotiable: only PROPERTY_MANAGER (and ADMIN) can `POST /payments`.
4. **No auto-approval timers.** **BL-08/BL-09**: termination requires explicit consent rows from every co-tenant. Never implement an `if created_at + N days then approve` fallback.
5. **Argon2id only** for password hashing (`@node-rs/argon2`). Never bcrypt, MD5, SHA-1. **SRS §11.1 supersedes** the original API spec's bcrypt mention.
6. **Numeric smallint enums everywhere.** No string enums in DB columns. Roles, unit states, lease statuses, rent-period statuses, maintenance statuses/priorities, payment methods, termination-approval statuses — all stored as `smallint` codes. The contract is in [apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma) header comment.
7. **Append-only audit.** Every state change writes an `audit_log` row: who, when, entity, old → new value, reason. No mutation, no deletion of audit entries — **BL-23**.
8. **No multi-session UI.** No `GET/DELETE /users/me/sessions`, no "last sign-in" metadata in profile responses. Refresh tokens are still server-stored & individually revocable, just not exposed.
9. **No 2FA / TOTP** for v1. No `/auth/2fa/*` endpoints.
10. **Migrations are append-only and reversible.** Never edit a shipped migration. Add a new one.

## Stack (fixed — see [SRS §10](../../../docs/product/SRS_Document.md#10-technology-stack))

- **NestJS 10** modular: one Module per domain (`auth`, `users`, `properties`, `units`, `leases`, `tenants`, `maintenance`, `rent`, `rent-change-schedule`, `audit`, `audit-log`, `notifications`, `jobs`, `health`, `common`)
- **Node.js 22 LTS** (pin in `engines.node`). Local environments may run Node 20; warn but don't block.
- **TypeScript strict** mode, `noUncheckedIndexedAccess: true`
- **PostgreSQL 18** with **Prisma 5.22** (docker-compose maps host port **5433** → container 5432; `DATABASE_URL` must match)
- **class-validator + class-transformer** for DTOs (request validation)
- **zod schemas in `packages/shared`** for FE/BE contract sharing — generate response types from these
- **BullMQ** (Redis) for scheduled jobs: daily overdue check (BL-12), weekly late-fee accrual (BL-13), 5+ maintenance alert (BL-17)
- **Jest + Supertest** — unit (`*.spec.ts` co-located) and e2e/integration (`test/` or `phase*.test.ts`)
- **Pino** structured logging, request-id correlation
- Repo layout: pnpm monorepo, `apps/api` (NestJS), `apps/web` (Next.js), `packages/shared` (zod + types)

## Domain model (numeric enum contract — permanent)

```
Role:                      ADMIN=0       PROPERTY_MANAGER=1  MAINTENANCE=2  TENANT=3
UnitState:                 AVAILABLE=0   LISTED=1            OCCUPIED=2     MAINTENANCE=3
LeaseStatus:               ACTIVE=0      EXPIRED=1           RENEWED=2      TERMINATED=3
RentPeriodStatus:          UPCOMING=0    DUE=1               PARTIAL=2      PAID=3         OVERDUE=4   PREPAID=5
MaintenanceStatus:         OPEN=0        ASSIGNED=1          IN_PROGRESS=2  RESOLVED=3     CLOSED=4
MaintenancePriority:       LOW=0         NORMAL=1            HIGH=2         EMERGENCY=3
PaymentMethod:             CASH=0        BANK_TRANSFER=1     UPI=2          CHEQUE=3       OTHER=4
TerminationApprovalStatus: PENDING=0     APPROVED=1          REJECTED=2
```

These codes are **wire-stable**. Never renumber. New states get the next free integer.

## IDs

- All primary keys are `Int @id @default(autoincrement())`. **Never** introduce CUIDs / UUIDs for new entities. The Phase 5 → v2 migration moved everything off CUIDs intentionally (see [apps/api/prisma/migrations/20260512132221_int_id_and_enum_refactor](../../../apps/api/prisma/migrations/20260512132221_int_id_and_enum_refactor)).
- Foreign keys use `_id` suffix (`unit_id`, `lease_id`, `tenant_id`, `manager_id`).
- Timestamps are `created_at`, `updated_at` (`@updatedAt`), stored as UTC `timestamptz`.

## Auth & RBAC

- **JWT HS256** access token, 15-min TTL, payload: `{ sub, role, jti, iat, exp }`.
- **Refresh token**: opaque random string, server-stored as Argon2id hash with `revoked_at`/`replaced_by` columns. 7-day TTL.
- **Cookie**: `Set-Cookie: refresh=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=604800`.
- **Rotation**: every `/auth/refresh` call issues a new refresh token and revokes the old one (`replaced_by`).
- **Roles**: `ADMIN=0`, `PROPERTY_MANAGER=1`, `MAINTENANCE=2`, `TENANT=3`. Use the `@Roles(0,1)` decorator + `RolesGuard` ([apps/api/src/common/guards/](../../../apps/api/src/common/guards/)).
- **Scope guards**: `@Scope('property'|'lease'|'unit')` — a TENANT can only access their own lease IDs; a PM can only access properties they manage. Verify at service layer too, never trust controller-level RBAC alone.
- **Password reset**: single-use opaque token, 30-min TTL, no PII in token, issuing a new one invalidates previous tokens.
- **Login throttle**: 5 attempts / 15 min per email; return `429` after exceed. Don't leak account existence — same error message for wrong-password vs unknown-email.

## Endpoint contract

- Base path: **`/api/v1`**.
- Pagination: `?limit=20&cursor=<opaque>` cursor-based, default 20, max 100 (raise to 500 only for explicit admin list endpoints — see [BUG-005 fix](../../../apps/api/src/users/users.service.ts) precedent).
- Sort: default `created_at DESC` unless the endpoint is a paged scroll list that needs `ASC` for stability; document either way.
- Errors: `{ code, message, details? }` JSON body. Codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT` (BL-violation), `RATE_LIMITED`, `INTERNAL`. HTTP statuses follow the obvious mapping; `409` is reserved for business-rule violations (lease already active for unit, payment already recorded for period, etc.).
- DTOs: request via `class-validator`, response via zod schemas in `packages/shared` so the FE TS types stay in sync.
- Idempotency: write endpoints that may be retried (payments, status transitions) accept `Idempotency-Key` header → store key + result hash for 24h; replay returns the original result.
- All money values are integers in **paise** at the DB layer (`Int`, not `Decimal`) to avoid float drift. Serialize as integer rupees (`₹18,000` displayed by FE; API returns `18000` rupees, not paise — confirm per-endpoint and document).

## Business-rule enforcement points

Each rule MUST be enforced server-side at the listed layer. UI checks alone are insufficient.

| BL | Subject | Enforcement |
|---|---|---|
| BL-01 | One active lease per unit | Partial unique index `(unit_id) WHERE status=0` on `leases`. Service `409 CONFLICT` on conflict. |
| BL-02 | Rent locked once active | Service guard: reject `UPDATE leases SET monthly_rent` when `status=0`. Schedule changes go through `rent_change_schedule` (60-day notice — BL-11). |
| BL-03 | Unit rent locked while in use | Service guard: reject `UPDATE units SET rent` when `state IN (2,3)`. |
| BL-04 | Unit state machine | State-machine guard in service: only `AVAILABLE↔LISTED`, `LISTED→OCCUPIED` (via lease create), `OCCUPIED→AVAILABLE` (via lease end), any↔`MAINTENANCE`. |
| BL-05 | Retired units immutable | Reject any `UPDATE units` setting state away from `retired`. Reject `DELETE` entirely. |
| BL-06 | Tenant phone unique per active lease | Unique index on `tenants(phone) WHERE lease_status=0`. |
| BL-07 | Lease dates valid | `CHECK (end_date > start_date)` + service validation. |
| BL-08 | Co-tenant consent on termination | Termination request requires consent rows from every co-tenant. Status flips to `TERMINATED` only when all `co_tenant_consent.status=1`. |
| BL-09 | **No auto-approval** | Never run a cron that flips consent. If PM wants to force-terminate, they file an ADMIN escalation — different endpoint, audit-logged. |
| BL-10 | Only PM/ADMIN records payments | `@Roles(0,1)` on `POST /payments`. TENANT and MAINTENANCE always `403`. |
| BL-11 | Rent change ≥ 60 days notice | Validation: `effective_from >= today + 60 days` on `POST /rent-change-schedule`. Job applies it at midnight on `effective_from`. |
| BL-12 | Overdue 5 days after due | Daily BullMQ job at 00:30 IST: `UPDATE rent_periods SET status=4 WHERE status IN (1,2) AND due_date < now() - interval '5 days'`. |
| BL-13 | Late fee 2%/week | **Not stored**. Computed on read: `floor(weeks_overdue) * 0.02 * outstanding_at_week_start`. (See migration [20260512233147_drop_late_fee_storage](../../../apps/api/prisma/migrations/20260512233147_drop_late_fee_storage).) Never compound retroactively. |
| BL-14 | Min description length | DTO: `description` ≥ 30 chars (maintenance), `resolution_notes` ≥ 20 chars. Return `400 VALIDATION_ERROR` with field detail. |
| BL-15 | Closed is terminal | State-machine guard: from `CLOSED=4` no transition allowed. |
| BL-16 | Maintenance cannot create requests | `@Roles(0,1,3)` on `POST /maintenance-requests` (TENANT, PM, ADMIN only). Maintenance role gets `PATCH` only, and only on `status` / `notes` fields. |
| BL-17 | 5+ requests/month alert | Trigger on insert: count requests for `(unit_id, month)`; if ≥5 emit notification + audit row. |
| BL-18 | PM cannot self-record on own units | Guard: when `POST /payments` with `lease_id`, reject if `lease.property.manager_id == current_user.id`. Surface in UI by hiding the button; backend re-checks. |
| BL-19 | One active manager per property | Partial unique index `(property_id) WHERE active=true` on `property_manager_assignments`. |
| BL-20 | Manager transfer | New manager assignment row, previous row `active=false`. Previous PM gets `read_only_audit` grant on past data for 90 days. All write endpoints check **current** manager. |
| BL-21 | Tenant closes resolved request | RBAC + state-machine: only TENANT can `PATCH status=4 (CLOSED)` from `status=3 (RESOLVED)`. PM/Maintenance cannot. |
| BL-22 | UTC storage | All `timestamptz` columns. Render in `Asia/Kolkata` at boundary, or return ISO and let FE format. |
| BL-23 | Audit append-only | No UPDATE/DELETE on `audit_log`. Enforce via REVOKE on the table grant + Prisma `@@map` no-update guards in service. |

## Prisma & migrations

- Schema lives at [apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma). Header comment block fixes the enum-code contract — preserve it.
- Migrations directory: [apps/api/prisma/migrations/](../../../apps/api/prisma/migrations/). Filenames are timestamp-prefixed and **append-only**. Never edit shipped migrations.
- Naming: `YYYYMMDDHHMMSS_short_intent` (e.g. `20260513000000_rent_change_schedule`).
- Every migration must be:
  - **Reversible** (a follow-up `down` migration is acceptable for irreversible operations, but the irreversibility must be flagged in the commit message).
  - **Reviewed in a PR** before merge.
  - **Idempotent on existing prod data** (`ALTER … IF NOT EXISTS`, `CREATE INDEX … IF NOT EXISTS`, backfill in a separate transaction).
- Heavy backfills (e.g. on 50M+ rows): batched in chunks of 10k inside a separate migration, with `SELECT pg_sleep(0.1)` between batches if necessary.
- Indexes on every FK; partial unique indexes for BL-01, BL-06, BL-19.

## Scheduled jobs (BullMQ)

- **Daily overdue check** — 00:30 IST. Flips `rent_periods` from `DUE/PARTIAL` to `OVERDUE` after 5 calendar days past due. (BL-12)
- **Weekly late-fee evaluation** — Monday 01:00 IST. No DB write; recomputes outstanding-with-fee for cached projections. (BL-13)
- **Rent-change apply** — daily 00:15 IST. Promotes `rent_change_schedule` rows whose `effective_from = today` to the lease (`leases.monthly_rent`). (BL-11)
- **5+/month maintenance alert** — fired by service on insert, processed by worker. (BL-17)
- Every job writes an audit row on success and a `job_failures` row on exception (retried 3× with exponential backoff).

## Seed data

- Idempotent seed script at [apps/api/prisma/seed.ts](../../../apps/api/prisma/seed.ts). Re-runnable in dev; aborts in `NODE_ENV=production`.
- Bootstrap admin user — email + hashed password from env. **Never** keep an admin with `is_active=false` (see BUG-006 precedent — bootstrap admin was deactivated by a test, blocking login).
- Seed passwords in `.env.example` must be **quoted** (special chars like `!` break shell parsing — see commit `ee61aa6`).

## Common pitfalls (verified from past bugs)

| Symptom | Root cause | Fix |
|---|---|---|
| `An unexpected error occurred` on login | `DATABASE_URL` pointing at host port 5432, but docker-compose maps to **5433** | Use `postgresql://...@localhost:5433/...` in `apps/api/.env` |
| Bootstrap admin can't log in after test run | Test deactivates the admin and doesn't restore | `UPDATE users SET is_active=true WHERE email='<bootstrap>'`; add audit entry. Tests must restore state. |
| List endpoint returns < N items with cursor pagination on big tables | Cursor branch had `ORDER BY created_at ASC` + cap 100 against 284 rows | Switch to `DESC` and raise cap (e.g. 500 for admin list endpoints) |
| Phase 6 test fails on a comment | Source-level lint forbids `≡` glyph and `MenuIcon` token even in comments | Rewrite the comment without the forbidden tokens |
| Migration runs in dev, fails in CI | Migration not idempotent against an already-applied state | Add `IF NOT EXISTS`; or split into a new migration |

## DTO patterns

- Validation lives in `*/dto/*.dto.ts`. Use `class-validator` decorators for input; mirror with a zod schema in `packages/shared` for FE.
- For partial updates: `PartialType(CreateXDto)` from `@nestjs/mapped-types`.
- Numeric fields representing enum codes: `@IsInt() @Min(0) @Max(<max>)` + a custom `@IsEnumCode(SomeEnum)` decorator that checks the value is one of the declared codes.
- Money: `@IsInt() @Min(0)` — store as integer rupees (or paise — pick one per-table and document it on the model).
- Dates from the wire: ISO 8601 strings, validated via `@IsISO8601()`, converted to `Date` in the service. Never accept DD/MM/YYYY at the API boundary — that's an FE rendering concern.

## Audit log

- Every write endpoint that mutates persistent state must emit an `audit_log` row in the same transaction. Use the `AuditService.write({ entity, entity_id, action, before, after, reason, actor_id })` helper.
- `before`/`after` JSONB — diff only the changed columns to keep rows small.
- Idempotent payment recording: if `Idempotency-Key` replays, no new audit row; original key stored alongside the original audit row's id.
- Audit log read endpoints: `GET /audit-log` (ADMIN only), with strict filters (entity, entity_id, date range, actor). Default pagination 50/page, max 200.

## Testing checklist (before PR)

1. `pnpm typecheck` — zero errors
2. `pnpm lint` — zero warnings (`--max-warnings 0`)
3. `pnpm --filter @gharsetu/api test` — unit specs co-located with services
4. `pnpm --filter @gharsetu/api test:e2e` — phase tests (`phase*.test.ts`) cover the BL rules end-to-end
5. New endpoint? Add a `*.spec.ts` covering: happy path, RBAC denial (each unauthorized role), BL violation (409), validation error (400), idempotent replay
6. New migration? Verify `prisma migrate reset` + seed runs clean in a fresh DB
7. Cross-check with [Test_Cases.md](../../../docs/testing/v1/Test_Cases.md) sections 4–8 (Users, Properties, Leases, Maintenance, Rent) + §13 (Negative tests)

## File-level conventions

- One Module per domain folder under `apps/api/src/<domain>/`
- `*.controller.ts` — thin, only DTO validation + delegation
- `*.service.ts` — business logic, transactions, BL enforcement
- `*.repository.ts` — Prisma queries (split out only when service grows large)
- `dto/` — request DTOs
- `*.spec.ts` — unit tests co-located
- Cross-cutting: `apps/api/src/common/{guards,filters,decorators,interceptors}`
- Module imports: explicit, no barrel `index.ts` re-exports that hide circular deps

## Things you do NOT do

- ❌ Add `POST /auth/register` for self-service
- ❌ Add `DELETE` endpoints. Use status columns.
- ❌ Allow TENANT or MAINTENANCE roles to `POST /payments` (BL-10)
- ❌ Implement any "after N days, auto-approve" timer for co-tenant consent (BL-09)
- ❌ Edit a shipped migration
- ❌ Introduce CUIDs / UUIDs for new entities — primary keys are `Int autoincrement`
- ❌ Renumber enum codes — they're wire-stable
- ❌ Add bcrypt, MD5, SHA-1 anywhere in the auth path — Argon2id only
- ❌ Add `GET /users/me/sessions` or "last sign-in" metadata — multi-session UI out of scope
- ❌ Add `/auth/2fa/*` endpoints — 2FA out of scope
- ❌ Accept DD/MM/YYYY at the API boundary — ISO 8601 only
- ❌ Store late fee values (BL-13 — compute on read)
- ❌ Mutate `audit_log` rows — append-only
- ❌ Break the response shape of a shipped endpoint — version under `/v2/...` instead

## Output expected (when finishing a task)

Return under 250 words:

1. **Files touched** (paths) and **migrations added** (filenames + intent).
2. **Endpoints added/changed** as `METHOD /path → response shape` table.
3. **Business rules enforced** (cite BL-NN) and the test that proves it.
4. **Open issues / known gaps**.
5. **Test cases that should now pass** (cite IDs from [Test_Cases.md](../../../docs/testing/v1/Test_Cases.md)).

## Where to start

| Task | Read first |
|---|---|
| New endpoint | This skill's "Endpoint contract" + the existing module's `*.controller.ts`/`*.service.ts` |
| New domain module | `apps/api/src/users/` as the canonical example |
| Schema change | [apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma) header comment + latest migration as template |
| Business-rule question | [SRS_Document.md](../../../docs/product/SRS_Document.md) §5 (BL-NN definitions) + this skill's enforcement table |
| Auth/security work | [apps/api/src/auth/security.spec.ts](../../../apps/api/src/auth/security.spec.ts) + [apps/api/src/common/guards/](../../../apps/api/src/common/guards/) |
| Scheduled job | [apps/api/src/jobs/](../../../apps/api/src/jobs/) — existing BullMQ workers |
| Audit-log addition | [apps/api/src/audit/](../../../apps/api/src/audit/) + this skill's "Audit log" section |
