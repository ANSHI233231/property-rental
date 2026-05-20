# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Status

This is a **greenfield repository** for a property rental platform ("GharSetu"). At the time of writing it contains **no application code** — only planning documents and tooling. Do not assume a framework, package manager, or build pipeline exists; verify before running commands.

There is no `package.json`, no lockfile, no source tree, and no test setup. The README's tech stack section (`Next.js`, `NestJS`, `PostgreSQL`) is written as `(e.g., …)` placeholders — these are **examples, not decisions**. Treat tech stack choices as open until the user confirms them or commits scaffolding.

## What's actually in the repo

- [README.md](README.md) — placeholder, do not rely on its `npm install && npm run dev` instructions until a `package.json` exists.
- [document/](document/) — design source-of-truth (binary `.docx`, not directly readable):
  - `Blueprint_Property_Rental_Application_v8.docx` — product blueprint
  - `GharSetu_UIUX_Design_Document_updated.docx` — UI/UX spec
  - When the user references requirements or design, ask them to paste/excerpt the relevant section, or convert to text first (`pandoc`, `docx2txt`) — do not guess at contents.
- [SRS_Document.md](SRS_Document.md) — full software requirements spec, including the **23 business rules (BL-01 → BL-23)** that every implementation must enforce.
- [Test_Cases.md](Test_Cases.md) — ~110 test cases with traceability back to the business rules.
- [prototype/](prototype/) — 19 static HTML/Tailwind pages covering every screen and flow. The Next.js implementation should mirror this 1:1. Design tokens live in [prototype/assets/styles.css](prototype/assets/styles.css). The custom form validator (replaces native browser tooltips with errors below each field) lives in [prototype/assets/validation.js](prototype/assets/validation.js).
- [AGENTS.md](AGENTS.md) — describes the **Claude Agent Team** for this project. Five subagents in [.claude/agents/](.claude/agents/): `gharsetu-lead` (Opus 4.7, planning + delegation), `gharsetu-frontend`, `gharsetu-backend`, `gharsetu-tester`, `gharsetu-security` (all Sonnet 4.6). Use the Task tool with these `subagent_type` values; route open-ended planning through `gharsetu-lead`.
- [.claude/skills/gharsetu-ui/](.claude/skills/gharsetu-ui/) — **project-specific** UI/UX skill encoding GharSetu's design tokens, component patterns, role tabbars, MoreSheet rules, responsive contract (single ≤1023px breakpoint), form-validation visual contract, accessibility floor, and the business rules that shape the UI (BL-01..BL-23). Invoke via the `gharsetu-ui` skill for any frontend work in this repo — it overrides generic UI guidance.
- [.claude/skills/gharsetu-backend/](.claude/skills/gharsetu-backend/) — **project-specific** backend skill encoding the NestJS + Prisma contract: wire-stable numeric enum codes, int-autoincrement IDs, the BL-01..BL-23 server-side enforcement table, Argon2id auth, JWT 15min + opaque refresh cookie at `/api/v1/auth`, migration discipline, no-DELETE / no-auto-approval / no-2FA / no-public-sign-up rules, append-only audit log, BullMQ job catalogue. Invoke via the `gharsetu-backend` skill for any backend work in this repo.
- [.claude/skills/ui-ux-pro-max-skill/](.claude/skills/ui-ux-pro-max-skill/) — generic UI/UX intelligence skill (styles, palettes, typography, UX guidelines). Use as a secondary reference; the project-specific `gharsetu-ui` skill takes precedence when they conflict.

## Working in this repo

- **Before any "build/test/lint" request**, check whether the relevant tooling actually exists in the repo. If not, surface that to the user and confirm the stack before scaffolding.
- **When scaffolding the application**, the two `.docx` files in `document/` are the authoritative spec — read or have the user excerpt them before making product/UX decisions.
- **For UI/component work**, invoke the `gharsetu-ui` skill first — it encodes design tokens, role-scoped nav, the no-hamburger rule, and BL-01..BL-23 UI implications. Fall back to `ui-ux-pro-max` only for generic patterns the project skill doesn't cover.
- **For backend / API / Prisma / migration / business-rule work**, invoke the `gharsetu-backend` skill first — it encodes the numeric-enum wire contract, the BL-01..BL-23 enforcement table, auth/RBAC, and the things you must never build.
