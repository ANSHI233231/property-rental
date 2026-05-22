# CONTEXT.md — GharSetu

At-a-glance snapshot of the repository for anyone (human or agent) walking in cold. This file is descriptive, not aspirational: it describes what is **actually on disk today** (2026-05-20, HEAD `283a245`). For the developer-onboarding view (install, env vars, scripts, troubleshooting), see [README.md](README.md); for the spec, see [SRS_Document.md](docs/product/SRS_Document.md).

> **Heads-up on stale doc.** [CLAUDE.md](CLAUDE.md) still describes this as a *greenfield* repo with "no application code". That is no longer true — the monorepo is built out through Phase 8 (security closeout). When the two disagree, trust this file and the live code over CLAUDE.md.

---

## 1. What this is

**GharSetu** — internal, role-scoped property-rental management web app for a Delhi operation with **120 units across 18 buildings**. Replaces paper folders, spreadsheets, and WhatsApp groups. **No public sign-up**, four roles, single tenant business.

| Code | Role | Scope |
|---|---|---|
| 0 | **Admin** | All 18 properties, all users |
| 1 | **Property Manager (PM)** | One assigned property — exactly one (BL-19) |
| 2 | **Maintenance Staff** | Their assigned tickets only — read + update, cannot create (BL-16) |
| 3 | **Tenant** | Own lease + own unit only — cannot record payments (BL-10) |

---

## 2. Tech stack (fixed — see [SRS §10](docs/product/SRS_Document.md))

| Layer | Choice |
|---|---|
| Runtime | **Node.js 22 LTS** (`.nvmrc` = `22`) |
| Package manager | **pnpm 9** workspaces (lockfile committed) |
| Frontend | **Next.js 15** App Router · React 18 · TypeScript strict · Tailwind 3 · React-Hook-Form + Zod · Vitest + Playwright (+ axe) |
| Backend | **NestJS 10** · Prisma 5 · `@nestjs/schedule` (in-process cron, no Redis) · `@nestjs/throttler` · `nestjs-pino` · Helmet · `@node-rs/argon2` · Jest + Supertest |
| Database | **PostgreSQL 18** (alpine, dev on host `:5433` via Docker Compose) |
| Auth | JWT HS256 access (15 min) + opaque refresh cookie (`HttpOnly Secure SameSite=Strict`, 7 d, server-side revocable) — Argon2id password hashing |
| Locale | `Asia/Kolkata` · DD/MM/YYYY · ₹ Indian digit grouping · `en-IN` |
| Currency in DB | **paise as `BIGINT`** (₹18,000 → `1800000`). No floats |

**Deliberately out of scope for v1:** payment gateway, SMS/WhatsApp, file uploads, charts, owner login, 2FA, multi-session UI. Transactional auth email (password reset) **is** in. See [SRS §9](docs/product/SRS_Document.md) and §11.3.

---

## 3. Repo layout (what's actually here)

```
property-rental/
├── apps/
│   ├── api/                          NestJS 10 API
│   │   ├── src/
│   │   │   ├── app.module.ts         · throttler buckets, pino redaction, global ValidationPipe + CodeErrorFilter
│   │   │   ├── auth/                 · login/refresh/logout/forgot/reset, RolesGuard, JwtAuthGuard, hashing
│   │   │   ├── users/                · self-service + admin CRUD
│   │   │   ├── properties/           · CRUD + transfer-pm (BL-19, BL-20)
│   │   │   ├── units/                · CRUD + state machine (BL-03, BL-04, BL-05)
│   │   │   ├── tenants/              · detail + update; list redacts PII
│   │   │   ├── leases/               · sign · renew · terminate-request/approve/withdraw/finalize · deposit-refund (BL-01..02, 07..09, 18)
│   │   │   ├── rent/                 · periods · record/void payment (BL-10..13)
│   │   │   ├── maintenance/          · open→assigned→in-progress→resolved→closed (BL-14..17, 21)
│   │   │   ├── rent-change-schedule/ · scheduled mid-lease rent change (compatible with BL-02)
│   │   │   ├── audit-log/            · read-only paginated, ADMIN only
│   │   │   ├── audit/                · audit writer (every mutation)
│   │   │   ├── jobs/                 · admin-triggered manual runs of the cron processors
│   │   │   ├── notifications/        · EmailService (SMTP via Nodemailer; log-only if SMTP_* unset)
│   │   │   ├── common/               · CodeErrorFilter, PropertyScopeGuard, etc.
│   │   │   └── health/, prisma/      · liveness + Prisma module
│   │   ├── prisma/
│   │   │   ├── schema.prisma         · single source of truth — int IDs, smallint enums
│   │   │   ├── migrations/           · 12 versioned migrations (phase_1_auth → user_name_split)
│   │   │   └── seed.ts               · idempotent: 1 bootstrap admin + 6 demo users
│   │   └── test/                     · jest config + e2e helpers
│   └── web/                          Next.js 15 App Router
│       ├── src/
│       │   ├── app/
│       │   │   ├── (public)/         · /login, /forgot-password, /reset-password/[token]
│       │   │   └── (app)/
│       │   │       ├── admin/        · dashboard, properties, properties/[id], users, units, rent, maintenance, audit-log, profile
│       │   │       ├── pm/           · dashboard, tenants, tenants/[id], leases, leases/[id], rent-collection, maintenance, units, profile
│       │   │       ├── maintenance/  · dashboard, all-open, profile
│       │   │       └── tenant/       · dashboard, leases, rent, maintenance, profile
│       │   ├── components/{admin,pm,tenant,maintenance,profile,ui}/
│       │   ├── lib/{api,auth,hooks,locale,pagination,pm,rent}/
│       │   ├── middleware.ts         · edge auth + role-cookie gate (redirects to /login or correct role dashboard)
│       │   └── __tests__/            · Vitest unit tests
│       ├── e2e/                      · 33 Playwright specs incl. axe a11y + per-BL regression specs
│       └── tailwind.config.ts        · tokens ported from prototype/assets/styles.css
├── packages/
│   └── shared/                       @gharsetu/shared — built with tsup → dist/
│       └── src/
│           ├── role.ts, enums.ts     · numeric enums + label maps (post-smallint refactor)
│           ├── business-rules.ts     · BL-* numeric constants
│           ├── schemas/              · zod schemas: auth, properties, users-admin, leases, maintenance, rent
│           └── utils/currency.ts     · paiseToRupees, rupeesToPaise, formatINR
├── prototype/                        19 static HTML pages — the design contract
│   ├── assets/styles.css             · design tokens (Navy #1A237E, Saffron #FF6F00, status palette)
│   ├── assets/validation.js          · custom form validator (replaces native tooltips, ⚠ glyph below field)
│   ├── index.html, login.html, forgot-password.html, reset-password.html
│   ├── admin/   (9 pages)
│   ├── pm/      (9 pages)
│   ├── tenant/  (4 pages)
│   └── maintenance/ (3 pages)
├── docs/
│   ├── planning/
│   │   ├── DOCUMENT_AGENT.md         · document agent briefing
│   │   └── v1/
│   │       ├── MASTER_PLAN.md        · Phase 0 → 8 plan (with acceptance gates per phase)
│   │       ├── MULTI_REPO_SETUP.md   · submodule day-2 workflow
│   │       ├── TODO_pm_to_manager_rename.md
│   │       ├── Agent_Collaboration_Handbook.docx
│   │       └── phase-0/SECURITY_REVIEW.md
│   ├── product/
│   │   ├── SRS_Document.md           · SRS incl. BL-01..23 (Section 5) and stack lock (Section 10)
│   │   ├── Solution_Overview.docx
│   │   └── v1/                       · source-of-truth specs (.docx + canonical API spec)
│   │       ├── Blueprint_Property_Rental_Application_v8.docx
│   │       ├── GharSetu_UIUX_Design_Document_updated.docx
│   │       ├── GharSetu_Model_API_Spec.md    · canonical REST contract (authoritative for endpoints)
│   │       └── GharSetu_Model_API_Spec_v2.docx
│   ├── requirement/                  · PROJECT_REPORT.docx — v1 gap analysis (regenerable via doc-assets/templates/generate_project_report.js)
│   └── testing/
│       ├── v1/                       · per-phase test reports + bl-traceability-matrix.md + phase-8-final-regression-report.md + Test_Cases.md (~110 cases)
│       └── security/phase-1..8-*.md  · 8 security review reports — phase-8-vapt-report.md is the final VAPT
├── .claude/agents/                   5 subagents — gharsetu-{lead,frontend,backend,tester,security}
├── backups/                          DB dumps (pre-refactor and dated snapshots) — do not commit, do not edit
├── docker-compose.yml                Postgres 18 on host :5433 (intentionally non-default)
├── .env.example                      root template — copied to apps/api/.env
├── smoke.sh                          login + 4 list-endpoints smoke test
├── pnpm-workspace.yaml               apps/* + packages/*
└── package.json                      root scripts: build · test · lint · typecheck · dev:db
```

---

## 4. The 23 hard business rules ([SRS §5](docs/product/SRS_Document.md))

Every implementation **must enforce these at the API/DB layer**, not just in the UI. Most have direct test coverage in [Test_Cases.md](docs/testing/v1/Test_Cases.md), and many have dedicated Playwright specs under `apps/web/e2e/bl-*.spec.ts`.

| # | Rule (one-liner) |
|---|---|
| BL-01 | A unit can never have two `active` leases (partial unique index on `leases(unit_id) WHERE status='active'`) |
| BL-02 | Monthly rent locked at lease signing, cannot be changed mid-lease |
| BL-03 | Unit rent editable only when state ∈ `{available, listed}` |
| BL-04 | Occupied unit can't go to `in-maintenance` or `listed` while lease active |
| BL-05 | `retired` is one-way; retired units never reactivate |
| BL-06 | Listed-unit rent change instantly reflects in public listing |
| BL-07 | All co-tenants jointly liable for unpaid rent |
| BL-08 | One co-tenant cannot terminate alone — all must consent |
| BL-09 | Termination pends until all co-tenants respond or requester withdraws; **no auto-timeout** |
| BL-10 | Only PMs record payments; tenants are view-only |
| BL-11 | Concurrent co-tenant payment → first closes period, second auto-prepaid to next (single tx, `FOR UPDATE`) |
| BL-12 | Period flips to `overdue` exactly 5 calendar days past due |
| BL-13 | Late fee = 2% × outstanding × full weeks overdue, per-period, **not retroactively compounded** |
| BL-14 | Maintenance description ≥ 30 chars; resolution notes ≥ 20 chars |
| BL-15 | Closed maintenance request cannot be reopened by anyone (incl. Admin) |
| BL-16 | Maintenance staff: read + update only — **cannot create** requests |
| BL-17 | Tenant ≥ 5 requests for same unit in one calendar month → Admin alert |
| BL-18 | Tenant turnover gap is a normal no-lease period (not overdue, not double-bookable) |
| BL-19 | Each PM assigned to exactly one property (partial unique on `properties(active_pm_id)`) |
| BL-20 | After property transfer, previous PM keeps read-only access; writes go to new PM |
| BL-21 | Tenant closes their own resolved request (PMs/Admins do not auto-close) |
| BL-22 | All times stored UTC, displayed in property local time (Asia/Kolkata) |
| BL-23 | Dates rendered DD/MM/YYYY everywhere |

---

## 5. Key cross-cutting conventions

- **API base path:** `/api/v1`. Body limit 100 KB. Pagination = cursor (`?cursor=…`, `meta: { next_cursor, has_more }`, default 20 rows).
- **Error envelope:** `{ error: { code, message, details? } }` on every error — codes from API spec §5 verbatim (e.g. `LEASE_UNIT_OCCUPIED`, `DUPLICATE_ACTIVE_LEASE`, `BL_10_TENANT_CANNOT_RECORD_PAYMENT`). Normalized by `apps/api/src/common/filters/code-error.filter.ts`.
- **Role enum (uppercase strings on the wire, smallint in DB):** `ADMIN | MANAGER | MAINTENANCE | TENANT` ↔ `0 | 1 | 2 | 3`.
- **Append-only state model.** Retire instead of delete; void instead of edit; payments and audit-log are immutable. Voided payments keep the original row with `is_voided`, `voided_by`, `void_reason`.
- **Prepaid credits** stored in a separate `prepaid_credits` table, not inline on `rent_periods`.
- **Idempotency:** `POST /payments` accepts an `Idempotency-Key` header.
- **Rate limits:** `default` 100/min/IP · `login` 10/min/IP · `auth-slow` 5/hour/IP (forgot/reset) · `change-pwd` 5/min/user. Tests raise all limits to 100k.
- **PII redaction** in pino logs covers `password`, `password_hash`, `token`, `refreshToken`, `accessToken`, `secret`, `cookie`, `*.dob`, `*.id_proof_number`, `req.headers.authorization`, `req.headers.cookie`.
- **CORS** allow-list via `WEB_ORIGIN` or comma-list `WEB_ORIGINS`; credentials on for the refresh cookie.
- **Cron jobs** (`@nestjs/schedule`, in-process):
  - 00:05 IST — rent accrual (BL-12 overdue flip + BL-13 late-fee accrual). Idempotent via `RentAccrualLog`.
  - 00:10 IST — maintenance alert sweep (BL-17).
  - 00:15 IST — apply due `RentChangeSchedule` rows.
  - Set `RUN_SCHEDULER=false` on replicas to disable.
- **Design tokens** in [prototype/assets/styles.css](prototype/assets/styles.css) port **verbatim** to [apps/web/tailwind.config.ts](apps/web/tailwind.config.ts). Custom validator UX (errors below field, ⚠ glyph) is re-implemented in React with React-Hook-Form + Zod — **never use native browser tooltips**.

---

## 6. Build status (Phase 0 → 8)

The [docs/planning/v1/MASTER_PLAN.md](docs/planning/v1/MASTER_PLAN.md) lays out 9 phases. Evidence on disk (migrations, security reports, test reports) shows all phases have landed through **Phase 8 closeout**:

| Phase | Scope | Evidence |
|---|---|---|
| **0** | Monorepo scaffold, tooling | root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, docker-compose.yml |
| **1** | Auth + roles + RBAC | `auth/` module, migration `20260510121443_phase_1_auth`, `docs/testing/security/phase-1-auth-review.md` |
| **2** | Properties + Units + Admin user CRUD | migrations `…_phase_2_props_units_users`, `…_phase_2_db_level_guards`; admin pages |
| **3** | Tenants + Leases + co-tenant flows | migration `…_phase_3_tenants_leases`, `pm/leases/[id]`, tenant approval UI |
| **4** | Rent collection + late-fee accrual + cron | migration `…_phase_4_rent_payments`, `rent/` module, `jobs/`, `bl-13-late-fee-breakdown.spec.ts` |
| **5** | Maintenance lifecycle | migration `…_phase_5_maintenance`, `maintenance/` module, BL-14..17/21 specs |
| **6** | Cross-role hardening | `phase-6-pre-vapt-walkthrough.md`, `phase-6-roles-test-report.md` |
| **7** | Security hardening (helmet, throttler, pino redact) | migration `…_phase_7_security_hardening`, throttler in `app.module.ts` |
| **8** | VAPT + final regression | `phase-8-vapt-report.md`, `phase-8-final-regression-report.md`, `phase-8-closeout.md`, `phase-8-bug-list.md` |

Since closeout, the working tree has continued small refinements: int-ID refactor (CUID→BIGSERIAL), late-fee storage drop (computed only), `rent_change_schedule`, user-name split + maintenance specialization, prototype refresh, mobile drawer, `MoreSheet`, role tabbars, two-step login, BUG-002..006 fixes. Latest commits at HEAD `283a245`:

```
283a245 feat(prototype): sync to live app — MoreSheet, role tabbars, login two-step
27c3499 feat: BUG-002..006 fixes + full doc set refresh
f4cbb1c feat: mobile drawer for prototype + responsive sidebar nav refinements
ee61aa6 chore(env): quote seed-password values in .env.example
f815655 docs: prototype + blueprint refresh
20ccd77 feat: password-reset email dispatch + test suite repairs for int-ID/DTO refactor
```

---

## 7. Source-of-truth hierarchy

When two documents disagree, this is the order of authority:

1. **[SRS_Document.md](docs/product/SRS_Document.md)** — single source of truth for product scope, business rules, and stack. §11 resolves any SRS-vs-API-spec conflict.
2. **[docs/product/v1/GharSetu_Model_API_Spec.md](docs/product/v1/GharSetu_Model_API_Spec.md)** — authoritative for endpoint paths, DTO fields, error codes, role-access matrix.
3. **[prototype/](prototype/)** — design contract. Live UI ports it 1:1; tokens in `prototype/assets/styles.css` are non-negotiable.
4. **[Test_Cases.md](docs/testing/v1/Test_Cases.md)** — ~110 test cases mapped back to BL rules (the BL traceability lives at [docs/testing/v1/bl-traceability-matrix.md](docs/testing/v1/bl-traceability-matrix.md)).
5. **`.docx` files** in [docs/product/v1/](docs/product/v1/) — the original blueprint and UI/UX design docs. Binary — convert with `pandoc`/`docx2txt` or have the user excerpt before quoting.
6. **[README.md](README.md)** — developer onboarding (install, env, scripts, troubleshooting).
7. **CLAUDE.md** — **outdated**, see top of this file. Treat as historical until refreshed.

---

## 8. Agent team

Five specialized subagents in [.claude/agents/](.claude/agents/) — invoke via the Task tool with `subagent_type`:

| Agent | Model | Role |
|---|---|---|
| `gharsetu-lead` | Opus 4.7 | Planning, architecture, delegation, cross-module review, synthesis |
| `gharsetu-frontend` | Sonnet 4.6 | Next.js / React / Tailwind / accessibility / API integration |
| `gharsetu-backend` | Sonnet 4.6 | NestJS / Prisma / Postgres / BL enforcement |
| `gharsetu-tester` | Sonnet 4.6 | Jest / Vitest / Playwright / `Test_Cases.md` runs |
| `gharsetu-security` | Sonnet 4.6 | VAPT, OWASP, role-scope leak audits, CVE scans |

Default entry point is **`gharsetu-lead`** for anything non-trivial. See [AGENTS.md](AGENTS.md) for the delivery flow and [Agent_Collaboration_Handbook.docx](docs/planning/v1/Agent_Collaboration_Handbook.docx) for the postmortem template and handoff conventions.

---

## 9. Common pitfalls (read before touching things)

- **Postgres is on `:5433`, not `:5432`** — `docker-compose.yml` deliberately uses a non-default host port. `DATABASE_URL` must match.
- **`@gharsetu/shared` is consumed as compiled `dist/`** — editing `packages/shared/src/**` requires `pnpm build:shared` before either app picks up the change. `postinstall` builds it automatically on `pnpm install`.
- **Migrations are append-only Prisma migrations** — never edit a past migration; create a new one.
- **Currency is paise `BIGINT`** — never store rupees as float. Use `paiseToRupees` / `formatINR` from `@gharsetu/shared`.
- **Validator UX** — do not let `react-hook-form` fall back to native browser tooltips. Errors render below the field with the ⚠ glyph, matching the prototype.
- **Auth tokens** — access JWT in `Authorization: Bearer …`, refresh token in `HttpOnly Secure SameSite=Strict` cookie at `/api/v1/auth`. Never put JWTs in localStorage.
- **No public sign-up, no SMS/WhatsApp, no file uploads, no payment gateway, no 2FA, no session-management UI** — all explicitly descoped in [SRS §9](docs/product/SRS_Document.md) and §11.3.
- **`backups/`** holds raw Postgres dumps from before/around the int-ID refactor. Treat as read-only artefacts.
