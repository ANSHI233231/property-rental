# Agent Change Log

Agent: document-agent
Project: GharSetu
Date: 2026-05-29

---

## Task 1 — Solution Overview docx · substantial restructure per client feedback

- Status: ✅ Completed
- Started: 2026-05-29 18:10 IST
- Completed: 2026-05-29 18:40 IST
- Duration: 30m

### Changes
- Edited the generator JS source-of-truth (`doc-assets/templates/generate_solution_overview.js`) per Rule 28; never touched the binary.
- Updated the file-header comment block to reflect the new 7-section structure (Cover · Introduction · Incomplete Features in Current System · New Features as Per Requirement · Business Rules · Out of Scope · Next Steps).
- Cover-page date refreshed from "26 May 2026" to **29 May 2026**.
- **Added §1 Introduction** — two short body paragraphs covering (a) what GharSetu is and (b) what this document captures.
- **Renamed §2 "Fixes in Existing Modules" → "Incomplete Features in Current System"** and reworded the JS comment from "fixes we will deliver" to "features in the current system that are not working or are missing — to be addressed in this engagement". Table header column 2 retitled "Fixes" → "Incomplete / missing features".
- **Expanded the table from 6 module rows to 8** — the original 6 rows (Users & Access, Properties & Units, Leases & Tenants, Maintenance Requests, Rent Collection, Dashboard) kept verbatim; added Settings (no Settings page today; tunable values hard-coded) and Master Data Management (reference lists hard-coded; no deactivation, no protection against deactivating in-use entries).
- **Added a closing body paragraph below the table** pointing to a separate Bugs & Gaps Excel sheet for per-bug detail, so the document itself stays readable.
- **Replaced the old "New Roles" + "Details" + "New Features" sections with a single major banner "New Features as Per Requirement"**, with 5 capsLabel-introduced sub-sections:
  - 3.1 Leases & Tenants — Per-Room Leasing (4 bullets — add rooms, unit-wise vs room-wise lease types, shared areas at unit creation + Master Data option, maintenance request scope choice on room-based leases including shared area / specific room)
  - 3.2 Users & Access — Admin Impersonation (single body paragraph — sign-in-as Org-scoped users, every action recorded against the Admin)
  - 3.3 Users & Access — Task Delegation (single body paragraph — date-range delegation to PM / Maintenance, revocable, actions recorded against the delegate)
  - 3.4 Visitor Management (single body paragraph — Tenant registers expected visitors; PM / Admin approve, deny, check-in / check-out)
  - 3.5 Organization Management (SAAS layer) (10 bn-led bullets — multi-org migration, public sign-up, public site + legal pages, **Super Admin role** described inline, plan catalogue, org lifecycle, invoicing, legal pages + contact queries, platform-level master data, Admin Organization view)
- **Removed entirely**: "New Roles" banner + Super Admin role table (Super Admin is now described inside §3.5), "Details" banner, SUBSCRIPTION_PLANS array + table, IMPERSONATION_SCOPE array + table, the stand-alone "Admin Task Delegation" capsLabel + paragraph (now §3.3), SETTINGS_DEFAULTS array + table, "Assumptions" banner + ASSUMPTIONS array + bullets.
- **Kept unchanged**: §4 Business Rules (NR-1..NR-8 verbatim from v8), §5 Out of Scope (2 bullets), §6 Next Steps + closing saffron hairline.
- Regenerated the .docx with `node doc-assets/templates/generate_solution_overview.js`. New file size: **16,970 bytes** (was 17,630 bytes — net −660 bytes; net structural removal exceeds the new Introduction + the 2 added module rows + the Bugs & Gaps pointer paragraph + the 5 capsLabel sub-section markers).
- Validated via python-docx round-trip: 65 paragraphs, 1 table, 2 sections. All required strings present ("Introduction", "Incomplete Features in Current System", "New Features as Per Requirement", "Per-Room Leasing", "Admin Impersonation", "Task Delegation", "Organization Management", "Bugs & Gaps"). All forbidden headings absent ("Fixes in Existing Modules", "New Roles", "Details", "Impersonation Scope", "Settings — Defaults and Tunable Ranges", "Assumptions" — all 0 occurrences). The lone "Subscription Plans" match is inside the Out of Scope bullet ("Billing for Subscription Plans — manual invoicing only") which is the brief-allowed context.
- Removed a stale Word lock file (`~$lution_Overview.docx`) from `docs/product/` so the regenerator could write cleanly.
- Updated `docs/planning/prototype-changes.md` with a new row dated 2026-05-29 summarising the restructure.

### Files Changed
- doc-assets/templates/generate_solution_overview.js
- docs/product/Solution_Overview.docx (regenerated; 17,630 → 16,970 bytes)
- docs/planning/prototype-changes.md (appended one row)
- agent-team-change-logs/document-agent-2026-05-29.md (this file, created)

### Notes
- Did NOT update `docs/planning/DOCUMENT_AGENT.md` in this task — the project briefing's "Documents Created So Far" Solution_Overview entry traces v2 → v3.8 (May 25). A v8 → v8.1 entry block should be appended in a follow-up since the document's macro-shape has shifted materially; flagged so the next session can update the briefing without losing the v3.x narrative chain.
- The companion `docs/product/Timeline.xlsx` is untouched — the restructure does not change the phase / module schedule.

---

## Task 2 — Solution Overview docx · interactive refinement pass (client review)

- Status: ✅ Completed
- All edits made in the generator JS (`doc-assets/templates/generate_solution_overview.js`) per Rule 28; binary regenerated each time.

### Changes (in order requested)
- Table header "Incomplete / missing features" → **"Incomplete features"**.
- Removed the **"Patterns that recur across the system"** capsLabel + its 5 bullets + spacer; trimmed the audit-summary paragraph to drop the patterns reference and end "…The table below names the major incomplete features per module."
- Leases & Tenants row: "Tenant Profile & Edit" → **"Tenant Creation"**.
- Users & Access row: removed **"Login (Email & Mobile)"** → leaves "User Management" (and later "Audit Log Detail" removed too — see de-dup below).
- Maintenance row: removed **"Cross-Property Reassignment"**; "Priority & Category Management" → **"Priority Change During Request"**.
- Rent Collection row: removed **"Rent Period Generation"** (and later "Outstanding & Late Fee Derivation" + changed "Period Filters & Pagination" → "Period Filters" — see de-dup).
- New Features → merged the two separate Users & Access sub-sections into a single **USERS & ACCESS** capsLabel with two navy bold sub-headers (**Impersonation**, **Delegation**). Added new `subLabel()` helper (navy bold, sentence case, size 22).
- Converted Impersonation, Delegation and Visitor Management paragraphs → **bullet points** (new `*_BULLETS` constants).
- **Removed the entire Business Rules section** (§4 banner + NEW_BUSINESS_RULES render). The `NEW_BUSINESS_RULES` array is left in place as a now-unused constant (kept in case the section returns).
- Added a **Delegation sub-table** ("Tasks an Admin can delegate") under the Delegation sub-header — 8 areas × tasks, sourced verbatim from `prototype/admin/delegation-new.html`. New `DELEGATION_TASKS` data constant.
- Added a **Server Hardening** row to the Incomplete Features table (9th module row) with 6 summary bullets: Access control, Data integrity, Concurrency, Observability, Performance, Security.
- **Conflict resolved (master-data ownership):** removed "Payment Methods" + "Cities & States" from the org-level Master Data Management row — they are now platform-level (Super Admin) master data, already covered as a new feature under Organization Management.
- **De-duplicated 3 overlaps** against the new Server Hardening row (kept Server Hardening intact, trimmed module rows): removed "Audit Log Detail" (Users & Access), "Outstanding & Late Fee Derivation" (Rent Collection), and "& Pagination" from "Period Filters & Pagination" (Rent Collection).
- Delegation sub-table Leases row: removed **"Edit Lease"** (leases are immutable after creation).
- **Left unchanged by user request:** the Introduction body paragraph still reads "…the rules and scope that frame the work" even though the Business Rules section was removed — user said keep as-is.

### Files Changed
- doc-assets/templates/generate_solution_overview.js
- docs/product/Solution_Overview.docx (regenerated; final size ≈ 16,781 bytes)

### Notes
- `prototype/admin/delegation-new.html` was also modified during this session (Edit Lease + Edit / Adjust Payment tasks removed, with explanatory comments) — **not done by this agent**; surfaced to the user at session close. Not reverted; it aligns with the immutable-lease / append-only-payment design.
- Sync follow-up (Rule #9): "Edit Lease" task chip still appears in `prototype/admin/delegations.html` (the list view) — should be removed there too, and checked against the SRS, to keep doc + prototype aligned. Flagged, not actioned.
- No commit/push (Rule #1 — no explicit instruction).

---

## Task 3 — Timeline.xlsx · full rebuild to match current Solution Overview

- Status: ✅ Completed
- All edits in the generator JS (`doc-assets/templates/generate_timeline.js`) per Rule 28; .xlsx regenerated.

### Why
The old Timeline was a compressed 5-day **Plan → Prototype → Build → Test → UAT** model whose schedule items no longer matched the current Solution Overview, and it carried a prototype/design phase the client no longer wants in the delivery clock.

### Changes
- **Removed the prototype/design phase entirely** — the schedule now starts at build, after the Solution Overview + prototype are shared and signed off.
- **Restructured to mirror the Solution Overview 1:1 and in the same order** so the two documents share a single reference:
  - Phase A — Close the Gaps (the 9 Incomplete-Feature modules, incl. Server Hardening)
  - Phase B — New Features (Per-Room Leasing → Impersonation → Delegation → Visitor Management → Organization Management, with the SAAS layer broken into its 10 sub-items)
  - Phase C — Integration, VAPT & Release
- **Pacing model = multiple autonomous AI agent teams working in parallel** (Backend, Frontend, DBA, QA, Security), not human developers. Items sharing a Day run concurrently (up to 6/day).
- **Per-item lifecycle**: each feature is built + automated-tested + manual-QA'd + VAPT-checked within its day; a **consolidated full-platform VAPT** + UAT sit in Phase C (per-feature VAPT + final pass).
- **Time expressed as relative working days (Day 1 … Day N), not calendar dates** — Day 1 = first working day after sign-off; calendar dates fixed later once start is agreed. (User decision: client cares about days/duration, not committed dates pre-sign-off.)
- **Total: 8 working days** (was an incorrect 49-day sequential draft mid-session; corrected after user flagged that parallel AI agents + a finished prototype should land ≤10 days).
- Two sheets: **Phase Overview** (phases, milestones in days, notes/legend incl. peak-parallelism) and **Schedule** (27 rows, grouped by Day with a navy divider, columns: #, Day, Phase, Module/Area, Work Item, Includes-per-item, AI Agent Team).
- Updated the CLAUDE.md source-of-truth table row for Timeline.xlsx to describe the new model.

### Files Changed
- doc-assets/templates/generate_timeline.js (full rewrite)
- docs/product/Timeline.xlsx (regenerated)
- CLAUDE.md (Timeline.xlsx description row)

### Notes
- Start date is an assumption-free relative model; no `START_DATE` constant remains.
- Open option flagged to user: can compress to ~6 days or add a UAT-buffer day; left at 8 pending direction.

---
