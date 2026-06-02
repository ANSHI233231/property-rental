# Feature plan — Delegation Detail page (dedicated)

| Field | Value |
|---|---|
| Status         | in-progress |
| Started        | 2026-06-01 |
| Shipped        | — |
| SRS row        | NR-8 (Admin Task Delegation) — no new rule; UI surface only |
| Test cases     | TC-DELEG-DETAIL-01..08 (designed below) |
| Prototype todo | row in `docs/planning/prototype-changes.md` (added on ship) |

---

## 1. Requirement (as given)

> "Delegations page — create a dedicated page for detail of Delegations. Currently the View page just opens a side-popup, but we need a separate page that shows a card with the selected Delegation row's details and then below shows what users did during this Delegation window with a clear table detail."
>
> Plus (same session): "On the Revoked tab of Delegations, remove the Revoked-by column." (already applied — the revoked-at/by data relocates onto this new detail page.)

## 2. Plan

**Goal.** Replace the right-side `aside.detail-drawer` on `admin/delegations.html` with a dedicated full page `admin/delegation-detail.html` reached from each row's **View** link. The page shows (a) a detail **card** for the selected delegation and (b) a **table** of the actions the delegate took during the delegation window.

**Why a page, not a drawer.** Consistent with the other drill-downs in the prototype (`lease-detail`, `unit-detail`, `maintenance-detail`), gives room for the full action table, and is linkable/shareable via `?id=`.

### 2.1 New page `admin/delegation-detail.html`
- Standard admin chrome: sidebar + topbar + bottom tabbar + MoreSheet, **Delegations** nav active. Account menu + impersonation script as on sibling pages.
- **No** sidebar / more-sheet entry of its own (it's a detail page reached from the list, like `lease-detail`).
- Per saved UX preferences: **no "← Back to Delegations" link**, and **no descriptive caption text** under the title or the table.
- Reads `?id=<n>` (numeric) from the URL, looks the delegation up in a mock `DELEGATIONS` array, and renders. Unknown / missing id → a graceful "Delegation not found" empty state with a link back to the list.

**Layout (top → bottom):**

1. **Page title** — "Delegation Detail".

2. **Detail card** (`.card`):
   - Header line: delegate **name** (≈18px Poppins) + **role chip** (`role-chip-pm` / `role-chip-maint`) + **status badge** (Active `badge-active` / Upcoming `badge-prepaid` / Expired `badge-closed` / Revoked `badge-terminated`).
   - `divider`, then a responsive definition grid (`grid sm:grid-cols-2 gap-…`):
     - **Tasks granted** — `task-chip`s (full list).
     - **Window** — `01/05/2026 → 31/05/2026 · 30 days`; for Active, also "· N days remaining" (computed vs the 2026-06-01 prototype clock).
     - **Created by** — `Raj Singh (Admin) · 28/04/2026 09:30 IST`.
     - **Revoked by** — rendered **only when status = Revoked** (`Raj Singh · 22/04/2026 17:00`). This is the new home for the column removed from the Revoked tab.

3. **Actions table** — heading "Actions taken during this window" + a one-line count ("12 actions"). Columns: **When (IST) · Action (badge) · Target**. Rows are per-delegation (NR-8: actions performed inside the window are attributed to the **delegate**, not the Admin). `overflow-x-auto` for mobile. Real **empty state** row ("No actions recorded during this window.") when the delegate did nothing.

### 2.2 Wire navigation (`admin/delegations.html`)
- Change every row's `View` from `onclick="…openDetailDrawer('sunita')"` to `href="delegation-detail.html?id=<n>"` (numeric id).
- **Remove the side drawer** entirely: the `aside#detailDrawer` + `#detailBackdrop` markup, the `.detail-drawer*` CSS block, and the `openDetailDrawer` / `closeDetailDrawer` JS + the Escape-closes-drawer branch. The Revoke flow, tabs, filters, and the global **Activity Log** button are untouched.

### 2.3 Data model (CLAUDE.md rule #19 — numeric ids, relations by id)
Replace the string-slug `drawerData` with one `DELEGATIONS` array, each entry:
```
{ id: 1, delegate: 'Sunita Arora', role: 'PM', roleClass: 'role-chip-pm',
  status: 'active', tasks: ['Add Property','Add Unit','Edit Unit Rent'],
  start: '01/05/2026', end: '31/05/2026', days: 30,
  createdBy: 'Raj Singh (Admin)', createdAt: '28/04/2026 09:30 IST',
  revokedBy: null, revokedAt: null,
  actions: [ { when:'14/05/2026 09:42', action:'RENT_CHANGE_SCHEDULED', badge:'badge-renewed', target:'Lease #L-2103 · Unit 1A' }, … ] }
```
- Numeric ids assigned to the existing delegations (Sunita=1, Manoj=2, Raju=3, Pooja=4, the expired ones 5–16, revoked Anil=17 — final numbering set during build to match the visible rows).
- URLs use `?id=<n>`; rows reference the delegation by numeric id only.
- This array can live inline in `delegation-detail.html` (the source of truth for the page); the list page only needs the id on each View link. If drift becomes a concern later, extract to a shared `assets/delegations-data.js` — noted as an app-port carry-over, not done now.

### 2.4 Reuse / tokens
Reuse existing classes only — `.card`, `.divider`, `.task-chip`, `.role-chip-pm/-maint`, `.data-table`, badge variants, `.label`. **No new CSS tokens.**

### 2.5 Relationship to `delegation-activity.html`
Keep the global **Activity Log** page (org-wide, all delegates, date/role filters) reached from the list's "Activity Log" button. The new page is the **per-delegation** drill-down. They are complementary; the new page's action table is the same shape as the activity log but scoped to one delegation's window.

## 3. Test cases (designed up front)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|----------|-------|---------------|-------|-----------------|----------|
| TC-DELEG-DETAIL-01 | View opens a page, not a drawer | On Delegations list | Click **View** on an Active row | Browser navigates to `delegation-detail.html?id=<n>`; no side-drawer animation | H |
| TC-DELEG-DETAIL-02 | Card shows correct delegation | Detail page for id=1 | Load page | Name, role chip, Active badge, all task chips, window `01/05/2026 → 31/05/2026 · 30 days`, created-by line all match the list row | H |
| TC-DELEG-DETAIL-03 | Days-remaining on Active | Active delegation, clock 01/06/2026 | Load page | Window line shows "· N days remaining" for Active only | M |
| TC-DELEG-DETAIL-04 | Revoked shows Revoked-by | Revoked delegation (Anil) | Load page | "Revoked by Raj Singh · 22/04/2026 17:00" block present; absent for non-revoked | H |
| TC-DELEG-DETAIL-05 | Actions table populated | Delegation with actions | Load page | Table lists When/Action/Target rows; count line matches row count | H |
| TC-DELEG-DETAIL-06 | Empty actions state | Delegation with no actions | Load page | Single "No actions recorded during this window." row; no crash | M |
| TC-DELEG-DETAIL-07 | Unknown id | URL `?id=999` | Load page | Graceful "Delegation not found" state + link to list | M |
| TC-DELEG-DETAIL-08 | Drawer fully removed | Delegations list | Inspect DOM / click around | No `#detailDrawer`, no `openDetailDrawer`; no JS errors | M |

## 4. Sign-off
- [x] Open decision 1 — numeric ids (Sunita=1 …) instead of the `sunita` slug. **Accepted.**
- [x] Open decision 2 — **REVERSED per user (2026-06-01): DROP the global `delegation-activity.html`** (don't manage two pages). The per-delegation detail page is the only place delegated actions are shown. Activity Log button removed from the list; `delegation-activity.html` deleted.
- [x] Open decision 3 — actions table scoped to within-window dates only. **Accepted.**
- [x] User go-ahead to implement received.

## 5. Execution log
- 2026-06-01 — plan authored. "Revoked by" column removed from the Revoked tab (its data relocates to this page's detail card).
- 2026-06-01 — **implemented** (orchestrator-direct). NEW `admin/delegation-detail.html` (detail card + within-window actions table; `DELEGATIONS` array with numeric ids 1–7, reads `?id=`). `delegations.html`: 7 View links rewired to `delegation-detail.html?id=<n>`; **Activity Log button removed**; side-drawer markup + `.detail-drawer*` CSS + `drawerData`/`openDetailDrawer`/`closeDetailDrawer` JS removed; Escape handler trimmed to the revoke modal. **`delegation-activity.html` deleted** (decision 2 reversal — no longer linked anywhere). Verified: 7 delegations parse, statuses active/active/active/upcoming/expired/expired/revoked, Pooja(4)=0 actions → empty state, Anil(7) revoked-by present, inline-script braces/parens balanced, 0 dangling `delegation-activity`/drawer references. No commit.

## 6. Files changed (planned)

| File | Change | Touched by |
|------|--------|------------|
| prototype/admin/delegation-detail.html | NEW page — detail card + within-window actions table; reads `?id=` from `DELEGATIONS` mock | gharsetu-frontend |
| prototype/admin/delegations.html | View links → `delegation-detail.html?id=<n>`; remove side-drawer markup + CSS + JS; (Revoked-by column already removed) | gharsetu-frontend |
| docs/planning/prototype-changes.md | ledger row on ship | gharsetu-frontend |

## 7. Agents used

| Agent | Task | Status |
|-------|------|--------|
| orchestrator (Opus) | Plan + prototype implementation (orchestrator-direct) | in progress |

## 8. Post-deploy
- App-port: real page at `/admin/delegations/[id]`; detail card from the `delegations` record; the actions table from `audit_log` rows where `delegation_id = :id` AND `created_at` within `[start, end]`, attributed to the delegate (NR-8). Within-window scoping enforced server-side.

## 9. Cross-references
- NR-8 (Admin Task Delegation) — SRS / Solution Overview.
- Sibling detail pages: `admin/lease-detail.html`, `admin/unit-detail.html`, `admin/maintenance-detail.html` (chrome + no-back-link + `?id=` pattern).
- `admin/delegation-activity.html` — global activity log (complementary).
- Saved UX preferences: no helper caption text; no back links on detail pages.
