# GharSetu — Claude Agent Team

Five specialized Claude Code subagents live in [.claude/agents/](.claude/agents/) (plus `document-agent` for `.docx` work). They share the same source-of-truth documents ([docs/product/SRS_Document.md](docs/product/SRS_Document.md), [docs/testing/v1/Test_Cases.md](docs/testing/v1/Test_Cases.md), the [prototype/](prototype/)) and the same **state files** ([claude-progress.md](claude-progress.md), [feature_list.json](feature_list.json)) — and play distinct roles.

## Operating contract — read first

Every session runs against the **`harness-engineering`** skill ([.claude/skills/harness-engineering/SKILL.md](.claude/skills/harness-engineering/SKILL.md)). It defines:

- **Session-start ritual** — read [claude-progress.md](claude-progress.md), [feature_list.json](feature_list.json), [CLAUDE.md](CLAUDE.md), `git log` before any action.
- **Worker ≠ Checker** — no agent flips its own `feature_list.json` row to `passing`. Only `gharsetu-lead`, only after the verification command exits 0 in a clean environment and the tester confirms.
- **Three-layer verification gates** — syntax → runtime → e2e. Do not skip levels.
- **Session-exit clean-state checklist** — build/test/lint/typecheck green, state files updated, change log appended.
- **L4 anti-monolith rule** — CLAUDE.md ≤ 200 lines, AGENTS.md ≤ 250 lines, topic docs split out.

Any plan or review that skips the harness contract is wrong on its face — bounce it back.

| Agent | Model | Role | Invoke when… |
|---|---|---|---|
| [`gharsetu-lead`](.claude/agents/gharsetu-lead.md) | **Opus 4.7** | Team Lead — planning, architecture, delegation, review, monitoring, feedback | Starting a feature · scoping a sprint · reviewing cross-module work · "what's next?" |
| [`gharsetu-frontend`](.claude/agents/gharsetu-frontend.md) | Sonnet 4.6 | UI/UX · Next.js · TypeScript · Tailwind · API integration | Any production frontend work — new screens, components, forms, accessibility, mobile |
| [`gharsetu-backend`](.claude/agents/gharsetu-backend.md) | Sonnet 4.6 | NestJS · TypeScript · PostgreSQL · business-rule enforcement (BL-01 → BL-23) | Endpoints, schemas, migrations, auth, RBAC, business logic |
| [`gharsetu-tester`](.claude/agents/gharsetu-tester.md) | Sonnet 4.6 | QA · Jest · Playwright · executing Test_Cases.md | After FE/BE deliver · regression suites · pre-release passes |
| [`gharsetu-security`](.claude/agents/gharsetu-security.md) | Sonnet 4.6 | VAPT · OWASP Top 10 · role-leak audits · CVE scans · formal reports | Before releases · after auth/payment changes · scheduled security reviews |

## How they work together

```
                     ┌──────────────────────────┐
                     │   gharsetu-lead (Opus)   │
                     │  plan · delegate · review│
                     └────────────┬─────────────┘
                                  │ Task tool
              ┌───────────────────┼───────────────────┬───────────────┐
              ▼                   ▼                   ▼               ▼
   gharsetu-frontend   gharsetu-backend    gharsetu-tester   gharsetu-security
        (Sonnet)            (Sonnet)            (Sonnet)         (Sonnet)
```

**Typical delivery flow for a new feature:**

1. **User → `gharsetu-lead`**: "Implement Record Payment for PM."
2. **Lead** reads the SRS section + relevant prototype page + relevant test cases. Drafts a plan with TodoWrite. Defines the API contract.
3. **Lead delegates in parallel** via the `Task` tool:
   - Frontend: "Build the modal at `/pm/rent-collection`, hook to `POST /api/payments`. Acceptance: TC-RENT-001…006."
   - Backend: "Implement `POST /api/payments` enforcing BL-10, BL-11, BL-13. Acceptance: TC-RENT-007…013."
4. Both return diffs + concise reports.
5. **Lead delegates to Tester**: "Run the rent-collection block from Test_Cases.md."
6. **Tester** returns pass/fail table.
7. **Lead delegates to Security** (if auth or payment surface changed): "VAPT pass on the new payment endpoint."
8. **Lead** synthesizes the four outputs into a single report for the user.

## Invoking an agent

From any Claude Code session in this repo, use the Task tool. The Lead is the natural entry point:

```
Use the gharsetu-lead agent to plan the next sprint.
```

Or invoke specialists directly when the work is clearly scoped:

```
Use gharsetu-frontend to port prototype/pm/rent-collection.html to Next.js.
Use gharsetu-tester to run all P0 test cases against the current main branch.
Use gharsetu-security to VAPT the auth flow.
```

## Hard rules every agent follows

> **Scope:** these apply to the **current engagement** (Solution Overview v8 — final close 2026-05-26) and the v1 release that precedes it. The current engagement now includes the SAAS layer, Super Admin role, Admin Impersonation, and Admin Task Delegation. Only subscription billing and custom-domain branding remain deferred — see [docs/product/Solution_Overview.docx](docs/product/Solution_Overview.docx) §Out of Scope and [feature_list.json](feature_list.json) `deferred_post_engagement`.

- **The 23 business rules ([SRS §5](docs/product/SRS_Document.md)) are non-negotiable.** Any code or test that violates one fails review. All 23 are currently `passing` per [feature_list.json](feature_list.json).
- **The prototype is the design contract.** Tokens in [prototype/assets/styles.css](prototype/assets/styles.css) port verbatim to `tailwind.config.ts`.
- **Dates: DD/MM/YYYY. Currency: ₹ with Indian digit grouping. Timezone: Asia/Kolkata.** UTC in DB, IST on the wire.
- **Scope guardrails** — Tenant self-signup remains forbidden (tenants come from leases only). No SMS/WhatsApp business notifications · no file uploads · no online payment gateway · no 2FA · no multi-session UI · no custom domains or per-organization branding. Transactional auth email (password reset, rent-change notification) IS in. **Public organization sign-up IS in scope** (per Solution Overview v8 — handled by Super Admin approval; tenant sign-up is still out). **Admin Impersonation and Admin Task Delegation are IN scope** for the current engagement. Subscription billing remains manual-invoice only.
- **The custom validator ([prototype/assets/validation.js](prototype/assets/validation.js)) replaces native browser tooltips.** Errors render below the field, with the ⚠ glyph.
- **Append-only state model.** Retire instead of delete; reverse instead of edit; audit log is immutable.
- **Worker ≠ Checker.** No agent writes `state: "passing"` to `feature_list.json` for its own work. Only `gharsetu-lead`, only after verification.
- **Change log per task.** Every agent appends a `## Task N — <name>` entry to `agent-team-change-logs/<agent>-YYYY-MM-DD.md` at the end of each task, matching the [sample format](agent-team-change-logs/sample-log-format.md): Status (✅/⚠️/❌), Started + Completed + Duration in IST, Changes (bulleted), Files Changed (paths), plus Notes / Pending / Issue + Error Summary + Action Required as applicable. The orchestrator does NOT need to remind agents — it's baked into each agent's definition under `## Change log`.

## Session-start checklist (initialization phase)

Before delegating, coding, or declaring a plan:

```
1. Read claude-progress.md            ← what state are we in?
2. Read feature_list.json             ← what's next / blocked / passing?
3. Read CLAUDE.md + AGENTS.md         ← rules I should know?
4. git log -10                        ← what changed since last session?
5. Invoke harness-engineering skill   ← reminder of the contract
```

## Session-exit checklist (clean state)

```
[ ] pnpm build · pnpm test · pnpm lint · pnpm typecheck — all green
[ ] feature_list.json updated for any state change (only lead writes "passing")
[ ] claude-progress.md sections 2, 3, 4, 5 updated
[ ] No stale debug / console.log / commented-out code
[ ] agent-team-change-logs/<agent>-YYYY-MM-DD.md appended
```

## Roles & scopes (recap)

| Role | Scope | Can do | Can't do |
|---|---|---|---|
| Admin | All 18 properties | Full system control | — |
| Property Manager | One assigned property | Tenants, leases, rent recording, maintenance for their property | Cross-property reads / writes |
| Maintenance Staff | Their assigned requests | Read + update existing requests | Create requests · see rent / lease / financial data |
| Tenant | Their own lease | View own lease + rent · raise + close own maintenance requests | Record payments · see other tenants/units · reopen closed requests |

## Files

```
property-rental/
├── AGENTS.md                                ← this file (operating model)
├── CLAUDE.md                                ← repo-level guidance (≤ 200 lines)
├── CONTEXT.md                               ← disk snapshot (descriptive, not aspirational)
├── claude-progress.md                       ← rolling cross-session state memory
├── feature_list.json                        ← machine-readable BL + feature state
├── apps/api/                                ← NestJS API (git submodule)
├── apps/web/                                ← Next.js Web (git submodule)
├── packages/shared/                         ← @gharsetu/shared — enums, Zod, formatters
├── docs/
│   ├── product/SRS_Document.md              ← spec (incl. BL-01 → BL-23)
│   ├── product/Solution_Overview.docx       ← current engagement scope (generated, v8)
│   ├── testing/v1/Test_Cases.md             ← ~110 test cases
│   ├── testing/v1/bl-traceability-matrix.md ← human-readable BL → test mapping
│   └── testing/security/*                   ← VAPT + OWASP ASVS L1 reports
├── prototype/                               ← 19 HTML pages · design tokens · validator
├── doc-assets/templates/*.js                ← .docx generators (never hand-edit binaries)
├── agent-team-change-logs/                  ← per-task append-only logs
└── .claude/
    ├── agents/
    │   ├── gharsetu-lead.md                 ← Opus 4.7
    │   ├── gharsetu-frontend.md             ← Sonnet 4.6
    │   ├── gharsetu-backend.md              ← Sonnet 4.6
    │   ├── gharsetu-tester.md               ← Sonnet 4.6
    │   ├── gharsetu-security.md             ← Sonnet 4.6
    │   └── document-agent.md                ← .docx generation specialist
    └── skills/
        ├── harness-engineering/             ← operating contract (read first)
        ├── gharsetu-ui/                     ← frontend design system
        ├── gharsetu-backend/                ← NestJS + Prisma contract
        └── document-generation/             ← .docx generator workflow
```
