# GharSetu — Property Rental Management

Delhi-first property rental management platform for a 120-unit / 18-building portfolio.
Four roles (Admin, Property Manager, Maintenance Staff, Tenant); no public sign-up.

See [SRS_Document.md](SRS_Document.md) for the full spec and [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md) for the phased build plan.

## Tech Stack

- **Frontend** — Next.js 15+ (App Router), TypeScript, Tailwind CSS
- **Backend** — NestJS (N-1), Node.js 22 LTS, Prisma
- **Database** — PostgreSQL 18
- **Monorepo** — pnpm workspaces: `apps/web`, `apps/api`, `packages/shared`
- **Scheduling** — `@nestjs/schedule` (in-process cron; no Redis required)

## Prerequisites

- Node.js ≥ 22 LTS
- pnpm ≥ 9
- Docker (for the local Postgres container)

## Setup

```bash
# 1. Install deps. The `postinstall` hook automatically builds
#    @gharsetu/shared so apps/web and apps/api can resolve its dist/.
pnpm install

# 2. Start Postgres (port 5433 on host).
pnpm dev:db

# 3. Configure env. Copy the template and fill in real secrets:
cp .env.example apps/api/.env
#    Then edit JWT_SECRET, BOOTSTRAP_ADMIN_*, SEED_TEST_PASSWORD as needed.

# 4. Apply migrations + seed the bootstrap admin and test users.
pnpm --filter @gharsetu/api exec prisma migrate deploy
pnpm --filter @gharsetu/api exec prisma db seed

# 5. Build everything (shared first, then apps).
pnpm build
```

### Running

```bash
# API (port 3001)
pnpm --filter @gharsetu/api start:dev

# Web (port 3000, in a second terminal)
pnpm --filter @gharsetu/web dev
```

## Build order (important)

`@gharsetu/shared` is consumed by both apps via its compiled `dist/`. The `dist/`
directory is **gitignored** (build artifact, not source) and is rebuilt automatically
on every `pnpm install` via the root `postinstall` hook.

If you ever edit something in `packages/shared/src/` and the apps stop resolving
the new symbol, rebuild shared explicitly:

```bash
pnpm build:shared   # or:  pnpm --filter @gharsetu/shared build
```

The full build (`pnpm build`) always builds packages before apps:

```bash
pnpm -r --filter "./packages/**" build && pnpm -r --filter "./apps/**" build
```

## Common commands

```bash
pnpm build        # build shared + api + web in correct order
pnpm test         # run every workspace's test suite
pnpm lint         # eslint across api + web (shared has no lint yet)
pnpm typecheck    # tsc --noEmit across all workspaces
pnpm dev:db       # start the Postgres docker container
pnpm dev:db:down  # stop the docker compose stack
```

## Seeded accounts (dev only)

After `prisma db seed`:

| Role | Email | Password source |
|---|---|---|
| Admin | from `BOOTSTRAP_ADMIN_EMAIL` | `BOOTSTRAP_ADMIN_PASSWORD` |
| PM | `pm.test@gharsetu.local` | `SEED_TEST_PASSWORD` |
| Maintenance | `maintenance.test@gharsetu.local` | `SEED_TEST_PASSWORD` |
| Tenant | `tenant.test@gharsetu.local` | `SEED_TEST_PASSWORD` |

Replace these before any non-local deployment.
