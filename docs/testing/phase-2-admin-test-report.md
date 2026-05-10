# Phase 2 — Admin CRUD Test Report
**Date:** 2026-05-10
**Branch:** main (HEAD: e35fb62)
**Tester:** gharsetu-tester (Claude Sonnet 4.6)
**Scope:** TC-PROP-*, TC-UNIT-*, TC-USER-*, TC-AUDIT-*, Phase 2 security checks, BUG-003 regression anchor

---

## Summary

| Layer | Tests | Pass | Fail | Notes |
|-------|-------|------|------|-------|
| API unit (Jest, pre-existing) | 29 | 29 | 0 | Unchanged from Phase 1 |
| API integration / Supertest — Phase 1 (pre-existing) | 32 | 32 | 0 | Unchanged |
| API integration / Supertest — Phase 2 original | 42 | 42 | 0 | phase2-integration.spec.ts |
| API integration / Supertest — Phase 2 gaps (new) | 24 | 24 | 0 | phase2-gaps.spec.ts |
| **API total** | **127** | **127** | **0** | |
| FE Vitest — Phase 1 (pre-existing) | 35 | 35 | 0 | |
| FE Vitest — Phase 2 original | 23 | 23 | 0 | phase2.test.ts |
| FE Vitest — Phase 2 gaps (new) | 29 | 29 | 0 | phase2-gaps.test.ts |
| **FE Vitest total** | **87** | **87** | **0** | |
| Playwright E2E — Phase 1 (pre-existing) | 24 | 8 | 16 | Pre-existing BUG-001/002 failures |
| Playwright E2E — Phase 2 (new) | 25 | 21 | 4 | 4 intentional BUG-003 regression anchors |
| **Playwright total** | **49** | **29** | **20** | 16 pre-existing + 4 intentional |
| **Grand total** | **263** | **243** | **20** | |

**Runtime:** API ~10s, FE Vitest ~520ms, Playwright ~1.1min

---

## API Integration Test Results — Phase 2 Gap Coverage

File: `apps/api/test/phase2-gaps.spec.ts`

| TC ID | Description | Result | BL Ref |
|-------|-------------|--------|--------|
| TC-PROP-001 | property.create audit row has action='property.create', before=null, after populated | PASS | BL-20 |
| TC-PROP-002 | PM token 403 on POST /properties | PASS | BL-19 |
| TC-PROP-002 | PM token 403 on PATCH /properties/:id | PASS | BL-19 |
| TC-PROP-002 | PM token 403 on DELETE /properties/:id | PASS | BL-19 |
| TC-PROP-002 | PM token 403 on POST /properties/:id/transfer-pm | PASS | BL-19 |
| TC-PROP-004 | Soft-deleted property hidden from GET (404 on GET by ID, deleted_at set) | PASS | — |
| TC-USER-001 | GET /users/:id after create does NOT expose temp_password | PASS | — |
| TC-USER-002 | PM 403 on POST /users | PASS | — |
| TC-USER-002 | PM 403 on PATCH /users/:id | PASS | — |
| TC-USER-002 | PM 403 on POST /users/:id/deactivate | PASS | — |
| TC-USER-002 | PM 403 on POST /users/:id/activate | PASS | — |
| TC-USER-003 | PATCH { is_active: false } on sole Admin → 409 LAST_ADMIN_PROTECTED (H-01) | PASS | — |
| TC-USER-004 | PATCH { role: MAINTENANCE } on sole Admin → 409 LAST_ADMIN_PROTECTED | PASS | — |
| TC-USER-005 | PM deactivate while assigned → 409 PM_HAS_PROPERTY; after transfer → 200 | PASS | BL-19 |
| TC-USER-006 | DELETE /users/:id → 405 | PASS | — |
| TC-AUDIT-001 | Nonexistent property PATCH leaves no stray audit entry (rollback) | PASS | — |
| TC-AUDIT-001 | Successful create → exactly one audit entry for that entity_id | PASS | — |
| TC-AUDIT-001 | Two PATCHes → two audit.update rows | PASS | — |
| TC-AUDIT-002 | User create audit log has no password_hash in before/after | PASS | — |
| TC-AUDIT-002 | User deactivate audit log has no password_hash | PASS | — |
| Mass-assign | PATCH /users/:id with is_admin:true — field not persisted, role unchanged | PASS | — |
| Mass-assign | PATCH /users/:id with role_raw — field not persisted | PASS | — |
| Concurrent | Two parallel transfer-pm for same PM → one 200, one 409 PM_ALREADY_ASSIGNED (not 500) | PASS | BL-19 |

---

## FE Vitest Gap Coverage

File: `apps/web/src/__tests__/phase2-gaps.test.ts`

| Category | Tests | Result |
|----------|-------|--------|
| DataTable logic (empty state, load more, row click, column render) | 8 | PASS |
| Cross-role middleware logic (homeForRole, redirect decision) | 10 | PASS |
| formatINR shape assertions (Indian grouping, TC-VIS-002) | 5 | PASS |
| mapApiErrorCode completeness (5 codes + fallback) | 6 | PASS |

---

## Playwright E2E — Phase 2 Results

Files: `apps/web/e2e/admin-*.spec.ts`

| Test | Result | Notes |
|------|--------|-------|
| Unauthenticated /admin/* → /login redirect | PASS (×5) | Middleware works |
| ADMIN cookie on /admin/dashboard → 200 | PASS (×5) | |
| BUG-003 REGRESSION: PM visiting /admin/dashboard should redirect | FAIL (intentional) | See BUG-003 below |
| BUG-003 REGRESSION: Tenant visiting /admin/dashboard should redirect | FAIL (intentional) | |
| BUG-003 REGRESSION: Admin visiting /pm/dashboard should redirect | FAIL (intentional) | |
| BUG-003 REGRESSION: Maintenance visiting /admin/dashboard should redirect | FAIL (intentional) | |
| TC-PROP-003/BL-19 traceability anchor | PASS | |
| TC-UI-001 traceability anchor | PASS | |
| TC-USER-001..002 traceability anchors | PASS | |
| TC-USER-003/004 traceability anchor | PASS | |
| TC-UNIT-002/BL-03 traceability anchor | PASS | |

---

## Pre-existing Playwright Failures (not introduced by Phase 2)

All 16 pre-existing failures are in Phase 1 specs. Root cause confirmed by replaying against unmodified `main` before any Phase 2 test additions.

**BUG-002 (pre-existing):** Login page (`/login`) renders `<div class="auth-card">Loading…</div>` in server HTML. The form is a client-side React component that renders after hydration. Phase 1 E2E tests wait for `form.auth-card` which never appears in the initial HTML. Affects: `auth-login-happy-path.spec.ts` (6 tests), `auth-login-invalid.spec.ts` (4 tests), `auth-role-redirect.spec.ts` (5 tests), `auth-protected-route.spec.ts` (1 test).

**BUG-001 (pre-existing):** CORS not configured on API — browser-initiated login from localhost:3000 to localhost:3001 fails at preflight. Documented in phase-1-auth-test-report.md.

---

## Business Rule Coverage — Phase 2

| BL | Rule | Test(s) covering | Status |
|----|------|-----------------|--------|
| BL-03 | Rent edit blocked when OCCUPIED/MAINTENANCE | phase2-integration.spec.ts "BL-03: rent lock" (3 tests) | COVERED |
| BL-05 | Retirement one-way | phase2-integration.spec.ts BL-05 block (4 tests) + DB trigger test | COVERED |
| BL-19 | One PM = one property | phase2-integration.spec.ts + phase2-gaps.spec.ts TC-PROP-002 + concurrent race | COVERED |
| BL-20 | Audit log on every mutation | phase2-integration.spec.ts + phase2-gaps.spec.ts TC-AUDIT-001/002 | COVERED |
| BL-22 | Timestamps UTC stored | AuditService code review (I-07) confirmed UTC; audit write confirmed in transaction | COVERED |

---

## Production Bugs Found

### BUG-003 — P1 — Middleware cross-role redirect via __role cookie does NOT fire

**Severity:** P1 (security UX gap — wrong role can access wrong dashboard layout)
**Affected role:** All (PM/Tenant/Maintenance visiting /admin/*; Admin visiting /pm/*)
**Business rule ref:** None (infrastructure / UX)
**Repro:**
```
curl -sv -H "Cookie: __loggedIn=1; __role=PROPERTY_MANAGER" http://localhost:3000/admin/dashboard
# Expected: HTTP/1.1 307 Temporary Redirect → /pm/dashboard
# Actual:   HTTP/1.1 200 OK
```
**Expected:** Middleware at `apps/web/src/middleware.ts` line 60 checks `roleCookie !== matched.role` and redirects. The `__loggedIn` guard (line 49) works correctly. The cross-role redirect branch does NOT fire.
**Actual:** 200 OK — the wrong-role user sees the admin layout shell (client-side auth guard redirects client-side after hydration, but the initial server response is unguarded).
**Impact:** A logged-in PM navigating to `/admin/dashboard` sees the admin HTML until client hydration. The API enforces RBAC so no data leakage occurs, but the UX is incorrect and the Phase 1 gap (PHASE-1-GAP documented in auth-cross-role.spec.ts) is NOT resolved as intended.
**Failing test:** `apps/web/e2e/admin-cross-role-redirect.spec.ts` — all 4 BUG-003 REGRESSION tests.
**Note:** This is not introduced by Phase 2 test work — it is an existing code issue exposed by new test coverage.

---

## Security Checks Locked In

| Check | Result | Evidence |
|-------|--------|----------|
| H-01: PATCH { is_active: false } on last Admin → 409 | PASS | phase2-gaps.spec.ts TC-USER-003 |
| H-01: role demotion on last Admin → 409 | PASS | phase2-gaps.spec.ts TC-USER-004 |
| H-01: two-admin deactivate-one-then-block | PASS | phase2-integration.spec.ts H-01 two-admin test |
| M-02: concurrent PM assignment → 409 not 500 | PASS | phase2-gaps.spec.ts concurrent race test |
| Audit before/after: no password_hash | PASS | phase2-gaps.spec.ts TC-AUDIT-002 |
| Mass-assignment: unknown fields stripped | PASS | phase2-gaps.spec.ts mass-assign tests |
| PM role guard on all property/user write endpoints | PASS | phase2-gaps.spec.ts TC-PROP-002/USER-002 |

---

## Coverage Delta

**New API integration tests added:** 24 (file: `apps/api/test/phase2-gaps.spec.ts`)
**New FE Vitest tests added:** 29 (file: `apps/web/src/__tests__/phase2-gaps.test.ts`)
**New Playwright tests added:** 25 (6 files: `apps/web/e2e/admin-*.spec.ts`)
**Total new:** 78 tests

**Business rules with 100% pass rate (Phase 2 scope):** BL-03, BL-05, BL-19, BL-20, BL-22

---

## Sign-off

**PASS-WITH-NOTES**

All 127 API integration tests pass (zero failures). All 87 FE Vitest tests pass (zero failures). The 4 intentional BUG-003 Playwright regression tests fail by design — they are the regression anchor that will turn green when FE fixes the middleware cross-role redirect. The 16 pre-existing Phase 1 Playwright failures are unchanged.

**Single most important fix before Phase 3:**

**BUG-003 (P1):** The Next.js Edge Middleware cross-role redirect (`__role` cookie check) does not fire — a PM navigating to `/admin/dashboard` receives a 200 at the server level. This was documented as PHASE-1-GAP and was supposed to be closed in Phase 2 via `(app)/layout.tsx` client-side role guard, but the server-side middleware path is still not working. Phase 3 PM-scoped endpoints will use the same middleware — if the guard cannot redirect at the middleware level, PM users can potentially observe admin HTML shells before client-side redirect. This must be fixed or explicitly accepted as "client-side guard is sufficient" before Phase 3 work begins.

**gharsetu-tester · 2026-05-10**
