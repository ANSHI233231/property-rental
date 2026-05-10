# GharSetu — Claude Agent Team

Five specialized Claude Code subagents live in [.claude/agents/](.claude/agents/). They share the same source-of-truth documents ([SRS_Document.md](SRS_Document.md), [Test_Cases.md](Test_Cases.md), the [prototype/](prototype/)) and play distinct roles.

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

- **The 23 business rules ([SRS Section 5](SRS_Document.md)) are non-negotiable.** Any code or test that violates one fails review.
- **The prototype is the design contract.** Tokens in [prototype/assets/styles.css](prototype/assets/styles.css) port verbatim to `tailwind.config.ts`.
- **Dates: DD/MM/YYYY. Currency: ₹ with Indian digit grouping. Timezone: Asia/Kolkata.**
- **No public sign-up, no SMS/email/WhatsApp notifications, no file uploads, no payment gateway** — all explicitly out of scope for v1 (SRS Section 9).
- **The custom validator ([prototype/assets/validation.js](prototype/assets/validation.js)) replaces native browser tooltips.** Errors render below the field, with the ⚠ glyph.
- **Append-only state model.** Retire instead of delete; reverse instead of edit; audit log is immutable.

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
├── AGENTS.md                       ← this file
├── CLAUDE.md
├── SRS_Document.md                 ← spec (incl. BL-01 → BL-23)
├── Test_Cases.md                   ← ~110 test cases · traceability matrix
├── prototype/                      ← 19 HTML pages · design tokens · validator
└── .claude/
    └── agents/
        ├── gharsetu-lead.md        ← Opus 4.7
        ├── gharsetu-frontend.md    ← Sonnet 4.6
        ├── gharsetu-backend.md     ← Sonnet 4.6
        ├── gharsetu-tester.md      ← Sonnet 4.6
        └── gharsetu-security.md    ← Sonnet 4.6
```
