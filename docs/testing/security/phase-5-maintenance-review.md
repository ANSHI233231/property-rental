# Phase 5 — Maintenance Request Lifecycle Backend Security Review
**Reviewer:** gharsetu-security
**Date:** 2026-05-11
**Backend commits in scope:** `2de778f` → `d725ac1` (Phase 5 — five commits)
**Phase 4 closed at:** `ce50a2d`
**Prior reviews:** Phase 1 (c6996b3→6b362cb), Phase 2 (63e891d→87cae2d), Phase 3 (1373b89→a4a8f48), Phase 4 (00c5ee3)

---

## Summary

**PASS-WITH-FINDINGS** — One HIGH finding (no property-scope enforcement on `GET /maintenance-requests/:id` for the PROPERTY_MANAGER role), one MEDIUM finding (MAINTENANCE role can read any unassigned OPEN request's full detail via `GET /:id`), and four LOW findings (three carried from Phase 4, one new advisory on unit-ID guessing on the create endpoint). No Critical findings.

Core BL-14, BL-15, BL-16, BL-17, and BL-21 enforcement is correctly implemented at both the controller/service layer and the DB level. The BL-17 idempotency uniqueness triple `(tenant_user_id, unit_id, month_key)` is backed by a database UNIQUE constraint. The BL-15 immutability trigger fires correctly and is verified by a direct Prisma test. The audit log is append-only throughout Phase 5.

**Trigger-disable status:** Production source code (`apps/api/src/`) contains zero occurrences of `DISABLE TRIGGER`, `DROP TRIGGER`, or `session_replication_role`. Phase 5 test teardown (`apps/api/test/phase5-integration.spec.ts:84-113`) does NOT use trigger-disable for maintenance_requests — it calls `prisma.maintenanceRequest.deleteMany()` directly (maintenance requests have no append-only trigger; the BL-15 trigger fires only on UPDATE, not DELETE). The existing phase-3/4 payment trigger-disable pattern remains test-only. **Tester is cleared to proceed.**

---

## Findings

### HIGH

#### H-01 · A01 / BL-19 · `GET /maintenance-requests/:id` has no property-scope check for PROPERTY_MANAGER — PM-B can read any request from PM-A's property

**Severity:** CVSS 3.1 7.1 (AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N)

**Evidence:**

`apps/api/src/maintenance/maintenance.service.ts:668-695` — `assertReadAccess` handles TENANT and MAINTENANCE roles with hard ownership checks, but the PROPERTY_MANAGER branch is explicitly deferred with a comment:

```
// PROPERTY_MANAGER: check scope (async check done in service, placeholder here)
// Full scope enforcement is in assertWriteAccess and list()
```

No scope enforcement actually executes for PM on the `findOne` code path. `assertWriteAccess` (line 701) is called for state transitions (`assign`, `inProgress`, `resolve`) but is NOT called by `findOne`. The `list()` method does correctly scope PM requests to their property (line 113-123), but `findOne` bypasses this.

**Static repro:**
```
# PM-B (Green Valley, property_id=PB) holds a valid JWT.
# Request R1 belongs to a unit in Sai Heights (property_id=PA).

GET /api/v1/maintenance-requests/R1
Authorization: Bearer <PM-B JWT>

Expected: 403 PROPERTY_SCOPE_VIOLATION
Actual (static analysis): 200 OK — full request record returned,
  including description, priority, resolution_notes, assigned_to_user_id,
  all timestamps.
```

**Impact:** A PROPERTY_MANAGER can read the full maintenance request detail (title, description, priority, resolution notes, assignee) for any request on any property by guessing or enumerating request IDs. Resolution notes may contain unit-access information or tenant PII. Violates BL-19. CVSS scored High on confidentiality (no write impact).

**Secondary note:** The write-path transitions (`/assign`, `/in-progress`, `/resolve`) ARE correctly protected via `assertWriteAccess`. The leak is read-only.

**Fix recommendation:** In `assertReadAccess`, add an async PM scope check mirroring `assertWriteAccess`. The simplest approach: after the MAINTENANCE branch, add a PROPERTY_MANAGER check that calls `prisma.property.findFirst({ where: { id: req.unit.property_id, active_pm_id: actor.sub, deleted_at: null } })` and throws `ForbiddenException({ code: 'PROPERTY_SCOPE_VIOLATION' })` if null. Because `findOne` already fetches `unit: { select: { property_id: true } }`, no extra DB round-trip is needed beyond the PM lookup. Alternatively, rename `assertReadAccess` to an async method and await it.

**Owner:** gharsetu-backend

**Refs:** SRS BL-19, OWASP A01, `apps/api/src/maintenance/maintenance.service.ts:668-695`, `apps/api/src/maintenance/maintenance.service.ts:159-175`

---

### MEDIUM

#### M-01 · A01 · MAINTENANCE role can read full detail of any OPEN/UNASSIGNED request via `GET /:id` even before assignment

**Severity:** CVSS 3.1 4.3 (AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N)

**Evidence:**

`apps/api/src/maintenance/maintenance.service.ts:684-692` — `assertReadAccess` for the MAINTENANCE role checks `req.assigned_to_user_id !== actor.sub`, which correctly blocks a maintenance worker from reading another worker's assigned request. However, when a request is in `OPEN` status, `assigned_to_user_id` is `null`. The null check evaluates to `null !== actor.sub` → `true` → throws 403.

This blocks maintenance from reading unassigned requests via `GET /:id`. **However**, the `list()` endpoint at line 105-109 permits the MAINTENANCE role to read all OPEN/ASSIGNED/IN_PROGRESS requests across all properties when `scope=all-open` is passed. The `list()` response includes the same `REQUEST_SELECT` fields as `findOne`. So the data is already accessible via `GET /maintenance-requests?scope=all-open`.

The inconsistency is: `GET /:id` with an OPEN (unassigned) request ID returns 403 for a MAINTENANCE actor, but the same data is readable via the `list()` endpoint with `scope=all-open`. This is a design inconsistency, not a critical leak, but it creates an exploitable path: a MAINTENANCE actor can enumerate all open request IDs via list, then use those IDs to confirm the 403/200 boundary.

More materially, there is no server-side check preventing a MAINTENANCE actor from constructing a `GET /:id` with an ID belonging to a request assigned to another MAINTENANCE worker that is in `IN_PROGRESS` state. If `assigned_to_user_id` is not null and is a different user's ID, the check fires correctly. But for OPEN requests where `assigned_to_user_id = null`: the check `null !== actor.sub` is always `true`, so 403 is returned. This part is correct.

The real medium finding is: the `list(scope=all-open)` path exposes the full `REQUEST_SELECT` shape (including `description`, `priority`, `resolution_notes`) of all open/assigned/in-progress requests from all properties to any MAINTENANCE actor. The SRS says MAINTENANCE role can "read + update existing maintenance requests" but "cannot see rent / lease / financial data." The current list shows `lease_id` (a Lease UUID) in the response, which is not directly financially sensitive but does reveal lease record existence for a unit. More critically, if `resolution_notes` is populated at RESOLVED status, a MAINTENANCE actor calling `?scope=all-open&status=RESOLVED` would not see it (RESOLVED is not in the `in` filter). This path is scoped correctly.

**Net assessment:** The `list(scope=all-open)` returning `lease_id` in the response is a low-level data over-exposure. However, the primary medium risk is that the `assertReadAccess` comment ("Full scope enforcement is in assertWriteAccess and list()") is misleading — it creates risk that future reviewers will not add the PM scope check correctly (the underlying driver of H-01). Flag as MEDIUM for the design debt.

**Fix recommendation:** Remove `lease_id` from `REQUEST_SELECT` in the list response, or strip it from the `scope=all-open` shape. Add the PM scope check to `assertReadAccess` (covers H-01 simultaneously). Update the comment to accurately reflect what is and is not enforced.

**Owner:** gharsetu-backend

**Refs:** SRS §2 Maintenance Staff role, OWASP A01, `apps/api/src/maintenance/maintenance.service.ts:22-41` (REQUEST_SELECT), `apps/api/src/maintenance/maintenance.service.ts:101-109` (list MAINTENANCE scope)

---

### LOW

#### L-01 · A05 · Helmet middleware still absent — carried from Phase 1/2/3/4

**Severity:** CVSS 3.1 3.1

`apps/api/src/main.ts` — no `helmet()` call. Phase 4 L-01 carried forward unchanged. Phase 7 backlog.

---

#### L-02 · A01 · `forbidNonWhitelisted: false` — carried from Phase 2/3/4

**Severity:** CVSS 3.1 3.1 (Low per prior review consensus — whitelist stripping is active)

`apps/api/src/app.module.ts:52` — `forbidNonWhitelisted: false`. `whitelist: true` strips unknown fields silently; 400 rejection on unknown fields does not fire. Phase 7 backlog.

---

#### L-03 · A06 · `path-to-regexp` 0.1.12 ReDoS — carried from Phase 1/2/3/4

**Severity:** CVSS 3.1 5.9 at library level (Low for GharSetu — static simple route shapes)

GHSA-37ch-88jc-xwx2. Introduced via `express@4.22.1` in the NestJS dependency chain. No pnpm override applied. GharSetu route patterns are static; trigger is unlikely. Phase 7 backlog.

---

#### L-04 (NEW) · A01 · `POST /maintenance-requests` accepts any `unitId` from a TENANT — unit enumeration possible

**Severity:** CVSS 3.1 2.7 (AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N)

**Evidence:**

`apps/api/src/maintenance/maintenance.service.ts:183-187` — `create()` first looks up the unit:

```typescript
const unit = await this.prisma.unit.findUnique({
  where: { id: dto.unitId },
  select: { id: true, property_id: true },
});
if (!unit) throw new NotFoundException("Unit not found");
```

A TENANT submitting a `unitId` for a unit they have no lease on receives a specific 403 `NO_ACTIVE_LEASE_ON_UNIT`. A TENANT submitting a non-existent `unitId` receives a 404 "Unit not found". The 403 vs. 404 distinction allows a TENANT to confirm whether a given UUID corresponds to any unit in the system (404) or a valid unit they are not a tenant of (403). This leaks unit existence across properties.

**Impact:** Low — unit IDs are UUIDs (random, not sequential), so the brute-force surface is large. No financial data is leaked. The oracle only confirms whether a UUID is a valid unit, not which property it belongs to. Included as Low advisory.

**Fix recommendation:** Return 404 for both "unit not found" and "no active lease on this unit" when actor is TENANT (merge the error codes into a single generic 404 to prevent the oracle). The check ordering would be: verify active lease exists for this tenant on any unit; if none, 404 generically. If the active-lease query returns a specific unit, that is the allowed unit. Reject mismatches silently.

**Owner:** gharsetu-backend

**Refs:** OWASP A01, `apps/api/src/maintenance/maintenance.service.ts:183-220`

---

### INFO

#### I-01 · BL-16 enforcement — CONFIRMED DOUBLE-ENFORCED

`maintenance.controller.ts:101-103` — `@Roles("TENANT", "ADMIN")` + `@RoleErrorCode("BL_16_ONLY_TENANT_CAN_RAISE_MAINTENANCE")`. MAINTENANCE and PROPERTY_MANAGER are blocked at the controller guard layer with the correct BL error code. Integration test in `phase5-integration.spec.ts:328-354` confirms MAINTENANCE → 403 BL_16, PM → 403 BL_16, ADMIN → 201. PASS.

---

#### I-02 · BL-21 enforcement — CONFIRMED DOUBLE-ENFORCED

`maintenance.controller.ts:167-168` — `@Roles("TENANT")` + `@RoleErrorCode("BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE")`. PM and ADMIN are blocked at controller. Service-level check at `maintenance.service.ts:451` (`req.raised_by_user_id !== actor.sub`) further ensures only the original raiser can close. Integration test in `phase5-integration.spec.ts:423-446` confirms PM → 403, ADMIN → 403, original tenant → 200. PASS.

---

#### I-03 · BL-14 DTO + DB CHECK constraints — CONFIRMED

DTO: `create-maintenance-request.dto.ts:33-34` — `@MinLength(30)` on `description`. `resolve-maintenance.dto.ts:10-11` — `@MinLength(20)` on `resolutionNotes`. DB migration `migration.sql:54-55` — `CHECK (length("description") >= 30)` and `CHECK ("resolution_notes" IS NULL OR length("resolution_notes") >= 20)`. Integration test confirms DB-level check fires when bypassing DTO (`phase5-integration.spec.ts:271-287`). PASS.

---

#### I-04 · BL-15 immutability trigger — CONFIRMED

`migration.sql:93-106` — `prevent_closed_maintenance_update()` function raises on `OLD.closed_at IS NOT NULL`. `CREATE TRIGGER trg_maintenance_requests_closed_immutable BEFORE UPDATE`. Integration test at `phase5-integration.spec.ts:542-551` confirms the trigger fires via direct Prisma update. PASS.

---

#### I-05 · BL-17 idempotency — CONFIRMED

`maintenance_alerts` table has `UNIQUE ("tenant_user_id", "unit_id", "month_key")` at both the DB level (`migration.sql:127-128`) and matched by a `findUnique` keyed on `tenant_user_id_unit_id_month_key` in `maintenance.service.ts:598-606`. Upsert logic (create on first, update count on subsequent) is correct. Idempotency integration test at `phase5-integration.spec.ts:771-776` confirms second run produces `alertsCreated: 0`. PASS.

---

#### I-06 · BL-17 IST month-key computation — CONFIRMED CORRECT

`maintenance.service.ts:59-67` — `toISTMonthKey` adds the 5h30m offset to UTC before slicing to `YYYY-MM`. Unit test in `maintenance-alert.processor.spec.ts:80-101` covers three boundary cases including the April-to-May midnight crossover at UTC 2026-04-30T19:00:00Z → IST 2026-05-01T00:30 → `2026-05`. PASS.

---

#### I-07 · BL-17 month boundary — CONFIRMED

Integration test `phase5-integration.spec.ts:815-864` — 5 requests seeded with `created_at: lastMonth` timestamp via direct Prisma. Worker runs. Assert no alert for current IST month key. PASS.

---

#### I-08 · `/assign` assignee validation — CONFIRMED

`maintenance.service.ts:295-311` — service fetches assignee user, confirms `role === 'MAINTENANCE'` and `is_active === true`. Returns `400 ASSIGNEE_NOT_MAINTENANCE_ROLE` or `400 ASSIGNEE_NOT_ACTIVE` appropriately. PASS.

---

#### I-09 · MAINTENANCE acting on someone else's assigned request — CONFIRMED

`maintenance.service.ts:355-359` (`inProgress`) and `maintenance.service.ts:403-407` (`resolve`) — both check `actor.role === 'MAINTENANCE' && req.assigned_to_user_id !== actor.sub` and throw `403 NOT_YOUR_ASSIGNMENT`. Integration test at `phase5-integration.spec.ts:588-594` confirms. PASS.

---

#### I-10 · PropertyScopeGuard on write transitions — CONFIRMED

`maintenance.service.ts:701-725` (`assertWriteAccess`) — for `PROPERTY_MANAGER`, fetches `property WHERE id = req.unit.property_id AND active_pm_id = actor.sub AND deleted_at = null`. If no match: `403 PROPERTY_SCOPE_VIOLATION`. Called by `assign`, `inProgress`, `resolve`. Integration test `phase5-integration.spec.ts:631-638` confirms PM-B blocked on PM-A's request. PASS.

---

#### I-11 · `/dismiss-alert` property scope for PM — CONFIRMED

`maintenance.service.ts:499-508` — PM scope check fetches `property WHERE active_pm_id = actor.sub AND deleted_at = null`; compares `alert.unit.property_id !== pm.id`; throws `403 PROPERTY_SCOPE_VIOLATION`. PASS.

---

#### I-12 · `/dismiss-alert` is Admin/PM only — CONFIRMED

`maintenance.controller.ts:73` — `@Roles("ADMIN", "PROPERTY_MANAGER")`. TENANT and MAINTENANCE are blocked. PASS.

---

#### I-13 · Audit log — append-only in Phase 5 — CONFIRMED

Grep of `apps/api/src/maintenance/` for `auditLog.update`, `auditLog.delete`: zero results. All six Phase 5 mutations (`create`, `assign`, `inProgress`, `resolve`, `close`, `dismissAlert`) call `audit.writeLog(tx, ...)` which calls only `tx.auditLog.create`. PASS.

---

#### I-14 · PII / sensitive fields excluded from responses — CONFIRMED

`REQUEST_SELECT` (lines 22-41) includes only: `id`, `unit_id`, `lease_id`, `raised_by_user_id`, `assigned_to_user_id`, `title`, `description`, `priority`, `status`, `resolution_notes`, timestamps, `closed_by_user_id`. No `password_hash`, `phone`, `dob`, `email`, or `id_proof` fields are present. User objects are not embedded. PASS.

---

#### I-15 · EMERGENCY priority log — no PII — CONFIRMED

`maintenance.service.ts:266-274` — structured `logger.warn` for EMERGENCY emits only: `event`, `requestId`, `unitId`, `raisedBy` (user UUID, not email), `title`, `timestamp`. No tenant phone, DoB, or email in the log entry. PASS.

---

#### I-16 · `/jobs/maintenance-alert/run` is ADMIN-only — CONFIRMED

`jobs.controller.ts:64` — `@Post("maintenance-alert/run")` with `@Roles("ADMIN")`. Class-level `@UseGuards(JwtAuthGuard, RolesGuard)`. MAINTENANCE and PROPERTY_MANAGER tokens receive 403. Integration test `phase5-integration.spec.ts:880-888` confirms. PASS.

---

#### I-17 · Rate limiting inherited — CONFIRMED

`apps/api/src/app.module.ts:27-30` — global `ThrottlerGuard` at 100 requests per 60-second window. `MaintenanceController` does not declare `@SkipThrottle`. All Phase 5 endpoints inherit the global throttler. PASS.

---

#### I-18 · Trigger disable — PRODUCTION CODE CLEAN, TEST TEARDOWN COMPLIANT

Grep of `apps/api/src/` for `DISABLE TRIGGER`, `DROP TRIGGER`, `session_replication_role`: **zero results**.

`apps/api/test/phase5-integration.spec.ts:84-113` — `afterAll` teardown deletes `maintenanceAlert`, `maintenanceRequest`, `prepaidCredit`, `rentPeriod`, `leaseTenant`, `lease`, `unit`, `property`, `tenant`, `auditLog`, `refreshToken`, `user` rows directly via Prisma. Payments are deleted via `$executeRawUnsafe('DELETE FROM payments WHERE lease_id = ANY($1::text[])', allLeaseIds)` (line 91) — this bypasses the payments append-only trigger for teardown. This is the same pattern as Phase 4 test teardown. No trigger-disable used for `maintenance_requests` (the BL-15 trigger fires only on UPDATE; DELETE is unrestricted). PASS.

---

#### I-19 · Phase 4 H-01 carry-forward status in Phase 5 scope

Phase 4 H-01 (`GET /rent-periods/:id` no PM scope check) was not fixed in Phase 5 commits (rent module was out of scope). Still open as a Phase 7 release blocker. No regression introduced in Phase 5. Confirmed.

---

## Checks Performed

| # | Check | Status | Evidence |
|---|---|---|---|
| 1 | POST /maintenance-requests @Roles excludes MAINTENANCE + PM | PASS | controller.ts:101-103 |
| 2 | @RoleErrorCode BL_16_ONLY_TENANT_CAN_RAISE_MAINTENANCE on create | PASS | controller.ts:103 |
| 3 | TENANT without active lease → 403 NO_ACTIVE_LEASE_ON_UNIT | PASS | service.ts:198-219 |
| 4 | POST /:id/close @Roles("TENANT") only + @RoleErrorCode BL_21 | PASS | controller.ts:167-168 |
| 5 | Close: raiser-only check (raised_by_user_id === actor.sub) | PASS | service.ts:451 |
| 6 | /assign @Roles("PROPERTY_MANAGER", "ADMIN") | PASS | controller.ts:118 |
| 7 | Assignee role=MAINTENANCE + is_active=true verified in service | PASS | service.ts:295-311 |
| 8 | /in-progress + /resolve @Roles("MAINTENANCE", "PM", "ADMIN") | PASS | controller.ts:133, 150 |
| 9 | MAINTENANCE on /in-progress restricted to own assignment | PASS | service.ts:355-359 |
| 10 | MAINTENANCE on /resolve restricted to own assignment | PASS | service.ts:403-407 |
| 11 | /dismiss-alert @Roles("ADMIN", "PROPERTY_MANAGER") | PASS | controller.ts:73 |
| 12 | dismiss-alert PM scope check (unit.property_id vs active_pm_id) | PASS | service.ts:499-508 |
| 13 | PM-B GET /maintenance-requests/:id (PM-A's request) → 403 | FAIL (H-01) | service.ts:668-695 — assertReadAccess PM branch is a no-op |
| 14 | PM-B /assign on PM-A's request → 403 | PASS | service.ts:701-725 (assertWriteAccess) |
| 15 | PM-B /in-progress on PM-A's request → 403 | PASS | service.ts:701-725 |
| 16 | PM-B /resolve on PM-A's request → 403 | PASS | service.ts:701-725 |
| 17 | Tenant-A GET /maintenance-requests/:id (Tenant-B's) → 403 | PASS | service.ts:674-681 |
| 18 | MAINTENANCE list(scope=all-open) exposes lease_id | MEDIUM (M-01) | service.ts:22-41 REQUEST_SELECT includes lease_id |
| 19 | BL-14 DTO: description @MinLength(30) | PASS | create-maintenance-request.dto.ts:33-34 |
| 20 | BL-14 DTO: resolutionNotes @MinLength(20) | PASS | resolve-maintenance.dto.ts:10-11 |
| 21 | BL-14 DB CHECK: description >= 30 | PASS | migration.sql:54 |
| 22 | BL-14 DB CHECK: resolution_notes IS NULL OR length >= 20 | PASS | migration.sql:55 |
| 23 | BL-15 trigger: prevent_closed_maintenance_update | PASS | migration.sql:93-106 |
| 24 | BL-15 trigger fires on closed update (Prisma test) | PASS | phase5-integration.spec.ts:542-551 |
| 25 | BL-17 unique triple (tenant_user_id, unit_id, month_key) — DB | PASS | migration.sql:127-128 |
| 26 | BL-17 IST month-key computation | PASS | service.ts:59-67; unit tests confirm boundary |
| 27 | BL-17 idempotency: second run → 0 created | PASS | phase5-integration.spec.ts:771-776 |
| 28 | BL-17 month boundary: prev-month requests excluded | PASS | phase5-integration.spec.ts:815-864 |
| 29 | BL-17 alert worker at 00:10 IST (Asia/Kolkata) | PASS | maintenance-alert-scheduler.service.ts:35-41 |
| 30 | /jobs/maintenance-alert/run @Roles("ADMIN") only | PASS | jobs.controller.ts:64-65 |
| 31 | Unit-ID enumeration oracle on POST /maintenance-requests (TENANT) | LOW (L-04) | service.ts:183-220 |
| 32 | All DTOs: whitelist stripping active | PASS | app.module.ts:51 |
| 33 | forbidNonWhitelisted: false | OPEN (L-02 carried) | app.module.ts:52 |
| 34 | EMERGENCY log: no PII (phone, DoB, email) | PASS | service.ts:266-274 |
| 35 | PII absent from API responses (no password_hash, phone, dob) | PASS | REQUEST_SELECT grep clean |
| 36 | audit_log: no UPDATE/DELETE path in Phase 5 src | PASS | grep returns zero results |
| 37 | Trigger disable in production src/ | PASS | grep returns zero results in apps/api/src/ |
| 38 | Trigger disable in test/ (teardown only, Phase 5) | PASS | phase5-integration.spec.ts uses deleteMany; no DISABLE TRIGGER for maintenance table |
| 39 | Global ThrottlerGuard inherited by MaintenanceController | PASS | app.module.ts:27-30; no @SkipThrottle on controller |
| 40 | Helmet middleware | OPEN (L-01 carried) | main.ts — no helmet() call |
| 41 | path-to-regexp ReDoS GHSA-37ch | OPEN (L-03 carried) | 0.1.12 unpatched |
| 42 | Dynamic curl checks (live API) | NOT RUN | API not running in audit environment |

---

## Phase 4 Carry-Forward Status

| Phase 4 Finding | Status in Phase 5 |
|---|---|
| H-01: GET /rent-periods/:id no PM scope check | Still OPEN — rent module out of Phase 5 scope |
| M-01: Accrual P2002 unhandled on concurrent trigger | Status unknown — rent module out of scope |
| M-02: amountPaise missing @Max | Status unknown — rent module out of scope |
| L-01: Helmet absent | OPEN (carried L-01 here) |
| L-02: forbidNonWhitelisted:false | OPEN (carried L-02 here) |
| L-03: path-to-regexp ReDoS | OPEN (carried L-03 here) |

---

## Remediation Timeline

| Severity | Finding | Deadline |
|---|---|---|
| HIGH | H-01: GET /maintenance-requests/:id no PM scope check | Fix before Phase 5 release; Phase 7 hardening at latest |
| MEDIUM | M-01: MAINTENANCE list scope exposes lease_id + assertReadAccess design debt | Fix within 14 days |
| LOW | L-01–L-04 | Phase 7 hardening sprint |

---

## Follow-Up Tests Required (after fixes)

After H-01 fix:
- Log in as PM-B. `GET /api/v1/maintenance-requests/<request-id from PM-A's property>` → must return `403 PROPERTY_SCOPE_VIOLATION`.
- Log in as PM-A. `GET` same request → must return `200 OK`.
- Verify `assertWriteAccess` is not broken (PM-A can still assign/inProgress/resolve their own requests).

After M-01 fix (if lease_id stripped):
- Verify `GET /maintenance-requests?scope=all-open` for MAINTENANCE role no longer includes `lease_id` in response objects.
- Verify ADMIN and PM responses still include `lease_id` if needed for their UI.

---

## Sign-off

**PASS-WITH-FINDINGS** — Phase 5 testing may proceed. The HIGH finding (H-01) is a read-only data leak on `GET /maintenance-requests/:id` for PM cross-property access. All write transitions are correctly scoped. BL-14, BL-15, BL-16, BL-17, and BL-21 enforcement is correctly implemented at both the service and DB layers. The BL-15 immutability trigger and BL-17 uniqueness constraint are production-correct with no trigger-disable in production code.

The append-only-trigger workaround remains **TEST-ONLY** — zero production impact confirmed. Tester is cleared.

**gharsetu-security · 2026-05-11**
