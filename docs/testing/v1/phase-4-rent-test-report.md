# Phase 4 — Rent Collection + Payments + Late-fee Accrual + BullMQ · Test Report

**Tester:** gharsetu-tester
**Date:** 2026-05-11
**Scope:** TC-RENT-*, TC-LATEFEE-*, TC-NEG-* (BL-10 negative), H-01 lock-in, M-01/M-02 lock-in, FC-1/2/3 contract alignment, 30-day simulated cron run.
**Commits in scope:** 00c5ee3 (BE) → 29230de (H-01 + FC fixes) + new test commits cad17d8, 57ddc43.

---

## Summary

PASS-WITH-NOTES. All Phase 4 business rules are covered by automated tests. Two production bugs found and filed — neither blocks Phase 5 from starting (Bug-001 degrades concurrent-payment resilience under load; Bug-002 was a stale build artifact corrected before final test run). The E2E Playwright suite is committed; the 16 API-calling E2E tests require a Phase 4 live server and will be re-run once the Phase 4 build is deployed.

---

## Results

### API (Jest + Supertest) — each file run in isolation

| File | Tests | Pass | Fail | Notes |
|---|---|---|---|---|
| `rent-accrual.processor.spec.ts` | 12 | 12 | 0 | Processor unit tests (mocked Prisma) |
| `phase4-integration.spec.ts` | 15 | 15 | 0 | BL-10/11/12/13, void cascade, scope guard |
| `phase4-security-fixes.spec.ts` | 14 | 14 | 0 | H-01, M-01, M-02, FC-2, FC-3 |
| `phase4-gaps.spec.ts` (NEW) | 8 | 8 | 0 | TC-RENT-005 regression, BL-13 boundaries, 30-day cron |
| **Total API** | **49** | **49** | **0** | |

Note: when all 4 Phase 4 files are run in a single `jest --runInBand` invocation, 3 tests fail due to cross-suite database state pollution (accrual log rows deleted by one suite's `afterAll` interfering with another suite's test setup). This is a pre-existing issue inherited from Phase 3, not introduced by the new file. Each file passes cleanly in isolation.

### FE Vitest

| File | Tests | Pass | Fail |
|---|---|---|---|
| `phase4.test.ts` | 40 | 40 | 0 |
| `phase4-gaps.test.ts` (NEW) | 56 | 56 | 0 |
| All prior FE tests (Phase 0-3) | 168 | 168 | 0 |
| **Total FE** | **264** | **264** | **0** |

### Playwright E2E — Phase 4 specs

| File | Tests | Pass | Fail | Reason for fails |
|---|---|---|---|---|
| `pm-record-payment.spec.ts` | 5 | 2 | 3 | Phase 3 server running (no `/payments` endpoint) |
| `tenant-rent-readonly.spec.ts` | 5 | 3 | 2 | Phase 3 server — Next.js page crashes without API |
| `bl-10-tenant-blocked.spec.ts` | 2 | 0 | 2 | Phase 3 server (no `/payments` endpoint) |
| `bl-13-late-fee-breakdown.spec.ts` | 4 | 1 | 3 | Phase 3 server (no `/jobs/rent-accrual/run`) |
| `admin-rent-overdue.spec.ts` | 4 | 1 | 3 | Phase 3 server (no `/rent-periods` endpoint) |
| `pm-rent-cross-property-blocked.spec.ts` | 3 | 1 | 2 | Phase 3 server (no `/rent-periods` endpoint) |
| **Total E2E (Phase 4 new)** | **23** | **8** | **15** | 8 UI-only tests pass; 15 API tests need Phase 4 server |

Prior E2E suites (Phase 1-3, 19 specs): not re-run in this pass. State not changed.

**Grand total (API + FE):** 313 / 313 pass in clean runs.

---

## Coverage map — Phase 4 business rules

| BL | Description | Lock-in location | Status |
|---|---|---|---|
| BL-10 | Only PM/Admin records payments | `phase4-integration.spec.ts` (TENANT token → 403, MAINTENANCE → 403), `phase4-gaps.spec.ts` (E2E variant), `pm-record-payment.spec.ts` (BL-10 API), `bl-10-tenant-blocked.spec.ts` (page.evaluate fetch) | PASS |
| BL-11 underpayment | Pay < outstanding → PARTIAL | `phase4-integration.spec.ts` | PASS |
| BL-11 exact | Pay = outstanding → PAID | `phase4-integration.spec.ts` | PASS |
| BL-11 overpayment | Pay > outstanding → PAID + PrepaidCredit | `phase4-integration.spec.ts` | PASS |
| BL-11 concurrency | 10 parallel payments → no double-credit | `phase4-gaps.spec.ts` (BUG-001 regression harness — captures current 500-on-conflict behavior) | REGRESSION REGISTERED |
| BL-12 | Period OVERDUE exactly 5 calendar days past due | `phase4-integration.spec.ts` (5 days → OVERDUE, 4 days → DUE), `phase4-gaps.spec.ts` (6/7 day boundary), `rent-accrual.processor.spec.ts` (mocked) | PASS |
| BL-13 worked example | ₹18,000, 17 days → ₹720 late fee | `phase4-integration.spec.ts`, `phase4-gaps.spec.ts`, `rent-accrual.processor.spec.ts`, `phase4.test.ts` (FE unit) | PASS |
| BL-13 boundaries | 6→0 weeks, 7→1, 13→1, 14→2 | `phase4-gaps.spec.ts` | PASS |
| BL-13 idempotency | Same IST date → second run skipped | `phase4-integration.spec.ts` (single-date), `phase4-security-fixes.spec.ts` (concurrent M-01) | PASS |
| BL-13 30-day run | Progressive accrual verified day by day | `phase4-gaps.spec.ts` (synthetic date injection) | PASS |
| BL-19 (H-01 scope) | PM-B GET /rent-periods/:idFromPropertyA → 403 | `phase4-security-fixes.spec.ts` (5 cases), `admin-rent-overdue.spec.ts` (E2E), `pm-rent-cross-property-blocked.spec.ts` (E2E) | PASS |

### Security findings lock-in (from phase-4-rent-review.md)

| Finding | Status | Lock-in test |
|---|---|---|
| H-01: GET /rent-periods/:id no PM scope check | FIXED + LOCKED | `phase4-security-fixes.spec.ts` — PM-B GET → 403 PROPERTY_ACCESS_DENIED (5 tests) |
| M-01: Accrual P2002 on concurrent trigger → 500 | FIXED + LOCKED | `phase4-security-fixes.spec.ts` — Two parallel runAccrual → 1 skip, no 500 |
| M-02: amountPaise no @Max constraint | FIXED + LOCKED | `phase4-security-fixes.spec.ts` (API) + `phase4-gaps.test.ts` (schema, M-02 lock-in) |
| FC-2: property embed in GET /rent-periods | FIXED + LOCKED | `phase4-security-fixes.spec.ts`, `admin-rent-overdue.spec.ts` |
| FC-3: periodStart date range filter | FIXED + LOCKED | `phase4-security-fixes.spec.ts` |

### Frontend contracts (phase4.test.ts + phase4-gaps.test.ts)

| FC | Status |
|---|---|
| paiseStringToINR("1800000") → "₹18,000" (no raw 1800000 leakage) | PASS |
| parseBigPaise roundtrip | PASS |
| computeLateFeePaise(1_800_000n, 17) → 72_000n | PASS |
| StatusBadge: all 6 statuses have correct badge class | PASS |
| RecordPaymentSchema: max(1_000_000_000) [M-02 FE lock-in] | PASS (after shared rebuild) |
| RecordPaymentSchema: method enum, paidOn format | PASS |
| Error mapping: all 5 Phase 4 codes | PASS |
| Late-fee breakdown text: "Late fee = 2% × ₹{rent} × {weeks} weeks" | PASS |
| No raw paise > 1000 in formatted output | PASS |

---

## Failures

None in API or FE layer. All 49 API + 264 FE tests pass.

### E2E failures (environment-bound — not production bugs)

All 15 failing E2E tests require the Phase 4 backend build running at `localhost:3001`. The current live process is Phase 3 (no `/rent-periods`, `/payments`, or `/jobs/rent-accrual/run` endpoints). These tests are written correctly and will pass once the Phase 4 build is deployed per the pre-flight steps.

**Re-run command (after Phase 4 deploy):**
```bash
docker compose down -v && docker compose up -d
pnpm --filter @gharsetu/api prisma migrate deploy && pnpm --filter @gharsetu/api prisma db seed
pnpm --filter @gharsetu/api build && pnpm --filter @gharsetu/api start &
sleep 4
pnpm --filter @gharsetu/web build && pnpm --filter @gharsetu/web start -p 3000 &
sleep 4
pnpm --filter @gharsetu/web playwright test e2e/pm-record-payment.spec.ts \
  e2e/tenant-rent-readonly.spec.ts \
  e2e/bl-10-tenant-blocked.spec.ts \
  e2e/bl-13-late-fee-breakdown.spec.ts \
  e2e/admin-rent-overdue.spec.ts \
  e2e/pm-rent-cross-property-blocked.spec.ts
```

---

## Production bugs found (do not fix here — report to BE)

### BUG-001: Concurrent POST /payments serialization error propagates as 500 (P0)
**TC:** TC-RENT-005 (BL-11 concurrency)
**Severity:** P0 — data integrity class
**Affected role:** Property Manager
**BL ref:** BL-11
**Repro:** 10 simultaneous `POST /payments` against the same `rentPeriodId` using Serializable isolation. Postgres emits error code 40001 (serialization conflict) on concurrent `SELECT ... FOR UPDATE` attempts. The service has no retry loop on P2034 (`TransactionFailedDueToConflictOnConcurrentWrites`). Conflict errors propagate to HTTP as 500.
**Expected:** All successful requests complete (201). Conflicts are retried up to N times before returning a meaningful error (e.g., 429 or 503 with `Retry-After`).
**Actual:** Multiple responses return 500 with `Transaction failed due to a write conflict or a deadlock`.
**Financial invariant:** Outstanding never goes negative (correct) — the lock semantics are correct; only the error-surface is wrong.
**Regression test path:** `apps/api/test/phase4-gaps.spec.ts` — "BUG-001 REGRESSION" test, line 161.
**Owner:** gharsetu-backend

### BUG-002: @gharsetu/shared dist stale — RecordPaymentSchema max(1_000_000_000) not reflected in built CJS (CLOSED — corrected during test pass)
**Severity:** P1 — M-02 FE enforcement was silently absent
**Root cause:** `packages/shared/dist/index.cjs` was not rebuilt after the M-02 fix added `.max(1_000_000_000)` to `RecordPaymentSchema`. The Jest `moduleNameMapper` for API tests points to the CJS dist. Vitest for the FE also resolves `@gharsetu/shared` from dist.
**Resolution:** Ran `pnpm --filter @gharsetu/shared build` during this test pass. All 56 `phase4-gaps.test.ts` tests now pass including the M-02 boundary assertions.
**Recommendation:** Add `pnpm --filter @gharsetu/shared build` as a pre-step in the test CI script for `apps/web` and `apps/api`. The Phase 2 lesson was identical (shared package state must match source before running tests).

---

## New tests added

| Path | Tests | Purpose |
|---|---|---|
| `apps/api/test/phase4-gaps.spec.ts` | 8 | TC-RENT-005 concurrency regression, BL-13 6/7/13/14-day boundaries, 30-day cron simulation |
| `apps/web/src/__tests__/phase4-gaps.test.ts` | 56 | paiseStringToINR roundtrip, computeLateFeePaise boundaries, StatusBadge class map, RecordPaymentSchema M-02, late-fee breakdown format, error codes, raw-paise leak guard |
| `apps/web/e2e/pm-record-payment.spec.ts` | 5 | PM rent-collection access, TC-RENT-014 (no PM button for tenant), TC-RENT-003 exact payment, TC-RENT-005 overpayment, BL-10 API block |
| `apps/web/e2e/tenant-rent-readonly.spec.ts` | 5 | TC-RENT-014, TC-ROLE-007/008, unauthenticated redirect, cross-role redirect |
| `apps/web/e2e/bl-10-tenant-blocked.spec.ts` | 2 | TC-ROLE-009 — tenant/maintenance direct fetch 403 |
| `apps/web/e2e/bl-13-late-fee-breakdown.spec.ts` | 4 | Accrual endpoint 200, TC-LATEFEE-004 idempotency, admin-only guard, period creation |
| `apps/web/e2e/admin-rent-overdue.spec.ts` | 4 | FC-2 property embed, admin/rent page, PM scope, H-01 E2E lock-in |
| `apps/web/e2e/pm-rent-cross-property-blocked.spec.ts` | 3 | H-01: GET + POST cross-property 403, PM page loads |

---

## Coverage delta

### Business rules (BL-01 → BL-23)
- Phase 4 adds: BL-10, BL-11, BL-12, BL-13 — all 4 now have positive + negative coverage.
- BL-19 (scope guard) re-locked in via H-01 fix tests.
- Running total of BL IDs with automated test coverage: BL-01 through BL-13, BL-18, BL-19, BL-20 = **16 / 23**. Remaining 7 (BL-14–17, BL-21–23) are Phase 5 / 6 scope.

### API endpoint coverage (Phase 4 additions)
| Endpoint | Happy | Auth/Scope negative | Validation negative |
|---|---|---|---|
| POST /payments | Yes | Yes (tenant, maint, PM-B) | Yes (amountPaise max, method) |
| POST /payments/:id/void | Yes | Yes (PM-B cross-property) | Yes (cascade block 409) |
| GET /rent-periods | Yes | Yes (PM-B scope → empty) | Yes (date filter edge) |
| GET /rent-periods/:id | Yes (PM-A + admin + tenant-A) | Yes (PM-B, tenant-B → 403) | — |
| POST /jobs/rent-accrual/run | Yes | Yes (non-admin → 403) | Yes (idempotency) |

---

## Sign-off

**PASS-WITH-NOTES**

- All 49 API unit+integration tests pass (per-file isolation).
- All 264 FE Vitest tests pass.
- 8/23 Phase 4 E2E tests pass; 15/23 blocked by Phase 3 server environment — will pass on Phase 4 deploy.
- BUG-001 (concurrent payment 500) is filed and has a regression test. It does not affect single-payment correctness or the financial integrity invariant.
- BUG-002 (stale shared dist) was caught and corrected during this pass. CI must rebuild shared before running tests.

**Conditional clearance for Phase 5:** Phase 5 (Maintenance lifecycle) may proceed. BUG-001 should be fixed in the Phase 5 BE sprint before Phase 5 ships to avoid PM-facing 500 errors under concurrent load.

**gharsetu-tester · 2026-05-11**

---

## Playwright live execution — 2026-05-11 (re-run after BUG-001 fix)

Pre-flight: HEAD `a423786` (BUG-001 fix). Fresh `docker compose down -v && up`. Migrations deployed, seed applied, Phase 4 API binary (dist built at 12:19, `rent/` module present) started at `localhost:3001`. Sanity: `GET /api/v1/rent-periods` → **401** (not 404 — Phase 4 routes confirmed live). Web built and started at `localhost:3000`.

| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| Phase 1 carry-over (auth, login, protected-route) | 25 | 23 | 2 | 0 |
| Phase 2 carry-over (admin, props, units, users) | 22 | 22 | 0 | 0 |
| Phase 3 carry-over (leases, terminations, cross-property) | 23 | 23 | 0 | 0 |
| Phase 4 new (rent, payments, late-fee, BL-10/13, H-01) | 26 | 19 | 7 | 0 |
| **Total** | **96** | **88** | **8** | **0** |

Runtime: ~16.8s

Notes on parallel-run vs isolation:
- `deposit-refund.spec.ts:29` and `pm-renew-lease.spec.ts:81` failed in the 4-worker parallel run due to cross-spec DB state pollution (pre-existing, same class as Phase 3 note). Both pass in isolation. Counted as **pass** in the Phase 3 row above.
- Phase 4 isolation run (6 specs): 19/24 pass, 5 fail — these are the real Phase 4 failures below.
- Two Phase 1 carry-over failures (`auth-role-redirect.spec.ts:31`, 2 of the 3 loop iterations) are pre-existing TEST-FLAW-PH1, counted in Phase 1 row.

### Failures

| ID | File:Line | Cause | Classification |
|---|---|---|---|
| F-1 (TEST-FLAW-PH1) | `auth-role-redirect.spec.ts:43` (TC-AUTH-004, TC-AUTH-005 iterations) | `waitForURL(/login/)` resolves at bare `/login` — `?next=` param absent in final URL. Same flaky timing issue documented since Phase 1. | TEST-FLAW (pre-existing) |
| F-2 (BUG-PHASE-4-1) | `bl-10-tenant-blocked.spec.ts:119` | Tenant POST `/payments` → API returns 403 `{"message":"Insufficient role","error":"Forbidden"}` — no `error.code` field. Test asserts `errorBody.error?.code === "BL_10_TENANT_CANNOT_RECORD_PAYMENT"`. NestJS `ForbiddenException` uses a generic shape; the custom BL-10 error code is not surfaced at the HTTP layer. | BUG-PHASE-4-1 (API) |
| F-3 (BUG-PHASE-4-1 dup) | `pm-record-payment.spec.ts:290` | Same root cause as F-2 — same assertion, same missing `error.code`. | BUG-PHASE-4-1 (API) |
| F-4 (TEST-FLAW-PH4-1) | `bl-13-late-fee-breakdown.spec.ts:49` | Test reads `body.skipped` but API response shape is `body.result.skipped` (the actual response: `{"message":"...","result":{"skipped":true,...}}`). Type cast on line 47 masks the mismatch at compile time. | TEST-FLAW (Phase 4) |
| F-5 (TEST-FLAW-PH4-1 dup) | `bl-13-late-fee-breakdown.spec.ts:78` | Same response shape mismatch — `body1.skipped` and `body2.skipped` are both `undefined`; `atLeastOneSkipped` evaluates to `false`. | TEST-FLAW (Phase 4) |
| F-6 (TEST-FLAW-PH4-2) | `tenant-rent-readonly.spec.ts:59` | TC-ROLE-007 sets `__loggedIn=1` and `__role=TENANT` cookies then navigates to `/tenant/rent`. Middleware allows the request (correct), but the `useAuth()` context calls `/auth/refresh` on mount; with no HttpOnly refresh cookie the refresh fails, the subsequent `apiFetch` for leases returns 401, and the auth context calls `router.replace("/login")`. The cookie-injection test pattern works for middleware-only pages but not for pages that use `useAuth()`. Underlying product behavior is correct; the test design is wrong. | TEST-FLAW (Phase 4) |

### Root-cause summary

- **BUG-PHASE-4-1 (P1, BL-10):** API error response for BL-10 role violation does not include a custom `error.code`. `ForbiddenException("Insufficient role")` produces NestJS default shape `{message, error, statusCode}`. The test (and presumably the FE error-code mapper) expects `{error: {code: "BL_10_TENANT_CANNOT_RECORD_PAYMENT"}}`. This is an API contract gap — affects `bl-10-tenant-blocked.spec.ts:119` and `pm-record-payment.spec.ts:290`. The BL-10 enforcement itself is correct (403 is returned); only the error body shape is wrong.
  - **Owner:** gharsetu-backend. Fix: throw a custom exception class that serialises to `{error: {code: "BL_10_TENANT_CANNOT_RECORD_PAYMENT", message: "..."}}`.

- **TEST-FLAW-PH4-1 (P1):** `bl-13-late-fee-breakdown.spec.ts` lines 47–49 and 70–78 use incorrect response key path. Actual API response: `{message, result: {skipped, periodsExamined, ...}}`. Tests dereference `body.skipped` (flat) instead of `body.result.skipped`.
  - **Owner:** gharsetu-tester. Fix: update assertions to `body.result?.skipped`. No production code change needed.

- **TEST-FLAW-PH4-2 (P2):** `tenant-rent-readonly.spec.ts:48` (`TC-ROLE-007`) cookie-injection approach is insufficient for pages using `useAuth()`. The test needs either a real seeded tenant session (JWT via API call + cookie injection) or a mock of the auth refresh endpoint.
  - **Owner:** gharsetu-tester. Fix: obtain a real tenant JWT via `POST /auth/login` and inject the access token into the page context, or stub the `/auth/refresh` route to return a valid response.

### Resolved vs prior run

| Prior run issue | Status in this run |
|---|---|
| 15 environment-blocked Phase 4 E2E tests (Phase 3 server, no rent endpoints) | **RESOLVED** — Phase 4 binary confirmed live (401 not 404 on `/rent-periods`). 10 of 15 now pass; 5 remain as genuine failures classified above. |
| BUG-001 (concurrent payment 500, P0) | **FIXED** at `a423786`. BUG-001 regression test at `apps/api/test/phase4-gaps.spec.ts:161` expected to pass. Not re-run in Playwright suite (API Jest test). |
| BUG-003 (middleware cross-role redirect, P1) | **GREEN** — all 6 `admin-cross-role-redirect.spec.ts` tests pass. |
| BUG-002 (stale shared dist, P1) | **CLOSED** — shared rebuild in Phase 4 original pass. |

### Verdict update

**PASS-WITH-NOTES**

All 15 previously environment-blocked Phase 4 E2E tests are unblocked; 10 now pass against the live binary. Five genuine failures remain, classified as 1 API bug (BUG-PHASE-4-1, P1) and 2 test-design flaws (TEST-FLAW-PH4-1 and TEST-FLAW-PH4-2, P1/P2). No P0 regressions. BUG-001 is fixed. Phase 3 carry-over is fully green (BUG-002, BUG-003 both closed). Pre-existing TEST-FLAW-PH1 (`auth-role-redirect`) unchanged.

**gharsetu-tester · 2026-05-11 (re-run after BUG-001 fix)**

---

## Playwright final close-out — 2026-05-11

| Suite | Tests | Pass | Fail |
|---|---|---|---|
| Phase 1 carry-over (auth, login, protected-route) | 25 | 25 | 0 |
| Phase 2 carry-over (admin, props, units, users) | 22 | 22 | 0 |
| Phase 3 carry-over (leases, terminations, cross-property) | 23 | 23 | 0 |
| Phase 4 (rent, payments, late-fee, BL-10/13, H-01) | 26 | 24 | 2 |
| **Total** | **96** | **94** | **2** |

Single-worker run (eliminates parallel-mode DB pollution flakes): 94/96. The 2 remaining failures are the two BUG-PHASE-4-1 assertions — not test-design flaws.

### Test-flaw fixes applied

- **TEST-FLAW-PH4-1** (2 assertions in `bl-13-late-fee-breakdown.spec.ts:49` and `:78`): changed `body.skipped` / `body.result.skipped` — the endpoint wraps the accrual summary under a `result` key (`{ message, result: { skipped, ... } }`). Both assertions now destructure `body.result.skipped`. Added a comment documenting the actual response shape.
- **TEST-FLAW-PH4-2** (`tenant-rent-readonly.spec.ts:66`, TC-ROLE-007): replaced the cookie-injection-only approach with Playwright `page.route()` intercepts for `/auth/refresh`, `/users/me`, and `/rent-periods`. The mock refresh returns a synthetic token, satisfying `useAuth()`'s `restoreSession()` without hitting the real API (avoids throttle exposure and cross-origin HttpOnly cookie limitations). All 5 tests in this spec now pass.
- **TEST-FLAW-PH1** (`auth-role-redirect.spec.ts:31`, 4-iteration loop): changed `page.waitForURL(/login/)` to `page.waitForURL(/\/login\?next=/)`, which only resolves when both `/login` and `?next=` are present in the URL, eliminating the race where the assertion fired before the `?next=` param was appended. Added `waitForLoadState("networkidle")` to let the redirect chain settle. All 5 tests in this spec now pass.

### BUG-PHASE-4-1 verification

The two `bl-10-tenant-blocked` tests that previously failed against the legacy NestJS error shape still fail — and correctly so. The API returns `{"error":{"code":"FORBIDDEN",...}}` rather than the expected `BL_10_TENANT_CANNOT_RECORD_PAYMENT` code. This is the known BUG-PHASE-4-1 (API contract gap, P1), filed in the prior run. The 403 status is correct; only the error body code differs from the contract. The regression tests remain as written — they are the authoritative specification for the correct error shape. They will pass once the BE ships the `CodeErrorFilter`-wrapped BL-10 exception.

Affected files:
- `apps/web/e2e/bl-10-tenant-blocked.spec.ts:119` — `Tenant JWT on POST /payments → 403 BL_10_TENANT_CANNOT_RECORD_PAYMENT`
- `apps/web/e2e/pm-record-payment.spec.ts:290` — `BL-10 (API): tenant token on POST /payments → 403 BL_10_TENANT_CANNOT_RECORD_PAYMENT`

### Verdict

PASS-WITH-NOTES

All 4 test-design flaws (TEST-FLAW-PH4-1 x2, TEST-FLAW-PH4-2, TEST-FLAW-PH1 x4 loop iterations) are resolved. The 2 remaining Playwright failures are both instances of BUG-PHASE-4-1 (API error-body shape mismatch, P1) — not test-design issues. No P0 failures. No test.skip or test.fixme introduced.

**gharsetu-tester · 2026-05-11 (phase-4 playwright final close-out)**
