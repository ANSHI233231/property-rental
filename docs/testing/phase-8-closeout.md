# Phase 8 — Final Closeout

**Date:** 2026-05-11
**HEAD:** `d0805bc`
**Decision:** Pre-release VAPT + full Test_Cases.md regression complete. All MUST-FIX items closed.

## Final test state

| Layer | Result |
|---|---|
| API Jest + Supertest | **448 / 448 ✅** |
| FE Vitest | **519 / 519 ✅** |
| Playwright (serial) | **74 / 74 ✅** (per Phase 8 tester run at `02d6a53`) |
| BL traceability | **23 / 23 BLs locked in** (`docs/testing/bl-traceability-matrix.md`) |
| TC regression (Test_Cases.md) | **110 / 110 covered** (~106 automated, the rest covered by added regression tests + manual sign-off) |
| `pnpm audit --prod` | 1 moderate remaining (`@nestjs/core` GHSA-36xv — known N-1 carry, no exploitable code path per VAPT static analysis) |

## Phase 8 findings — all closed

| ID | Severity | Status |
|---|---|---|
| BUG-008-001 | P0 financial integrity — `addMonthMinusOneDay` Jan 31 overflow | **FIXED** (`67a66b1`) — 8 adjacent unit tests green |
| BUG-008-002 | P1 — Lease accepts `endDate < startDate` | **FIXED** (`a519dc1`) — service throws 400 `INVALID_LEASE_DATES` |
| BUG-008-003 | P2 — Placeholder text contrast fails WCAG AA | **FIXED** (`50b78fb`) — `#546E7A` placeholder, 4.84:1 contrast |
| BUG-008-004 | Stale carry — not a real bug | n/a (was already closed at `b6abfef`) |
| F-01 | MUST-FIX (policy) — Password min 10 vs ASVS L2 12 | **DOCUMENTED** (`f1918f1`) — user chose SRS §10.2 default; deviation noted in VAPT production checklist |
| F-02 | MUST-FIX — `tenants[]` no array-size cap | **FIXED** (`8b46942`) — `@ArrayMaxSize(20)` + matching zod cap |
| Throttler scoping | P0 surfaced during VAPT — named buckets applied to all routes | **FIXED** (`6751901`) — `skipIf` predicates + `@SkipThrottle` |
| `GET /leases` TENANT access | P1 surfaced during regression — tenants couldn't list own lease | **FIXED** (`a20bb75`) — server-forced self-scope, IDOR-safe |

## OWASP ASVS L1 self-assessment (Phase 7 baseline + Phase 8 patches)

- 32 PASS / 3 PARTIAL / 0 FAIL / 4 N/A per `docs/security/phase-7-owasp-asvs-l1-assessment.md`
- Phase 8 patches close PARTIAL-01 (password length stays at 10 per documented SRS §10.2 deviation)
- 2 remaining PARTIALs are intentional N-1 + Next.js-CSP items deferred to a post-v1 hardening pass

## Production deployment checklist (per `docs/security/phase-8-vapt-report.md`)

- `.env` matrix documented (which keys, who sets them, where they live)
- Migration plan: `prisma migrate deploy` on first boot of each environment
- Rollback plan: standard `prisma migrate resolve --rolled-back <id>` flow
- Seed-Admin procedure: `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD` env, `pnpm prisma db seed` once per environment
- CI Jest step: must include `--runInBand` (already in the package.json test script)

## Carry-over to post-v1 hardening (none release-blocking)

1. NestJS 10 → 11 migration to clear `@nestjs/core` GHSA-36xv — N-1 policy currently in force per user decision.
2. Next.js Content-Security-Policy header — React auto-escaping is the only XSS defence on the FE origin today. No active XSS exploit found in VAPT; recommend adding CSP via `next.config.mjs` headers() export when the design phase for it lands.
3. Password minimum length 10 → 12 — defer per user.
4. Extract shared `formatDateIST` / locale helpers to `@gharsetu/shared` so API + web use the same implementation (currently duplicated). Surfaced during BUG-BL22-001 fix.
5. Test-isolation: Playwright specs share DB state in parallel mode; serial runs are 100% green. Either teach each spec to fully self-seed, or commit to `--workers=1` in CI.
6. Throttler default-limit at 100/min in test env — already raised; document as the standard test-env config.

## Verdict

**RELEASE-READY.** All MUST-FIX findings closed. All 23 BLs locked in. 967 / 967 unit + integration tests green. Pre-release production checklist documented.

Awaiting user sign-off for release.
