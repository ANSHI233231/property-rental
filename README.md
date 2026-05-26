# GharSetu — Property Rental Management

A Delhi-first property rental management platform for a 120-unit / 18-building portfolio. Replaces paper folders, spreadsheets, and WhatsApp groups with a single role-scoped web app.

**Problem it solves.** Leases lost in physical folders, rent reconciled in error-prone spreadsheets, maintenance tickets buried in WhatsApp threads, no clean audit trail when a property changes hands.

**Who it is for.** Four roles, no public sign-up:

| Code | Role | Scope |
|---|---|---|
| 0 | Admin | All 18 properties, all users |
| 1 | Property Manager | One assigned property |
| 2 | Maintenance Staff | Their assigned tickets only |
| 3 | Tenant | Own lease + unit only |

**Tech stack.**

![Node.js](https://img.shields.io/badge/Node.js-22_LTS-43853d?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-9-F69220?logo=pnpm&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC?logo=tailwind-css&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT_HS256-000?logo=jsonwebtokens&logoColor=white)

See [docs/product/SRS_Document.md](docs/product/SRS_Document.md) for the full spec and [docs/planning/v1/MASTER_PLAN.md](docs/planning/v1/MASTER_PLAN.md) for the phased build plan.

---

## 1. Project Structure

```
property-rental/
├── apps/
│   ├── api/                          # NestJS 10 API — REST + auth + cron
│   │   ├── src/                      # Modules: auth, users, properties, units,
│   │   │                             # tenants, leases, rent, maintenance,
│   │   │                             # rent-change-schedule, audit, audit-log,
│   │   │                             # jobs, health, notifications, common
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # Single source of truth for the DB
│   │   │   ├── migrations/           # 12 versioned migrations
│   │   │   └── seed.ts               # Bootstrap admin + 6 demo users
│   │   ├── .env.example              # API env template
│   │   └── package.json
│   └── web/                          # Next.js 15 App Router — UI for all 5 roles (Super Admin · Admin · PM · Maintenance · Tenant)
│       ├── src/
│       │   ├── app/(public)/         # /login, /forgot-password, /reset-password
│       │   ├── app/(app)/admin/      # Admin pages
│       │   ├── app/(app)/pm/         # PM pages
│       │   ├── app/(app)/maintenance/# Maintenance staff pages
│       │   ├── app/(app)/tenant/     # Tenant pages
│       │   ├── components/           # admin/, pm/, tenant/, maintenance/, ui/
│       │   ├── lib/                  # api/, auth/, pagination/, locale/, rent/
│       │   └── middleware.ts         # Edge auth + role-cookie gate
│       ├── .env.example              # Web env template
│       └── package.json
├── packages/
│   └── shared/                       # @gharsetu/shared — enums, Zod schemas, formatters
│       ├── src/                      # Consumed by both apps via compiled dist/
│       └── package.json
├── prototype/                        # 19 static HTML pages — the design contract
├── docs/                             # All spec + planning + product + security + testing
│   ├── product/                      # SRS_Document.md + v1/ (blueprint, UI/UX, API spec .docx)
│   ├── testing/v1/                   # Test_Cases.md + phase-1..8 test reports + bl-traceability
│   ├── planning/                     # DOCUMENT_AGENT.md + v1/ (MASTER_PLAN, MULTI_REPO_SETUP, TODO, phase-0)
│   └── security/                     # phase-1..8 security review reports
├── doc-assets/templates/             # .docx generators (JS source of truth)
├── agent-team-change-logs/           # Per-task append-only logs (human + agent)
├── .claude/
│   ├── agents/                       # 6 subagents — lead, frontend, backend,
│   │                                 #  tester, security, document-agent
│   └── skills/                       # harness-engineering, gharsetu-ui,
│                                     #  gharsetu-backend, document-generation
├── CLAUDE.md                         # Repo guidance for Claude Code (≤ 200 lines)
├── AGENTS.md                         # Agent team operating model
├── CONTEXT.md                        # Disk-snapshot reference (descriptive)
├── claude-progress.md                # Rolling cross-session state memory
├── feature_list.json                 # Machine-readable BL + feature state
├── docker-compose.yml                # Local dev — Postgres 18 on host :5433
├── .env.example                      # Root env template (covers API + Web)
├── smoke.sh                          # Quick end-to-end API smoke test
├── pnpm-workspace.yaml               # pnpm workspaces config
└── package.json                      # Root scripts: build / test / lint / dev:db
```

> **Working with Claude Code in this repo?** Read [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) first. The agent team operates under the contract in [`.claude/skills/harness-engineering/SKILL.md`](.claude/skills/harness-engineering/SKILL.md): session-start ritual, worker-≠-checker verification gates, clean-state exit. State lives in [claude-progress.md](claude-progress.md) (rolling memory) and [feature_list.json](feature_list.json) (machine-readable BL + feature state — currently **23/23 BLs passing**, 5 v3.1 features `not_started`).

---

## 2. Prerequisites

| Tool | Required version | Check command |
|---|---|---|
| Node.js | ≥ 22.0.0 (LTS) | `node --version` |
| pnpm | ≥ 9.0.0 | `pnpm --version` |
| Docker (with Compose v2) | any recent | `docker --version && docker compose version` |
| PostgreSQL client (optional, for `psql` debugging) | 14+ | `psql --version` |

**Node version pin.** The repo includes [`.nvmrc`](.nvmrc) (`22`). If you use `nvm`, run `nvm use` from the project root.

**No global installs needed.** Everything (Next.js CLI, Nest CLI, Prisma CLI, ESLint, TypeScript) is pinned per workspace and resolved via pnpm.

---

## 3. Environment Variables

### 3.1 Backend — `apps/api/.env`

| Variable | Description | Example | Required |
|---|---|---|---|
| `NODE_ENV` | Runtime mode. `production` raises Pino log level to `info` and disables `pino-pretty`. | `development` | yes |
| `API_PORT` | Port the NestJS HTTP server listens on. | `3001` | yes |
| `API_HOST` | Bind address. `0.0.0.0` for containers, `127.0.0.1` for local-only. | `0.0.0.0` | yes |
| `DATABASE_URL` | Postgres connection string. Note the **`:5433`** port — that's what `docker-compose.yml` maps to host. | `postgresql://gharsetu:gharsetu_dev_pw@localhost:5433/gharsetu?schema=public` | yes |
| `RUN_SCHEDULER` | Set to `false` on extra API replicas to disable the cron triggers and avoid duplicate runs. Unset / `true` enables them. | (unset) | optional |
| `JWT_SECRET` | HS256 signing secret. **Minimum 32 random bytes** — generate with `openssl rand -hex 32`. | `7f3a…` (32+ chars) | yes |
| `JWT_ACCESS_TTL` | Access-token lifetime. | `15m` | yes |
| `JWT_REFRESH_TTL` | Refresh-token lifetime. | `7d` | yes |
| `WEB_ORIGIN` | Single CORS allow-list origin. | `http://localhost:3000` | yes (or use `WEB_ORIGINS`) |
| `WEB_ORIGINS` | Comma-separated CORS allow-list. Takes priority over `WEB_ORIGIN`. | `http://localhost:3000,https://app.example.com` | optional |
| `BOOTSTRAP_ADMIN_EMAIL` | Email of the bootstrap admin created by `prisma db seed`. | `admin@triline.co` | yes (for seed) |
| `BOOTSTRAP_ADMIN_PASSWORD` | Password for the bootstrap admin. Min 10 chars, at least one letter and one digit. | `Password#123` | yes (for seed) |
| `SEED_TEST_PASSWORD` | Shared password for the six demo PM/Maintenance/Tenant accounts. | `Password#123` | yes (for seed) |
| `SEED_DEMO_DOMAIN` | Domain used for the demo accounts (`pm@<domain>`, `maintance@<domain>`, `tennat@<domain>`). | `triline.co` | optional, default `triline.co` |
| `SMTP_HOST` | SMTP server host for outbound email (password reset, rent-change notifications). | `smtp.sendgrid.net` | optional |
| `SMTP_PORT` | SMTP port. | `587` | optional |
| `SMTP_USER` | SMTP username. | `apikey` | optional |
| `SMTP_PASS` | SMTP password / API key. | (secret) | optional |
| `SMTP_FROM` | From: address on outbound mail. | `no-reply@gharsetu.app` | optional |

If any `SMTP_*` is missing, `EmailService` runs in **log-only mode** — emails are written to the Pino logger but never sent.

### Backend `.env` template (copy-pasteable)

```
NODE_ENV=development
API_PORT=3001
API_HOST=0.0.0.0

DATABASE_URL=postgresql://gharsetu:gharsetu_dev_pw@localhost:5433/gharsetu?schema=public

# RUN_SCHEDULER=true

JWT_SECRET=replace_with_at_least_32_random_chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

BOOTSTRAP_ADMIN_EMAIL=admin@triline.co
BOOTSTRAP_ADMIN_PASSWORD=Password#123
SEED_TEST_PASSWORD=Password#123
# SEED_DEMO_DOMAIN=triline.co

WEB_ORIGIN=http://localhost:3000
# WEB_ORIGINS=http://localhost:3000,https://app.example.com

# Outbound email (optional). If any of these is unset, emails are logged only.
# SMTP_HOST=
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=no-reply@gharsetu.app
```

### 3.2 Frontend — `apps/web/.env.local`

| Variable | Description | Example | Required |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the NestJS API, **including the `/api/v1` prefix**. Read at module-eval time in `apps/web/src/lib/api/client.ts`. | `http://localhost:3001/api/v1` | yes (default is local URL) |

### Frontend `.env.local` template (copy-pasteable)

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1
```

---

## 4. Installation & Setup

> **This is a multi-repo setup.** The backend (`apps/api`) and frontend (`apps/web`) live in their own GitHub repos and are wired into this meta repo as **git submodules**. You **must** clone with `--recurse-submodules` (or run `git submodule update --init --recursive` afterwards), otherwise `apps/api` and `apps/web` will be empty folders.
>
> - Meta:     https://github.com/ANSHI233231/property-rental
> - Backend:  https://github.com/ANSHI233231/property-rental-api  →  `apps/api`
> - Frontend: https://github.com/ANSHI233231/property-rental-web  →  `apps/web`
>
> Day-2 workflow (editing a sub-repo, bumping the pointer in this meta repo, etc.) is documented in [MULTI_REPO_SETUP.md](docs/planning/v1/MULTI_REPO_SETUP.md).

```bash
# 1. Clone (note --recurse-submodules)
git clone --recurse-submodules git@github.com:ANSHI233231/property-rental.git
cd property-rental

# If you forgot --recurse-submodules:
#   git submodule update --init --recursive

# 2. Install dependencies. The `postinstall` hook automatically builds
#    @gharsetu/shared so apps/web and apps/api can resolve its dist/.
pnpm install

# 3. Configure environment.
cp .env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Edit apps/api/.env — set JWT_SECRET, BOOTSTRAP_ADMIN_PASSWORD, SEED_TEST_PASSWORD.

# 4. Start the dev Postgres (host port 5433).
pnpm dev:db

# 5. Apply DB migrations.
pnpm --filter @gharsetu/api exec prisma migrate deploy

# 6. Seed the bootstrap admin + 6 demo users.
pnpm --filter @gharsetu/api prisma:db:seed

# 7. (Optional) Build everything once to catch issues before you run.
pnpm build
```

---

## 5. Running the Project

### Everything together

There is no single `pnpm dev` orchestrator yet — run the two apps in two terminals (the dev Postgres only needs to be started once).

### Backend only — `http://localhost:3001/api/v1`

```bash
pnpm --filter @gharsetu/api start:dev
```

Hot reload via `nest start --watch`. Cron jobs are wired in: rent-accrual at 00:05 IST, maintenance-alert at 00:10 IST, rent-change-apply at 00:15 IST. Disable them on a replica with `RUN_SCHEDULER=false`.

### Frontend only — `http://localhost:3000`

```bash
pnpm --filter @gharsetu/web dev
```

Next.js Fast Refresh — edits to `apps/web/src/**` apply without a full reload. **Note:** if you edit `packages/shared/src/**`, you must rebuild shared (`pnpm build:shared`) before either app picks up the new symbol.

### Useful URLs

| URL | What |
|---|---|
| `http://localhost:3000` | Web app (after login, lands on role dashboard) |
| `http://localhost:3000/login` | Login page (seeded admin → `admin@triline.co` / `Password#123`) |
| `http://localhost:3001/api/v1/health` | API liveness + DB ping |

---

## 6. Available Scripts

| Command | Where to run | What it does |
|---|---|---|
| `pnpm install` | repo root | Install everything + auto-build `@gharsetu/shared` via `postinstall` |
| `pnpm build` | repo root | Build packages then apps (correct order) |
| `pnpm build:shared` | repo root | Rebuild only `@gharsetu/shared` |
| `pnpm test` | repo root | `pnpm -r test` — Jest in API, Vitest in Web |
| `pnpm lint` | repo root | `pnpm -r lint` — ESLint with `--max-warnings 0` |
| `pnpm typecheck` | repo root | `pnpm -r typecheck` — `tsc --noEmit` everywhere |
| `pnpm dev:db` | repo root | `docker compose up -d postgres` |
| `pnpm dev:db:down` | repo root | `docker compose down` |
| `pnpm --filter @gharsetu/api start:dev` | repo root | Nest `start --watch` on port 3001 |
| `pnpm --filter @gharsetu/api build` | repo root | `nest build` to `dist/` |
| `pnpm --filter @gharsetu/api start` | repo root | `node dist/main.js` (production-style) |
| `pnpm --filter @gharsetu/api test` | repo root | `NODE_ENV=test jest --runInBand` |
| `pnpm --filter @gharsetu/api test:watch` | repo root | Jest watch mode |
| `pnpm --filter @gharsetu/api lint` | repo root | ESLint on `src/**/*.ts` |
| `pnpm --filter @gharsetu/api typecheck` | repo root | `tsc --noEmit` |
| `pnpm --filter @gharsetu/api prisma:generate` | repo root | Regenerate Prisma client |
| `pnpm --filter @gharsetu/api prisma:migrate:dev` | repo root | Create + apply a new migration |
| `pnpm --filter @gharsetu/api prisma:db:push` | repo root | Sync schema without a migration (dev only) |
| `pnpm --filter @gharsetu/api prisma:db:seed` | repo root | Run `prisma/seed.ts` |
| `pnpm --filter @gharsetu/api exec prisma migrate deploy` | repo root | Apply pending migrations (production-style) |
| `pnpm --filter @gharsetu/api exec prisma migrate status` | repo root | Show which migrations are applied/pending |
| `pnpm --filter @gharsetu/web dev` | repo root | Next.js dev server on port 3000 |
| `pnpm --filter @gharsetu/web build` | repo root | `next build` |
| `pnpm --filter @gharsetu/web start` | repo root | `next start` on port 3000 |
| `pnpm --filter @gharsetu/web lint` | repo root | `next lint --max-warnings 0` |
| `pnpm --filter @gharsetu/web typecheck` | repo root | `tsc --noEmit` |
| `pnpm --filter @gharsetu/web test` | repo root | Vitest |
| `./smoke.sh` | repo root | End-to-end API smoke test (login + 4 list endpoints) |

---

## 7. Services & Integrations

### PostgreSQL 18
- **Used for:** every persistent record — users, properties, units, leases, payments, maintenance, audit log.
- **Setup (dev):** `pnpm dev:db` brings up `postgres:18-alpine` via Compose on host port **5433** (deliberately non-default to avoid clashing with a system Postgres).
- **Env var:** `DATABASE_URL`.
- **Free tier:** N/A — open-source. Production should use a managed Postgres (AWS RDS, Supabase, Neon, etc.).

### SMTP (any provider via Nodemailer)
- **Used for:** password-reset emails, rent-change notifications, lease creation / termination, deposit-refund receipts.
- **Setup:** any SMTP provider — SendGrid ([sendgrid.com](https://sendgrid.com)), Postmark, Amazon SES, Mailgun, or your own server. Free tiers available from SendGrid (100 emails/day), Mailgun (free trial), Brevo (300/day).
- **Env vars:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- **Fallback:** if any is missing, emails are logged via Pino but not sent. Safe for local dev.

### Docker (local infra only)
- **Used for:** running Postgres for local development. Production deployments use managed services.
- **Setup:** install Docker Desktop (Mac/Win) or Docker Engine + Compose v2 (Linux).
- **Free tier:** yes — Docker is free for personal / small-business use.

---

## 8. Database Setup

**Engine:** PostgreSQL 18 (Alpine image) for dev. Schema lives in [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma). 12 versioned migrations on disk.

### Create the dev database

```bash
pnpm dev:db
# postgres container 'gharsetu-postgres' listens on host :5433
```

The compose file pre-creates user `gharsetu` / password `gharsetu_dev_pw` / db `gharsetu`.

### Apply migrations

```bash
# Production-style — applies all pending migrations, no prompts.
pnpm --filter @gharsetu/api exec prisma migrate deploy

# Dev — creates a new migration from current schema.prisma drift.
pnpm --filter @gharsetu/api prisma:migrate:dev
```

### Seed

```bash
pnpm --filter @gharsetu/api prisma:db:seed
```

Creates **1 bootstrap admin** (from `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD`) and **6 demo users** (all using `SEED_TEST_PASSWORD`):

| Role | Email (default domain `triline.co`) |
|---|---|
| Admin | `admin@triline.co` (or your `BOOTSTRAP_ADMIN_EMAIL`) |
| Property Manager | `pm@triline.co`, `pm.test@gharsetu.local` |
| Maintenance | `maintance@triline.co`, `maintenance.test@gharsetu.local` |
| Tenant | `tennat@triline.co`, `tenant.test@gharsetu.local` |

The seed is **idempotent** — re-running it rotates passwords and ensures `is_active = true`.

### Reset the database (destructive — dev only)

```bash
# Wipe + reapply all migrations + run seed.
pnpm --filter @gharsetu/api exec prisma migrate reset

# Or destroy the docker volume and start fresh:
docker compose down -v
pnpm dev:db
pnpm --filter @gharsetu/api exec prisma migrate deploy
pnpm --filter @gharsetu/api prisma:db:seed
```

### Check migration status

```bash
pnpm --filter @gharsetu/api exec prisma migrate status
```

---

## 9. API Overview

| Item | Value |
|---|---|
| Base URL (local) | `http://localhost:3001/api/v1` |
| Base URL (prod) | _not deployed — managed-services target_ |
| Body format | JSON (max 100 KB enforced by `express.json` limit) |
| Auth | **JWT HS256** (15-min access token in `Authorization: Bearer …`) + **opaque rotating refresh token** in `HttpOnly Secure SameSite=Strict` cookie at `/api/v1/auth` (7-day) |
| Password hashing | **Argon2id** |
| Rate limits | `default` 100/min/IP · `login` 10/min/IP · `auth-slow` (forgot/reset password) 5/hour/IP · `change-pwd` 5/min/user |
| CORS | Allow-list via `WEB_ORIGIN` / `WEB_ORIGINS`; credentials enabled for the refresh cookie |
| Headers | Helmet (strict CSP `default-src 'none'`), `Referrer-Policy: no-referrer`, `Strict-Transport-Security` |
| Logging | Pino (`nestjs-pino`) with PII redaction (`password`, `password_hash`, `token`, `refreshToken`, `accessToken`, `secret`, `cookie`, `*.dob`, `*.id_proof_number`, `req.headers.authorization`, `req.headers.cookie`) |
| Idempotency | `POST /payments` accepts an `Idempotency-Key` header — duplicate keys collapsed to the original response |

### Endpoint groups

| Module | Base path | Notes |
|---|---|---|
| Auth | `/auth/*` | `login`, `refresh`, `logout`, `forgot-password`, `reset-password` |
| Users | `/users/*` | Self-service (`/me`, `/me/change-password`) + admin CRUD + `:id/reset-password`, `:id/activate`, `:id/deactivate` |
| Properties | `/properties/*` | CRUD + `:id/transfer-pm` |
| Units | `/units/*`, `/properties/:propertyId/units/*` | CRUD + `:id/state`, `:id/retire` |
| Tenants | `/tenants/*`, `/properties/:propertyId/tenants` | Detail + update; list redacts PII |
| Leases | `/leases/*`, `/properties/:propertyId/units/:unitId/leases` | Create, renew, terminate-request/approve/withdraw/finalize, deposit-refunds |
| Rent | `/rent-periods/*`, `/payments/*` | Periods, record payment, void payment |
| Maintenance | `/maintenance-requests/*` | List, create, assign, in-progress, resolve, close, alerts, dismiss-alert |
| Rent change | `/units/:unitId/rent-schedule/*` | Schedule, modify, cancel, get; `tenant-view` for the in-app banner |
| Audit log | `/audit-log/*` | Read-only paginated query (ADMIN) |
| Jobs | `/jobs/*` | Admin-triggered manual runs: `rent-accrual/run`, `maintenance-alert/run`, `rent-change-apply/run` |
| Health | `/health` | Public liveness + DB ping |

Full design + per-endpoint contract: see [`Design_Document.docx`](docs/product/v1/Design_Document.docx) §4 and [`docs/product/v1/GharSetu_Model_API_Spec.md`](docs/product/v1/GharSetu_Model_API_Spec.md).

---

## 10. Troubleshooting

### Login fails with "An unexpected error occurred"
Browser DevTools shows `Provisional headers shown` and 0 B response.

- **Cause:** the API isn't running, or `NEXT_PUBLIC_API_BASE_URL` points somewhere that isn't.
- **Fix:** in another terminal, `pnpm --filter @gharsetu/api start:dev`. Confirm it's listening: `curl http://localhost:3001/api/v1/health`.

### `prisma migrate` fails: `column "users.first_name" does not exist`
- **Cause:** the DB was seeded against an older schema and pending migrations weren't applied.
- **Fix:** `pnpm --filter @gharsetu/api exec prisma migrate deploy` then re-run the seed.

### API errors immediately with `connect ECONNREFUSED 127.0.0.1:5432`
- **Cause:** `DATABASE_URL` is pointing at host port **5432**, but the dev Postgres listens on **5433** (compose intentionally avoids 5432 to not clash with a system Postgres).
- **Fix:** in `apps/api/.env`, set `DATABASE_URL=postgresql://gharsetu:gharsetu_dev_pw@localhost:5433/gharsetu?schema=public`.

### "Port 3000 is in use" / "Port 3001 is in use"
- **Cause:** another process is bound to the port (often a previous dev run).
- **Fix (Linux/Mac):** `lsof -i :3000` to identify the PID, then `kill <pid>`. Or change the port: Web uses `next dev -p <PORT>`; API reads `API_PORT` from `.env`.

### CORS error on the browser console: `Access-Control-Allow-Origin missing`
- **Cause:** the API's allow-list doesn't include the Web origin. Defaults to `http://localhost:3000`; trips if you change the Web port or run it from a different hostname.
- **Fix:** in `apps/api/.env`, set `WEB_ORIGIN=http://localhost:<port>` or use `WEB_ORIGINS=http://localhost:3000,http://localhost:3010` (comma list).

### Missing env var: `[Nest] ConfigService is null` or `JWT_SECRET undefined`
- **Cause:** `apps/api/.env` wasn't created or is in the wrong folder.
- **Fix:** `cp .env.example apps/api/.env` and edit. The API reads `.env` from `apps/api/.env` via `@nestjs/config` `envFilePath: [".env"]`.

### Build fails: `Cannot find module '@gharsetu/shared'`
- **Cause:** the shared package wasn't compiled. Apps import from its `dist/`, which is gitignored.
- **Fix:** `pnpm build:shared` (or simply re-run `pnpm install` — the `postinstall` hook builds shared automatically).

### Build fails: `Cannot find module 'next'` / `Cannot find module '@nestjs/core'`
- **Cause:** dependencies weren't installed.
- **Fix:** `pnpm install` at the repo root.

### `./smoke.sh` prints `Login failed.`
- **Cause:** the script's defaults expect the local seed values. Override if your seed used different creds: `ADMIN_EMAIL=… ADMIN_PASSWORD='…' ./smoke.sh`.

### Edits to `packages/shared/src/**` don't show up
- **Cause:** apps consume the compiled `dist/`. Editing source doesn't rebuild.
- **Fix:** `pnpm build:shared`, then restart the dev server.

### Postgres container starts but won't accept connections
- **Cause:** stale volume from an older Postgres major version, or the host's port 5433 is already taken.
- **Fix:** `docker compose down -v` (destroys the volume — only for dev) then `pnpm dev:db`. If the port is taken, change the host port in `docker-compose.yml` and update `DATABASE_URL`.

---

## 11. Contributing

### Branch naming
- `feat/<short-slug>` — new feature
- `fix/<short-slug>` or `bugfix/<bug-id>-<slug>` — bug fix (Bug ID from the team handbook is preferred)
- `chore/<short-slug>` — tooling, deps, infra
- `refactor/<short-slug>` — no behaviour change
- `docs/<short-slug>` — docs only
- `security/<short-slug>` — security fix (include the finding ID if you have one)

Lowercase, hyphen-separated, ≤ 50 chars. Never push to `main` directly.

### Commit message format
[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <imperative summary, ≤ 60 chars, no trailing period>

Optional body — wrap at 72 chars. Explain WHY, not what (the diff already
shows what). Reference the bug / SRS / BL number / test case ID.

Refs: GS-001
```

Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `security`, `perf`, `style`.
Scopes: `auth`, `users`, `units`, `leases`, `rent`, `maintenance`, `audit`, `web`, `api`, `prisma`, etc.

### PR process
1. Branch off the latest `main`.
2. Make the change. Add or update tests in the same PR.
3. Run the full quality gate locally before opening the PR:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   ```
4. Open the PR with a body that includes: Summary, Linked Bug ID, Business rules touched (BL-numbers), Test plan + new test names, Screenshots for any UI change, Risk + rollback note.
5. Get one peer review in the same layer (Frontend reviews Frontend, etc.) + an extra Security review for any auth / payment / consent change.

### Running tests before submitting

```bash
# Everything, in CI mode:
pnpm lint && pnpm typecheck && pnpm test && pnpm build

# Just one app:
pnpm --filter @gharsetu/api test
pnpm --filter @gharsetu/web test

# Smoke against a running stack:
./smoke.sh
```

For more on team workflow, postmortem template, and the agent collaboration model, see [`Agent_Collaboration_Handbook.docx`](docs/planning/v1/Agent_Collaboration_Handbook.docx).

---

## Seeded accounts (dev only)

After `prisma db seed`:

| Role | Email | Password source |
|---|---|---|
| Admin | from `BOOTSTRAP_ADMIN_EMAIL` (default `admin@triline.co`) | `BOOTSTRAP_ADMIN_PASSWORD` |
| PM | `pm@triline.co`, `pm.test@gharsetu.local` | `SEED_TEST_PASSWORD` |
| Maintenance | `maintance@triline.co`, `maintenance.test@gharsetu.local` | `SEED_TEST_PASSWORD` |
| Tenant | `tennat@triline.co`, `tenant.test@gharsetu.local` | `SEED_TEST_PASSWORD` |

Rotate every value above before deploying anywhere shared.
