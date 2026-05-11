# Phase 6 — Tenant + Maintenance Read-Only Dashboards · Test Report

**Date:** 2026-05-11
**Scope:** Tenant + Maintenance role views polish, full 4-role × ~30-endpoint role-leakage matrix, accessibility scan scaffold, BL-10 / BL-16 reaffirmation.

## Headline numbers

| Layer | Total | Pass | Fail | Notes |
|---|---|---|---|---|
| API Jest + Supertest | 395 | 395 | 0 | 328 prior + 67 new in `phase6-role-matrix-full.spec.ts` |
| FE Vitest | 418 | 418 | 0 | 371 prior + 47 new in `phase6.test.ts` |
| Playwright (serial) | inherited from Phase 5 | 37 | 0 | a11y spec authored, full live a11y run is a Phase 7 wishlist item |

Total static + unit + integration: **813 / 813 pass.**

## Coverage map (Phase 6 only)

### Role-leakage matrix (9 sections, 67 new cells)
| # | Section | Result |
|---|---|---|
| A | Units — PM / TENANT / MAINTENANCE blocked on `PATCH /units/:id`, `PATCH /units/:id/state`, `POST /units/:id/retire` | PASS |
| B | Users admin endpoints — MAINTENANCE + TENANT blocked on every Admin route | PASS |
| C | Tenants module — MAINTENANCE + TENANT blocked on create / update / list-cross | PASS |
| D | Leases — MAINTENANCE + TENANT blocked on create / renew / finalize; MAINTENANCE blocked on terminate-approve | PASS |
| E | Deposit refunds — MAINTENANCE + TENANT blocked | PASS |
| F | Rent-periods — MAINTENANCE blocked on GET list + GET by-id | PASS |
| G | Void payment — TENANT + MAINTENANCE blocked | PASS |
| H | Jobs — PM/TENANT/MAINTENANCE blocked on `POST /jobs/rent-accrual/run`; PM/TENANT blocked on `POST /jobs/maintenance-alert/run` | PASS |
| I | Tenant data-scope cross-isolation — Tenant-A cannot read Tenant-B's leases, rent-periods, or maintenance requests | PASS |

### Reaffirmed business rules
| BL | Description | Lock-in |
|---|---|---|
| BL-10 | Only PROPERTY_MANAGER + ADMIN can record payments | Phase 4 + Phase 6 matrix section G |
| BL-16 | Only TENANT (+ ADMIN on-behalf) can raise maintenance | Phase 5 + Phase 6 matrix section C/D |

### Backend hygiene fix
| ID | Title | Fix commit |
|---|---|---|
| Phase 6 Leak-01 | `GET /users/me` was returning `created_by_user_id` (internal admin field) | `de5a184` |

### Frontend deliverables
- Tenant Dashboard rewritten with skeleton + 3 cards (lease, current period, open maintenance) + late-fee breakdown using `computeLateFeePaise`
- Tenant Profile page with password change + lease quick-view
- Maintenance Staff Profile page with work stats
- Mobile bottom tab bar across all 4 role views (no hamburger menus)
- Skip-to-main link in every role layout
- `aria-label` on every status badge
- `aria-busy` on every skeleton; `role="status"` on EmptyState

### Accessibility
`apps/web/e2e/a11y.spec.ts` scaffolded with `@axe-core/playwright`. Scans /login structurally; authenticated tenant + maintenance scans wire token injection. Full live run requires seeded DB + running stack — flagged as a Phase 7 wishlist item per the security walkthrough's recommendation.

## Production bugs found

None during Phase 6 acceptance. The one Phase 6 hygiene fix (`created_by_user_id` exposure on `/users/me`) was caught by the backend scope-verification turn and closed in the same phase.

## Carry-over items (deferred to Phase 7)

Per `docs/security/phase-6-pre-vapt-walkthrough.md` (commit `62b9218`):
- 0 NEW HIGH
- 2 NEW MED — `POST /auth/reset-password` lacks dedicated rate-limit; integration tests share dev schema
- 10 carry-over HIGH/MED — `@nestjs/core`, `path-to-regexp`, `lodash` (N-1 blocked); BL-03 / BL-19 / termination race-condition tightening; auth events missing from `audit_log`; `helmet()` not wired; `Idempotency-Key` on `POST /payments`

## Verdict

**PASS.** Phase 6 closed at every gate. 4-role × ~30-endpoint leakage matrix fully green. Pre-VAPT walkthrough surfaces no new HIGH and signs off ready-for-Phase-7. Clear to proceed to Phase 7 hardening.
