# GharSetu — Master Implementation Plan

**Status:** Draft awaiting user approval. **No code may be written until the user replies "begin Phase 0".**
**Repo HEAD at planning time:** `6c46584` · working tree clean · 7 commits on `main`.
**Date:** 2026-05-10.

---

## 1. Executive Summary

GharSetu is a Delhi-first, internal property-rental management platform replacing paper folders, spreadsheets, and WhatsApp groups for a 120-unit / 18-building operation. The implementation is divided into **9 phases (Phase 0 → Phase 8)** that take a greenfield repo from "no `package.json`" to a security-hardened release candidate covering all 23 hard business rules.

The plan is **API-contract-first**: every phase fixes the contract (in `packages/shared`) before frontend and backend diverge, so they can progress in parallel under the lead's review. Each phase has an explicit acceptance gate tied back to `Test_Cases.md` and `SRS_Document.md` §5 (BL-01 → BL-23).

**Total wall-clock estimate (focused work, single FE + single BE + tester + security agent in coordinated rotation):** **78 – 110 hours.**

**Top three risks:** (1) Prisma + pnpm-workspace type resolution flakiness in `packages/shared`; (2) BullMQ scheduling determinism for the BL-12 / BL-13 / BL-17 cron jobs; (3) the 1:1 prototype-to-React port leaking native browser tooltips and breaking the `validation.js` UX contract. Each is addressed in §5.

---

## 2. Phased Breakdown

### Phase 0 — Monorepo scaffold + tooling
**Goal:** smallest end-to-end "hello world" — Next.js page hits NestJS health endpoint hits Postgres via Prisma, all inside a pnpm workspace.

| Field | Value |
|---|---|
| Estimate | **6 – 8 h** |
| Prereqs | None |
| BL enforced | None directly (foundation) |

**Deliverables**
- `pnpm-workspace.yaml`, root `package.json` with `engines.node = "22"`, `.nvmrc`.
- `apps/web` — Next.js 15+ App Router scaffold, TS strict, Tailwind, design tokens already ported from `prototype/assets/styles.css` to `tailwind.config.ts` (Navy `#1A237E`, Saffron `#FF6F00`, status palette, Poppins/Inter via `next/font`).
- `apps/api` — NestJS N-1 scaffold, TS strict, Prisma client wired, `/api/v1/health` returns `{ status: "ok", db: "ok", timestamp }`.
- `packages/shared` — TS package, builds to `dist/`, exports a single placeholder `BusinessRules` constants module + the `Role` enum (`ADMIN | MANAGER | MAINTENANCE | TENANT`) so both apps prove they can consume it.
- `prisma/schema.prisma` — empty datasource + a stub `HealthCheck` model so `prisma migrate dev` runs cleanly.
- `docker-compose.yml` (dev only) — Postgres 18, Redis 7 (for BullMQ later).
- ESLint + Prettier + `lint-staged` + `husky` pre-commit; root `tsconfig.base.json`.
- GitHub Actions: `typecheck → lint → unit → build` matrix on Node 22.
- `.env.example` documenting every variable.

**Acceptance gate**
- `pnpm install && pnpm -r build` succeeds locally and in CI.
- `curl localhost:3001/api/v1/health` returns 200 with `db: "ok"`.
- `apps/web` index page calls that endpoint and renders the result.
- A change to `packages/shared` triggers rebuilds in both apps.

**Distribution**
- `gharsetu-backend` — NestJS scaffold, Prisma wiring, health endpoint, Docker compose.
- `gharsetu-frontend` — Next.js scaffold, Tailwind tokens, fetch the health endpoint.
- `gharsetu-tester` — CI workflow file + smoke test (`pnpm test` runs one Vitest + one Jest case).
- `gharsetu-security` — review `.env.example`, `.gitignore`, and pre-commit secret-scan hook.

---

### Phase 1 — Auth + roles + RBAC scaffolding
**Goal:** four-role login working end-to-end with refresh tokens, password reset, and role-scoped guards. **No public signup.**

| Field | Value |
|---|---|
| Estimate | **10 – 14 h** |
| Prereqs | Phase 0 |
| BL enforced | None of BL-01..BL-23 directly, but the **role enum** (Module 1) and the API spec §6 access matrix become real here. |

**Deliverables**
- Prisma models: `User` (with `role` enum, `argon2id` `password_hash`, `is_active`, `created_by_user_id`), `RefreshToken` (server-side, revocable), `PasswordResetToken` (single-use, 30-min TTL).
- Endpoints (per API spec §4.1 + §11.2):
  - `POST /auth/login` — email + password → access JWT (15 min) + httpOnly refresh cookie (`SameSite=Strict; Secure`).
  - `POST /auth/refresh` · `POST /auth/logout`.
  - `POST /auth/forgot-password` · `POST /auth/reset-password` — anti-enumeration response.
  - `GET /users/me` · `PATCH /users/me` · `POST /users/me/change-password`.
- NestJS `@Roles(...)` decorator + `RolesGuard` + `JwtAuthGuard`; `PropertyScopeGuard` stub used by later phases.
- Frontend pages: `/login`, `/forgot-password`, `/reset-password/[token]` — 1:1 with `prototype/login.html`, `prototype/forgot-password.html`. Custom validator UX (errors below field, ⚠ glyph) re-implemented with React Hook Form + zod, replacing `prototype/assets/validation.js`.
- Middleware in `apps/web` redirects unauthenticated users to `/login` and routes by role to the correct dashboard.
- Seed script: one Admin (set via env), used as the bootstrap account.

**Acceptance gate**
- TC-AUTH-001 through TC-AUTH-010 pass (login, lockout, role redirect, reset link, anti-enumeration).
- Argon2id confirmed in DB; bcrypt nowhere in the dependency tree.
- No "session list" / "sign out everywhere" UI exists (per §11.3).

**Distribution**
- `gharsetu-backend` — Prisma schema, auth module, guards, password reset, rate-limit (100/min).
- `gharsetu-frontend` — login / forgot / reset pages + auth context + role-based middleware.
- `gharsetu-tester` — auth test cases, anti-enumeration assertion, Playwright login flow.
- `gharsetu-security` — verify Argon2id params, cookie flags, refresh-token revocation, no JWT in localStorage.

---

### Phase 2 — Properties + Units + Users (Admin CRUD)
**Goal:** Admin can manage all 18 properties, their units, and the four user types from the Admin UI.

| Field | Value |
|---|---|
| Estimate | **10 – 13 h** |
| Prereqs | Phase 1 |
| BL enforced | **BL-03**, **BL-05**, **BL-19**, **BL-20** (PM ↔ property scope; retired terminal; rent edit gate). BL-22 / BL-23 (timezone + DD/MM/YYYY) become a project-wide default starting here. |

**Deliverables**
- Prisma models: `Property` (with `timezone` default `Asia/Kolkata`, `active_pm_id`), `Unit` (with `state` enum + `is_retired` boolean per §11.1), `PropertyTransferLog` (for BL-20).
- Critical indexes: partial unique on `properties(active_pm_id)` (BL-19); `units(state) WHERE state <> 'retired'`.
- Endpoints (API spec §4.2 + §6 Users):
  - `/properties` CRUD, `/properties/{id}/transfer-pm`, `/units` CRUD, `/units/{id}/state`, `/users` CRUD (Admin only).
- BL-03 enforced: `PATCH /units/{id}` with `monthly_rent` change rejected unless state ∈ `{available, listed}` → `UNIT_RENT_LOCKED` error.
- BL-05 enforced: setting `is_retired=true` is one-way; DB-level CHECK + service-level guard.
- Frontend pages 1:1 with `prototype/admin/properties.html`, `prototype/admin/users.html`, `prototype/admin/dashboard.html` (KPI shell only — live numbers fill in later phases).
- Indian digit grouping helper in `packages/shared` (₹1,20,000) used wherever rent renders.

**Acceptance gate**
- TC-PROP-* and TC-USER-* (admin CRUD subset) pass.
- Trying to assign a PM already attached to another property → `PM_ALREADY_ASSIGNED`.
- Retired unit cannot transition back; covered by an integration test.

**Distribution**
- `gharsetu-backend` — schemas, endpoints, BL-03/05/19/20 guards, audit-log writes for every mutation.
- `gharsetu-frontend` — admin Properties / Users pages; reusable table + pagination component (cursor, 20 rows).
- `gharsetu-tester` — TC-PROP / TC-USER coverage; verifies `is_retired` is sticky.
- `gharsetu-security` — review role guards, ensure Admin endpoints are not accessible to MANAGER even by URL guess.

---

### Phase 3 — Tenants + Leases + co-tenant flows
**Goal:** PMs sign leases, onboard tenants (with co-tenants), renew, and start the early-termination dance.

| Field | Value |
|---|---|
| Estimate | **12 – 16 h** |
| Prereqs | Phase 2 |
| BL enforced | **BL-01**, **BL-02**, **BL-04**, **BL-07**, **BL-08**, **BL-09**, **BL-18** |

**Deliverables**
- Prisma models: `Tenant`, `LeaseTenant` (join with `is_primary`), `Lease` (`monthly_rent_paise BIGINT`, `security_deposit_paise BIGINT`, `status` enum `active|expired|renewed|terminated`), `LeaseTermination` (with `requested_by_tenant_id`, per-co-tenant `LeaseTerminationApproval` rows), `DepositRefund`.
- Critical index: **partial unique on `leases(unit_id) WHERE status='active'`** — the database guarantee for BL-01.
- Endpoints (API spec §4.3): `/tenants`, `/leases`, `/leases/{id}/renew`, `/leases/{id}/terminate-request`, `/leases/{id}/terminate-approve`, `/leases/{id}/terminate-withdraw`, `/leases/{id}/finalize-termination`, `/deposit-refunds`.
- BL-02 enforced: lease `monthly_rent_paise` is `@updatedAt`-immune; service rejects any update.
- BL-04 enforced: unit cannot move to `in-maintenance`/`listed` while an active lease exists (pairs with Phase 2 state machine).
- BL-08 / BL-09: termination only finalizable when `LeaseTerminationApproval` rows are all `APPROVED`; no auto-timeout job; requester can `withdraw` at any time → request deleted.
- Lease signing creates tenant user accounts (BL of Module 1); first rent period auto-generated (lays groundwork for Phase 4).
- Frontend pages 1:1 with `prototype/pm/tenants.html`, `prototype/pm/leases.html`; co-tenant approval surface inside `prototype/tenant/dashboard.html`.

**Acceptance gate**
- TC-LEASE-* + TC-TERM-* pass; concurrent-lease attempt blocked at DB level (kill the service-layer guard, the unique index still rejects it — this is the regression test).
- Tenant turnover gap (BL-18) verified by an integration test.

**Distribution**
- `gharsetu-backend` — lease/tenant module, BL-01/02/04/07/08/09/18 guards, partial unique index migration.
- `gharsetu-frontend` — PM Tenants + Leases pages, tenant-side termination approval card.
- `gharsetu-tester` — TC-LEASE + TC-TERM, plus an explicit "DB-level BL-01" test that bypasses the service.
- `gharsetu-security` — verify a PM cannot operate on a lease in another property (PropertyScopeGuard real now).

---

### Phase 4 — Rent collection + payments + late-fee accrual + BullMQ worker
**Goal:** PMs record payments; system reconciles paid / partial / overdue / prepaid; BullMQ runs daily to flip overdue and add late fees.

| Field | Value |
|---|---|
| Estimate | **12 – 16 h** |
| Prereqs | Phase 3 |
| BL enforced | **BL-06**, **BL-10**, **BL-11**, **BL-12**, **BL-13** |

**Deliverables**
- Prisma models: `RentPeriod` (`due_date`, `amount_due_paise`, `late_fee_paise`, `outstanding_paise`, `status`), `Payment` (append-only, with `is_voided` + `voided_by` + `void_reason`), `PrepaidCredit` (separate table per §11.4).
- Endpoints (API spec §4.5): `/rent-periods?unit_id=`, `POST /payments`, `POST /payments/{id}/void`.
- BL-06: changing rent on a `listed` unit (Phase 2 endpoint) immediately reflects in the public-facing listing surface (Tenant dashboard mock + future public page).
- BL-10: `POST /payments` rejected for any role except `MANAGER`.
- BL-11: concurrent-payment reconciliation done in a single transaction with `SELECT … FOR UPDATE` on the period; second payment auto-routes excess to next period as `prepaid`.
- BL-12 / BL-13: BullMQ worker (`apps/api/src/jobs/rent-accrual.processor.ts`) running daily 00:05 IST:
  - flips any period 5+ days past due to `overdue`;
  - adds 2% × outstanding × full-weeks-overdue, **non-compounded retroactively**, evaluated per period.
- Idempotency: each accrual run writes to a `RentAccrualLog` so re-runs on the same date are no-ops.
- Frontend pages 1:1 with `prototype/pm/rent-collection.html`, `prototype/admin/rent.html`, `prototype/tenant/rent.html`. Record Payment modal (PM only) — DD/MM/YYYY, method enum, reference text, recorded-by stamped server-side.

**Acceptance gate**
- TC-RENT-* + TC-LATEFEE-* pass.
- A tenant calling `POST /payments` directly → `403 BL_10_TENANT_CANNOT_RECORD_PAYMENT`.
- A worked example: ₹18,000 rent, 17 days overdue → 2 full weeks → 4% late fee = ₹720; tenant view shows breakdown.

**Distribution**
- `gharsetu-backend` — rent module, payment txn, BullMQ worker, accrual logic.
- `gharsetu-frontend` — Record Payment modal, rent tables across all three role views.
- `gharsetu-tester` — TC-RENT + TC-LATEFEE, plus a simulated 30-day cron run with frozen clock.
- `gharsetu-security` — verify BL-10 at API level (tenant token on `POST /payments` → 403); verify void cannot mutate the original record.

---

### Phase 5 — Maintenance request lifecycle
**Goal:** open → assigned → in-progress → resolved → closed lifecycle, with the 5+ alert and emergency banner.

| Field | Value |
|---|---|
| Estimate | **8 – 11 h** |
| Prereqs | Phase 3 |
| BL enforced | **BL-14**, **BL-15**, **BL-16**, **BL-17**, **BL-21** |

**Deliverables**
- Prisma models: `MaintenanceRequest` (status enum, priority enum, `description ≥ 30`, `resolution_notes ≥ 20`, `closed_at` immutable once set), `MaintenanceAlert` (for BL-17).
- Endpoints (API spec §4.4): `/maintenance-requests` CRUD-subset; `POST /maintenance-requests/{id}/assign`, `/in-progress`, `/resolve`, `/close`, `/dismiss-alert`.
- BL-14 enforced via DB CHECK + DTO validation.
- BL-15: closed requests → 409 on any state-change attempt.
- BL-16: `MAINTENANCE` role blocked from `POST /maintenance-requests`.
- BL-17: BullMQ worker `maintenance-alert.processor.ts` runs daily at 00:10 IST and creates `MaintenanceAlert` rows whenever a tenant has ≥5 requests for the same unit in the **calendar month** (1st → end of month). Admin dashboard surfaces it.
- BL-21: `/close` endpoint accepts `TENANT` only; PM/Admin `/close` is rejected.
- Frontend pages 1:1 with `prototype/pm/maintenance.html`, `prototype/maintenance/dashboard.html`, `prototype/maintenance/all-open.html`, `prototype/tenant/maintenance.html`, `prototype/admin/maintenance.html`. Char counters (N/30, N/20) restored.

**Acceptance gate**
- TC-MAINT-* pass; "raise 5th request" test fires the alert deterministically.
- Maintenance staff role does not see a "New Request" button anywhere (UC-08).

**Distribution**
- `gharsetu-backend` — maintenance module, BL-14..21 guards, BullMQ alert worker.
- `gharsetu-frontend` — four role-views + emergency banner + char counters.
- `gharsetu-tester` — TC-MAINT, plus the BL-17 trigger test.
- `gharsetu-security` — confirm role boundaries on every state transition endpoint.

---

### Phase 6 — Tenant + Maintenance Staff dashboards (read-only role views)
**Goal:** the two least-privileged roles see exactly what they should — no more, no less.

| Field | Value |
|---|---|
| Estimate | **6 – 8 h** |
| Prereqs | Phases 4, 5 |
| BL enforced | Reaffirms **BL-10**, **BL-16**; cross-cutting role-scope hardening. |

**Deliverables**
- `prototype/tenant/dashboard.html`, `prototype/tenant/profile.html` ported with live data: lease summary card, current period card, late-fee breakdown if any.
- `prototype/maintenance/profile.html` ported with work stats.
- Empty-state, skeleton-screen, and 401/403 redirect handling consistent across all role-views.
- Bottom tab bar (mobile) wired up; **no hamburger menus** anywhere.

**Acceptance gate**
- Manual + axe a11y scan on every tenant + maintenance page returns zero serious/critical issues.
- Tenant token cannot fetch any Admin / PM endpoint (negative tests).

**Distribution**
- `gharsetu-frontend` — tenant + maintenance dashboard polish, mobile tab bar, skeletons.
- `gharsetu-backend` — minor: ensure `/users/me`-style endpoints scope correctly.
- `gharsetu-tester` — full role-leakage test matrix (4 roles × ~30 endpoints).
- `gharsetu-security` — light pre-VAPT walk-through; flag obvious wins.

---

### Phase 7 — Reporting, alerts, polish, accessibility audit, security hardening
**Goal:** Admin reports, alerts surfaced everywhere, full WCAG AA pass, OWASP Top 10 mitigations baked in.

| Field | Value |
|---|---|
| Estimate | **8 – 12 h** |
| Prereqs | Phases 4, 5, 6 |
| BL enforced | Cross-cutting reinforcement; **BL-22**, **BL-23** verified end-to-end. |

**Deliverables**
- Admin dashboard live: occupancy across 18 properties, monthly rent collected, overdue count, 5+ alerts panel.
- Admin Rent page: aggregate overdue tenants list with drill-down.
- `GET /audit-log` Admin endpoint + viewer page (table + filters).
- Accessibility pass: axe-core in Playwright, manual NVDA + VoiceOver check on critical flows (login, record payment, raise request, terminate lease).
- Security hardening: helmet middleware, CORS allowlist, CSRF on state-changing routes, rate limit confirmed (100/min), input-size caps, SQL-injection regression tests via Prisma raw escapes audit.
- Indian locale verification: every date is DD/MM/YYYY; every currency is `₹X,XX,XXX` (Indian grouping); every timestamp uses `Asia/Kolkata`.
- Logging: structured pino logs, PII-redacted (no passwords, no tokens, no full email in logs).

**Acceptance gate**
- Lighthouse + axe scores ≥ 95 / zero critical on every page.
- All 23 BL-IDs mapped to at least one passing test.
- Security checklist (OWASP ASVS L1) green.

**Distribution**
- `gharsetu-frontend` — Admin reporting pages, audit-log viewer, locale-format helpers.
- `gharsetu-backend` — `/audit-log`, helmet, rate-limit, structured logging.
- `gharsetu-tester` — a11y suite, 23-BL traceability matrix.
- `gharsetu-security` — OWASP ASVS L1 self-assessment and gap fixes.

---

### Phase 8 — Pre-release VAPT + full Test_Cases.md regression pass
**Goal:** independent VAPT, full ~110-case regression run, sign-off readiness.

| Field | Value |
|---|---|
| Estimate | **6 – 10 h** |
| Prereqs | Phases 0 – 7 |
| BL enforced | Verifies all 23. |

**Deliverables**
- Full execution of `Test_Cases.md` (every TC-* row); pass/fail/skip log committed.
- VAPT report: authn/authz, session handling, payment void path, role-leakage, IDOR, cookie flags, refresh-token replay, password-reset token replay, rate-limit bypass, request-size attacks.
- Findings triaged into MUST-FIX (release blocker) / SHOULD-FIX / NICE-TO-HAVE; MUST-FIX patched and retested.
- Production checklist: `.env` matrix documented, migration plan, rollback plan, seed-Admin procedure.

**Acceptance gate**
- Zero MUST-FIX findings open.
- 100% of `Test_Cases.md` passing or explicitly waived with user sign-off.

**Distribution**
- `gharsetu-tester` — full regression sweep + traceability report.
- `gharsetu-security` — VAPT, OWASP Top 10 active scan, remediation verification.
- `gharsetu-backend` / `gharsetu-frontend` — patch MUST-FIX items only.

---

## 3. Cross-cutting Workstreams

| Workstream | Introduced in | Owner | Notes |
|---|---|---|---|
| Design tokens port (`prototype/assets/styles.css` → `tailwind.config.ts`) | Phase 0 | `gharsetu-frontend` | Verbatim names: Navy, Saffron, status palette; Poppins (headings) + Inter (body) via `next/font`. Lead approves diff before any page is built. |
| `validation.js` → React Hook Form + zod | Phase 1 | `gharsetu-frontend` | Visual contract = errors below field, ⚠ glyph, no native browser tooltip. Reusable `<Field>` wrapper enforced. |
| Audit-log table + write-on-mutation | Phase 2 (model), Phase 7 (viewer) | `gharsetu-backend` | Append-only; Prisma middleware writes a row for every mutation with `actor_id`, `entity`, `entity_id`, `action`, `before/after JSONB`. |
| Role-scope guard middleware (`PropertyScopeGuard`) | Phase 1 (stub), Phase 3 (real) | `gharsetu-backend` | Every PM endpoint asserts the resource belongs to the PM's assigned property; reused by maintenance + rent endpoints. |
| i18n / locale (`en-IN`, `Asia/Kolkata`, ₹ Indian grouping) | Phase 0 (helper), enforced Phase 2 onward | `gharsetu-frontend` + `gharsetu-backend` | `formatDateIST`, `formatINR`, `parseINR` lives in `packages/shared`. BL-22 / BL-23. |
| Indian-paise BIGINT money handling | Phase 3 (lease), Phase 4 (payments) | `gharsetu-backend` | Per §11.4: amounts stored as `BIGINT` paise. No floats. Format only at API boundary. |
| BullMQ + Redis | Phase 0 (compose), Phase 4 (rent), Phase 5 (alerts) | `gharsetu-backend` | One worker process per cron family, shared Redis. Idempotency via per-day log table. |
| Accessibility (WCAG AA) | Phase 0 (semantics) → Phase 7 (audit) | `gharsetu-frontend` + `gharsetu-tester` | axe-core in Playwright from Phase 1; full manual audit in Phase 7. |
| CI / GitHub Actions pipeline | Phase 0 onward | `gharsetu-tester` | Each phase adds the relevant test stage. |

---

## 4. Specialist Responsibility Matrix

| Agent | Durable responsibilities (across all phases) |
|---|---|
| **`gharsetu-frontend`** | Next.js App Router pages 1:1 with `prototype/`; Tailwind tokens; React Hook Form + zod; TanStack Query; sparing shadcn/ui; Indian locale rendering; mobile bottom tab bar; skeleton + empty states; axe-clean output; never bypasses native validation; never imports server-only code into client components. |
| **`gharsetu-backend`** | NestJS modules; Prisma schema + migrations; DTOs (class-validator) mirroring zod; JWT + refresh + Argon2id; `@Roles` + `PropertyScopeGuard`; BullMQ workers for BL-12/13/17; audit-log middleware; cursor pagination; error envelope `{ error: { code, message, details? } }`; paise BIGINT; UTC store / IST render. **Owns enforcement of every BL-XX at the API/DB level**, not just the UI. |
| **`gharsetu-tester`** | CI workflow; Vitest (web) + Jest + Supertest (api) + Playwright (E2E + axe); `Test_Cases.md` execution log; BL-XX → TC-XX traceability matrix; regression suite stays green per phase; 1 deterministic test per BullMQ cron with frozen clock. |
| **`gharsetu-security`** | Pre-commit secret scan; cookie/header review; Argon2id parameter check; refresh-token + reset-token replay tests; role-leakage matrix (4 roles × every endpoint); IDOR + payment-void abuse; helmet/CORS/CSRF/rate-limit verification; OWASP ASVS L1 in Phase 7; full VAPT in Phase 8. Sign-off required before any release. |

---

## 5. Risks & Mitigations

| # | Risk | Likelihood × Impact | Mitigation |
|---|---|---|---|
| R1 | `packages/shared` types not resolving cleanly across `apps/web` (Next.js bundler) and `apps/api` (NestJS / ts-node) | High × Med | Ship a compiled `dist/` from `packages/shared` (`tsup`), not raw `.ts`. Both apps consume the built output, not `src/`. Validated in Phase 0 acceptance gate. |
| R2 | BullMQ cron drift: BL-12 / BL-13 / BL-17 jobs running twice or skipping a day | Med × High | (a) Idempotency log per `(job, date)`. (b) `repeat: { cron, tz: 'Asia/Kolkata' }`. (c) Phase-4/5 tests use `@sinonjs/fake-timers` to simulate 30 days deterministically. |
| R3 | 1:1 prototype port leaks native browser tooltips (breaking the `prototype/assets/validation.js` UX contract) | Med × Med | Forbid `required`, `pattern`, `minlength`, `type=email` HTML attributes in client code; ESLint rule + Playwright test that asserts no browser tooltip appears on submit. Only `<Field>` wrapper renders errors. |
| R4 | NestJS N-1 + Prisma N + Node 22 ecosystem skew (e.g. peer-dep warnings, Reflect-metadata clashes) | Med × Med | Phase 0 pins exact versions in root `package.json`; Renovate disabled until Phase 8; any version bump is a separate PR with its own CI run. |
| R5 | Money math drift (₹ floats, off-by-one in late-fee accrual) | Low × High | All money is `BIGINT` paise (per §11.4); `formatINR` / `parseINR` are the only conversion paths and live in `packages/shared`; property-based tests on the late-fee function (BL-13) with 1000 random inputs. |

---

## 6. Approval Checklist

- [ ] Phase ordering acceptable (0 → 8 as described above)
- [ ] Time estimates acceptable (78 – 110 h focused work, total)
- [ ] Stack and version pins acceptable (Next.js 15+, **NestJS N-1**, Node 22 LTS, Prisma, Postgres 18, pnpm workspaces)
- [ ] Specialist responsibilities clear (matrix in §4)
- [ ] Risks acknowledged (§5)
- [ ] Cross-cutting workstreams owned (§3)

**Reply "begin Phase 0" to start execution.**

---

## 7. Proposed Additions (require user decision before adoption)

These are **not in SRS §10** but the lead recommends them. Each is opt-in; defaults are SRS-compliant if you skip them.

| # | Addition | Why | Risk if skipped |
|---|---|---|---|
| P1 | **`tsup`** in `packages/shared` to emit `dist/` | Resolves R1 cleanly; standard for pnpm-workspace TS packages | Type-resolution flakiness |
| P2 | **`pino` + `pino-http`** for structured backend logs (Phase 7) | Searchable PII-redacted logs for the audit story | Plain `console.log` muddies logs |
| P3 | **`@sinonjs/fake-timers`** in `apps/api` tests | Deterministic BullMQ + accrual tests | Flaky time-based tests |
| P4 | **Renovate** (paused until Phase 8) | Clean dependency updates post-launch | Manual upkeep |
| P5 | **`zod-to-openapi`** to publish API spec from `packages/shared` | Living API docs; FE/BE never disagree on shapes | Spec drift risk |

If any of P1 – P5 are rejected, the plan still works; the lead will work around them.
