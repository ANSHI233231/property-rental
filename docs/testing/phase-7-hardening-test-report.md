# GharSetu — Phase 7 Hardening + Reporting Test Report
**Date:** 2026-05-11
**Sign-off:** PASS-WITH-NOTES

---

## 1. Summary

Phase 7 acceptance testing complete. All P0 gates pass. One P1 production bug found (BUG-BL22-001) with regression tests written. The live Playwright stack was unavailable (no running servers) so E2E and a11y tests were assessed from source rather than live execution. Full serial API and Vitest runs are clean (excluding intentional regression failures).

---

## 2. Test Counts

| Suite | Total | Pass | Fail | Notes |
|---|---|---|---|---|
| API Jest (serial) | 434 | 432 | 2 | 2 intentional regression tests for BUG-BL22-001 |
| Web Vitest | 519 | 515 | 4 | 4 intentional regression tests for BUG-BL22-001 |
| Playwright E2E | N/A | N/A | N/A | Servers not running; source-level reviewed |
| **Total** | **953** | **947** | **6** | All 6 failures are intentional regression tests |

**Note:** API tests must be run with `--runInBand` (serial). Parallel execution causes DB state collisions between integration test suites — this is a pre-existing test isolation issue, not a new failure.

---

## 3. 23-BL Traceability Matrix

Full matrix: `/docs/testing/bl-traceability-matrix.md`

**Headline: 22/23 BLs locked in by passing tests. BL-22 has a partial gap (BUG-BL22-001).**

| BL | Status |
|---|---|
| BL-01 through BL-21 | Green — all covered by passing integration tests |
| BL-22 (IST display) | Partial — non-midnight samples pass; midnight samples expose BUG-BL22-001 |
| BL-23 (DD/MM/YYYY) | Green — all date-only and non-midnight datetime samples pass |

---

## 4. Phase 7 Hardening Verification

All items from the Phase 7 spec verified against `test/phase7-hardening.spec.ts`:

| Item | Test | Status |
|---|---|---|
| Helmet headers (X-Content-Type-Options, Referrer-Policy, CSP, no X-Powered-By) | `phase7-hardening.spec.ts` §1 | PASS |
| JSON body cap 100KB → 413 | `phase7-hardening.spec.ts` §2 | PASS |
| `forbidNonWhitelisted: true` → 400 on unknown fields | `phase7-hardening.spec.ts` §3 | PASS |
| `GET /audit-log` ADMIN-only (TENANT/PM/MAINTENANCE → 403, unauth → 401) | `phase7-hardening.spec.ts` §4 | PASS |
| `auth.login.success` audit row on login | `phase7-hardening.spec.ts` §5 | PASS |
| `auth.login.failure` row — no password in after snapshot | `phase7-hardening.spec.ts` §5 | PASS |
| `auth.login.failure` for unknown email has `actor_id = null` | `phase7-hardening.spec.ts` §5 | PASS |
| Audit log `action` prefix filter | `phase7-hardening.spec.ts` §6 | PASS |
| Audit log sensitive-key redaction `[REDACTED]` | `phase7-hardening.spec.ts` §6 | PASS |
| BL-03 Serializable tx — OCCUPIED unit rent update → 409 UNIT_RENT_LOCKED | `phase7-hardening.spec.ts` §7 | PASS |
| Throttler rate limits registered (login 10/min, auth-slow 5/h, change-pwd 5/min) | `src/auth/security.spec.ts` H-01 | PASS |
| Raw reset token not logged in production (H-02) | `src/auth/security.spec.ts` H-02 | PASS |
| Idempotency-Key header sent on payment submit | `src/__tests__/phase7.test.ts` §8 | PASS (source check) |
| Pino PII redaction in AppModule | `apps/api/src/app.module.ts` | PASS (source review) |

---

## 5. A11y Assessment

Live Playwright a11y run was not executable (servers not running). Source-level assessment:

- `e2e/a11y.spec.ts` covers: `/login` (3 viewports: 320px/768px/1440px), tenant 4 pages, maintenance 3 pages.
- axe tags: `wcag2a`, `wcag2aa`, `wcag21aa`.
- Structural checks: skip-to-main confirmed on admin audit-log page (inherits admin layout).
- Audit log table has `caption`, `scope="col"` on all headers, `htmlFor` on filter labels — verified via `src/__tests__/phase7.test.ts`.
- Admin TAB_ITEMS ≤ 5 items — audit-log correctly in sidebar only, not mobile tab bar.

**Live a11y counts:** Not obtainable without running stack. Deferred to Phase 8 with full VAPT stack.

---

## 6. New Regression Tests Added

| File | Description | BL |
|---|---|---|
| `apps/api/test/bl22-bl23-audit-ist.spec.ts` | 19 tests: audit_log per mutation, UTC timestamp round-trip, BL-06 LISTED rent propagation, IST boundary samples | BL-06, BL-22, BL-23 |
| `apps/web/src/__tests__/bl22-bl23-locale-lockins.test.ts` | 27 tests: formatDateIST/formatDateOnlyIST boundaries, no-DST, no-ISO-leak, todayIST | BL-22, BL-23 |
| `apps/api/tsconfig.test.json` | Test tsconfig with Jest types — resolves IDE language-server diagnostic on test/ files | — |

---

## 7. Production Bugs Found

### BUG-BL22-001 (P1) — formatDateIST renders midnight as "24:00" not "00:00"

- **Severity:** P1 — affects display of all timestamps that fall exactly at IST midnight (00:00 IST)
- **Affected role:** All roles viewing audit logs, maintenance timestamps, rent period due dates
- **BL ref:** BL-22 (IST display contract)
- **Root cause:** `Intl.DateTimeFormat` with `hour12: false` + `en-IN` locale on Node 20 returns `"24"` for midnight hour, not `"0"` or `"00"`. The `formatDateIST` function in `apps/web/src/lib/locale/index.ts` uses the raw `hour` part without normalizing `"24"` → `"00"`.
- **Repro:** `formatDateIST("2026-05-10T18:30:00.000Z")` → `"11/05/2026 24:00"` (should be `"11/05/2026 00:00"`)
- **Failing regression tests:**
  - `apps/web/src/__tests__/bl22-bl23-locale-lockins.test.ts`: TC-BL22-WEB-001/003/004/006
  - `apps/api/test/bl22-bl23-audit-ist.spec.ts`: TC-BL23-001/004
- **Fix direction (for FE):** In `formatDateIST`, normalize the hour part: `const normalHour = get("hour") === "24" ? "00" : get("hour");`
- **Status:** Open. Do NOT fix in this PR. Hand to `gharsetu-frontend`.

---

## 8. Sign-off

**PASS-WITH-NOTES**

- All P0 tests pass (100%).
- One P1 bug found (BUG-BL22-001) — regression tests written, awaiting FE fix.
- API test parallelism issue (pre-existing) — tests must be run `--runInBand`; not a new failure.
- E2E / a11y live run deferred — no running stack. Confirmed from source. Must be run with live stack before Phase 8 VAPT.

**Clear to proceed to Phase 8 (VAPT):** Yes, with conditions:
1. BUG-BL22-001 must be fixed and the 6 regression tests turned green before any production release.
2. Live Playwright a11y run must be executed against the seeded stack before the Phase 8 security sign-off.
3. API integration tests must be run with `--runInBand` in CI to prevent DB state collisions (add `--runInBand` to the CI Jest step).
