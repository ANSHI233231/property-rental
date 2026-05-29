# Agent Change Log

Agent: gharsetu-lead
Project: GharSetu
Date: 2026-05-28

---

## Task 1 — Lease feature end-to-end planning session

- Status: ✅ Completed
- Started: 2026-05-28 (planning session)
- Completed: 2026-05-28
- Duration: ~1 session

### Brief

User asked for a planning session on the Lease feature with two intertwined deliverables:
1. **Resolve the property-vs-unit confusion** on where Leasing mode (Unit-wise / Room-wise) lives, given a real-world mixed-building example (a 10-unit building running 3 units as PG room-wise and 7 units as whole apartments) — a case that the current "property-only" framing cannot represent.
2. **Plan the full Lease feature** covering status taxonomy (`upcoming` + `active` + `ended` + `terminated`), lease conflict validation, room-wise data model + form + listing, the property/unit input for lease type, role-by-role surfaces, and BL/NR rule adds/amendments.

Lead-only task; implementation deferred. No prototype HTML or app code written.

### What I did

1. Read source-of-truth context:
   - `CLAUDE.md` (Working rules + Technical conventions + Scope rules), `docs/planning/FEATURE_PLANNING.md` (template).
   - `docs/product/SRS_Document.md` §4 Module 2 + Module 3, §5 BL-01..BL-23, §5 NR-1..NR-8 (existing), §6 Flow F1/F4/F5/F6, §7 use cases.
   - Existing planning files: `2026-05-26-per-room-leasing.md` (589 lines, status: proposed — the upstream design with property-scope NR-1 lock that this session amends), `2026-05-27-admin-leases-page.md` (Admin Leases page skeleton, in-progress).
   - Existing prototype: `prototype/admin/leases.html` (340 lines — five-tile filter pattern verified: All · Active · Renewed · Terminated; **no Upcoming tile**), `prototype/admin/create-lease.html`, `prototype/pm/leases.html`, `prototype/pm/lease-detail.html`, `prototype/admin/property-detail.html`.
   - Grep confirmed: the prototype does **not** yet wire any Leasing mode field on `admin/properties.html` or `admin/property-detail.html` — i.e. the per-room-leasing planning file is still proposal-only on disk. This gave us a clean window to revise the architecture before any HTML is committed.

2. Resolved the property-vs-unit question with a three-option comparison table and a clear recommendation:
   - **Option C wins** — Leasing mode is stored at the unit level (truth), with a property-level default (convenience seed for new units).
   - Honors the client commitment ("set at property creation") because the Add Property modal still asks the question.
   - Honors reality (mixed buildings) because each unit can override on creation.
   - **Moves NR-1's lock from property scope to unit scope** — which is the natural granularity and prevents the first room lease in one PG flat from locking every other flat in the same building.

3. Produced the planning file at `docs/planning/features/2026-05-28-lease-feature-plan.md` (493 lines) using the template from `docs/planning/FEATURE_PLANNING.md`. All 9 template sections populated:
   - **§2.0** — Property-vs-unit resolution with three-option trade-off table and a clear "Option C" recommendation.
   - **§2.1** — Five-status taxonomy with wire-stable smallint mapping (upcoming=1, active=2, expired=3, renewed=4, terminated=5) chosen to slot `upcoming` below the existing block without renumbering. Two daily auto-transition crons specified.
   - **§2.2** — Listing page filter tiles (All · Upcoming · Active · Ended · Terminated), badge taxonomy reusing existing CSS classes, status-driven row actions table, sort order.
   - **§2.3** — Conflict validation rule precisely stated: leases with `status IN (upcoming, active)` cannot overlap on the same unit (or same room), interval closed on both ends. Same-day overlap is a conflict; clean handoff requires `new.start_date > old.end_date`. Postgres EXCLUDE USING gist proposed for DB-level enforcement.
   - **§2.4** — Prisma schema changes (snake_case per Technical convention #12, no FK constraints per Tech rule #13, int autoincrement per Scope rule H, append-only migration with backfill).
   - **§2.5** — UI shape of the new input on property creation ("Default leasing mode for new units") + unit creation ("Same as property default / Unit-wise / Room-wise") + lock state on unit edit when active/upcoming lease exists.
   - **§2.6** — Rule changes: NR-1 amended (lock re-scoped to unit level), NR-9 new (conflict rule), NR-10 new (auto-transition rule).
   - **§2.7** — Role-by-role surface table covering Super Admin, Admin, PM, Tenant, Maintenance + read-only edge cases (BL-20 reassigned PM, NR-7 impersonation, NR-8 delegation).
   - **§2.8** — Explicitly out of scope: lease document upload, in-lease rent escalation, subleasing, custom room labels, in-place end-date extension.
   - **§2.9** — Files-to-touch ledger (10 prototype files, 7 apps/api files, 3 apps/web files, SRS, Test_Cases, prototype-changes).
   - **§2.10** — Three open dependencies surfaced (backend GiST confirmation, supersession of per-room-leasing planning file, Tenant role's upcoming-lease visibility).
   - **§3** — Six test-case namespaces with ~55 cases total: TC-LEASE-NEW-MODE (10), TC-LEASE-NEW-STATUS (9), TC-LEASE-NEW-LIST (12), TC-LEASE-NEW-CONFLICT (12), TC-LEASE-NEW-ROOM (12), TC-LEASE-NEW-ROLE (12). Every case has Pre-condition / Steps / Expected Result / Priority.
   - **§4** — 8 sign-off questions for the user, each with proposed default and rationale.
   - **§5–§9** — execution log seeded, files-changed table seeded with pending owners, agents-used table seeded, post-deploy section open, cross-references mapped.

### Files Changed

- `docs/planning/features/2026-05-28-lease-feature-plan.md` (new, 493 lines)
- `agent-team-change-logs/gharsetu-lead-2026-05-28.md` (this file, new)

### Open decisions blocking implementation

Eight questions in §4 of the planning file; the user's answers will be appended in-place. The most critical:

1. Q1 — Confirm Option C as the architecture (supersedes `2026-05-26-per-room-leasing.md` in spirit).
2. Q3 — Confirm explicit `renewed_from_lease_id` linkage on the successor lease (instead of guessing renewal via tenant-set overlap in the cron).
3. Q5 — Confirm Postgres `EXCLUDE USING gist` is acceptable for DB-level conflict enforcement (the "no FOREIGN KEY constraints" rule does not block exclusion constraints, but worth recording in the backend skill catalogue).
4. Q7 — Confirm Tenant role sees their `upcoming` lease in dashboard.

### Notes

- No code written. No prototype HTML produced. No SRS amendments made on disk — those happen when this plan moves out of `proposed`.
- The session uncovered a real architectural risk in the existing per-room-leasing planning file (property-scope NR-1 lock cannot represent mixed buildings). Addressed by superseding-in-spirit rather than rewriting — the older file keeps its detailed prototype-iteration spec; the newer file owns the truth on lock scope.
- The five-status taxonomy reconciles the user's vocabulary ("upcoming + active + ended + terminated") with the SRS-locked four-status set (active/expired/renewed/terminated) by keeping all five enum values internally and merging expired+renewed into a single "Ended" filter tile in the UI. Both views are preserved.
- Wire-stable smallint enums respected (Scope rule G): `upcoming` slotted at value 1, the existing four kept at their original positions 2-5. No renumbering.
- All proposed UI uses existing prototype CSS tokens (`badge-active`, `badge-prepaid`, `badge-closed`, `badge-terminated`, `field-error`) — no new design tokens introduced; no design contract change required (Scope rule I).
- Migration discipline respected (Tech rule #14): the proposed migration is append-only, reversible, and includes a documented backfill (existing units → leasing_mode=1, existing leases → scope=1, room_id NULL).
- Snake_case for tables and columns per Tech rule #12. No FK constraints per Tech rule #13 — relations declared via Prisma `@relation` only. The proposed `EXCLUDE USING gist` is an exclusion constraint, not a foreign key — a distinction that needs explicit recording in the backend skill if accepted (Q5).
- Worker-≠-Checker: this planning file does not flip any `feature_list.json` row to `passing`. Implementation is downstream and goes through the standard verification gate when ready.
- No commits or pushes (per Working rule §1 — user instruction required).

---

## Task 2 — Lease feature plan REWRITTEN (property/unit leasing-mode toggle abandoned)

- Status: ✅ Completed
- Started: 2026-05-28 (continuation of same session)
- Completed: 2026-05-28
- Duration: ~1 session

### Brief

User confirmed in chat that the prior plan's "per-unit `leasing_mode` enum + property-level default" model has been **completely abandoned**. New final model:

1. Lease type (unit-wise / room-wise) is NOT a property or unit setting. No field on Add Property. No toggle on Unit. Scope is decided at lease-create time, encoded by `lease.room_id` (NULL = unit-wise, non-NULL = room-wise).
2. Rooms become sub-entities of a Unit, managed from the Unit Detail page (mirroring property→units IA).
3. Create Lease is rebuilt as a 5-step wizard with card grids (not dropdowns) for property + unit selection.
4. Tenant search-or-create with autocomplete; tenants may hold N active leases (informational badge, never blocking).
5. Step 5 auto-fills rent + deposit, runs real-time conflict validation, shows context panels (unit/room lease history + each tenant's lease history).

### What I did

1. **Read prior plan** (`docs/planning/features/2026-05-28-lease-feature-plan.md`, 493 lines) end-to-end so the rewrite preserves what carries over (status taxonomy, NR-9 conflict rule, NR-10 auto-transition, BL reconciliation) and drops what's withdrawn (property/unit leasing-mode toggle, NR-1 re-scope, the `properties.default_leasing_mode` + `units.leasing_mode` schema changes).

2. **Read context** for surface-area sizing: `prototype/admin/unit-detail.html` (253 lines — sees how Leases table is laid out + the prototype status simulator pattern), `prototype/admin/create-lease.html` (286 lines — current single-page form to be replaced), `prototype/admin/leases.html` (340 lines — current 4-tile filter), `prototype/admin/property-detail.html` Units sub-table pattern (lines 132–144 — mirror this for the Rooms section), and `docs/planning/FEATURE_PLANNING.md` template.

3. **Rewrote `docs/planning/features/2026-05-28-lease-feature-plan.md`** end-to-end (425 lines, all 9 template sections populated). Key changes from the prior draft:
   - **§2.1 model** — rooms as sub-entities of units; lease scope encoded by `lease.room_id` only; no `leasing_mode` enum on units; no `default_leasing_mode` on properties.
   - **§2.2 status taxonomy** — preserved verbatim from prior draft (upcoming=1, active=2, expired=3, renewed=4, terminated=5).
   - **§2.3 NR-9 refined** — now includes the cross-scope conflict statement: a unit-wise lease blocks all room-wise leases on the same unit (and vice-versa) in the same date range.
   - **§2.4 NR-10 preserved** — daily 00:05 + 00:10 crons; `renewed_from_lease_id` linkage is the renewal marker (no tenant-set guesswork).
   - **§2.5 lock rules rewritten** — unit-level lock for room CRUD when the unit has any active/upcoming lease (whether unit-wise or on any of its rooms); room-level lock for editing/retiring a specific occupied room.
   - **§2.6 NEW — full 5-step wizard spec** — radio cards Step 1 · card grid Step 2 · card grid + conditional room grid Step 3 · tenant search-or-create with Primary radio Step 4 · auto-filled lease details + conflict validation + two context panels Step 5. Card-grid pattern (not dropdowns) is locked in.
   - **§2.7 listing refactor** — five tiles: All · Upcoming · Active · Ended · Terminated. Status badge taxonomy (Upcoming = `badge-prepaid`, Active = `badge-active`, Ended = `badge-closed` with disambiguated label, Terminated = `badge-terminated`). Row actions are status-driven; non-View actions are placeholders that fire `gsToast` info messages (the real Renew / Terminate flows ship in their own planning files).
   - **§2.8 unit-detail Rooms section** — table mirrors property-detail Units sub-table; Add/Edit/Retire modals with locks.
   - **§2.10 NR-11 NEW** — explicit "a tenant may hold N active leases simultaneously; system does not restrict." Captures real-world landlord-leases-same-person-multiple-PG-rooms case.
   - **NR-1 marked superseded** — earlier per-unit `leasing_mode` lock formulation is withdrawn; replacement statement says scope lives on the lease, not on the unit or property.
   - **§2.9 files** — Admin-only scope: 3 files to touch (`unit-detail.html`, `create-lease.html`, `leases.html`) + 2 verify-only (`properties.html`, `property-detail.html`). PM / tenant / maintenance / super-admin / backend explicitly deferred.
   - **§3 test cases** — 6 namespaces, ~65 cases (TC-LEASE-NEW-ROOMS-001..010, TC-LEASE-NEW-WIZARD-001..018, TC-LEASE-NEW-CONFLICT-001..012, TC-LEASE-NEW-STATUS-001..009, TC-LEASE-NEW-LIST-001..010, TC-LEASE-NEW-TENANT-001..006).
   - **§4 sign-off** — 8 open decisions surfaced with proposed defaults; the property-vs-unit Q1 from the prior draft is gone (decided), replaced with sharper questions on schema minimality, lock granularity, cross-scope conflict, tenant-search scope, deposit auto-fill default, NR-11 wording, listing tiles, and the deferred-PM scope confirmation.

4. **Dispatched `gharsetu-frontend`** to build the Admin-only prototype iteration — see Task 3 below.

### Files Changed

- `docs/planning/features/2026-05-28-lease-feature-plan.md` — rewritten end-to-end (493 → 425 lines)
- `agent-team-change-logs/gharsetu-lead-2026-05-28.md` — this Task 2 section appended (plus Task 3)

### Notes

- The earlier draft's Task 1 entry in this change log is preserved unchanged — it documents the original three-option analysis (Property-only / Unit-only / Property-default + Unit-truth) and the Option C recommendation. That history stays in the log even though the recommendation itself has been overtaken by a fourth option (lease-only, the current model). Worth keeping for the audit trail of how the decision evolved.
- No code written, no prototype HTML produced by this Task. Dispatch to gharsetu-frontend happens in Task 3.
- No commits or pushes (Working rule §1 — user instruction required).
- No `feature_list.json` change in this Task (planning files do not flip state rows).

---

## Task 3 — Dispatch gharsetu-frontend for Admin-only build of the Lease feature

- Status: ✅ Dispatched
- Started: 2026-05-28
- Duration: in-flight at session close

### Brief

Following Task 2's plan rewrite, dispatch `gharsetu-frontend` (Sonnet 4.6) to build the Admin-only prototype iteration. Three prototype files in scope: `admin/unit-detail.html` (add Rooms section), `admin/create-lease.html` (full rewrite to 5-step wizard), `admin/leases.html` (filter tiles + status badges + row actions refactor). Two verify-only: `admin/properties.html` and `admin/property-detail.html` (confirm no leasing-mode field added or removed). PM / Tenant / Maintenance / Super Admin / backend all explicitly out of scope.

### Notes

- Dispatch brief includes: full step-by-step wizard spec, room-management UX in unit-detail, card-grid pattern enforcement (not dropdowns for property/unit selection), tenant search-or-create with Primary radio, auto-fill behaviors on Step 5, conflict validation logic + exact error message wording, two context panels on Step 5, lock rules, and explicit self-verification checklist (tagcheck, inline JS node --check, manual click-through of the wizard).
- Reminders sent: no helper caption text under inputs (project rule); searchable dropdowns where applicable (rule #18) — but explicitly NOT for property/unit selection in this build (cards, not dropdowns).
- Frontend agent is NOT to commit or push (Working rule §1).
- Frontend agent will produce a 5–10-line summary on return; gharsetu-lead reviews + acceptance pending.

---

### Update — Task 3 dispatch could not be issued from this context

The Task tool for delegating to `gharsetu-frontend` is not available from the current sub-shell. The full dispatch brief was prepared and is included in the final return message to the parent orchestrator; the orchestrator should issue the `Task` invocation with `subagent_type: gharsetu-frontend` using that brief verbatim.

No code was written. No prototype HTML produced. Planning file rewrite + this change log are the only deliverables this session can complete from inside the sub-shell.

---

## Task 4 — `renewed` status dropped + unit-detail Leases-table visibility fix recorded

- Status: ✅ Completed (planning delta only)
- Started: 2026-05-28 (continuation of same session)
- Completed: 2026-05-28
- Duration: ~1 session segment

### Brief

User landed two clarifications after Task 2:

1. **Drop the `renewed` status entirely.** Rationale: "When we renew a lease, we only create a new lease — we never change details on the existing lease. So there's no meaning of renewed status." The renewal flow F4 creates a brand-new `upcoming` lease; the original lease runs out its term and the end-of-day cron transitions it to `expired`. The optional `renewed_from_lease_id` metadata FK is retained on the new lease for lineage/reporting only, with zero status implications.
2. **Leases table on `admin/unit-detail.html` (and PM mirror) must remain visible across all unit statuses**, not just when occupied. Specifically: an `upcoming` lease row must show even when the unit is currently Available / Listed / Under Maintenance. Only the **active** lease row stays gated to occupied status. The user has already applied this fix to both `admin/unit-detail.html` and `pm/unit-detail.html` (adding a 4th sample row `#L-2245 · Aditi Joshi · Upcoming · 01/04/2026 → 31/03/2027`). Recording for completeness.

### What I did

1. **Rewrote `docs/planning/features/2026-05-28-lease-feature-plan.md`** with the Revision 2 delta. Net diff vs Revision 1:
   - Front-matter: test-case count 65 → 62 (3 cases dropped); test-case IDs updated (CONFLICT 12→11, STATUS 9→8, LIST 12→10 with relabel).
   - Revision-history note: added Revision 2 entry explaining the status simplification + user reasoning.
   - §1 Requirement (as given): bullet 4 rewritten — "four wire-stable smallint enums" (was five); bullet 5 simplified — drop `renewed` from the ignored-by-conflict list.
   - §2.1 Model: added a sentence on the optional `renewed_from_lease_id` lineage column being metadata-only.
   - §2.2 Status taxonomy: collapsed to a 4-row table (1 upcoming · 2 active · 3 expired · 4 terminated). Explicit note on the renumbering choice (`terminated: 5 → 4`, contiguous, valid because pre-code; flagged as open question §2.11-Q6 in case the user prefers a gap).
   - §2.3 NR-9: filter clause now reads "`expired` or `terminated`" (was "`expired`, `renewed`, or `terminated`").
   - §2.4 NR-10: cron simplified — single `active → expired` flip at 00:10 regardless of any successor. `renewed_from_lease_id` lookup removed from cron logic.
   - §2.6 Step 5 — context panel A wording unchanged (still shows status badges, but no `renewed` rows can exist).
   - §2.7 Listing — filter tiles table simplified ("Ended" maps to `status = 3 (expired)` only, no merge); badge table loses the renewed row; "Ended" label drops the parenthetical disambiguation; row-actions table loses the renewed row.
   - §2.8 split into (a) Rooms section + (b) Leases table visibility fix. The (b) section documents the user's already-applied fix and instructs the frontend agent to verify (preserve) it, not re-implement.
   - §2.10 NR-10 statement updated — "There is no `renewed` status — renewal creates a new lease independently."
   - §2.11 Q3 removed (cross-scope conflict — kept as Q2 in the renumbered list); Q6 added (the `terminated=4` vs `terminated=5` numbering choice — proposed default contiguous, flagged for backend dispatch).
   - §3 Test cases:
     - **Dropped**: `TC-LEASE-NEW-CONFLICT-007` (Renewed lease ignored), `TC-LEASE-NEW-STATUS-004` (Ended renewed badge), `TC-LEASE-NEW-LIST-004` (Renewed row actions), `TC-LEASE-NEW-LIST-011` (Renewed badge in Status column).
     - **Renamed**: `TC-LEASE-NEW-STATUS-003` is now "Ended badge" (was "Ended (expired)"); label in expected result now reads just "Ended".
     - **Added**: `TC-LEASE-NEW-LIST-010` "No 'Renewed' filter tile" — confirms the listing has no tile labeled "Renewed" and no `badge-renewed` in the Status column. Renumbered subsequent rows to keep IDs contiguous.
     - **Renumbered**: CONFLICT block now 1..11 (12→11); STATUS block now 1..8 (9→8); LIST block now 1..10 (was 12, but 2 dropped + 1 added = 10).
   - §4 Sign-off table: previously-pending Q "drop renewed?" is now marked confirmed by the user; new Q on the `terminated=4` vs `terminated=5` numbering choice added as pending (backend-dispatch concern, not blocking the frontend build).
   - §5 Execution log: Revision 2 entry appended.
   - §6 Files changed: added `prototype/pm/unit-detail.html` row marked as "already updated by user" for completeness.
   - §9 Cross-references: SRS impact note expanded ("§4 Module 3 status list will need to be amended to drop `renewed` on ship").

2. **No prototype HTML written** by Task 4. The user's already-applied fix on `prototype/admin/unit-detail.html` + `prototype/pm/unit-detail.html` is preserved as-is; the frontend agent's brief instructs them to verify (not re-implement) the upcoming-row visibility.

3. **Regenerated the dispatch brief** for `gharsetu-frontend` to reflect:
   - 4-status enum (no `renewed`).
   - Listing tile "Ended" maps to `expired` only.
   - Status badge label is just "Ended" (no parenthetical).
   - Mock data on `admin/leases.html`: 4 active · 2 upcoming · 1 expired · 1 terminated (8 rows; previously was 4 active · 2 upcoming · 1 expired · 1 renewed · 1 terminated = 9 rows).
   - Multi-value tile-filter strategy is no longer needed (no merge behind Ended); the existing single-value paginator suffices unchanged.
   - Unit-detail dispatch verifies the user's already-applied Leases-table visibility fix, doesn't re-implement it.
   - The final brief is included in the parent orchestrator's return message for direct dispatch.

### Files Changed

- `docs/planning/features/2026-05-28-lease-feature-plan.md` — rewritten with Revision 2 delta (425 → 440 lines)
- `agent-team-change-logs/gharsetu-lead-2026-05-28.md` — this Task 4 section appended

### Notes

- The Task 3 dispatch brief from earlier is now stale (it referenced 5 statuses and a multi-value Ended-tile filter). The regenerated brief in the orchestrator's return message supersedes it.
- The simplification is a meaningful win for the backend dispatch later: no `renewed_from_lease_id` lookup in the cron, no two-branch end-of-day logic, no merged-tile filter logic in the listing. The lineage relation stays available for reporting if the user wants it, but it's not on any critical path.
- Worker-≠-Checker: planning files do not flip `feature_list.json` state rows. No JSON write in this Task.
- No commits / pushes (Working rule §1).

---

## Task 5 — admin/leases.html listing refactor refined (Revision 3 of the planning file)

- Status: ✅ Completed (planning delta only — dispatch to follow when frontend agent finishes its first pass)
- Started: 2026-05-28 (continuation of same session)
- Completed: 2026-05-28
- Duration: ~1 session segment
- Note: The frontend agent's first build pass (agent id `a239c5fb19af7bc02`) is still running on the Revision 2 brief. This Task 5 planning delta will be sent as a **follow-up SendMessage** after the first pass returns; do not interrupt it.

### Brief

User landed three structural refinements to the `admin/leases.html` listing — purely table-shape changes; the filter-tile + status-badge spec from Revision 2 is untouched.

1. **Separate `Lease Type` column** — new column showing "Unit-wise" or "Room-wise" for each row, positioned between `Lease #` and the next column. Small subtle badge OR plain text — the frontend agent's call, document the choice.
2. **Combined `Property · Unit · Room` cell** — applies the standing user convention from `property-unit-combined-cell.md`. Property name (with locality) on top in default colour; unit on the next line as muted sub-text. For room-wise leases, the muted line concatenates the room label after the unit number via a middle dot: `Unit PG-101 · Room A`. Replaces any existing separate Property + Unit columns.
3. **`Action` column collapses to a single `View detail` link.** All status-driven actions (Cancel-before-start, Renew, Terminate, Process-refund) move to the (deferred, not-yet-built) `prototype/admin/lease-detail.html` page. No inline buttons remain in the listing. The Lease # column becomes meaningfully clickable to the same target.

### What I did

1. **Did NOT interrupt the running frontend agent.** No SendMessage, no message-overlap. The orchestrator will dispatch the delta brief from Task 5 as a follow-up once the first pass returns.

2. **Read context for surgical edits:**
   - The user's memory file `property-unit-combined-cell.md` — confirms the established convention (property on top, unit beneath as `<div class="text-xs muted">`), and the pairing of `data-property` + `data-unit` row attributes for cascade filtering.
   - Confirmed the planning file's leases-listing section is `§2.7` (the user's prompt said "§2.2" but that's the status-taxonomy block — clearly a slip; edited §2.7 as intended).
   - Read the existing §2.7 + §3 LIST test-case block + §2.9 files table to confirm the surgical edit points.

3. **Rewrote `docs/planning/features/2026-05-28-lease-feature-plan.md` surgically** — five anchored substitutions, no full-file rewrite. Net diff:
   - **Front matter** — bumped LIST test IDs `1..010 → 1..011`, total `~62 → ~63`.
   - **Revision history** — added a Revision 3 bullet capturing the three structural changes + the per-user-convention reference.
   - **§2.7** — fully rewritten. New "Table column structure" sub-block lists 8 columns: `# · Lease # · Lease Type · Property · Unit · Tenant(s) · Rent · Status · Action`. Per-column content spec includes:
     - Lease # is now a clickable monospace link → `lease-detail.html?id=L-XXXX` (with `unit-detail.html?lease=L-XXXX` fallback if the detail page doesn't exist when the build runs).
     - Lease Type uses small subtle badges (suggested `badge-renewed` blue for Room-wise, `badge-closed` neutral for Unit-wise) OR plain muted text; agent's judgment call, must be documented in the return summary.
     - Combined cell follows `property-unit-combined-cell.md`. Examples included for both unit-wise (`Green Valley, Dwarka` / `Unit 3A`) and room-wise (`Sai Heights, Lajpat Nagar` / `Unit PG-101 · Room A`).
     - Tenant(s) is the primary name + `+N` muted suffix when co-tenants exist.
     - Action collapses to a single `View detail` link. **No conditional rendering by status.** No buttons. No `gsToast.info(...)` stubs.
   - The old "Row actions" sub-block (the conditional Cancel/Renew/Terminate table) is **deleted** and replaced with the "Row actions are gone from this listing" prose + a two-bullet enumeration of the consequences (Action cell is always `View detail`; Lease # and View detail target the same destination).
   - **§2.9** — leases.html row description updated to reference the new column structure and the room-wise-row-in-mock requirement. The lease-detail.html row is promoted from "skip" to a clearer "DEFERRED" marker explaining the link target convention.
   - **§3 TC-LEASE-NEW-LIST block** — rewritten end-to-end:
     - Dropped: the 4 conditional-action TCs (LIST-001 Upcoming actions, LIST-002 Active actions, LIST-003 Expired actions, LIST-004 Terminated actions — all obsolete with single `View detail`).
     - Dropped: the "No Renewed filter tile" assertion at LIST-010 — its substantive content (no `badge-renewed`, no `data-status="renewed"`) is now folded into the new LIST-011 negative-assertion sweep.
     - Added: LIST-001 column order matches spec; LIST-002 Lease Type Unit-wise rendering; LIST-003 Lease Type Room-wise rendering; LIST-004 Combined-cell unit-wise rendering; LIST-005 Combined-cell room-wise rendering; LIST-006 Action cell is View detail only; LIST-007 Lease # clickable to same target.
     - Kept (renumbered): LIST-008 "+ New Lease" navigates to wizard; LIST-009 Wizard submit toasts and returns; LIST-010 Locale (dates + currency merged into one TC); LIST-011 Negative-assertion sweep — grep `Cancel|Renew|Terminate|Process refund` in the tbody returns zero matches, plus the Revision-2 carry-over assertions on `Renewed` / `data-status="renewed"` / `badge-renewed`.
     - All-tile count TC is dropped as redundant with TC-LEASE-NEW-STATUS-008.

4. **Drafted the delta dispatch brief** (verbatim in the orchestrator's return message). The brief is concise — a focused 1-page edit, not a rebuild. Key guarantees baked in:
   - Reuses existing badges + tokens only (no new CSS, no new badge class definitions).
   - Follows `property-unit-combined-cell.md` literally — `text-xs muted` for the sub-text.
   - Negative assertions on Cancel / Renew / Terminate / Process refund presence in the Action cell.
   - Lease # link target convention — same as `View detail`; deferred-detail-page comment in HTML.

### Files Changed

- `docs/planning/features/2026-05-28-lease-feature-plan.md` — surgically edited (440 → 453 lines). Five anchored replacements: front-matter test counts; revision history Revision 3 bullet; §2.7 column-structure rewrite + actions-removed prose; §2.9 leases.html row + lease-detail.html DEFERRED marker; §3 TC-LEASE-NEW-LIST block rewrite.
- `agent-team-change-logs/gharsetu-lead-2026-05-28.md` — this Task 5 section appended.

### Notes

- The frontend agent's first pass on the Revision-2 brief is still in-flight. Two outcomes are possible when it returns:
  1. **First-pass output already aligned with Revision 3** — unlikely, but possible if the agent saw the user convention and went column-combined of its own accord. Lead reviews first-pass output, accepts, dispatches the delta only for the residual gaps (Lease Type column, action collapse to View detail).
  2. **First-pass output as briefed** — separate Property + Unit columns, conditional action buttons. Lead dispatches the full delta brief; the second pass is a focused edit on `admin/leases.html` only (the unit-detail Rooms section + create-lease wizard from the first pass are unaffected).
- Worker-≠-Checker: planning files do not flip `feature_list.json` state rows. No JSON write in this Task.
- No commits / pushes (Working rule §1).

---

## Task 6 — Planning file for `admin/lease-detail.html` (spin-out from master Lease plan)

- Status: ✅ Completed (planning only — dispatch follows when the current frontend agent's listing delta returns)
- Started: 2026-05-28 (continuation of same session)
- Completed: 2026-05-28
- Duration: ~1 session segment
- Note: The frontend agent's listing-delta second pass (agent `a239c5fb19af7bc02`) is still in flight. This Task 6 deliverable does NOT touch the running agent — it queues the next dispatch.

### Brief

User specced the `admin/lease-detail.html` page conceptually. The listing's Revision 3 build linked to it as a 404-acceptable placeholder. Now that the page is being scoped formally, the user wants:

- Page title `Lease #L-XXXX` (no tenant-name suffix) + Renew + Early-Terminate buttons in the top-right of the page header.
- A Lease Summary card (read-only — all 12 fields the user listed).
- A Tenants card (read-only — primary + co-tenants, with "View profile" placeholder link).
- A Rent Change Schedule card — **the ONLY editable block on the page**, supporting add / edit / remove on future entries with the past entries locked. Verbatim user constraint: "Only Rent Schedule Change only this can be allowed after lease is created no other modification allowed it in no tenant change no lease details change."
- Renew + Early Terminate buttons are **placeholders only this build** — fire toasts. Both flows are deferred to separate planning sessions; termination especially needs a design discussion because of BL-08 (per-co-tenant consent).

### What I did

1. **Did NOT interrupt the running frontend agent.** No SendMessage. Pure parallel planning work.

2. **Read context:**
   - The existing `prototype/pm/lease-detail.html` (593 lines) end-to-end. PM page has 5 blocks: Lease Summary · Co-tenants · Rent Change Schedule (single pending entry + empty-state form) · Documents · Renewal section · Termination section (3-step consent flow inline). Identified what to reuse (cards, modify/cancel schedule modal markup, status-badge tokens) and what NOT to port (the inline renewal drawer, the 3-step termination consent flow, the Documents card, the "Add Co-tenant" button — admin is read-only).
   - Master Lease plan §2.9 to confirm the lease-detail row currently reads `DEFERRED — separate planning file + dispatch`. Updated this row in the master plan to point to the new spin-out file.

3. **Created `docs/planning/features/2026-05-28-lease-detail-page.md`** (486 lines, all 9 FEATURE_PLANNING.md sections populated). Highlights:
   - §1 verbatim user requirement.
   - §2.0 — IA placement: arrivals from `admin/leases.html` (listing's `Lease #` + `View detail` links), `admin/unit-detail.html` (existing per-row "View detail" links — flagged for switch-over from `pm/lease-detail.html` to the new admin page in this build), and a future `admin/users.html`-tenant-detail entry point.
   - §2.0 explicit diff table vs the PM page — 7 deltas captured (title format, Renew/Terminate position + behavior, Co-tenants edit-vs-readonly, RCS multi-entry vs single, Documents card omission, etc.).
   - §2.1 — 5-block page structure with an ASCII sketch + per-block specs:
     - Block 1 page header: title + Renew (primary) + Early Terminate (danger) in topbar; mobile wraps below title, no kebab.
     - Block 2 Lease Summary: 12 fields in a 2-col grid; Property·Unit row uses the combined-cell convention (full-width row spanning both columns to accommodate muted sub-text); fully read-only.
     - Block 3 Tenants: vertical stack of tenant blocks; Primary badge (`badge-active`); Co-tenant badge (`badge-prepaid`); "View profile" placeholder → `users.html?tenant=<slug>` (default option, flagged in §4 Q4); no Add Co-tenant button.
     - Block 4 Rent Change Schedule: table columns Effective date · From → To · Scheduled on · Scheduled by · Status · Action; past = `badge-paid` "Applied" + locked; future = `badge-prepaid` "Scheduled" + Edit/Remove; mock 3 entries (1 past, 2 future) seeded; empty-state spec.
     - Block 5 Renew + Early Terminate: placeholder toasts; HTML `<\!-- TODO -->` comments; status-aware visibility table (upcoming hides Renew; expired hides Terminate; terminated hides both); `data-status-show` attribute pattern.
   - §2.2 — Add / Edit / Remove modals with the BL-11 60-day rule + < lease.end_date check + no-duplicate-date check; success toasts.
   - §2.3 — Prototype-only status simulator (4 buttons: Upcoming / Active / Expired / Terminated) toggling Block 5 + Block 4 behavior + Status badge in Summary.
   - §2.4 — Lock-rules summary table restating the user's "Only Rent Change Schedule is editable" constraint at row granularity.
   - §2.5 — Backend cron interaction (informational; out of prototype scope). Proposes **NR-12** (new) — "Scheduled rent changes auto-apply at 00:15 IST on their effective date. The lease's `monthly_rent_paise` is updated, the rent-schedule row's status flips to Applied (locked), audit_log row written with `actor = system`. No manual 'apply now' API." Wire-stable rule ID per Scope rule G — NR-12 is next free.
   - §2.6 files to touch: new `admin/lease-detail.html` + sweep of `admin/unit-detail.html` per-row "View detail" links from PM to admin lease-detail target.
   - §2.7 BL / NR rules touched table — BL-08 deferred, BL-11 enforced in RCS modal, NR-10 unchanged, NR-12 proposed.
   - §3 — 36 test cases across 6 namespaces: TC-LD-LAYOUT (6), TC-LD-SUMMARY (5), TC-LD-TENANTS (4), TC-LD-RCS (10), TC-LD-ACTIONS (6), TC-LD-STATUS (5). Every TC has Pre-condition / Steps / Expected Result / Priority.
   - §4 — **6 open questions**, of which Q1 (Early Termination consent flow) is explicitly BLOCKING for the termination dispatch. Q1 enumerates **8 sub-questions** for the user's design discussion: who raises the request, how consent is collected, deadline rules (and the Scope-E "no auto-approval timers" interaction), one-decline-kills-all rule, audit-trail format, deposit-refund coupling, effective-date determination, cross-flow conflict with in-flight renewals. Q2 is the Renewal flow fast-track. Q3 is the RCS modal-vs-inline UX choice (recommended: modal). Q4 is the tenant-profile-link target. Q5 is NR-12 sign-off. Q6 is Documents card omission confirmation.
   - §5–§9 — execution log, files-changed ledger, agents-used (with termination + renewal flagged "deferred — separate dispatch"), post-deploy open, cross-references seeded.

4. **Updated `docs/planning/features/2026-05-28-lease-feature-plan.md` §2.9** — the `lease-detail.html` row promoted from `DEFERRED — separate planning file + dispatch` to a clearer "Scoped to a spin-out planning file: ./2026-05-28-lease-detail-page.md. Build is planned (not deferred-indefinite) — next dispatch after this build's listing delta returns. Renew + Early-Terminate flows are placeholder toasts on the page; the actual flows are deferred to their own planning sessions." Touched-by column updated to `gharsetu-lead (planned) → gharsetu-frontend (next build)`.

5. **Drafted the dispatch brief** (verbatim in the orchestrator's return message). Brief is the next-after-listing dispatch — paste-ready once the running frontend agent returns.

### Files Changed

- `docs/planning/features/2026-05-28-lease-detail-page.md` — new (486 lines)
- `docs/planning/features/2026-05-28-lease-feature-plan.md` — §2.9 lease-detail row updated (one anchored substitution)
- `agent-team-change-logs/gharsetu-lead-2026-05-28.md` — this Task 6 section appended

### Notes

- The two deferred flows (Renewal + Termination) each get their own planning file when scheduled. Until then, the page surfaces them as toasts. The user has explicitly committed to a separate design discussion on termination because of BL-08; Q1 in §4 of the new planning file lists the 8 sub-questions to seed that discussion.
- The proposed **NR-12** (rent-change auto-applier cron) is the only new business rule introduced by this page. Wire-stable rule ID. Will need SRS amendment on ship — recorded in the planning file's §9 cross-references.
- The new page reuses the existing PM page's visual language verbatim — no new design tokens, no new CSS classes. The modify/cancel schedule modal markup from `pm/lease-detail.html` (lines 260–294) is the direct reference for the admin Add/Edit/Remove modals.
- Worker-≠-Checker: planning files do not flip `feature_list.json` rows. No JSON write.
- No commits / pushes (Working rule §1).

---

## Task 7 — Plans hardening + Invoicing & Billing module planning

- Status: ✅ Completed (planning + SRS amendment only — dispatch to follow user sign-off + when the current frontend agent is free)
- Started: 2026-05-28 (continuation of same session)
- Completed: 2026-05-28
- Duration: ~1 session segment
- Constraint: Did NOT interrupt the running frontend agent `a239c5fb19af7bc02` (currently on its second pass for the listing-delta + queued behind the lease-detail dispatch).

### Brief

User locked five decisions in chat:
1. **Plans gain a price.** Monthly only — no annual.
2. **Signup unchanged** — public sign-up → Super Admin approval → org on chosen plan immediately. No trial.
3. **Payment collection external** (bank transfer / off-platform). Platform does NOT handle payments.
4. **Invoicing data lives IN the platform.** Auto-generated, Mark-Paid by Super Admin, viewable by Admin read-only.
5. **Feature-gating in admin pages HELD** for a separate session — out of this planning pass.

Scope union: (a) close the 6 remaining critical Plans gaps from prior SaaS analysis (gap #6 held); (b) design the new Invoicing & Billing module end-to-end.

### What I did

1. **Read context** to size the work correctly:
   - `prototype/assets/plans.js` — single-source plan catalogue + helpers (`renderMarketingPlans`, `renderSignupPlanTiles`, `gsFeatureList`, `gsToast`). Confirmed the slugify-on-edit bug at line 336.
   - `prototype/super-admin/plans.html` (441 lines) — Add/Edit/Deactivate flow. Confirmed `askPlanStatus` and `setPopular` patterns.
   - `prototype/super-admin/organization-detail.html` (534 lines) — Change Plan modal lives at line 236-and-following. Confirmed the existing 3-tile picker + Save-disabled-when-equals-current pattern.
   - `prototype/admin/dashboard.html` (302 lines) — current KPI strip + Overdue Leases + Recent Open Maintenance card layout.
   - SRS §4 Module 6 lines 163-168 — current Module 6 spec.
   - SRS §9 line 377 — current "Subscription billing integration" out-of-scope row.
   - SRS §5 NR-table — confirmed the last NR id in use to size NR-13/14/15.

2. **Drafted `docs/planning/features/2026-05-28-plans-and-billing.md`** (575 lines, all 9 FEATURE_PLANNING.md sections populated). Highlights:
   - **§2.0 Mock pricing**: ₹999 / ₹2,999 / ₹6,999 monthly. Reasoning grounded in Delhi rental market economics (cost-as-percent-of-revenue decreases with scale; ₹999 reads as a sub-₹1k psychological threshold; no free tier; no annual discount per user direction).
   - **§2.1 Plans hardening** — six gaps, one per sub-block:
     - Gap 1 pricing: new `gsPriceLabel(plan)` helper; updated `renderMarketingPlans` + `renderSignupPlanTiles`; Add/Edit Plan modal gains a `Monthly price (₹)` field.
     - Gap 2 Change Plan impact panel: caps comparison · features gained · features lost · cap-breach blocker; submit label flips Upgrade Plan / Downgrade Plan / Change Plan based on `priceInr` comparison.
     - Gap 3 deactivate-with-org-count modal copy.
     - Gap 4 "≥3 active plans" enforced as a count rule (not specific ids — the user's question on what the rule means was answered with the rationale).
     - Gap 5 plan id locked on edit; live id preview on Add ("id: standard — locked" sub-text under Name input).
     - Gap 7 Admin dashboard cap nudge — blue at ≥80%, red at 100%, no banner for unlimited plans, dismissable via sessionStorage, prototype simulator toggle.
   - **§2.2 Invoicing & Billing module** — full data model (`invoices` + `invoice_line_items` tables), generation flow (approval-time pro-rated + monthly 00:00 IST cron + draft-to-issued at 00:05), snapshot policy (plan_*_snapshot columns frozen at issue time), three new Super Admin pages (`invoices.html`, `invoice-detail.html`, plus a new Invoices tab on `organization-detail.html`), one new Admin page (`billing.html`).
   - **§2.2.3 First-invoice math** — pro-ration formula with worked example (Standard plan approved 15/05/2026 → ₹1,644.77 for 17 days).
   - **§2.2.4 Mid-cycle plan change** — three options weighed (A new invoice immediately · B amend current · C no proration); recommended **Option C with hybrid feature-flip** (caps + features flip immediately; billing changes from next cycle; no proration on current invoice). Reasoning given: matches industry default · cleanest audit · simplest implementation · 1–30 day asymmetry is small and absorbable.
   - **§2.3 BL/NR rules added**: NR-13 (one issued invoice per org per month), NR-14 (mid-cycle plan change — immediate caps/features, next-cycle billing), NR-15 (invoices append-only post-issue). Plus a non-NR clarification on Gap 4's "≥3 active plans" rule.
   - **§2.4 Files** — 9 prototype touches (3 new pages: `super-admin/invoices.html`, `super-admin/invoice-detail.html`, `admin/billing.html`; 6 existing edited; 30-file sidebar/MoreSheet rollout for the two new nav links).
   - **§3 Test cases** — 9 namespaces, ~48 cases: TC-PLN-PRICE (6), TC-PLN-CHGMOD (8), TC-PLN-DEACT (6), TC-PLN-RENAME (3), TC-ADM-CAP (4), TC-INV-LIST (6), TC-INV-DETAIL (5), TC-INV-GEN (6), TC-INV-ADM (4). Every TC has Pre-condition / Steps / Expected Result / Priority.
   - **§4 Open questions** — 7 questions. Q1 (proration) RESOLVED with clear recommendation (Option C-hybrid) — flagged as needing final user confirmation before backend dispatch. Q2 (GST) deferred to a follow-on planning file. Q3-Q7 each have proposed defaults the user can override.
   - **§5-§9** — execution log, files-changed ledger, agents-used (FE pending; backend + security deferred), post-deploy open, cross-references.

3. **Amended `docs/product/SRS_Document.md` §4 Module 6** (in-place):
   - Plans bullet rewritten: dropped "never below the 3 defaults" parenthetical, added "monthly price (₹) BIGINT paise", added Gap-4 clarification ("at least 3 active plans must exist at all times"), added wire-stable-id sentence.
   - **New Invoicing bullet** added: in-platform invoicing · external payment collection · monthly cron · approval-time pro-ration · 4-status enum (draft/issued/paid/cancelled) · Mark Paid / Cancel (audited) · append-only post-issue · admin-side read-only.
   - "Billing is manual-invoice only" line **removed** (superseded by the new invoicing bullet).

4. **Amended SRS §5 BL/NR table** — added three new rows:
   - NR-13: One issued invoice per org per calendar month; monthly cron.
   - NR-14: Mid-cycle plan change — immediate caps/features, next-cycle billing, no proration.
   - NR-15: Invoices append-only post-issue; only `issued → paid` and `issued → cancelled` transitions allowed; plan snapshot columns frozen.
   - Inserted automatically by walking forward from NR-8 or the highest existing NR row (handles the case where NR-11 + NR-12 from earlier 2026-05-28 sessions are already present).

5. **Amended SRS §9 Out of Scope** row — "Subscription billing integration" was the old wording (implied no invoicing in platform). Rewritten to "Subscription payment gateway" (clearer: invoicing data IS in platform; only payment collection stays external).

6. **CLAUDE.md** — reviewed, no edits needed. Scope rule K's existing "Subscription billing stays manual-invoice only" wording is factually still correct — no payment gateway is being added; the only change is that invoice data is now generated/tracked in-platform. The rule's intent (no Stripe/Razorpay/etc) is preserved.

7. **Drafted the dispatch brief** for `gharsetu-frontend` (returned verbatim to the orchestrator). The brief sequences the work in 7 phases:
   - Phase A: `plans.js` + verify landing + signup pricing
   - Phase B: Super Admin plans page hardening (price field, locked id, deactivate guards)
   - Phase C: Change Plan modal impact panel + label flips
   - Phase D: Admin dashboard cap nudge + simulator
   - Phase E: Super Admin invoices listing + detail pages
   - Phase F: Admin billing page
   - Phase G: Nav rollout (Invoices ×13, Billing ×17)
   Self-contained one-Task call. Tested mock pricing locked. Negative-assertion sweep included.

### Files Changed

- `docs/planning/features/2026-05-28-plans-and-billing.md` — new (575 lines)
- `docs/product/SRS_Document.md` — Module 6 amendment + NR-13/14/15 + §9 Out-of-Scope row update
- `agent-team-change-logs/gharsetu-lead-2026-05-28.md` — this Task 7 section appended

### Notes

- **Mock pricing reasoning is captured in §2.0 of the planning file** — not just numbers but the Delhi-rental-market analysis behind each. If the user wants to override (e.g. ₹499 / ₹1,999 / ₹4,999), the planning file is the single place to edit; `plans.js` follows.
- **Q1 (proration) is the only blocking decision before the backend dispatch.** The frontend prototype builds against the C-hybrid recommendation regardless (mock data + audit-timeline annotations); the user's confirmation determines what the backend cron actually does.
- **CLAUDE.md scope rule K** intentionally **not edited**. The rule's wording ("Subscription billing stays manual-invoice only") remains correct — the invoices ARE manual-invoice (no automated payment collection). If the user wants the rule reworded for precision, that's a separate request.
- **Sidebar/MoreSheet rollout (30 files total)** is the largest mechanical chunk — sized appropriately for one frontend agent dispatch. The agent has shown it can handle large multi-file builds (the v8 build-out touched 37 pages in one session).
- Worker-≠-Checker: planning files do not flip `feature_list.json` rows. No JSON write in this Task.
- No commits / pushes (Working rule §1).

---
