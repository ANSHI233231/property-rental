# Agent Change Log

Agent: document-agent
Project: GharSetu
Date: 2026-05-26

> Note: this session was operated through Claude Code's main conversation, not a formal `Task` delegation. Document-agent work (all `.docx` / `.xlsx` generators + regenerated artifacts) is logged here. Lead-style work (skill rollout, audit, reconciliation) is in `gharsetu-lead-2026-05-26.md`.

---

## Task 1 — Solution Overview v6.5 → v7.0 (delta rewrite)

- Status: ✅ Completed
- Started: 2026-05-26 11:00 IST (approx.)
- Completed: 2026-05-26 12:00 IST (approx.)
- Duration: ~1h

### Context
- User feedback: v6.5 was rejected by seniors for "too much repeated content from previous solution overview" + the doc was implicitly conflating v3.1 with v2 SAAS.
- Initial decision: cut to v3.1-only delta format.

### Changes
- Rewrote `doc-assets/templates/generate_solution_overview.js` (≈580 lines net, helpers untouched).
- Cut sections: Before/After table in §What We Heard, Subscription Plans matrix, Assumptions, Sign-off block detail.
- Collapsed §Modules — Features and Current Gaps into single-column gap list (features column dropped — every entry is a feature that does not work).
- Renamed §New Modules → §New Features.
- Split §Business Rules into "New" (8 NRs) + "Updated" (5 URs with `Updates BL-XX` references). Pure duplicates of v1 BLs removed.
- Cut v2-only content: Super Admin role, Module 10 Org Management, BR-24..28.
- Trimmed §Out of Scope to v3.1-relevant items only.
- Cover updated: v6.5 (Draft) 25 May 2026 → v7.0 (Draft) 26 May 2026.

### Files Changed
- `doc-assets/templates/generate_solution_overview.js` (−141 lines net)
- `docs/product/Solution_Overview.docx` (regenerated, 22 KB → 18 KB)

### Notes
- python-docx round-trip validation: 9 section banners in correct order, zero v2-SAAS leakage on scan ("Super Admin", "SAAS", "Subscription", "BR-24/25/26", "impersonation", "delegation"), Assumptions section absent.

---

## Task 2 — v7.0 → v7.1 (SAAS pivot reversal)

- Status: ✅ Completed
- Started: 2026-05-26 14:00 IST (approx.)
- Completed: 2026-05-26 14:30 IST (approx.)
- Duration: ~30m

### Context
- User reversed Task 1 scope: bring SAAS layer + Super Admin role + Organisation Management back into scope. Master Data + Settings reframed as **missing modules** in the Fixes section (not new modules). Per-room leasing reframed as a new feature.

### Changes
- Added Master Data Administration + Settings rows to `GAPS_IN_EXISTING_MODULES` array.
- Dropped Per-room leasing bullet from Module 3 gaps (becoming a new feature).
- Rewrote `NEW_FEATURES`: dropped Master Data + Settings; added Per-Room Leasing + Organisation Management (SAAS layer).
- Replaced §New Roles body — re-introduced Super Admin with capability bullets.
- Added 2 SAAS BRs to `NEW_BUSINESS_RULES` (NR-9 org isolation, NR-10 subscription plan cap).
- Updated cover subtitle + header comment to reflect SAAS in scope.
- Restored SAAS-relevant Out-of-Scope bullets (subscription billing, custom domains, impersonation/delegation deferred).
- Cover bumped to v7.1.

### Files Changed
- `doc-assets/templates/generate_solution_overview.js`
- `docs/product/Solution_Overview.docx`

### Notes
- Lead role (Task 2 in `gharsetu-lead-2026-05-26.md`) handled the sibling-file reconciliation.

---

## Task 3 — v7.1 iterative copy edits + structural cleanup

- Status: ✅ Completed
- Started: 2026-05-26 15:00 IST (approx.)
- Completed: 2026-05-26 17:00 IST (approx.)
- Duration: ~2h (many small iterations)

### Changes (chronological)
- Removed numeric prefixes from module names in `GAPS_IN_EXISTING_MODULES` (`1. Users & Access` → `Users & Access`).
- Removed NR-1 (tenant auto-create — was actually an existing-feature gap, not a new rule); renumbered NR-2..NR-10 → NR-1..NR-9.
- Moved Master Data Administration + Settings back into New Features (after seniors-pattern realisation — they're brand-new modules even if underlying values existed in v1).
- Added new BR: "Amenities, Maintenance Categories and Payment Methods sourced from Master Data — no longer hardcoded."
- Removed entire `UPDATED_BUSINESS_RULES` array and the §Updated rendering block — user feedback: client already has previous Solution Overview, no need to restate.
- Removed NR-2 (maintenance active-lease gate), NR-3 (only Maintenance moves to In Progress), NR-5 (rent-change 60-day notice) — all already in previous Solution Overview; renumbered remaining to NR-1..NR-6.
- Dropped the "New" caps sub-header (only one category remained).
- Out of Scope section removed (no genuinely new exclusions vs v6.5).
- Added Admin Impersonation + Task Delegation as new features (user reversed earlier decision to defer them).
- Added NR-7 (impersonation audit + boundary) and NR-8 (delegation audit + window) to `NEW_BUSINESS_RULES`.
- Re-added Out of Scope with **2 specific bullets only** (custom domains, subscription billing).
- Moved Out of Scope to position right after Business Rules (§5).
- Renamed §Gaps in Existing Modules → §Fixes in Existing Modules; column header "Features not working / missing" → "Fixes"; preamble body removed.
- Removed preamble bodies after §New Roles, §New Features banners (consistent with §1 cleanup).
- Renamed Per-Room Leasing row to "Leases & Tenants — Per-Room Leasing" (clarifies it's an extension of an existing module, not a standalone new module).
- Moved Super Admin descriptive paragraph from §New Roles body into NR-5 (rule, not paragraph).
- Removed "Live application" bullet from Settings.
- Removed payment gateway names (Razorpay / Stripe / PayPal) from Out of Scope bullet.
- Dashboard fixes tightened — three bullets shortened by ~40% each.
- Dropped the long cover subtitle (was a prose table-of-contents).
- §Next Steps reduced to 2-line formal paragraph; "draft" / "Timeline.xlsx" mentions stripped from external-facing copy.

### Files Changed
- `doc-assets/templates/generate_solution_overview.js` (multiple iterations)
- `docs/product/Solution_Overview.docx` (regenerated each iteration; ~25 regenerations total in this task block)

### Notes
- Each iteration was python-docx round-trip validated. Word lock file (`~$lution_Overview.docx`) appeared and persisted — user has the .docx open in Word.

---

## Task 4 — Timeline split into a separate spreadsheet

- Status: ✅ Completed
- Started: 2026-05-26 17:00 IST (approx.)
- Completed: 2026-05-26 17:30 IST (approx.)
- Duration: ~30m

### Context
- User instruction: timeline becomes a separate Excel artifact; Solution Overview no longer carries it.

### Changes
- Installed `exceljs ^4.4.0` in `doc-assets/` (npm install).
- Created `doc-assets/templates/generate_timeline.js` — new generator script (Phase Overview sheet + Module Schedule sheet, frozen header, auto-filter, brand-aligned palette).
- Wired `SCHEDULE` data: 6 Fix rows + 7 New-Feature rows = 13 items, each mapped across Day 1–5 (Plan / Proto / Build / Test / UAT) with Owner column.
- Generated `docs/product/Timeline.xlsx` (10,246 bytes).
- Registered `build:timeline` script in `doc-assets/package.json`.
- Removed `DAY_PLAN` constant + §Delivery Approach + §Day-by-Day Plan sections from Solution Overview.
- Updated Next Steps body to reference the companion (later trimmed — external copy doesn't mention `Timeline.xlsx` by name).

### Files Changed
- `doc-assets/package.json` (+`exceljs` dep, +`build:timeline` script)
- `doc-assets/templates/generate_timeline.js` (new file, 247 lines)
- `docs/product/Timeline.xlsx` (new file, 10 KB)
- `doc-assets/templates/generate_solution_overview.js` (DAY_PLAN + 2 sections removed)
- `docs/product/Solution_Overview.docx` (size dropped 22 KB → 16 KB after timeline split)

### Notes
- Validated with `openpyxl` round-trip: 2 sheets, 8 + 18 rows, brand colors applied.
- Timeline allocation is placeholder (every row shows `Plan / Proto / Build / Test / UAT` linearly) — flagged to user that this doesn't show parallelism or differentiated effort.

---

## Task 5 — Final polish for sign-off readiness (v7.1 → v8)

- Status: ✅ Completed
- Started: 2026-05-26 18:00 IST (approx.)
- Completed: 2026-05-26 18:50 IST (approx.)
- Duration: ~50m

### Context
- Triggered by lead-role rude-client review (Task 3 in `gharsetu-lead-2026-05-26.md`) and a follow-on audit pass (Task 4 there).

### Changes
- **Cover**: replaced `Version: 7.1 (Draft)` line with single bold-italic saffron `DRAFT` marker (no version number per user request); added `Contact: aayush@triline.co.in` line under Prepared by; updated "Aayush Kumar" → "Aayush Kumar, Triline".
- **§1 Fixes cleanup**:
  - PM dashboard bullet rewritten from vague ("locked at scope finalisation") to specific (rent collection %, overdue tenant count, open maintenance by priority, upcoming lease expirations).
  - Properties amenities bullet split — dropped the "no Amenities master" half (duplicates Master Data feature), kept "no amenities field on the property form."
  - Rent Collection: dropped 2 bullets that duplicated Master Data + Settings new features ("Payment methods baked..." and "Late-fee rate, grace period... baked...").
  - Removed stray "Day 1" mention in PM dashboard fix; later replaced with "scope finalisation" then with specific metrics.
  - Removed "overdue" from Maintenance dashboard fix (overdue is a rent concept per BL-12, not maintenance).
- **§4 NR-5 rewrite** — resolved the every-user-except-Super-Admin paradox: "Every user belongs to exactly one Organisation, with the sole exception of the Super Admin. The Super Admin is a platform-level role and sits above all organisations. No other role — including Admin — can read or write outside its own Organisation..."
- **§3 New Features** — trimmed Impersonation row to 1 bullet (Login-as only) and Delegation row to 2 bullets (Delegate + Window-bounded rights) to remove word-for-word duplication with NR-7 / NR-8.
- **§3 Master Data Administration** — tightened deactivate bullet to align with NR-4 ("deactivation is only permitted once no records reference them").
- **§5 Details (new)** — 3 reference tables + 1 paragraph:
  - Subscription Plans: Basic 5 users / Standard 20 users / Premium Unlimited
  - Admin Impersonation Scope: 5-row × 3-col grid (PM/Maint/Tenant ✓ in own Org; Another Admin and Super Admin ✗)
  - Admin Task Delegation: broad-framing paragraph (any action the Admin is authorised to perform, to PM or Maintenance, for a defined date range)
  - Settings — Defaults and Tunable Ranges: late-fee 2% (0–10%), grace 5 days (0–15), notice 60 days (30–90)
- **§6 Assumptions (new)** — initially 4 bullets, later trimmed to 3 (Sign-off cadence bullet removed at user request): Data migration to default Organisation (working name "GharSetu Solutions"), ID continuity, Email scope.
- **§7 Risks (new)** — initially 3 bullets, later removed entirely at user request.
- **Cleanup pass**: caught 3 day-N leaks I introduced in new sections ("before Day 1", "extend Day 1 planning", "during Day 4 testing") — all rewritten without day references.

### Files Changed
- `doc-assets/templates/generate_solution_overview.js`
- `docs/product/Solution_Overview.docx` (final size 17,585 bytes)

### Notes
- Final python-docx round-trip: 8 section banners in order, 0 day-N mentions in document, NR-5 contradiction cleared, "GharSetu Solutions" present as default org name, "DRAFT" present on cover, no version number on cover.
- Final section flow: Cover (DRAFT) → Fixes → New Roles → New Features → Business Rules → Details → Assumptions → Out of Scope → Next Steps.

---

## Task 6 — Change-log retrofit

- Status: ⚠️ Partial — written at session close, not after each task
- Started: 2026-05-26 19:20 IST
- Completed: 2026-05-26 19:30 IST
- Duration: ~10m

### Context
- User flagged at session close: "i did't get the agent-team-change-logs for today work, which agent do what no clue."
- AGENTS.md hard rule (and harness-engineering skill §Change log per task) requires per-task append. This was not done.

### Changes
- Authored this file + `gharsetu-lead-2026-05-26.md` retroactively.

### Pending
- Process: future sessions need to append per-task in real time, not at session close. Recommend wiring this into a session-exit hook or making it a Claude-side cadence pattern.

### Files Changed
- `agent-team-change-logs/document-agent-2026-05-26.md` (this file)
- `agent-team-change-logs/gharsetu-lead-2026-05-26.md`

### Notes
- Times in this file are session-approximate, not wall-clock precise — Claude doesn't have a continuous time-of-day reference across turns.
