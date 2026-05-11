# Phase 4 — Rent Collection, Payments, Late-fee Accrual Backend Security Review
**Reviewer:** gharsetu-security
**Date:** 2026-05-11
**Backend commit in scope:** 00c5ee3 (squash: "feat(api): phase 4 — rent collection, payments, BullMQ accrual (BL-10–BL-13)")
**Prior reviews:** Phase 1 (c6996b3 → 6b362cb), Phase 2 (63e891d → 87cae2d), Phase 3 (1373b89 → a4a8f48)

---

## Summary

PASS-WITH-FINDINGS — One HIGH finding (cross-property data leak on `GET /rent-periods/:id` for PM role, BL-19), two MEDIUM findings (accrual idempotency race exposes 500 on concurrent admin triggers; `amountPaise` has no `@Max` validator), and four LOW findings (carried open items from Phase 3 plus the double-submit informational). The HIGH finding does not block payment recording or void operations but does expose tenant payment data and prepaid-credit balances cross-property. **Phase 4 testing may proceed with the HIGH finding tracked as a release blocker for Phase 7 hardening.**

The append-only-trigger workaround is **TEST-ONLY** — confirmed present only in `apps/api/test/` files (`phase3-gaps.spec.ts`, `phase3-security-fixes.spec.ts`, `phase4-integration.spec.ts`). Zero occurrences in `apps/api/src/`. **No production code disables the triggers.** Tester is cleared to proceed.

---

## Findings

### HIGH

#### H-01 · A01 / BL-19 · `GET /rent-periods/:id` has no PM property-scope check — PM-B can read any payment detail from PM-A's property

**Severity:** CVSS 3.1 7.5 (AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N)

**Evidence:**

`apps/api/src/rent/rent.controller.ts:71-91` — `GET /rent-periods/:id` is guarded by `JwtAuthGuard` + `RolesGuard` (`ADMIN`, `PROPERTY_MANAGER`, `TENANT`). `PropertyScopeGuard` is NOT in the guard chain for `RentController` (`@UseGuards(JwtAuthGuard, RolesGuard)` at line 34 — no `PropertyScopeGuard`). For the `TENANT` role the controller does perform an explicit service-layer ownership check (`tenantHasAccessToPeriod` at line 79). For the `PROPERTY_MANAGER` role there is no equivalent check.

`apps/api/src/rent/rent.service.ts:216-244` — `findPeriodById` fetches the period and all its associated payments (including the `reference` field — UPI IDs, NEFT UTR numbers, cheque numbers) and all `prepaid_credits` for the same `lease_id` without any actor-scope filter.

Contrast with the correct implementation in `recordPayment` (`rent.service.ts:312-329`): the PM scope check is performed inside the `$transaction` after locking the period row, verifying `lease → unit → property_id` against `active_pm_id`.

**Static repro (no running API needed):**
```
# Sunita (PM of Green Valley, property_id=PB) holds a valid JWT.
# Period P1 belongs to Sai Heights (property_id=PA).

GET /api/v1/rent-periods/P1
Authorization: Bearer <SunitaPM-JWT>

Expected: 403 PROPERTY_ACCESS_DENIED
Actual (static analysis): 200 OK with full period data including payments[].reference
```

**Impact:** A `PROPERTY_MANAGER` can enumerate any `RentPeriod` ID (via trial or by observing another property's URL patterns) and retrieve: the period financial state, a complete payment history for that lease including UPI IDs / cheque numbers / NEFT UTR references, and prepaid credits. This leaks payment instrument identifiers belonging to tenants at another PM's property. It violates BL-19 ("do not expose cross-property data to a PM, even read-only"). CVSS scored High on confidentiality — there is no write impact, but payment-instrument data (reference field) has significant PII value.

**Secondary note — TENANT TOCTOU (Low-risk):** The controller at lines 74 and 79 fetches the period first (`findPeriodById`), then checks tenant ownership. If access is denied, the data is discarded server-side and never sent to the client. No information is leaked to the tenant, but the DB round-trip is wasted. This is an inefficiency, not an exploitable leak.

**Fix recommendation:** Add a PM-scope guard to `findPeriodById` (or inline in the controller handler for the PM role). The simplest correct pattern mirrors what `recordPayment` already does: after loading the period, resolve `lease → unit → property_id` and assert it matches the PM's `active_pm_id`. Alternatively, wire `PropertyScopeGuard` into `RentController` and add a `@PropertyScope('rent-period')` body-scope decorator that resolves period → lease → unit → property_id. The service-layer inline check is preferred because it avoids a redundant DB lookup in the guard.

**Owner:** gharsetu-backend

**Refs:** SRS BL-19, OWASP A01, `apps/api/src/rent/rent.controller.ts:71-91`, `apps/api/src/rent/rent.service.ts:216-244`

---

### MEDIUM

#### M-01 · A04 / BL-12 · Accrual idempotency log creation is outside the try/catch — concurrent triggers yield an unhandled P2002 and a 500 response

**Severity:** CVSS 3.1 5.3 (AV:N/AC:H/PR:H/UI:N/S:U/C:N/I:N/A:L)

**Evidence:**

`apps/api/src/jobs/rent-accrual.processor.ts:95-119` — the idempotency check and log creation sequence is:

```
line  95: existingLog = await prisma.rentAccrualLog.findUnique({ where: { run_date } })
line  99: if (existingLog?.finished_at) → early return (skip)
line 112: logEntry = existingLog ? update : CREATE  // outside try block
line 130: try { ... main accrual logic ... }
line 270: } catch (err) { errorMsg = ... }
```

If two `POST /jobs/rent-accrual/run` (ADMIN role, no rate-limit applied to this endpoint beyond the global 100 req/min) or one scheduled BullMQ run + one manual trigger arrive simultaneously on the same IST date:

1. Both calls read `existingLog = null` (line 95).
2. Both reach `rentAccrualLog.create(...)` at line 117.
3. The second call throws a Prisma P2002 (unique constraint on `run_date`).
4. This throw is **outside** the `try/catch` block (which starts at line 130).
5. The P2002 propagates uncaught through `runAccrual()`, causing the BullMQ job to fail with an unhandled error and the manual endpoint to return 500.

The `run_date` unique index (`rent_accrual_log_run_date_key`, confirmed in `migration.sql:192`) IS the correct idempotency backstop. The problem is the error surface: a 500 instead of a graceful "already running, skipping" response.

The functional risk is low (no double-accrual occurs, as the unique constraint prevents it), but the 500 on the Admin trigger endpoint is surprising and a tester-blocker for the idempotency test case.

**Fix recommendation:** Wrap the `rentAccrualLog.create` call in a try/catch that handles P2002 as a "concurrent run already started" signal and returns the skip response. Alternatively, use Prisma `upsert` with `create`/`update` semantics and add a `SELECT ... FOR UPDATE` advisory lock on the log row inside a transaction so only one run proceeds.

**Owner:** gharsetu-backend

**Refs:** SRS BL-12, OWASP A04, `apps/api/src/jobs/rent-accrual.processor.ts:95-119`

---

#### M-02 · A03 · `amountPaise` field in `RecordPaymentDto` has no `@Max` constraint — accepts values up to `Number.MAX_SAFE_INTEGER`

**Severity:** CVSS 3.1 4.3 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N)

**Evidence:**

`apps/api/src/rent/dto/record-payment.dto.ts:33-35`:

```typescript
@IsInt({ message: "amountPaise must be an integer" })
@IsPositive({ message: "amountPaise must be positive" })
amountPaise!: number;
```

`amountPaise` is typed as JavaScript `number`. JSON numbers map to JS `number`, whose safe integer range is `2^53 - 1 = 9,007,199,254,740,991` paise (~₹90 trillion). The class-validator `@IsInt` decorator ensures the value is an integer in that range; `@IsPositive` ensures it is > 0. There is no `@Max` to cap the amount at a business-reasonable ceiling.

At `rent.service.ts:331`, `BigInt(dto.amountPaise)` converts the JS number safely to BigInt before arithmetic. The actual DB insertion uses BIGINT. So there is no arithmetic overflow.

The risk is that a PM can record a payment of, say, ₹9,00,72,99,25,47,40,991 against a period, instantly marking it as `PAID` with a massive `PrepaidCredit` balance, which distorts all downstream financial reporting. There is no financial validation that `amountPaise` is sane relative to the lease's `monthly_rent_paise` or any ceiling.

**Fix recommendation:** Add `@Max(100_000_000_00)` (₹10 crore in paise = 1,000,00,00,000) or a configurable ceiling as a reasonable upper bound. Alternatively, add a service-layer guard that rejects amounts exceeding, say, 12× the monthly rent for the lease.

**Owner:** gharsetu-backend

**Refs:** OWASP A03, `apps/api/src/rent/dto/record-payment.dto.ts:33-35`, `apps/api/src/rent/rent.service.ts:331`

---

### LOW

#### L-01 · A05 · Helmet middleware still absent — carried from Phase 1/2/3

**Severity:** CVSS 3.1 3.1

`apps/api/src/main.ts` — no `helmet()` call. Phase 3 L-03 carried forward unchanged. Phase 7 backlog.

---

#### L-02 · A01 · `forbidNonWhitelisted: false` — carried from Phase 2/3

**Severity:** CVSS 3.1 4.3 (Medium threshold but scoped as Low per prior review consensus)

`apps/api/src/app.module.ts:52` — `forbidNonWhitelisted: false`. Phase 3 M-04 (partially) carried forward. `whitelist: true` is set (line 51) so unknown fields are stripped silently; the missing `forbidNonWhitelisted` means the 400 rejection on unknown fields does not fire. Risk is low because whitelist stripping is active, but the defense-in-depth layer is absent. Phase 7 backlog.

---

#### L-03 · A06 · `path-to-regexp` 0.1.12 ReDoS — carried from Phase 1/2/3

**Severity:** CVSS 3.1 5.9 at library level (Low for GharSetu given simple, fixed route shapes)

`pnpm audit --prod` — `path-to-regexp@0.1.12` is unpatched (GHSA-37ch-88jc-xwx2). Introduced via `express@4.22.1` in the NestJS dependency chain. No pnpm override applied. GharSetu route patterns are static/simple (`/rent-periods/:id`, `/payments/:id/void`) and do not contain multiple consecutive optional segments, so the ReDoS trigger pattern is unlikely to be exercised. Phase 7 backlog.

---

#### L-04 · A18 (Info) · No server-side deduplication window on `POST /payments` — PM double-submit records two payments

**Severity:** CVSS 3.1 2.0 (AV:N/AC:H/PR:H/UI:R/S:U/C:N/I:L/A:N)

There is no idempotency key on `POST /payments`. A PM who double-clicks "Record Payment" in the UI will create two `Payment` rows. Each will apply correctly (second payment will partially or fully overfill the period and route excess to `PrepaidCredit`), so the financial math is not corrupted, but the operational noise (extra payment to manually void) is a UX issue. FE should implement double-submit prevention (button disable on click). This is an advisory for the FE team. No backend change strictly required but a server-side 5-second idempotency window keyed on `(actorId, rentPeriodId, amountPaise, paidOn)` would be belt-and-suspenders.

**Owner:** gharsetu-frontend (primary), gharsetu-backend (optional backstop)

**Refs:** `apps/api/src/rent/rent.controller.ts:99-107`

---

### INFO

#### I-01 · BL-10 enforcement — CONFIRMED PRESENT, DOUBLE-ENFORCED

`rent.controller.ts:100` — `@Roles("ADMIN", "PROPERTY_MANAGER")` excludes TENANT and MAINTENANCE at the guard level.

`rent.service.ts:254-262` — belt-and-suspenders `actorRole !== "PROPERTY_MANAGER" && actorRole !== "ADMIN"` check throws `ForbiddenException` with code `BL_10_TENANT_CANNOT_RECORD_PAYMENT`. PASS.

---

#### I-02 · `POST /payments/:id/void` role gate — CONFIRMED

`rent.controller.ts:115` — `@Roles("ADMIN", "PROPERTY_MANAGER")`. TENANT and MAINTENANCE are excluded. The service does not add a belt-and-suspenders check here, but the controller-level guard is sufficient. PASS.

---

#### I-03 · `POST /jobs/rent-accrual/run` and `/schedule` — ADMIN ONLY — CONFIRMED

`jobs.controller.ts:34` (`/run`) and `:47` (`/schedule`) — both decorated `@Roles("ADMIN")`. Class-level `@UseGuards(JwtAuthGuard, RolesGuard)` applies to both. PM and TENANT tokens will receive 403. PASS.

---

#### I-04 · PM property-scope on `POST /payments` (recordPayment) — CONFIRMED INSIDE TRANSACTION

`rent.service.ts:312-329` — after the `SELECT ... FOR UPDATE` row lock, the PM's `active_pm_id` is verified against the period's `lease → unit → property_id` inside the Serializable transaction. A PM-B forging a payment against PM-A's period receives `403 PROPERTY_ACCESS_DENIED`. PASS.

---

#### I-05 · PM property-scope on `POST /payments/:id/void` (voidPayment) — CONFIRMED INSIDE TRANSACTION

`rent.service.ts:486-503` — same pattern as recordPayment, inside the Serializable transaction. PASS.

---

#### I-06 · BL-11 Serializable isolation + SELECT FOR UPDATE — CONFIRMED

`rent.service.ts:264,443` — `this.prisma.$transaction(async (tx) => { ... }, { isolationLevel: "Serializable" })`. Inside the transaction, `SELECT id, ... FROM rent_periods WHERE id = ${dto.rentPeriodId} FOR UPDATE` (raw SQL) explicitly locks the row. Outstanding is recomputed from the locked snapshot; spillover is routed to `PrepaidCredit`. PASS.

---

#### I-07 · voidPayment — Serializable isolation + correct cascade-check ordering — CONFIRMED

`rent.service.ts:453-634` — `voidPayment` also runs with `{ isolationLevel: "Serializable" }`. The cascade-block check at line 506-523 (reject if `consumed_at IS NOT NULL`) fires **before** `tx.payment.update` at line 539. No partial state mutation can occur on a rejected void. PASS.

---

#### I-08 · Append-only trigger — CONFIRMED PRODUCTION CLEAN, TEST-ONLY DISABLE

Grep of `apps/api/src/` for `DISABLE TRIGGER`, `DROP TRIGGER`, `session_replication_role`: **zero results**.

Grep of `apps/api/test/` reveals three files (`phase3-gaps.spec.ts:107-113`, `phase3-security-fixes.spec.ts:95-101`, `phase4-integration.spec.ts:95-107`) that use `ALTER TABLE payments DISABLE TRIGGER ... / ENABLE TRIGGER ...` inside `afterAll` teardown blocks, wrapped in try/finally to guarantee re-enabling. The pattern:

```typescript
await prisma.$executeRawUnsafe(`ALTER TABLE payments DISABLE TRIGGER payments_no_delete`);
await prisma.$executeRawUnsafe(`ALTER TABLE payments DISABLE TRIGGER payments_restrict_update`);
try {
  // delete test rows
} finally {
  await prisma.$executeRawUnsafe(`ALTER TABLE payments ENABLE TRIGGER payments_no_delete`);
  await prisma.$executeRawUnsafe(`ALTER TABLE payments ENABLE TRIGGER payments_restrict_update`);
}
```

This is test teardown hygiene only. **Production source code (`apps/api/src/`) does not disable the triggers under any code path.** Tester-blocker check: CLEAR.

Migration SQL confirms both triggers exist and are correct:
- `payments_no_delete` (`migration.sql:103-113`): BEFORE DELETE → always raises `P0001`.
- `payments_restrict_update` (`migration.sql:116-138`): BEFORE UPDATE → permits changes only to `is_voided`, `voided_by_user_id`, `voided_at`, `void_reason`; raises on any other field change.

The trigger guards are correctly ordered against the update trigger: `tx.payment.update({ data: { is_voided, voided_by_user_id, voided_at, void_reason } })` at `rent.service.ts:539-547` changes only the permitted columns. PASS.

---

#### I-09 · BL-13 `computeLateFeePaise` math — CONFIRMED CORRECT, INTEGER THROUGHOUT

`packages/shared/src/schemas/rent.ts:98-108` — implementation:

```typescript
export function computeLateFeePaise(amountDuePaise: bigint, daysOverdue: number): bigint {
  if (daysOverdue < 7) return 0n;
  const fullWeeks = Math.floor(daysOverdue / 7);
  const raw = amountDuePaise * BigInt(2) * BigInt(fullWeeks);
  return raw / 100n;
}
```

Verification:
- `daysOverdue < 7` (including negative): returns `0n`. PASS.
- 17 days → `floor(17/7) = 2` weeks → `1_800_000 × 2 × 2 / 100 = 72_000n` (₹720). Matches SRS worked example. PASS.
- All arithmetic is `BigInt`; no float conversion. PASS.
- The division `/ 100n` truncates (floor) for positive values as required. PASS.
- Non-compounded: always on `amount_due_paise`, never on a prior accrued balance. PASS.

---

#### I-10 · BL-12 accrual threshold — 5 calendar days — CONFIRMED

`rent-accrual.processor.ts:132-143` — threshold computed as `today - 5 days` (date-only, midnight UTC). `findMany` filters `due_date: { lte: overdueThresholdDate }`. Periods due exactly 5 days ago are included; 4 days ago are not. PASS.

---

#### I-11 · Accrual idempotency: unique `run_date` index — CONFIRMED

`migration.sql:192` — `CREATE UNIQUE INDEX "rent_accrual_log_run_date_key" ON "rent_accrual_log"("run_date")`. Schema also has `@unique` on `run_date`. PASS. (The race-condition surface is covered under M-01.)

---

#### I-12 · Health endpoint Redis failure — connection string NOT in API response — CONFIRMED

`health.service.ts:33` — `tcpPing` creates an `Error(\`Redis TCP timeout on ${host}:${port}\`)` on failure. This error is caught at line 56 and logged via `logger.warn` only. The `redis` field in the response is set to `'down'` (a generic string). The `HealthResponse` interface returns `{ status, app, sharedVersion, db, redis, timestamp }` — no connection metadata. No internal hostname or port is exposed to the caller. PASS.

---

#### I-13 · BullBoard dashboard — NOT PRESENT — CONFIRMED

`pnpm audit` dependency tree and `apps/api/src/` grep return zero results for `@bull-board`, `bull-board`, `bull-arena`. The queue management surface is the ADMIN-only `POST /jobs/rent-accrual/run` endpoint only. PASS.

---

#### I-14 · Audit log — no UPDATE/DELETE on `audit_log` in Phase 4 code — CONFIRMED

`grep -rn "auditLog.update|auditLog.delete" apps/api/src/rent/ apps/api/src/jobs/` — zero results. All Phase 4 mutations use `audit.writeLog(tx, ...)` which calls only `tx.auditLog.create`. Append-only property holds for Phase 4. PASS.

---

#### I-15 · Sensitive data exposure — payment `reference` field not in audit log — CONFIRMED

`rent.service.ts:383-399` — `payment.record` audit entry's `after` block contains `{ amount_paise, method, new_paid_paise, new_status }`. The `reference` field (UPI ID / NEFT UTR / cheque number) is **not** included in the audit log. It is stored only on the `payments` row and retrieved only by authorized PM/Admin on the payments list. PASS.

---

#### I-16 · Logging — no PII or payment amounts at info+ level — CONFIRMED

`grep -rn "logger.log|logger.debug" apps/api/src/rent/ apps/api/src/jobs/` — all logger calls log only job IDs, IST dates, and period counts. No `amountPaise`, `reference`, or tenant identifiers are emitted to the logger at any level. PASS.

---

#### I-17 · Phase 3 H-03 (`file-type` DoS CVEs) — CONFIRMED RESOLVED IN THIS BUILD

`pnpm audit --prod` — GHSA-5v7r-6r5c-r473 and GHSA-j47w-4g3g-c36v are not present. The pnpm override `"file-type": ">=21.3.2"` applied in commit `c46208c` is effective. PASS.

---

#### I-18 · Tenant data-scope on `GET /rent-periods` (list) — CONFIRMED

`rent.service.ts:157-173` — when `actorRole === 'TENANT'`, the query filters to `lease.lease_tenants.some({ tenant_id: tenant.id, removed_at: null })`, derived from the JWT `sub` → `tenant.user_id` lookup. A tenant cannot query other leases' periods via this endpoint regardless of `leaseId` or `unitId` query params, because those are ANDed with the ownership filter. PASS.

---

#### I-19 · Phase 3 HIGH findings carry-forward status

| Phase 3 Finding | Status in Phase 4 |
|---|---|
| H-01: Tenant impersonation on termination endpoints | RESOLVED — confirmed fixed at `leases.service.ts` per commit `19cbb67` |
| H-02: POST /deposit-refunds missing PropertyScope | RESOLVED — `@PropertyScopeBody('leaseId')` decorator applied; `property-scope.guard.ts:172-188` handles it |
| H-03: file-type 20.4.1 DoS CVEs | RESOLVED — pnpm override applied in `c46208c`; audit clean |

---

## Checks Performed

| # | Check | Status | Evidence |
|---|---|---|---|
| 1 | POST /payments @Roles excludes TENANT + MAINTENANCE | PASS | rent.controller.ts:100 |
| 2 | POST /payments service belt-and-suspenders BL_10 check | PASS | rent.service.ts:254-262 |
| 3 | POST /payments/:id/void @Roles excludes TENANT + MAINTENANCE | PASS | rent.controller.ts:115 |
| 4 | POST /jobs/rent-accrual/run @Roles("ADMIN") only | PASS | jobs.controller.ts:34 |
| 5 | POST /jobs/rent-accrual/schedule @Roles("ADMIN") only | PASS | jobs.controller.ts:47 |
| 6 | PM-B recordPayment against PM-A period → 403 | PASS | rent.service.ts:312-329 inside Serializable tx |
| 7 | PM-B voidPayment against PM-A payment → 403 | PASS | rent.service.ts:486-503 inside Serializable tx |
| 8 | PM-B GET /rent-periods/:id against PM-A period → 403 | FAIL (H-01) | rent.controller.ts:71-91 — no PM scope check |
| 9 | PM-B GET /rent-periods?leaseId=<PM-A's lease> → empty not 403 | PASS (acceptable) | rent.service.ts:177-193 — property filter ANDs correctly |
| 10 | TENANT GET /rent-periods — only own lease periods returned | PASS | rent.service.ts:157-173 |
| 11 | TENANT GET /rent-periods/:id — ownership checked (post-fetch) | PASS | rent.controller.ts:77-88 |
| 12 | BL-11 Serializable + SELECT FOR UPDATE on recordPayment | PASS | rent.service.ts:264,280-284,443 |
| 13 | BL-11 Serializable on voidPayment | PASS | rent.service.ts:454,632 |
| 14 | payments_no_delete trigger exists and is correct | PASS | migration.sql:103-113 |
| 15 | payments_restrict_update trigger exists and is correct | PASS | migration.sql:116-138 |
| 16 | Trigger disable in production src/ code | PASS | grep returns zero results in apps/api/src/ |
| 17 | Trigger disable in test/ code only (teardown pattern) | INFO | apps/api/test/{phase3-gaps,phase3-security-fixes,phase4-integration}.spec.ts — test teardown, wrapped in try/finally, re-enabled |
| 18 | Void cascade-block BEFORE any state mutation | PASS | rent.service.ts:506-523 precedes update at 539 |
| 19 | Void audit log written | PASS | rent.service.ts:608-619 |
| 20 | computeLateFeePaise — BigInt, non-compounded, floor, correct | PASS | packages/shared/src/schemas/rent.ts:98-108 |
| 21 | computeLateFeePaise — negative daysOverdue → 0 | PASS | daysOverdue < 7 guard covers all negatives |
| 22 | computeLateFeePaise — daysOverdue = 0 → 0 | PASS | |
| 23 | BL-13 worked example: ₹18,000 × 17 days → ₹720 | PASS | Test confirms 72,000n paise |
| 24 | BL-12 threshold: 5 calendar days past due | PASS | rent-accrual.processor.ts:132-143 |
| 25 | Accrual idempotency: finished_at check before processing | PASS | processor.ts:95-109 |
| 26 | Accrual idempotency race: P2002 handled gracefully | FAIL (M-01) | processor.ts:117 outside try block; P2002 → unhandled 500 |
| 27 | run_date unique index on rent_accrual_log | PASS | migration.sql:192 |
| 28 | RecordPaymentDto fields: all decorated with class-validator | PASS | record-payment.dto.ts — all fields decorated |
| 29 | RecordPaymentDto @Max on amountPaise | FAIL (M-02) | No @Max constraint; accepts up to MAX_SAFE_INTEGER |
| 30 | VoidPaymentDto fields: all decorated with class-validator | PASS | void-payment.dto.ts — @IsString @MinLength(5) @MaxLength(1000) |
| 31 | whitelist: true on ValidationPipe | PASS | app.module.ts:51 |
| 32 | forbidNonWhitelisted: true | FAIL (L-02, carried) | app.module.ts:52 — false |
| 33 | BullBoard dashboard absent | PASS | no @bull-board import anywhere |
| 34 | POST /jobs/rent-accrual/run accessible without ADMIN token | not run (API down) | Static: @Roles("ADMIN") guards both endpoints |
| 35 | Health endpoint: Redis failure leaks connection string to caller | PASS | health.service.ts:56 — 'down' string only; host:port in logger.warn only |
| 36 | Reference field (UPI ID) not in audit log | PASS | rent.service.ts:383-399 — after block excludes reference |
| 37 | PII absent from payment/period API responses | PASS | no password_hash, token_hash, dob, id_proof in response serialization |
| 38 | No console.log or logger with amounts/references | PASS | grep confirms only IST date and job ID logged |
| 39 | audit_log no UPDATE/DELETE path in Phase 4 src | PASS | grep returns zero results |
| 40 | Phase 3 H-01 resolved | PASS | leases.service.ts — tenant ID mapped from JWT sub |
| 41 | Phase 3 H-02 resolved | PASS | @PropertyScopeBody('leaseId') on deposit-refunds |
| 42 | Phase 3 H-03 resolved (file-type CVEs) | PASS | pnpm audit clean for GHSA-5v7r + GHSA-j47w |
| 43 | pnpm audit — path-to-regexp (GHSA-37ch) | OPEN (L-03, carried) | 0.1.12 unpatched |
| 44 | pnpm audit — lodash code injection (GHSA-r5fr) | OPEN (carried) | 4.17.21 via @nestjs/config |
| 45 | pnpm audit — @nestjs/core injection (GHSA-36xv) | OPEN (carried) | Requires NestJS v11 migration |
| 46 | Dynamic curl checks (live API) | NOT RUN | API not running in audit environment |
| 47 | Concurrent payment stress test (10 parallel @ same period) | NOT RUN (static-only) | Static: Serializable + FOR UPDATE is correct; tester to run race harness |

---

## Phase 3 Carry-Forward Status

| Phase 3 Finding | Status in Phase 4 |
|---|---|
| H-01: Tenant termination impersonation | RESOLVED |
| H-02: POST /deposit-refunds cross-property | RESOLVED |
| H-03: file-type 20.4.1 DoS CVEs | RESOLVED |
| M-01: Termination tx missing Serializable (3 paths) | Status unknown — out of Phase 4 scope (leases module) |
| M-02: Renew idempotency outside tx | Status unknown — out of Phase 4 scope |
| M-03: PII in tenant.update audit log | Status unknown — out of Phase 4 scope |
| M-04: Untyped withdraw body + forbidNonWhitelisted:false | forbidNonWhitelisted:false OPEN (L-02); withdraw body status unknown |
| L-01: Lease startDate backdating | Out of Phase 4 scope |
| L-02: PM scope race on GET /leases | Out of Phase 4 scope |
| L-03: Helmet absent | OPEN (L-01 here) |
| L-04: path-to-regexp ReDoS | OPEN (L-03 here) |

---

## Remediation Timeline

| Severity | Finding | Deadline |
|---|---|---|
| HIGH | H-01: GET /rent-periods/:id no PM scope check | Fix before Phase 4 release; Phase 7 if not blocking testing |
| MEDIUM | M-01: Accrual P2002 unhandled on concurrent trigger | Fix within 7 days |
| MEDIUM | M-02: amountPaise missing @Max constraint | Fix within 14 days |
| LOW | L-01 – L-03 | Phase 7 hardening sprint |
| INFO | L-04: Double-submit advisory | FE responsibility; no deadline |

---

## Follow-Up Tests Required (after fixes)

After H-01 fix:
- Log in as PM-B. GET `/api/v1/rent-periods/<period-id from PM-A's property>` → must return `403 PROPERTY_ACCESS_DENIED`.
- Log in as PM-A. GET same period → must return `200 OK` with payments list.

After M-01 fix:
- Fire two simultaneous `POST /api/v1/jobs/rent-accrual/run` requests on the same IST date. Both should return `200 OK`; one with `skipped: true`, one with `skipped: false` (or the second with `skipped: true`). Neither should return 500.

After M-02 fix:
- `POST /api/v1/payments` with `amountPaise: 100000000001` (above ceiling) → must return `400 BAD_REQUEST`.

Tester-only (concurrent payment stress, static-verified but not run dynamically):
- Fire 10 parallel `POST /payments` against the same `rentPeriodId` with `amountPaise: 10000` (₹100 each). Period `outstanding_paise` must increase by exactly the applied sum; no double-credit. Final `paid_paise` must equal the sum of non-voided accepted amounts; `PrepaidCredit` must capture overflow correctly.

---

## Sign-off

**PASS-WITH-FINDINGS** — Phase 4 testing may proceed. The HIGH finding (H-01) is a read-only data leak and does not affect payment write integrity. It is a release blocker for production deployment and should be remediated during Phase 7 hardening at the latest, or earlier if the Phase 4 test environment is shared with multiple PM accounts.

The append-only-trigger workaround is **TEST-ONLY** — zero production impact confirmed. Tester is cleared.

Core BL-10/11/12/13 enforcement is correctly implemented: double-guarded role check, Serializable transaction with row-level lock, correct late-fee integer math, and idempotent accrual log with unique `run_date` index.

**gharsetu-security · 2026-05-11**
