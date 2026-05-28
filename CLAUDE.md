# CLAUDE.md

Guidance for Claude Code working in this repo. **Keep this file ≤ 200 lines.** Anything longer goes in a topic doc and gets linked.

## Repository status — current state (2026-05-26)

GharSetu is a Delhi-first property-rental management platform — 120 units / 18 buildings, four operational roles + one platform role. **Not greenfield.** Phase 8 closed 2026-05-11; v1 is **RELEASE-READY pending user sign-off**, with 967/967 unit+integration tests green, 74/74 Playwright (serial) green, and **23/23 business rules locked in**. Current engagement scope (Solution Overview v8) adds SAAS layer, Super Admin role, Admin Impersonation, Admin Task Delegation, per-room leasing, Visitor Management, Master Data Administration and Settings.

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

`apps/api` and `apps/web` are **git submodules** — clone with `--recurse-submodules` or run `git submodule update --init --recursive`. See [docs/planning/v1/MULTI_REPO_SETUP.md](./docs/planning/v1/MULTI_REPO_SETUP.md).

## Operating contract — read these every session

1. **`.claude/skills/harness-engineering/SKILL.md`** — session rituals, worker-≠-checker, verification gates, clean-state exit.
2. **[claude-progress.md](./claude-progress.md)** — rolling cross-session state: current phase, in-flight work, blockers, next priority.
3. **[feature_list.json](./feature_list.json)** — machine-readable state. **State transitions are gated here.** Only `gharsetu-lead` writes `state: "passing"`, only after the verification command exits 0.
4. **[CONTEXT.md](./CONTEXT.md)** — descriptive snapshot of what's actually on disk today.

## Source-of-truth documents

| Document | Purpose |
|---|---|
| [docs/product/SRS_Document.md](./docs/product/SRS_Document.md) | Full spec including 23 business rules (BL-01 → BL-23). Sacrosanct. |
| [docs/product/v1/GharSetu_Model_API_Spec.md](./docs/product/v1/GharSetu_Model_API_Spec.md) | API contract: data models, endpoints, error codes, role matrix. |
| [docs/testing/v1/Test_Cases.md](./docs/testing/v1/Test_Cases.md) | ~110 test cases mapped to BLs. |
| [docs/testing/v1/bl-traceability-matrix.md](./docs/testing/v1/bl-traceability-matrix.md) | BL → passing-test mapping. Sync with `feature_list.json`. |
| [docs/product/Solution_Overview.docx](./docs/product/Solution_Overview.docx) | **Current engagement scope (v8).** Generated from `doc-assets/templates/generate_solution_overview.js`. |
| [docs/product/UIUX_Design_Document.docx](./docs/product/UIUX_Design_Document.docx) | **UI/UX design spec — prototype builds against this.** Generated from `doc-assets/templates/generate_design_document.js`. |
| [docs/product/Timeline.xlsx](./docs/product/Timeline.xlsx) | Companion timeline (Phase Overview + Module Schedule). Generated from `doc-assets/templates/generate_timeline.js`. Do not reference by filename in client-facing copy. |
| [docs/planning/FEATURE_PLANNING.md](./docs/planning/FEATURE_PLANNING.md) | Process + template for per-feature planning files. |
| [prototype/](./prototype/) | 29 static HTML pages — the design contract. Tokens in `prototype/assets/styles.css`. |

## Agent team

Five specialist subagents in [.claude/agents/](./.claude/agents/) — see [AGENTS.md](./AGENTS.md) for the full operating model.

| Agent | Model | Use for |
|---|---|---|
| `gharsetu-lead` | Opus 4.7 | Planning, delegation, review, state-file writes |
| `gharsetu-frontend` | Sonnet 4.6 | Next.js, Tailwind, accessibility, API integration |
| `gharsetu-backend` | Sonnet 4.6 | NestJS, Prisma, business-rule enforcement, auth |
| `gharsetu-tester` | Sonnet 4.6 | Unit / integration / e2e tests, regression suites |
| `gharsetu-security` | Sonnet 4.6 | VAPT, OWASP, role-leak audits, auth/payment review |

Plus `document-agent` for `.docx` / `.xlsx` work — see [.claude/agents/document-agent.md](./.claude/agents/document-agent.md).

## Project-specific skills

| Skill | When to invoke |
|---|---|
| `harness-engineering` | Every planning session. Operating manual for multi-agent work. |
| `gharsetu-ui` | Any frontend / component / responsive / accessibility / role-tabbar work. |
| `gharsetu-backend` | Any NestJS, Prisma, migration, guard, DTO, business-rule, auth, or job work. |
| `document-generation` | Any work touching `.docx` files under `docs/product/`. |

## Session-start checklist

```
1. Read claude-progress.md            ← what state are we in?
2. Read feature_list.json             ← what's next / blocked / passing?
3. Read CLAUDE.md + AGENTS.md         ← rules I should know?
4. git log -10                        ← what changed since last session?
5. Invoke harness-engineering skill   ← reminder of the contract
```

## Session-exit checklist

```
[ ] pnpm build · pnpm test · pnpm lint · pnpm typecheck — all green
[ ] feature_list.json updated for any state change
[ ] claude-progress.md sections 2, 3, 4, 5 updated
[ ] No stale debug / console.log / commented-out code
[ ] agent-team-change-logs/<agent>-YYYY-MM-DD.md appended
```

## Working rules — how this team operates

> Process rules — read every session. These are **not** business rules.

1. **Never commit or push** without an explicit user instruction. Local edits and regenerated artifacts are fine; `git commit` and `git push` require the user to ask.
2. **Plan first.** Every new feature or significant change gets a planning file at `docs/planning/features/<YYYY-MM-DD>-<short-slug>.md` BEFORE any code is written. See [docs/planning/FEATURE_PLANNING.md](./docs/planning/FEATURE_PLANNING.md) for the template + reactivation discipline.
3. **`gharsetu-lead` orchestrates; specialists write.** The lead does not write code itself — it delegates to `gharsetu-frontend`, `gharsetu-backend`, `gharsetu-tester`, `gharsetu-security`. Anything non-trivial routes through the lead.
4. **Worker ≠ Checker.** No agent flips its own `feature_list.json` row to `passing`. Only `gharsetu-lead`, only after the verification command exits 0 in a clean environment.
5. **Append a change-log entry** to `agent-team-change-logs/<agent>-YYYY-MM-DD.md` at the end of every task.
6. **Apps are git submodules.** `apps/api` and `apps/web` live in their own repos; commits + pushes happen there. The meta repo only bumps the submodule pointer.
7. **Relative paths in markdown.** Internal links use `./path/...`, never absolute `/Users/...` paths.
8. **CONTEXT.md mirrors the actual repo.** When a top-level file or folder appears, disappears, or changes purpose, update it.
9. **SRS, prototype, and live app stay in sync — always.** Any new or changed feature is reflected in all three in the same change: the `prototype/` HTML, the **SRS** ([docs/product/SRS_Document.md](./docs/product/SRS_Document.md) — §3 pages · §4 modules · §5 BL/NR rules · §9 scope), and the eventual `apps/`. Never let the prototype drift ahead of the SRS or vice-versa. Capture the change list in `docs/planning/prototype-changes.md`.
10. **`.docx` and `.xlsx` are generated from JS** in `doc-assets/templates/`. Never hand-edit the binary; edit the generator and regenerate.
11. **CLAUDE.md ≤ 200 lines · AGENTS.md ≤ 250 lines.** Topic docs split out; cross-link freely.

## Technical conventions

12. **Database tables and columns use snake_case** (e.g. `lease_terminations`, `monthly_rent_paise`).
13. **No FOREIGN KEY constraints in PostgreSQL.** Every relation is declared in Prisma via `@relation`, never as an SQL `FOREIGN KEY`.
14. **Schema changes ship as Prisma migrations.** Migrations are append-only and reversible — never edit a shipped migration.
15. **Every mutation writes an `audit_log` row.** `audit_log` is append-only — no UPDATE, no DELETE on it ever.
16. **Frontend validation (Zod) mirrors backend validation (class-validator)** for every field. The browser's native HTML5 validation (`required`, `pattern`, `min`, `:invalid` tooltips) is not used — errors render below the field per the UI/UX contract.
17. **Sensitive files never enter git.** `.env`, `.env.*`, log files, runtime files, temp files, Office lock files (`~$*.docx`, `~$*.xlsx`). Use `.env.example` as the template.
18. **Property and Unit pickers are searchable dropdowns** — any `<select>` that lists **properties** or **units** must be a type-to-filter combobox (shared `assets/searchable-select.js`, `data-searchable`), never a plain `<select>`. Other selects (status, role, plan, master types, etc.) stay native unless asked.

## Scope rules — what the product is

> Business / scope rules — apply to the current engagement (Solution Overview v8) and the v1 release that precedes it.

A. **The 23 business rules** ([SRS §5](./docs/product/SRS_Document.md)) are sacrosanct.
B. **Public Organization sign-up IS in scope** (Super Admin approval gate). Tenant accounts auto-create at lease signing; tenant self-signup is out. PM and Maintenance users are created by Admin.
C. **No DELETE endpoints.** Soft-retire via status/state columns. Audit log is permanent.
D. **Only PROPERTY_MANAGER and ADMIN record payments** (BL-10). TENANT / MAINTENANCE → 403.
E. **No auto-approval timers** (BL-08 / BL-09) — termination requires explicit per-co-tenant consent.
F. **Argon2id only** for password hashing. Never bcrypt / SHA / MD5.
G. **Wire-stable numeric smallint enums.** Never renumber; new states get the next free integer.
H. **Int autoincrement primary keys.** No CUIDs / UUIDs for new entities.
I. **Prototype is the design contract.** Tokens in `prototype/assets/styles.css` port verbatim to `tailwind.config.ts`.
J. **DD/MM/YYYY · ₹ Indian grouping · Asia/Kolkata** everywhere. UTC in DB, IST on the wire.
K. **No SMS/WhatsApp business notifications · no file uploads · no online payment gateway · no 2FA · no multi-session UI · no custom domains or per-organization branding.** Subscription billing stays manual-invoice only.

## Conflict resolution

- When `claude-progress.md` and `feature_list.json` disagree → the JSON wins. Fix the markdown.
- When CLAUDE.md and CONTEXT.md disagree → CONTEXT.md is the truth (literal disk snapshot). Fix CLAUDE.md.
- When a Working rule and a Scope rule appear to conflict → ask the user; do not pick one silently.
