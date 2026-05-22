# Phase 3 — Tenants + Leases + Co-tenant Flows · Test Report

**Tester:** gharsetu-tester (initial run crashed on transport error during Playwright execution; coverage authored and lock-ins validated via API + FE Vitest)
**Date:** 2026-05-11
**Scope:** TC-LEASE-001..009, TC-TERM-001..006, TC-REFUND-001..002, cross-property scope regression, H-01 / H-02 / H-03 security lock-ins, BL-01 / BL-02 / BL-04 / BL-07 / BL-08 / BL-09 / BL-18.

## Headline numbers

| Layer | Count | Pass | Fail | Notes |
|---|---|---|---|---|
| API (Jest + Supertest) | 176 | 176 | 0 | 153 prior + 23 new in `phase3-gaps.spec.ts` |
| FE (Vitest) | 168 | 168 | 0 | 119 prior + 49 new in `phase3-gaps.test.ts` |
| Playwright | 8 specs | — | — | Specs committed; live execution deferred (see note below) |

Total static + unit + integration: **344 pass / 344 total**.

## Coverage map (Phase 3 only)

### Business-rule lock-ins
| BL | Description | Lock-in location | Status |
|---|---|---|---|
| BL-01 | Only one ACTIVE lease per unit (DB-level partial unique) | `apps/api/test/phase3-gaps.spec.ts` — DB regression case bypasses the service and asserts P2002 | PASS |
| BL-01 | Same constraint, service-layer + race | `apps/api/test/phase3-integration.spec.ts` | PASS |
| BL-02 | Rent / deposit on lease immutable | `apps/api/test/phase3-gaps.spec.ts` — `prisma.lease.update` raises | PASS |
| BL-04 | Active lease ⇔ unit.state = OCCUPIED | `apps/api/test/phase3-integration.spec.ts` | PASS |
| BL-07 | Lease needs ≥1 tenant | `phase3-gaps.spec.ts` — empty tenants → 400 `LEASE_NEEDS_TENANT` | PASS |
| BL-08 | All co-tenants must approve termination before finalize | `phase3-integration.spec.ts` + `phase3-gaps.spec.ts` (TC-TERM-002/003) | PASS |
| BL-09 | Requester can withdraw; rejected approval blocks finalize | `phase3-gaps.spec.ts` TC-TERM-003/004 | PASS |
| BL-18 | 24-hour turnover gap between tenants on a unit | `phase3-gaps.spec.ts` TC-TERM-006 (clock injection) | PASS |

### Security findings (Phase 3 review at `4f58062`) — verification
| ID | Title | Lock-in test | Status |
|---|---|---|---|
| H-01 | Tenant impersonation on terminate-{request,approve,withdraw} | `phase3-security-fixes.spec.ts` — 5 cases | CLOSED |
| H-02 | Deposit-refund missing PropertyScopeBody guard | `phase3-security-fixes.spec.ts` — 3 cases | CLOSED |
| H-03 | `file-type@<21.3.2` HIGH DoS CVEs | `pnpm why file-type` → 22.0.1; audit no longer surfaces | CLOSED |

### Frontend contract alignments
| ID | Status |
|---|---|
| FC-1 — `tempPassword` camelCase + `tenants[].id` + `tenants[].userId` | Aligned at `19cbb67`; FE consumes via `SignLeaseResponse` |
| FC-2 — `GET /leases?tenantId=<User.id>` joins via `tenant.user_id` | Aligned at `19cbb67`; tenant dashboard returns expected rows |

## Playwright execution status

The initial tester turn crashed on an Anthropic-side transport error during the live Playwright stage. The 8 specs were authored and committed:

- `pm-sign-lease.spec.ts`
- `pm-renew-lease.spec.ts`
- `pm-finalize-termination.spec.ts`
- `tenant-approve-termination.spec.ts`
- `tenant-impersonation-blocked.spec.ts` — H-01 lock-in at UI layer
- `cross-property-blocked.spec.ts` — H-02 / PropertyScopeGuard lock-in at UI layer
- `bl-18-turnover-gap.spec.ts`
- `deposit-refund.spec.ts`

All specs compile under TypeScript and import only from `@playwright/test`. They follow the Phase 2 spec conventions (seeded admin login, deterministic test-user passwords from `SEED_TEST_PASSWORD`).

**Recommendation:** before Phase 4 starts, run the suite end-to-end once against a fresh `docker compose` + `prisma migrate deploy` + `prisma db seed` to confirm UI parity. The Phase 2 re-run command is:

```bash
docker compose down -v && docker compose up -d
cd apps/api && pnpm prisma migrate deploy && pnpm prisma db seed
pnpm --filter @gharsetu/api start &
pnpm --filter @gharsetu/web build && pnpm --filter @gharsetu/web start &
pnpm --filter @gharsetu/web exec playwright test --reporter=line
```

If the API + Vitest gates remain green and the user is satisfied with Phase 2's prior live-Playwright track record, Phase 4 can proceed in parallel with this run.

## Production bugs found

None.

## Outstanding audit-level items (carry over, not Phase 3 regressions)

- `@nestjs/core` GHSA-36xv-jgw5-4q75 — patched only in NestJS ≥ 11.1.18, blocked by N-1 policy.
- `path-to-regexp` and `lodash` HIGH advisories — both transitive via NestJS 10's Express stack, same N-1 conflict.

## Verdict

**PASS-WITH-NOTES.** API + FE Vitest fully green and lock in every Phase 3 business rule and security fix. Playwright specs committed but pending a live run; recommend executing once before declaring Phase 3 fully closed at the UI layer. Cleared to proceed to Phase 4 in parallel with that run unless the user wants the Playwright pass first.

---

## Playwright live execution — 2026-05-11

### Pre-flight notes

A stale Next.js server (PID 15531, started at 07:22 from a previous session) was serving the OLD build against port 3000. This caused 3 Phase 3 page-navigation tests (`pm-sign-lease.spec.ts:33`, `pm-renew-lease.spec.ts:131`, `pm-finalize-termination.spec.ts:26`) to return 404 in the first run. After killing the stale process and starting a fresh `next start` against the current build, all three resolved to 200 — same class of artifact as BUG-001 from Phase 2. No production bug.

The `auth-login-invalid.spec.ts` failures (3 tests) in the first parallel run were also stale-server artifacts — all pass once the fresh server was in place.

### Results (authoritative: serial run `--workers=1`, fresh server)

| Suite | Tests | Pass | Fail | Skipped |
|---|---|---|---|---|
| Phase 1 carry-over | 24 | 22 | 2 | 0 |
| Phase 2 carry-over | 25 | 22 | 3 | 0 |
| Phase 3 new (8 specs, 23 tests) | 23 | 23 | 0 | 0 |
| **Total** | **72** | **67** | **5** | **0** |

Runtime: ~38s (serial)

### Failures — all pre-existing carry-overs, none are Phase 3 regressions

| ID | Spec:line | Classification | Description |
|---|---|---|---|
| BUG-003 | `admin-cross-role-redirect.spec.ts:52` | BUG (FE, pre-existing) | PM visiting /admin/dashboard returns 200 instead of 307 — middleware cross-role guard not firing in live runtime |
| BUG-003 | `admin-cross-role-redirect.spec.ts:84` | BUG (FE, pre-existing) | Admin visiting /pm/dashboard returns 200 instead of 307 |
| BUG-003 | `admin-cross-role-redirect.spec.ts:105` | BUG (FE, pre-existing) | Maintenance visiting /admin/dashboard returns 200 instead of 307 |
| BUG-002 | `auth-login-happy-path.spec.ts:72` | BUG (FE, pre-existing) | Login form renders as Loading skeleton; `.bg-bg-overdue[role="alert"]` never appears — client-side hydration timing |
| TEST-FLAW-PH1 | `auth-role-redirect.spec.ts:31` (1-3 of 4 loop iterations) | TEST-FLAW (pre-existing) | `waitForURL(/login/)` resolves immediately because the page is already at /login before the click redirect completes; flaky across runs |

All 3 BUG-003 tests are **intentionally failing** regression anchors authored in Phase 2 to document the bug. They are expected to fail until FE fixes the middleware cross-role guard.

BUG-002 and TEST-FLAW-PH1 were documented in the Phase 2 report as pre-existing Phase 1 failures.

### Phase 3 spec results (23/23 pass)

| Spec | Tests | Result | BL/Security coverage |
|---|---|---|---|
| `pm-sign-lease.spec.ts` | 4 | PASS | BL-01, BL-04, BL-07 |
| `pm-renew-lease.spec.ts` | 3 | PASS | BL-01, BL-02 |
| `pm-finalize-termination.spec.ts` | 3 | PASS | BL-04, BL-08, BL-09 |
| `tenant-approve-termination.spec.ts` | 3 | PASS | BL-08, BL-09 |
| `tenant-impersonation-blocked.spec.ts` | 3 | PASS | H-01, BL-09 |
| `cross-property-blocked.spec.ts` | 3 | PASS | H-02, BL-19 |
| `bl-18-turnover-gap.spec.ts` | 2 | PASS | BL-18 |
| `deposit-refund.spec.ts` | 2 | PASS | BL-19, TC-REFUND-001/002 |

### Verdict update

**PASS.** All 23 Phase 3 tests pass. All 5 failures are pre-existing carry-overs (BUG-003 × 3, BUG-002 × 1, TEST-FLAW-PH1 × variable) documented in prior phase reports. No new failures introduced by Phase 3 code. Phase 3 is fully closed at all three layers (API Jest, FE Vitest, Playwright E2E).

The single most important thing to fix before Phase 4: **BUG-003** — the Next.js middleware cross-role guard does not fire in the live `next start` runtime. The middleware logic at `apps/web/src/middleware.ts:60` is correct in code but does not execute as expected. This is a security-in-depth concern (the API enforces RBAC via JWT, so it is not an auth bypass) but it does allow logged-in users to visit other roles' dashboards in the browser.
