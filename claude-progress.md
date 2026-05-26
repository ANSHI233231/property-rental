# GharSetu — claude-progress.md

> **Rolling cross-session memory.** Updated at session exit. Pair this human-readable file with the machine-readable [feature_list.json](feature_list.json) — when they disagree, the JSON wins. See [.claude/skills/harness-engineering/SKILL.md](.claude/skills/harness-engineering/SKILL.md) for the contract.

**Last updated:** 2026-05-26 · final-close · maintained by `gharsetu-lead`

---

## 1. Current phase / engagement

| Stream | Status | Notes |
|---|---|---|
| **v1** | ✅ **RELEASE-READY** pending user sign-off | Phase 8 closeout dated 2026-05-11 — all MUST-FIX closed, 967/967 unit+integration green, 74/74 Playwright green (serial), 23/23 BLs locked in [bl-traceability-matrix.md](docs/testing/v1/bl-traceability-matrix.md). |
| **Current engagement** (was v3.1 / v6.5) | 🟡 **ACTIVE (not yet started)** | Per the [Solution_Overview.docx](docs/product/Solution_Overview.docx) v8 (final-close 2026-05-26): Fixes to 6 existing modules + 7 new features (**per-room leasing**, **Admin Impersonation**, **Admin Task Delegation**, **Visitor Management**, **Master Data Administration**, **Settings**, **Organisation Management / SAAS layer**) + **new Super Admin role** + 6 new business rules. Timeline lives in [Timeline.xlsx](docs/product/Timeline.xlsx). |
| **Deferred** (post-current) | ⏸ **DEFERRED** | After all the scope pulls, only two items remain deferred per [docs/planning/v2-saas-roadmap.md](docs/planning/v2-saas-roadmap.md) and [Solution_Overview.docx §Out of Scope](docs/product/Solution_Overview.docx): **subscription billing integration** (manual invoicing only) and **custom domains + per-organisation branding**. |

---

## 2. Last session summary (2026-05-26 — final-close)

Solution Overview was iterated end-to-end (v6.5 → v8) over a long single session. Major moves:

- **Structural rewrite**: dropped the Before/After table, all v1 feature restatements, the full ROLE_CAPABILITIES table, the Subscription Plans matrix-as-callout, Assumptions (later re-added focused), §What We Heard, and the §Updated Business Rules subsection. Removed duplicate BRs that just restated v1 BLs.
- **Scope decisions**: SAAS layer + Super Admin pulled forward (was v2). Master Data Administration + Settings reframed twice (gap → feature → gap → feature again — landed in §New Features). Per-room leasing reframed under "Leases & Tenants — Per-Room Leasing" to show it's an extension, not a standalone module. Admin Impersonation + Task Delegation reversed from deferred → in scope.
- **New artifacts**: created `harness-engineering` skill ([.claude/skills/harness-engineering/SKILL.md](.claude/skills/harness-engineering/SKILL.md)), `feature_list.json` (this state file's sibling), `Timeline.xlsx` + its generator ([doc-assets/templates/generate_timeline.js](doc-assets/templates/generate_timeline.js); installed `exceljs` for it), and split-out timeline that previously lived in the Solution Overview.
- **Audit pass** caught: one "Day 1" timeline leak, the Master Data deactivation contradiction (NR-4 vs feature bullet), word-for-word duplication of NR-7/NR-8 in the Impersonation + Delegation feature rows, NR-5 every-user-except-Super-Admin paradox, and a fabricated "overdue" concept in the Maintenance dashboard fix (overdue is rent-only per BL-12). All resolved.
- **Cover**: dropped the long subtitle and version number; cover now reads title + saffron rule + bold-italic saffron "DRAFT" + date + Prepared by (with contact) + Prepared for.
- **Final v8 section flow** (cover + 8 banners): Fixes · New Roles · New Features · Business Rules · Details · Assumptions · Out of Scope · Next Steps.
- **Reconciled at final-close**: this file, `feature_list.json`, `AGENTS.md`, `docs/planning/v2-saas-roadmap.md`, `CLAUDE.md`, `README.md`.
- **Change logs written retroactively** in [agent-team-change-logs/](agent-team-change-logs/) for `gharsetu-lead-2026-05-26.md` and `document-agent-2026-05-26.md` — flagged as a process violation; rule requires per-task append, was done at session close instead.

---

## 3. What's in flight

_Nothing._ v1 is release-ready and paused for user sign-off. The current engagement has not been kicked off.

When the current engagement begins:
- The lead will flip the first feature from `not_started` to `in_progress` in `feature_list.json`.
- This section will mirror that.

---

## 4. Blockers

| Item | Type | Why blocked | Unblock criteria |
|---|---|---|---|
| **CARRY-01** — NestJS 10 → 11 migration | Carry-over | Awaiting user decision on N-1 vs latest dependency policy | User clarifies preference. No exploitable code path per VAPT, so not release-blocking. |
| **CARRY-05** — Password min 10 → 12 | Carry-over | Deferred by user; SRS §10.2 deviation documented in VAPT report | Reopen only on explicit user request. |

No BL or current-engagement feature is currently blocked.

---

## 5. Next session priority

Two viable starting points — user picks:

1. **Kick off current engagement.** Lead reads `Solution_Overview.docx` v8 + the 9 ENG-F* rows in `feature_list.json`. Strongest first candidates (independent — could run in parallel by FE/BE pairs): **ENG-F01 Per-Room Leasing** (biggest schema change, blocks the rest of the lease-touching work) and **ENG-F06 Organisation Management / SAAS layer** (biggest infra change, gates user-scoping for everything else).
2. **Address remaining post-v1 carry-over.** Best ROI: CARRY-03 (extract `formatDateIST` to `packages/shared`) — small, removes duplication surfaced during BUG-BL22-001, no scope risk.

If the user has neither in mind: surface both options with this tradeoff and ask.

---

## 6. Carry-over / known issues

From [docs/testing/v1/phase-8-closeout.md](docs/testing/v1/phase-8-closeout.md) §Carry-over — none release-blocking:

| ID | Item | Source | Status |
|---|---|---|---|
| CARRY-01 | NestJS 10 → 11 (clears `@nestjs/core` GHSA-36xv) | VAPT | blocked (user decision) |
| CARRY-02 | Next.js CSP header via `next.config.mjs` | VAPT | not_started |
| CARRY-03 | Extract `formatDateIST` / locale helpers to `@gharsetu/shared` | BUG-BL22-001 fix | not_started |
| CARRY-04 | Playwright spec isolation (or commit to `--workers=1` in CI) | Phase 8 closeout | not_started |
| CARRY-05 | Password min 10 → 12 (ASVS L2) | OWASP ASVS L1 | blocked (user deferred) |

All five are tracked in `feature_list.json` under `carry_over_v1_post_release`.

---

## 7. Session log (recent only — keep ≤10 entries)

| Date | HEAD | Agent | What changed |
|---|---|---|---|
| 2026-05-26 | _pending_ | gharsetu-lead + document-agent | Solution Overview v6.5 → v8 final-close · Timeline split into Timeline.xlsx · harness-engineering skill rolled out · sibling files reconciled · agent change logs written |
| 2026-05-25 | `6a537a4` | gharsetu-lead | Harness-engineering rollout: skill + feature_list.json + claude-progress.md + CLAUDE.md rewrite + AGENTS.md update |
| 2026-05-22 | (multiple) | document-agent | Solution_Overview v6.5 draft committed (SAAS pivot, per-room leasing, subscription plans) |
| 2026-05-11 | `d0805bc` | gharsetu-lead | Phase 8 closeout — release-ready verdict; all MUST-FIX closed |
| 2026-05-11 | `02d6a53` | gharsetu-tester | Phase 8 final regression: 110/110 TCs covered |

---

## 8. Cross-session decisions (durable — do NOT delete)

- **N-1 dependency policy** in force (per user) — NestJS stays at 10, NOT upgraded to 11 until explicit reversal.
- **Password minimum length stays at 10** (SRS §10.2) — ASVS L2 12-char recommendation explicitly deferred.
- **Playwright runs `--runInBand` / serial** in CI today — known limitation, not a bug.
- **N+1 dependency overrides** in root `package.json` (`multer`, `file-type`, `path-to-regexp`, `lodash`, `postcss`, `uuid`) — keep these; they patch known CVEs without bumping majors.
- **Submodule layout** (`apps/api`, `apps/web` as git submodules pointing at separate GitHub repos) — keep; see [MULTI_REPO_SETUP.md](docs/planning/v1/MULTI_REPO_SETUP.md).
- **SAAS data isolation** locked to `shared schema + organisation_id + Postgres RLS` (2026-05-24).
- **Billing** locked to manual / out-of-scope. No payment gateway, ever.
- **Sequencing pivot (2026-05-26)**: SAAS layer, Super Admin role, Admin Impersonation and Admin Task Delegation all pulled forward into the current engagement (originally deferred). Only subscription billing integration and custom domains + per-org branding remain deferred. See [docs/planning/v2-saas-roadmap.md](docs/planning/v2-saas-roadmap.md) for the supersession trail.
- **Solution Overview structure (final, v8)**: cover (DRAFT marker, no version number) + 8 banners — Fixes, New Roles, New Features, Business Rules, Details, Assumptions, Out of Scope, Next Steps. No timeline content in the .docx — that lives in `Timeline.xlsx`.
- **Timeline lives in Excel**: [docs/product/Timeline.xlsx](docs/product/Timeline.xlsx), regenerated from [doc-assets/templates/generate_timeline.js](doc-assets/templates/generate_timeline.js). The Solution Overview should NOT mention `Timeline.xlsx` by name in customer-facing copy.

---

## How to update this file

At session exit:

1. Update section 2 (Last session summary) — replace it with this session's 5–10 bullets.
2. Move section 2's previous content into section 7 (one row).
3. Update section 3 (in flight) — mirror what's `in_progress` in `feature_list.json`.
4. Update section 4 (blockers) — mirror `state: "blocked"` rows from `feature_list.json`.
5. Update section 5 (next priority) — top 1–3 things.
6. If a durable decision was made, add it to section 8.
7. Keep this file under ~300 lines. If it grows, trim section 7.
