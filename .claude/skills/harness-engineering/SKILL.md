---
name: harness-engineering
description: "Harness Engineering operating contract for GharSetu — the binding rules every agent (especially gharsetu-lead) follows so multi-session, multi-agent work stays reliable. Use at the start of EVERY non-trivial planning session, before delegating to a specialist, before declaring any task done, and at session end. Covers: the 5 harness subsystems (Instructions, Tools, Environment, State, Feedback), the session-start initialization ritual, the session-exit clean-state checklist, the worker-≠-checker gate (no agent self-certifies completion), feature_list.json as the single machine-readable source of state (gates the transition from `in_progress` → `passing`), claude-progress.md as the rolling cross-session memory, the L4 anti-monolith rule for instruction files (CLAUDE.md / AGENTS.md stay ≤200 lines, topic docs split out), the L9 three-layer verification gates (syntax → runtime → e2e), and the L12 entropy-prevention discipline. Invoke when: starting any sprint or feature, scoping work for a specialist, reviewing a deliverable, updating an instruction file, ending a session, onboarding a new agent. Built on the 12-lecture framework from walkinglabs/learn-harness-engineering, specialized for this NestJS + Next.js + Prisma monorepo."
---

# Harness Engineering — GharSetu Operating Contract

This skill is the **operating manual** for how agents work on GharSetu. It is binding on `gharsetu-lead` and informative for every specialist. It encodes the rules that make multi-session, multi-agent work reliable — not the rules of the product itself (those live in the SRS and the `gharsetu-backend` / `gharsetu-ui` skills).

> A harness is *everything in the engineering infrastructure outside the model weights*. The 23 business rules are the **product** contract; this skill is the **process** contract.

---

## The 5 subsystems — what a harness IS

Every agent action must respect all five. The repo's current state of each is in parentheses.

| # | Subsystem | What it is | GharSetu artefact |
|---|---|---|---|
| 1 | **Instructions** | Rules / scope / constraints the agent must follow | [CLAUDE.md](../../../CLAUDE.md), [AGENTS.md](../../../AGENTS.md), `.claude/skills/*/SKILL.md`, `.claude/agents/*.md` |
| 2 | **Tools** | Execution surface (shell, package mgr, prisma, gh) — least privilege | `.claude/settings.local.json`, `agent.tools` frontmatter |
| 3 | **Environment** | Reproducible runtime (Node, pnpm, Postgres, env vars) | [.nvmrc](../../../.nvmrc), [package.json](../../../package.json), [docker-compose.yml](../../../docker-compose.yml), [.env.example](../../../.env.example), [.github/workflows/ci.yml](../../../.github/workflows/ci.yml) |
| 4 | **State** | Cross-session memory: what's done, what's next, what's blocked | [claude-progress.md](../../../claude-progress.md), [feature_list.json](../../../feature_list.json), [docs/testing/v1/bl-traceability-matrix.md](../../../docs/testing/v1/bl-traceability-matrix.md), [agent-team-change-logs/](../../../agent-team-change-logs/) |
| 5 | **Feedback** | Verification commands — how the agent KNOWS work succeeded | `pnpm lint && pnpm typecheck && pnpm test && pnpm build`, [smoke.sh](../../../smoke.sh), CI workflow |

> **Information that doesn't exist in the repo, doesn't exist for the agent.** Slack, WhatsApp, meeting notes, undocumented decisions — all invisible. If a decision matters, put it in the repo.

---

## Session-start ritual (initialization phase)

`gharsetu-lead` runs this every session — no exceptions. Specialists run a subset relevant to their domain.

```
1. Read claude-progress.md          ← what state are we actually in?
2. Read feature_list.json           ← what's next / blocked / passing?
3. Read CLAUDE.md + AGENTS.md       ← any rules I should know?
4. git log -10                      ← what changed since last session?
5. If anything in 1–4 contradicts what you remember, TRUST the files.
```

Until those five reads are complete, do not delegate, do not write code, do not declare a plan.

---

## Session-exit ritual (clean state — L12)

At the end of every session, the lead (or the user before closing) verifies:

```
[ ] Build green               pnpm build
[ ] Tests green               pnpm test
[ ] Lint clean                pnpm lint
[ ] Typecheck clean           pnpm typecheck
[ ] feature_list.json updated for any feature whose state changed
[ ] claude-progress.md updated with: what shipped, what's blocked, what's next
[ ] No stale debug / console.log / commented-out code in the diff
[ ] agent-team-change-logs/<agent>-YYYY-MM-DD.md appended
[ ] If a doc was updated, the related skill / CLAUDE.md is still consistent
```

Entropy accumulates exponentially without this. The discipline costs minutes per session and prevents the "we have to spend the first hour cleaning up before we can ship anything" problem.

---

## Worker ≠ Checker — the non-negotiable rule (L9)

**No agent certifies its own completion.** A task does not move from `in_progress` to `passing` because the worker says so. It moves because:

1. The worker emits a **verification command** (e.g. `pnpm --filter @gharsetu/api test -t "BL-10 tenant cannot record payment"`)
2. That command exits **0** in a clean environment
3. `gharsetu-tester` (or CI) confirms the run
4. ONLY THEN does `gharsetu-lead` flip the feature's state in `feature_list.json` to `passing`

The matrix:

| Worker | Approved by | State allowed to set |
|---|---|---|
| `gharsetu-backend` | self → `in_progress`, `blocked` only |
| `gharsetu-frontend` | self → `in_progress`, `blocked` only |
| `gharsetu-tester` | runs verification → returns pass/fail report |
| `gharsetu-security` | for auth/payment/scope work → must sign off before `passing` |
| `gharsetu-lead` | only role that writes `passing` to feature_list.json |

If a backend agent's task report says "done," the lead reads:
- The actual diff (not just the summary)
- The test output (proof the verification command ran)
- The BL impact (does this still pass `bl-traceability-matrix.md`?)

If any of those is missing → the work is not done. Bounce it back.

---

## Three-layer verification gates (L9)

Tests must pass in order. **Do not proceed to level N+1 if level N fails.**

```
Layer 1 — Syntax + static     pnpm lint, pnpm typecheck
Layer 2 — Runtime behaviour   pnpm test (Jest API + Vitest Web)
Layer 3 — System / e2e        Playwright (apps/web/e2e), smoke.sh
```

`gharsetu-tester` enforces this order. A green Vitest run does not mean the feature works — it means the unit test passed. Layer 3 is the only layer that proves the user-visible behaviour.

---

## State files — the source of truth

### `feature_list.json` (top-level)

**Single, machine-readable, append-only-edit.** Every BL and every v3.1 feature has a row. Schema:

```json
{
  "id": "BL-10",
  "behavior": "Only PM/Admin can record payments. Tenant POST /payments → 403 BL_10_TENANT_CANNOT_RECORD_PAYMENT.",
  "verification": "pnpm --filter @gharsetu/api test -t 'BL-10 tenant cannot record payment'",
  "evidence": ["apps/api/test/phase4-integration.spec.ts", "apps/api/test/phase6-role-matrix-full.spec.ts"],
  "layer": "Integration",
  "phase": 4,
  "state": "passing",
  "blocker": null,
  "updated": "2026-05-11"
}
```

**State values:** `not_started` · `in_progress` · `blocked` · `passing`.

**Rules:**
- Only `gharsetu-lead` writes `state: "passing"`.
- A `blocked` row must include `blocker: "<short reason>"`.
- `verification` must be a runnable shell command — no English descriptions.
- `evidence` must be real file paths that exist in the repo today.

### `claude-progress.md` (top-level)

**Rolling human-readable cross-session memory.** Updated at session exit. Sections (kept short — file should never exceed ~300 lines):

1. **Current phase / engagement** — what we're shipping right now (v1 release-ready, v3.1 active, v2 deferred).
2. **Last session summary** — 5–10 bullets of what changed.
3. **What's in flight** — features with `state: "in_progress"` in feature_list.json.
4. **Blockers** — features with `state: "blocked"` + why.
5. **Next session priority** — top 1–3 things to start on.
6. **Carry-over** — known issues deferred (e.g. NestJS 10→11, Next.js CSP).

When `claude-progress.md` and `feature_list.json` disagree, **feature_list.json wins** — it's the machine-checkable source. Fix the markdown.

---

## L4 anti-monolith rule — instruction files stay small

**CLAUDE.md ≤ 200 lines. AGENTS.md ≤ 250 lines. Each SKILL.md scoped to one domain.**

Why: large instruction files burn 10–20K of context window, suffer "lost in the middle," and pile up contradictions over time.

How to apply:
- If CLAUDE.md grows past 200 lines, split the new content into a topic doc and link it.
- If a SKILL.md covers two domains, split it.
- If you find yourself repeating something across files, put it in one place and link.
- Cap "Hard rules" lists at **15 items**. More than 15 means at least one isn't really hard.

---

## Anti-patterns to avoid

| Anti-pattern | Symptom | Correction |
|---|---|---|
| **Instruction decay** | CLAUDE.md says "greenfield" but the repo has 967 tests | Rewrite the file, don't patch around it |
| **Premature completion** | Backend says "done" with no test output attached | Demand the verification-command exit code |
| **Self-evaluation bias** | Worker grades own work positively | Always delegate to tester before marking `passing` |
| **State drift** | `bl-traceability-matrix.md` says 22/23 but tests pass 23/23 | feature_list.json is source of truth — update the matrix from it, not vice versa |
| **Knowledge offsite** | Decision in a Slack thread or .docx the agent can't read | Move to a markdown file in `docs/` |
| **Monolith creep** | Single instruction file climbs past 300 lines | Split, link, summarize |
| **Skipped initialization** | Lead delegates without reading claude-progress.md | The first thing the lead does in any new session is the 5-step session-start ritual |
| **Scope creep at completion gate** | "While I was here I also refactored X" | Refactors get their own task and their own verification — never bundled with a fix |

---

## How `gharsetu-lead` uses this skill

Every session:

1. **At session start** — runs the initialization ritual. Reads claude-progress.md + feature_list.json before doing anything else.
2. **Before delegating** — picks the next `not_started` feature from feature_list.json (or the user's explicit task). Briefs the specialist with: goal, source-of-truth pointers, scope boundary, **verification command**, acceptance criteria.
3. **On specialist return** — reads the diff, reads the test output. If the verification command's exit code isn't 0 (or wasn't run), state stays `in_progress`. No exceptions.
4. **Before marking `passing`** — runs (or asks tester to run) the verification command in a clean environment. Updates feature_list.json. Appends to claude-progress.md.
5. **At session exit** — runs the clean-state checklist. If anything fails, surface it to the user before closing.

---

## How specialists use this skill

- **gharsetu-frontend / gharsetu-backend**: read the relevant `state` from feature_list.json before starting; never set `state: "passing"` themselves; always emit a runnable verification command in the deliverable summary.
- **gharsetu-tester**: this skill names you as the only verification authority for layer 2 + 3. Your pass/fail report is the gate.
- **gharsetu-security**: for any auth / payment / role-scope change, you are an additional required gate before `passing`. Cite the relevant ASVS L1 item.

---

## When to invoke this skill

| Situation | Why |
|---|---|
| Starting a new sprint / feature | Initialization ritual + scope from feature_list.json |
| Reviewing a specialist's deliverable | Worker-≠-checker rule + verification gates |
| About to update CLAUDE.md or AGENTS.md | L4 monolith rule + decay risk |
| About to write `passing` to a feature | This is the gate the rule is about |
| End of session | Clean-state checklist |
| Onboarding a new agent or human | This is the operating manual |
| Anything that smells like "let's just trust the model" | That smell is the failure mode this skill exists to prevent |

---

## Source

Framework derived from [walkinglabs/learn-harness-engineering](https://walkinglabs.github.io/learn-harness-engineering/en/) — 12 lectures on building closed-loop AI coding systems. The lectures are the theory; this file is the GharSetu-specific contract that operationalises them.
