# Phase 3 — Leases & Tenants Backend Security Review
**Reviewer:** gharsetu-security
**Date:** 2026-05-11
**Backend commits in scope:** 1373b89 → a4a8f48
**Prior reviews:** Phase 1 (c6996b3 → 6b362cb), Phase 2 (63e891d → 87cae2d)

---

## Summary

FAIL — Three HIGH findings block Phase 3 testing until remediated. The most critical (H-01, H-02, H-03) are all present in the shipped code and are all reproducible statically without a running API. Phase 2 HIGH findings (last-admin deactivation bypass, NestJS RCE CVE) are both RESOLVED in this build. DB-level invariants (BL-01 partial unique index, BL-02 rent-immutability trigger) are correctly implemented. Transaction isolation is applied on lease create, renew, and finalize — but three mutation paths (terminate-request, terminate-approve, terminate-withdraw) run without Serializable isolation, and the deposit-refund path has no property-scope guard at all.

---

## Findings

### HIGH

#### H-01 · A01 / BL-09 · Tenant can impersonate any co-tenant on all three termination endpoints

**Severity:** CVSS 3.1 8.1 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:H)

**Evidence — terminate-request (`POST /leases/:id/terminate-request`):**

`apps/api/src/leases/leases.service.ts:616-714` — `requestTermination` receives `actorId` (= `JWT.sub` = `User.id`) and `dto.requestedByTenantId` (= `Tenant.id`). The service verifies `dto.requestedByTenantId` is on the lease (line 638-648) but never resolves the acting user's `Tenant.id` from `actorId` and compares them. The two identifiers are in different domains (`User.id` vs `Tenant.id`) and no cross-mapping is performed.

**Evidence — terminate-approve (`POST /leases/:id/terminate-approve`):**

`apps/api/src/leases/leases.service.ts:720-768` — `approveTermination` checks only that `dto.tenantId` has an approval row on the termination (`findFirst` line 734). It does NOT check that `actor.sub` maps to `dto.tenantId`. Any TENANT who knows the `leaseId` and a co-tenant's `Tenant.id` can approve (or reject) that co-tenant's pending approval.

**Evidence — terminate-withdraw (`POST /leases/:id/terminate-withdraw`):**

`apps/api/src/leases/leases.controller.ts:163-166` — the body `{ requestedByTenantId: string }` is passed directly as `requestingTenantId` to `withdrawTermination`. The service at line 788 compares `termination.requested_by_tenant_id !== requestingTenantId` — correctly enforcing that only the requester can withdraw — but it never verifies the authenticated user IS that requester. Any TENANT who knows the requester's `Tenant.id` can withdraw.

**Compounding factor — PropertyScopeGuard passes TENANT unconditionally:**

`apps/api/src/auth/guards/property-scope.guard.ts:91-95` — the guard comment says "Tenant scope is validated at the service layer per endpoint." For `terminate-approve` and `terminate-withdraw` the service layer performs NO tenant ownership check. The guard's promise is broken.

**Static repro (no running API needed):**
```
# Tenant A (user_id=U1, tenant_id=T1) on lease L1
# Tenant B (user_id=U2, tenant_id=T2) also on lease L1
# Tenant A holds a valid JWT

POST /api/v1/leases/L1/terminate-approve
Authorization: Bearer <TenantA-JWT>
Content-Type: application/json
{ "tenantId": "T2", "decision": "APPROVED" }

Expected: 403 FORBIDDEN
Actual (static analysis): 200 OK — TenantA casts TenantB's vote
```

**Impact:** On any multi-tenant lease, a single tenant can unilaterally approve all co-tenant slots, enabling them to trigger finalization without genuine co-tenant consent. This fully breaks BL-09. They can also withdraw a termination request they did not initiate, or file a request in another tenant's name (making that tenant the auto-approved requester with all others PENDING).

**Recommendation:** In each of the three service methods, resolve the JWT actor's `Tenant.id` from `actorId` (via `prisma.tenant.findUnique({ where: { user_id: actorId } })`), then assert that resolved ID equals `dto.requestedByTenantId` / `dto.tenantId` / the body-supplied `requestedByTenantId`. Alternatively, stop accepting `tenantId` from the body entirely and derive it from the JWT — this is the safer design.

**Owner:** gharsetu-backend

**Refs:** SRS BL-09, OWASP A01, Test_Cases TC-LEASE-terminate-impersonation

---

#### H-02 · A01 / BL-19 · `POST /deposit-refunds` has no PropertyScopeGuard — PM of Property B can process a refund for Property A's lease

**Severity:** CVSS 3.1 7.1 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N)

**Evidence:**

`apps/api/src/leases/leases.controller.ts:190-198` — `POST /deposit-refunds` has `@Roles("ADMIN", "PROPERTY_MANAGER")` but no `@PropertyScope` decorator. The class-level `@UseGuards(JwtAuthGuard, RolesGuard, PropertyScopeGuard)` means `PropertyScopeGuard.canActivate` runs, but at line 50 of the guard, `scopeType` resolves to `undefined` (no decorator) and the guard returns `true` unconditionally.

`apps/api/src/leases/leases.service.ts:947-1028` — `createDepositRefund` fetches the lease by `dto.leaseId` but never checks that the lease's unit's `property_id` matches the acting PM's assigned property. Any authenticated `PROPERTY_MANAGER` can supply any `leaseId` from any property.

**Static repro:**
```
# Sunita (PM of Green Valley, property_id=PB) has a valid JWT
# Terminated lease LA belongs to Sai Heights (property_id=PA)

POST /api/v1/deposit-refunds
Authorization: Bearer <SunitaPM-JWT>
{ "leaseId": "LA", "amountPaise": 5000000, "paidToTenantId": "T_sai_tenant" }

Expected: 403 PROPERTY_ACCESS_DENIED
Actual (static analysis): 201 Created — cross-property refund written
```

**Impact:** A PM can record a deposit refund (with arbitrary amount) for any terminated lease across all properties. This violates BL-19 financial isolation. The `processed_by_pm_id` in the refund row will be the attacking PM's ID, corrupting the financial audit trail. The attack also bypasses any downstream deposit-accounting since refund amounts are not validated against the lease's `security_deposit_paise`.

**Recommendation:** Add `@PropertyScope("lease")` to the `deposit-refunds` handler and pass `leaseId` as a route param (e.g., `POST /leases/:leaseId/deposit-refund`) so the guard can resolve `lease → unit → property_id`. Alternatively, add an explicit service-layer check: after loading the lease, assert `lease.unit.property_id === pm.assignedPropertyId`.

**Owner:** gharsetu-backend

**Refs:** SRS BL-19, OWASP A01, Test_Cases TC-LEASE-deposit-cross-prop

---

#### H-03 · A06 · `file-type` 20.4.1 — two new CVEs introduced by @nestjs/common upgrade to 10.4.22

**Severity:** CVSS 3.1 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H)

**Evidence:**

`pnpm audit --prod` output on this build (apps/api resolved `@nestjs/common@10.4.22`):

```
│ moderate │ file-type affected by infinite loop in ASF parser on malformed input with zero-size sub-header │
│ Package  │ file-type                                                                                       │
│ Versions │ >=13.0.0 <21.3.1  →  patched >=21.3.1                                                         │
│ More info│ https://github.com/advisories/GHSA-5v7r-6r5c-r473                                              │

│ moderate │ file-type: ZIP Decompression Bomb DoS via [Content_Types].xml entry                            │
│ Package  │ file-type                                                                                       │
│ Versions │ >=20.0.0 <=21.3.1  →  patched >=21.3.2                                                        │
│ More info│ https://github.com/advisories/GHSA-j47w-4g3g-c36v                                             │
```

`pnpm-lock.yaml` confirms `file-type@20.4.1` is a new transitive dependency introduced when `@nestjs/common` was upgraded from `10.4.15` (Phase 2) to `10.4.22` (Phase 3 GHSA-cj7v-w2c7-cp7c fix). The ASF-parser DoS (GHSA-5v7r-6r5c-r473) allows an unauthenticated attacker to send a crafted request body that triggers an infinite loop and hangs the process. The ZIP bomb (GHSA-j47w-4g3g-c36v) allows OOM exhaustion. Both are pre-auth reachable if NestJS inspects the Content-Type body before authentication.

Both are individually MODERATE severity (CVSS ~5.9), but together they create a composite unauthenticated DoS surface on all API endpoints. Combined severity is filed as HIGH because availability loss is total (server hang or OOM), not degraded.

Note: this is a **new** finding relative to Phase 2. The Phase 2 HIGH CVE (GHSA-cj7v-w2c7-cp7c) is resolved; the upgrade that resolved it introduced `file-type` as a new attack surface.

**Recommendation:** Apply a pnpm override: `"file-type": ">=21.3.2"` in the root `package.json`. Verify `pnpm audit --prod` no longer reports either advisory. The NestJS team is aware; a patched `@nestjs/common` release shipping `file-type >=21.3.2` is expected — alternatively update to that release when available.

**Owner:** gharsetu-backend

**Refs:** OWASP A06, GHSA-5v7r-6r5c-r473, GHSA-j47w-4g3g-c36v

---

### MEDIUM

#### M-01 · A04 / BL-09 · `terminate-request`, `terminate-approve`, `terminate-withdraw` transactions run at default (READ COMMITTED) isolation

**Severity:** CVSS 3.1 5.9 (AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:H/A:N)

**Evidence:**

```
leases.service.ts:657  — requestTermination  → $transaction(async tx => …)   [no isolationLevel]
leases.service.ts:747  — approveTermination  → $transaction(async tx => …)   [no isolationLevel]
leases.service.ts:797  — withdrawTermination → $transaction(async tx => …)   [no isolationLevel]
```

Contrast with:
```
leases.service.ts:334  — create              → { isolationLevel: "Serializable" } ✓
leases.service.ts:607  — renew               → { isolationLevel: "Serializable" } ✓
leases.service.ts:938  — finalizeTermination → { isolationLevel: "Serializable" } ✓
```

Under READ COMMITTED two concurrent `terminate-approve` calls (from co-tenants T2 and T3 responding simultaneously) can both read `approval.status=PENDING`, both update to `APPROVED`, and both commit — this is actually the desired outcome for approval, but the issue is:

1. `requestTermination` creates the termination + all approval rows in a non-serializable tx. A concurrent second `requestTermination` call on the same lease (from a different tenant) might both pass the service-layer lease-status check and race to insert — the DB partial unique index (`lease_terminations_lease_open_unique`) will catch this and throw P2002, which IS translated to `TERMINATION_OPEN`. So the constraint catches this case.

2. The more serious risk: `terminate-request` reads `allLeaseTenants` (the list of tenants to create approval rows for) OUTSIDE the transaction, then creates rows inside it. A tenant added between the read and the transaction commit would not get an approval row, making finalization impossible later (all-approved check would pass prematurely if the approval count doesn't match active lease tenant count at finalization time). This is a narrow TOCTOU window.

**Impact:** Low probability exploit requiring precise timing; impact would be a lease finalized without all co-tenant approvals on record — directly violating BL-09. The DB partial unique + service-layer all-approved check in finalizeTermination provides partial backstop.

**Recommendation:** Add `{ isolationLevel: "Serializable" }` to the three transactions. Also move the `allLeaseTenants` read for `requestTermination` inside the transaction (currently at line 651, before the `$transaction` call at line 657).

**Owner:** gharsetu-backend

**Refs:** SRS BL-08, BL-09, OWASP A04

---

#### M-02 · A04 / BL-09 · Idempotency window for `renew` is evaluated OUTSIDE the transaction

**Severity:** CVSS 3.1 5.3 (AV:N/AC:H/PR:H/UI:N/S:U/C:N/I:H/A:N)

**Evidence:**

`apps/api/src/leases/leases.service.ts:504-517` — the idempotency check (`findFirst` for a lease created in the last 5 seconds by the same PM on the same unit) runs before the `$transaction` call at line 540. Two simultaneous `POST /leases/:id/renew` requests from the same PM would both read no recent lease, both pass the idempotency check, and both enter the transaction. One transaction would mark the old lease as `RENEWED` and create a new ACTIVE lease. The second transaction would then try to update an already-`RENEWED` lease (service guard at line 493-502 catches `status !== 'ACTIVE'`), but that guard also runs OUTSIDE the transaction.

There is a DB backstop: the partial unique index `leases_unit_active_unique` on `leases(unit_id) WHERE status='ACTIVE'` would fire on the second transaction's `tx.lease.create`, throwing P2002. The outer catch at line 337 translates this to `UNIT_HAS_ACTIVE_LEASE`. So the worst case is a 409 error on the duplicate, not a silent double-renewal. The functional impact is limited.

**Recommendation:** Move the idempotency `findFirst` inside the `$transaction` callback (already Serializable), or rely solely on the DB partial unique index as the true idempotency guard (it is sufficient).

**Owner:** gharsetu-backend

**Refs:** SRS BL-02, OWASP A04

---

#### M-03 · A09 · PII written to audit log in `tenant.update` — `dob`, `id_proof_number`, `emergency_contact_phone` stored in `before`/`after`

**Severity:** CVSS 3.1 4.7 (AV:L/AC:H/PR:H/UI:N/S:U/C:H/I:N/A:N)

**Evidence:**

`apps/api/src/tenants/tenants.service.ts:154-161`:

```typescript
await this.audit.writeLog(tx, {
  actorId,
  action: "tenant.update",
  entityType: "Tenant",
  entityId: id,
  before: { ...before, user: undefined },   // TENANT_SELECT includes dob, id_proof_number, emergency_contact_phone
  after: { ...updated, user: undefined },    // same
});
```

`TENANT_SELECT` at `tenants.service.ts:10-32` includes `dob`, `id_proof_type`, `id_proof_number`, `emergency_contact_name`, `emergency_contact_phone`. Spreading the full `before` and `after` objects into the audit log writes these PII fields to `audit_log.before` and `audit_log.after` (JSONB columns) verbatim. Anyone with read access to the `audit_log` table (or to any API that surfaces audit log data) sees the tenant's date of birth, ID proof number, and emergency contact phone. This is particularly sensitive in India given DPDP Act applicability.

The `lease.create` audit write in `leases.service.ts:237-244` correctly limits the tenant payload to `{ id, user_id }` — PII is excluded there. The problem is isolated to the PATCH update path.

**Recommendation:** Redact sensitive fields from the audit `before`/`after` snapshot. For the tenant update, log only the changed field names and a redacted marker, not the values themselves: `before: { dob: '[REDACTED]', id_proof_number: '[REDACTED]', ... }` for the fields present in the diff. Alternatively, pass a safe subset: `{ id: before.id, user_id: before.user_id }` as the `before` snapshot.

**Owner:** gharsetu-backend

**Refs:** SRS §11 (data protection), OWASP A09

---

#### M-04 · A01 · `forbidNonWhitelisted: false` — carried from Phase 2 L-03; Phase 3 termination body not a typed DTO

**Severity:** CVSS 3.1 4.3 (AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N)

**Evidence:**

Phase 2 L-03 (still open): `apps/api/src/app.module.ts:48` — `forbidNonWhitelisted: false`.

New Phase 3 instance: `apps/api/src/leases/leases.controller.ts:163` — `@Body() dto: { requestedByTenantId: string }` is an inline type annotation, not a class with `class-validator` decorators. `ValidationPipe` cannot apply `whitelist` stripping or `forbidNonWhitelisted` rejection to plain TypeScript interface types — only to class instances decorated with `class-validator`. Any extra fields in the `terminate-withdraw` body are silently forwarded to the service without stripping.

Current impact is low (the service only reads `dto.requestedByTenantId` and no other fields are destructured), but this pattern should not be extended.

**Recommendation:** Create a `TerminationWithdrawDto` class with `@IsString() requestedByTenantId: string;` and replace the inline type. Also resolve the `forbidNonWhitelisted: false` setting from Phase 2 L-03.

**Owner:** gharsetu-backend

**Refs:** Phase 2 L-03, OWASP A04

---

### LOW

#### L-01 · A04 / BL-18 · `startDate` accepts past dates with no server-side minimum — data integrity gap

**Severity:** CVSS 3.1 3.1 (AV:N/AC:H/PR:H/UI:N/S:U/C:N/I:L/A:N)

**Evidence:** `apps/api/src/leases/dto/create-lease.dto.ts:20-21` — `startDate` is validated with `@Matches(/^\d{4}-\d{2}-\d{2}$/)` (format only). No `@IsDateString()` with future-or-today constraint or custom validator checks `startDate >= now`. A PM can create a lease backdated by months, recording false historical data.

The BL-18 24-hour turnover gap check (`leases.service.ts:128-145`) is based on `terminated_at` of the previous lease, not on `startDate` of the new lease. Backdating `startDate` does NOT bypass BL-18; it is purely a data-quality issue.

**Recommendation:** Add `@MinDate(new Date())` (via `@IsDate()` + `@Transform`) or a custom validator that rejects `startDate` more than 24 hours in the past.

**Owner:** gharsetu-backend

**Refs:** SRS BL-18

---

#### L-02 · A04 · `GET /leases` PROPERTY_MANAGER scoping relies on `active_pm_id` not re-checked inside transaction — same pattern as Phase 2 M-01

**Severity:** CVSS 3.1 3.7 (AV:N/AC:H/PR:H/UI:N/S:U/C:L/I:L/A:N)

**Evidence:** `apps/api/src/leases/leases.service.ts:389-401` — the PM's property is resolved via `prisma.property.findFirst({ where: { active_pm_id: actorId } })` outside any transaction. A property transfer between this read and the query could result in a PM seeing a brief window of wrong-property data. This is the same pattern as Phase 2 M-01 (BL-03 state check outside transaction) and shares the same low-probability caveat.

**Recommendation:** Note for Phase 7 hardening sprint. Not immediately blocking.

**Owner:** gharsetu-backend

---

#### L-03 · A05 · Helmet middleware still absent — carried from Phase 1/2

**Evidence:** `apps/api/src/main.ts` — no `helmet()` call. Phase 2 L-02 carried forward unchanged.

CVSS 3.1 3.1. Phase 7 backlog.

---

#### L-04 · A06 · `path-to-regexp` 0.1.12 — ReDoS — carried from Phase 1/2

**Evidence:** `pnpm audit --prod` — `path-to-regexp@0.1.12` still unpatched. Phase 2 L-04 carried forward. No override applied.

CVSS 3.1 5.9 (at library level; LOW for this app given simple route shapes). Phase 7 backlog.

---

#### L-05 · A01 · PropertyScopeGuard comment misrepresents TENANT handling on write endpoints

**Severity:** CVSS 3.1 0.0 (Info — no direct exploitable risk beyond what H-01 already covers)

**Evidence:** `apps/api/src/auth/guards/property-scope.guard.ts:88-95` — the comment reads "allowed on lease-scoped reads only — the specific handler must add its own tenant ownership check in the service layer." The handler at lines 124, 141, 158 of `leases.controller.ts` are all write endpoints (POST), not reads. The service layer did NOT add the ownership checks for approve and withdraw. This is the root design failure that led to H-01.

**Recommendation:** After H-01 is fixed, update the guard comment to be accurate. Consider making the TENANT pass conditional on the service layer implementing a contract (e.g., a required method on the controller or a decorator that forces an ownership check).

**Owner:** gharsetu-backend

---

### INFO

#### I-01 · Phase 2 H-01 fix — last-admin deactivation bypass — CONFIRMED RESOLVED

`apps/api/src/users/users.service.ts:254-267` — `adminUpdateUser` now contains the `is_active === false && role === ADMIN` guard inside the `$transaction` callback (the `adminCount` query at line 257 runs inside the transaction, resolving Phase 2 M-03 as well). Both the deactivation and role-demotion paths now run the count check inside the transaction. PASS.

---

#### I-02 · Phase 2 H-02 fix — @nestjs/common GHSA-cj7v-w2c7-cp7c — CONFIRMED RESOLVED

`apps/api/package.json:24` — `"@nestjs/common": "^10.4.16"`. Resolved version `10.4.22` per `pnpm-lock.yaml`. `pnpm audit --prod` no longer reports GHSA-cj7v-w2c7-cp7c. PASS. (See H-03 for new CVEs introduced by this transitive upgrade.)

---

#### I-03 · BL-01 partial unique index — CONFIRMED PRESENT AND CORRECT

`apps/api/prisma/migrations/20260511000000_phase_3_tenants_leases/migration.sql:79-81`:
```sql
CREATE UNIQUE INDEX "leases_unit_active_unique"
  ON "leases"("unit_id")
  WHERE status = 'ACTIVE';
```
Index name follows `_unique` convention. PASS.

---

#### I-04 · BL-02 rent-immutability trigger — CONFIRMED PRESENT AND CORRECT

`migration.sql:89-113` — `trg_prevent_lease_rent_change` BEFORE UPDATE trigger on `leases`. Fires on `monthly_rent_paise` or `security_deposit_paise` change; raises `P0001`. PASS.

---

#### I-05 · Deposit refund uniqueness — CONFIRMED PRESENT, error translation CONFIRMED

`migration.sql:227` — `CREATE UNIQUE INDEX "deposit_refunds_lease_id_key" ON "deposit_refunds"("lease_id")`. `leases.service.ts:1017-1024` — P2002 caught and translated to `409 DEPOSIT_REFUND_EXISTS`. PASS.

---

#### I-06 · Transaction isolation — create and finalize termination — CONFIRMED SERIALIZABLE

`leases.service.ts:334` (create), `607` (renew), `938` (finalize-termination) — all three high-risk write paths use `{ isolationLevel: "Serializable" }`. The three missing paths are covered under M-01.

---

#### I-07 · Audit log — no UPDATE/DELETE paths in Phase 3 code — CONFIRMED

`grep -rn "auditLog.update|auditLog.delete"` returns zero results. All Phase 3 mutations use `audit.writeLog` which calls only `tx.auditLog.create`. Append-only property holds. PASS.

---

#### I-08 · Audit log — no temp password in audit writes — CONFIRMED

`leases.service.ts:212-219, 237-244` — `user.create` audit writes `{ id, email, role }` only; `tenant.create` writes `{ id, user_id }` only. `tempPassword` is appended to the HTTP response after the transaction (line 324-331) and is NOT in any audit `after` field. PASS.

---

#### I-09 · Sensitive fields absent from lease API responses — CONFIRMED

`LEASE_SELECT` (line 26-40) does not include `password_hash`, `token_hash`, or `refresh_tokens`. `TENANT_SELECT` in `tenants.service.ts:10-32` does not include `password_hash` or `token_hash`. Temp passwords appear only in the `POST /properties/:propertyId/units/:unitId/leases` response body for newly created accounts. PASS.

---

#### I-10 · ThrottlerGuard — Phase 3 endpoints inherit global guard — CONFIRMED

`app.module.ts:40-44` — `APP_GUARD` with `ThrottlerGuard` remains registered globally. All Phase 3 endpoints inherit 100 req/60s throttling. Termination endpoints (which could be used for harassment) are throttled. PASS.

---

#### I-11 · @nestjs/core GHSA-36xv-jgw5-4q75 — known open item, not Phase-3-new

`pnpm audit --prod` — `@nestjs/core@10.4.22` is within the vulnerable range `<=11.1.17`; patched only in `>=11.1.18` (requires NestJS v11 migration). This was noted as a known unresolved item in the engagement scope. Not filed as a new Phase 3 finding; logged here for completeness. No change from prior review.

---

#### I-12 · Cursor-based pagination — Phase 3 endpoints inherit raw CUID cursors

`tenants.service.ts:85` — `next_cursor` is raw tenant CUID. ADMIN/PM-only endpoints; same risk profile as Phase 2 I-05. Note carried. Signed cursors recommended if tenant list ever becomes tenant-accessible.

---

## Checks Performed

| # | Check | Status | Evidence |
|---|---|---|---|
| 1 | terminate-request: actor.sub mapped to Tenant.id before comparing to dto.requestedByTenantId | FAIL (H-01) | leases.service.ts:616 — no mapping performed |
| 2 | terminate-approve: actor.sub mapped to Tenant.id before comparing to dto.tenantId | FAIL (H-01) | leases.service.ts:720 — no mapping performed |
| 3 | terminate-withdraw: actor.sub mapped to Tenant.id before comparing to body tenantId | FAIL (H-01) | leases.service.ts:774 — no mapping performed |
| 4 | PropertyScopeGuard enforces TENANT lease ownership | FAIL (H-01) | property-scope.guard.ts:91-95 — unconditional pass for TENANT |
| 5 | POST /deposit-refunds has @PropertyScope decorator | FAIL (H-02) | leases.controller.ts:190 — no decorator; guard is no-op |
| 6 | createDepositRefund service checks PM → property assignment | FAIL (H-02) | leases.service.ts:947 — no property scope check |
| 7 | file-type CVE via @nestjs/common upgrade | FAIL (H-03) | pnpm audit: GHSA-5v7r-6r5c-r473, GHSA-j47w-4g3g-c36v |
| 8 | terminate-request $transaction isolationLevel: Serializable | FAIL (M-01) | leases.service.ts:657 — no isolationLevel |
| 9 | terminate-approve $transaction isolationLevel: Serializable | FAIL (M-01) | leases.service.ts:747 — no isolationLevel |
| 10 | terminate-withdraw $transaction isolationLevel: Serializable | FAIL (M-01) | leases.service.ts:797 — no isolationLevel |
| 11 | allLeaseTenants read inside transaction for requestTermination | FAIL (M-01) | leases.service.ts:651 — read before $transaction at line 657 |
| 12 | renew idempotency check inside transaction | FAIL (M-02) | leases.service.ts:504-517 — outside $transaction |
| 13 | tenant.update audit log redacts PII | FAIL (M-03) | tenants.service.ts:154-161 — full TENANT_SELECT spread |
| 14 | terminate-withdraw body is typed DTO class | FAIL (M-04) | leases.controller.ts:163 — inline type, not class |
| 15 | forbidNonWhitelisted: true | FAIL (M-04) | app.module.ts:48 — still false (Phase 2 L-03 open) |
| 16 | POST /leases/:id/terminate-request @Roles includes TENANT | PASS | leases.controller.ts:124 — ADMIN,PROPERTY_MANAGER,TENANT |
| 17 | POST /leases/:id/terminate-approve @Roles includes TENANT | PASS | leases.controller.ts:141 |
| 18 | POST /leases/:id/terminate-withdraw @Roles includes TENANT | PASS | leases.controller.ts:158 |
| 19 | POST /leases/:id/finalize-termination @Roles excludes TENANT | PASS | leases.controller.ts:175 — ADMIN,PROPERTY_MANAGER only |
| 20 | POST /deposit-refunds @Roles excludes TENANT | PASS | leases.controller.ts:191 |
| 21 | GET /leases @Roles excludes TENANT | PASS | leases.controller.ts:67 |
| 22 | GET /leases/:id @Roles excludes TENANT | PASS | leases.controller.ts:95 |
| 23 | PM-2 → PropertyScopeGuard blocks Property A lease access | PASS | property-scope.guard.ts:64-86 — active_pm_id check |
| 24 | PropertyScopeGuard lease resolution uses DB lookup (not URL param) | PASS | property-scope.guard.ts:131-138 — lease → unit → property_id |
| 25 | BL-01: partial unique index leases_unit_active_unique present | PASS | migration.sql:79-81 |
| 26 | BL-02: rent-immutability trigger trg_prevent_lease_rent_change present | PASS | migration.sql:89-113 |
| 27 | BL-04: unit → OCCUPIED on lease create (inside tx) | PASS | leases.service.ts:307-320 — inside $transaction |
| 28 | BL-04: unit → AVAILABLE on finalize termination (inside tx) | PASS | leases.service.ts:917-929 — inside $transaction |
| 29 | BL-07: at least one tenant guard (service + DTO) | PASS | leases.service.ts:87-95; create-lease.dto.ts:37-40 |
| 30 | BL-08/09: all-approved check before finalize | PASS | leases.service.ts:850-863 — pending/rejected count check |
| 31 | BL-09: no time-based auto-approval | PASS | No scheduled job found; no TTL on approval rows |
| 32 | BL-18: 24-hour turnover gap on lease create | PASS | leases.service.ts:128-145 |
| 33 | BL-18: 24-hour turnover gap on finalize termination | PASS | leases.service.ts:867-887 |
| 34 | BL-18: turnover gap cannot be bypassed by backdating startDate | PASS | gap check is on terminated_at of prev lease, not startDate |
| 35 | create lease $transaction isolationLevel: Serializable | PASS | leases.service.ts:334 |
| 36 | renew $transaction isolationLevel: Serializable | PASS | leases.service.ts:607 |
| 37 | finalizeTermination $transaction isolationLevel: Serializable | PASS | leases.service.ts:938 |
| 38 | Deposit refund unique constraint deposit_refunds_lease_id_key | PASS | migration.sql:227 |
| 39 | Deposit refund P2002 → DEPOSIT_REFUND_EXISTS (not 500) | PASS | leases.service.ts:1017-1024 |
| 40 | BL-01 P2002 → UNIT_HAS_ACTIVE_LEASE (not 500) | PASS | leases.service.ts:337-344 |
| 41 | Temp password absent from audit log | PASS | audit write at leases.service.ts:212-219 — no tempPassword |
| 42 | Temp password — one-time disclosure only | PASS | Returned at create only; no subsequent GET exposes it |
| 43 | Lease response shape excludes password_hash / token_hash | PASS | LEASE_SELECT at leases.service.ts:26-40 |
| 44 | Tenant response shape excludes password_hash | PASS | TENANT_SELECT excludes password_hash |
| 45 | PII in tenant.create audit log | PASS | leases.service.ts:237-244 — only {id, user_id} |
| 46 | PII in tenant.update audit log | FAIL (M-03) | tenants.service.ts:154-161 — full spread includes dob, id_proof_number |
| 47 | console.log / logger leaking PII | PASS | Only logger.log at leases.service.ts:516 (lease ID only) |
| 48 | Audit log — no UPDATE/DELETE on audit_log table | PASS | grep returns zero results |
| 49 | Audit log writes inside same $transaction | PASS | All writeLog calls inside tx callbacks |
| 50 | MAINTENANCE role blocked from all Phase 3 endpoints | PASS | @Roles guards exclude MAINTENANCE; PropertyScopeGuard blocks via ForbiddenException for unscoped endpoints where Roles guard alone covers |
| 51 | ThrottlerGuard — Phase 3 endpoints throttled | PASS | app.module.ts:40 — global APP_GUARD |
| 52 | pnpm audit — GHSA-cj7v-w2c7-cp7c resolved (Phase 2 H-02) | PASS | @nestjs/common 10.4.22 |
| 53 | pnpm audit — file-type DoS CVEs (new in Phase 3) | FAIL (H-03) | GHSA-5v7r-6r5c-r473, GHSA-j47w-4g3g-c36v |
| 54 | pnpm audit — path-to-regexp 0.1.12 | OPEN (L-04) | No override; carried |
| 55 | pnpm audit — lodash code injection | OPEN (carried) | lodash 4.17.21 via @nestjs/config |
| 56 | Phase 2 H-01: last-admin deactivation bypass | RESOLVED | users.service.ts:254-267 — guard inside $transaction |
| 57 | Phase 2 M-03: last-admin count race outside tx | RESOLVED | Count now runs inside tx; see I-01 |
| 58 | CORS — no regression | PASS | main.ts CORS unchanged |
| 59 | Dynamic curl checks (live API) | NOT RUN | API not running in audit environment |

---

## Phase 2 Carry-Forward Status

| Phase 2 Finding | Status in Phase 3 |
|---|---|
| H-01: Last-admin deactivation bypass | RESOLVED — guard moved inside $transaction |
| H-02: @nestjs/common 10.4.15 GHSA-cj7v-w2c7-cp7c | RESOLVED — upgraded to 10.4.22 |
| M-01: BL-03 rent-lock race (state check outside tx) | OPEN — units module; Phase 2 scope only |
| M-02: BL-19 P2002 not translated in transferPm | OPEN — properties module; Phase 2 scope only |
| M-03: Last-admin count outside tx | RESOLVED — combined fix with H-01 |
| L-02: Helmet absent | OPEN — carried as L-03 |
| L-03: forbidNonWhitelisted: false | OPEN — carried as M-04 (elevated due to untyped withdraw body) |
| L-04: path-to-regexp ReDoS | OPEN — carried as L-04 |
| L-05: monthly_rent_paise INT not BIGINT | RESOLVED — Phase 3 Lease model uses BIGINT; units.monthly_rent_paise remains INT (Phase 7 backlog) |

---

## Remediation Timeline

| Severity | Finding | Deadline |
|---|---|---|
| HIGH | H-01: Tenant impersonation on termination endpoints | Fix before Phase 3 testing begins |
| HIGH | H-02: POST /deposit-refunds missing PropertyScope | Fix before Phase 3 testing begins |
| HIGH | H-03: file-type 20.4.1 DoS CVEs | Fix before Phase 3 testing begins (pnpm override) |
| MEDIUM | M-01: Termination transactions missing Serializable isolation | Fix within 7 days; allLeaseTenants read must move inside tx |
| MEDIUM | M-02: Renew idempotency check outside transaction | Fix within 14 days; DB index is backstop |
| MEDIUM | M-03: PII in tenant.update audit log | Fix within 14 days |
| MEDIUM | M-04: Untyped withdraw body + forbidNonWhitelisted:false | Fix within 14 days |
| LOW | L-01 – L-04 | Phase 7 hardening sprint |

---

## Follow-Up Tests Required (after fixes)

After H-01 fix:
- Seed two tenants on a multi-tenant lease (T1, T2). Log in as T1. POST `/leases/:id/terminate-approve` with `tenantId=T2-tenant-id, decision=APPROVED` → must return `403 TENANT_MISMATCH` or equivalent.
- POST `/leases/:id/terminate-request` with `requestedByTenantId=T2-tenant-id` while authenticated as T1 → must return `403`.
- POST `/leases/:id/terminate-withdraw` with `requestedByTenantId=T1-tenant-id` while authenticated as T2 (T2 did not initiate) → must return `403`.

After H-02 fix:
- As PM of Property B, POST `/deposit-refunds` with a `leaseId` from Property A → must return `403 PROPERTY_ACCESS_DENIED`.

After H-03 fix:
- `pnpm audit --prod` → GHSA-5v7r-6r5c-r473 and GHSA-j47w-4g3g-c36v must no longer appear in the API dependency path.

After M-01 fix:
- Concurrent terminate-request from two tenants on same lease (race harness) → only one succeeds; other returns `409 TERMINATION_OPEN`.
- Tester confirms `allLeaseTenants` read is inside the $transaction callback.

After M-03 fix:
- Run `PATCH /tenants/:id { "dob": "1990-01-01" }`. Query `audit_log` table. Confirm `before.dob` is `[REDACTED]` or absent.

---

## Sign-off

**FAIL** — Phase 3 testing is blocked by H-01 (tenant impersonation on termination), H-02 (cross-property deposit refund), and H-03 (file-type DoS CVEs). All three have static repros and are present in the as-shipped code at commit `a4a8f48`. Dynamic curl checks are NOT RUN (API unavailable in audit environment). Dynamic confirmation of H-01 and H-02 should be the first action after the environment is stood up — both are trivially reproducible with a seeded multi-tenant lease. The DB-level invariants (BL-01 index, BL-02 trigger, deposit-refund unique, open-termination partial unique) are all correctly implemented and would serve as backstops for several edge cases even without the service-layer fixes.

**gharsetu-security · 2026-05-11**


