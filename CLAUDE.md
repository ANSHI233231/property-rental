# CLAUDE.md

Guidance for Claude Code working in this repo. **Keep this file ≤ 200 lines.** Anything longer goes in a topic doc and gets linked.

## Repository status — current state (2026-05-25)

GharSetu is a Delhi-first property-rental management platform — 120 units / 18 buildings, four roles, no public sign-up. **Not greenfield.** Phase 8 closed 2026-05-11; v1 is **RELEASE-READY pending user sign-off**, with 967/967 unit+integration tests green, 74/74 Playwright (serial) green, and **23/23 business rules locked in**.

Current stack (fixed, see [SRS §10](docs/product/SRS_Document.md)):

| Layer | Choice |
|---|---|
| Runtime | Node.js 22 LTS (`.nvmrc` = `22`) |
| Package mgr | pnpm 9 workspaces |
| Frontend | Next.js 15 (App Router) · React 18 · TS strict · Tailwind 3 · RHF + Zod · Vitest + Playwright (+ axe) |
| Backend | NestJS 10 · Prisma 5 · `@nestjs/schedule` (in-process cron) · `@nestjs/throttler` · `nestjs-pino` · Helmet · `@node-rs/argon2` · Jest + Supertest |
| DB | PostgreSQL 18 (dev on host `:5433` via Docker Compose) |
| Auth | JWT HS256 15min + opaque refresh cookie at `/api/v1/auth` (7d, HttpOnly Secure SameSite=Strict) · Argon2id |
| Locale | Asia/Kolkata · DD/MM/YYYY · ₹ with Indian digit grouping · `en-IN` |
| Currency | paise as `BIGINT` (₹18,000 → `1800000`). No floats. |

`apps/api` and `apps/web` are **git submodules** — clone with `--recurse-submodules` or run `git submodule update --init --recursive`. See [docs/planning/v1/MULTI_REPO_SETUP.md](docs/planning/v1/MULTI_REPO_SETUP.md).

## Operating contract — read these every session

1. **`.claude/skills/harness-engineering/SKILL.md`** — binding rules: session-start ritual, worker-≠-checker, verification gates, clean-state exit. Invoke at the start of any non-trivial planning session.
2. **[claude-progress.md](claude-progress.md)** — rolling cross-session state: current phase, in-flight work, blockers, next priority.
3. **[feature_list.json](feature_list.json)** — machine-readable state for 23 BLs + 9 current-engagement features + 5 post-v1 carry-over items + 4 SAAS design locks + 2 deferred items. **State transitions are gated here.** Only `gharsetu-lead` writes `state: "passing"`, and only after the verification command exits 0.
4. **[CONTEXT.md](CONTEXT.md)** — descriptive snapshot of what's actually on disk today.

## Source-of-truth documents

| Document | Purpose |
|---|---|
| [docs/product/SRS_Document.md](docs/product/SRS_Document.md) | Full spec, including the **23 business rules (BL-01 → BL-23)** in §5. Sacrosanct. |
| [docs/product/v1/GharSetu_Model_API_Spec.md](docs/product/v1/GharSetu_Model_API_Spec.md) | API contract: data models, endpoints, error codes, role matrix. |
| [docs/testing/v1/Test_Cases.md](docs/testing/v1/Test_Cases.md) | ~110 test cases mapped to BLs. |
| [docs/testing/v1/bl-traceability-matrix.md](docs/testing/v1/bl-traceability-matrix.md) | Human-readable BL → passing-test mapping. Sync with `feature_list.json`. |
| [docs/product/Solution_Overview.docx](docs/product/Solution_Overview.docx) | **Current engagement scope (v8 final-close 2026-05-26).** Generated from `doc-assets/templates/generate_solution_overview.js` — never hand-edit. |
| [docs/product/Timeline.xlsx](docs/product/Timeline.xlsx) | **Companion timeline** — Phase Overview + Module Schedule sheets. Generated from `doc-assets/templates/generate_timeline.js`. Do not reference this filename in customer-facing copy. |
| [docs/planning/v2-saas-roadmap.md](docs/planning/v2-saas-roadmap.md) | Deferred SAAS engagement. Locked decisions only. |
| [prototype/](prototype/) | 19 static HTML pages — the design contract. Tokens in `prototype/assets/styles.css`. |

## Agent team

Five subagents in [.claude/agents/](.claude/agents/) — see [AGENTS.md](AGENTS.md) for the full operating model.

| Agent | Model | Use for |
|---|---|---|
| `gharsetu-lead` | Opus 4.7 | Planning, delegation, review, state-file writes |
| `gharsetu-frontend` | Sonnet 4.6 | Next.js, Tailwind, accessibility, API integration |
| `gharsetu-backend` | Sonnet 4.6 | NestJS, Prisma, business-rule enforcement, auth |
| `gharsetu-tester` | Sonnet 4.6 | Unit / integration / e2e tests, regression suites |
| `gharsetu-security` | Sonnet 4.6 | VAPT, OWASP, role-leak audits, auth/payment review |

Plus `document-agent` for `.docx` generation work — see [.claude/agents/document-agent.md](.claude/agents/document-agent.md).

## Project-specific skills (load on demand)

| Skill | When to invoke |
|---|---|
| `harness-engineering` | **Every planning session.** Operating manual for multi-agent work. |
| `gharsetu-ui` | Any frontend / component / responsive / accessibility / role-tabbar work. |
| `gharsetu-backend` | Any NestJS, Prisma, migration, guard, DTO, business-rule, auth, or job work. |
| `document-generation` | Any work touching `.docx` files under `docs/product/`. |

## Session-start checklist (initialization phase)

Before delegating, writing code, or declaring a plan:

```
1. Read claude-progress.md            ← what state are we in?
2. Read feature_list.json             ← what's next / blocked / passing?
3. Read CLAUDE.md + AGENTS.md         ← rules I should know?
4. git log -10                        ← what changed since last session?
5. Invoke harness-engineering skill   ← reminder of the contract
```

## Session-exit checklist (clean state — L12)

```
[ ] pnpm build                                            ← green
[ ] pnpm test                                             ← green
[ ] pnpm lint                                             ← green
[ ] pnpm typecheck                                        ← green
[ ] feature_list.json updated for any state change
[ ] claude-progress.md sections 2, 3, 4, 5 updated
[ ] No stale debug / console.log / commented-out code
[ ] agent-team-change-logs/<agent>-YYYY-MM-DD.md appended
```

## Hard rules (binding on every agent — capped at 15)

> These apply to the **current engagement** (Solution Overview v8 — includes SAAS, Super Admin, Impersonation, Delegation) and the v1 release that precedes it. Only subscription billing and custom-domain branding remain deferred.

1. **The 23 business rules** ([SRS §5](docs/product/SRS_Document.md)) are sacrosanct. Any code or test that violates one fails review.
2. **No public sign-up.** Accounts are created by ADMIN (any role) or PROPERTY_MANAGER (TENANT/MAINTENANCE only).
3. **No DELETE endpoints.** Soft-retire via status/state columns. Audit log is append-only.
4. **Only PM/ADMIN record payments** (BL-10). TENANT or MAINTENANCE → 403.
5. **No auto-approval timers.** BL-08 / BL-09 — termination requires explicit consent.
6. **Argon2id only** for password hashing. Never bcrypt / SHA / MD5.
7. **Wire-stable numeric smallint enums.** Never renumber; new states get the next free integer.
8. **Int autoincrement primary keys.** No CUIDs / UUIDs for new entities.
9. **Migrations are append-only and reversible.** Never edit a shipped migration.
10. **Prototype is the design contract.** Tokens in `prototype/assets/styles.css` port verbatim to `tailwind.config.ts`.
11. **DD/MM/YYYY · ₹ Indian grouping · Asia/Kolkata** everywhere. UTC in DB, IST on the wire.
12. **No SMS/WhatsApp business notifications, no file uploads, no online payment gateway, no 2FA, no multi-session UI, no custom domains or per-organisation branding.** Subscription billing stays manual-invoice only. **Public organisation sign-up IS in scope** (Super Admin approval gate); tenant self-signup is still out.
13. **Worker ≠ Checker.** No agent flips its own `feature_list.json` row to `passing`. Only `gharsetu-lead`, only after verification command exits 0.
14. **Append a change-log entry** to `agent-team-change-logs/<agent>-YYYY-MM-DD.md` at the end of every task.
15. **CLAUDE.md ≤ 200 lines · AGENTS.md ≤ 250 lines.** Topic docs split out; cross-link freely.

## Working in this repo

- **Before any "build/test/lint" request**, just run it — `package.json` has the scripts. No more "verify the stack exists" — the stack is real.
- **For UI / component work**, invoke `gharsetu-ui` skill.
- **For backend / API / Prisma / migration / business-rule work**, invoke `gharsetu-backend` skill.
- **For `.docx` work**, invoke `document-generation` skill (generators in `doc-assets/templates/*.js`; never hand-edit binaries).
- **For multi-agent planning**, invoke `harness-engineering` skill, then `gharsetu-lead`.
- **When `claude-progress.md` and `feature_list.json` disagree**, the JSON wins. Fix the markdown.
- **When CLAUDE.md and CONTEXT.md disagree**, CONTEXT.md is the truth (it's a literal disk snapshot). Fix CLAUDE.md.

## What you do NOT do

- Do **not** write `state: "passing"` to `feature_list.json` from any agent except `gharsetu-lead`.
- Do **not** edit a shipped Prisma migration. Add a new one.
- Do **not** hand-edit binary `.docx` files. Edit the JS generator and regenerate.
- Do **not** treat impersonation, delegation, SAAS layer, or Super Admin as out-of-scope — they were pulled into the current engagement on 2026-05-26. See [feature_list.json](feature_list.json) for the current scope-of-truth and [docs/planning/v2-saas-roadmap.md](docs/planning/v2-saas-roadmap.md) for the supersession history.
- Do **not** mark a task complete without attaching the verification command + its exit code.
