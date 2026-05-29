# gharsetu-frontend change log — 2026-05-28

## Session start

Work from this session (2026-05-28). Prior session work (2026-05-27 into 2026-05-28) is in `gharsetu-frontend-2026-05-27.md`.

---

## Maintenance detail pages — all 4 roles (session start this date)

See `gharsetu-frontend-2026-05-27.md` session-close entry for the full breakdown. Key items completed on 2026-05-28:
- Status simulators added to `admin/`, `pm/`, `maintenance/`, and `tenant/` maintenance-detail pages
- Admin: context card fixed (Monthly Rent removed), Assignment History removed, add-note input added to timeline
- PM: 4-col context card, status-aware actions, captions removed
- Maintenance staff: 3-button simulator (Assigned/In-Progress/Resolved); Acknowledge/Pause/Resume removed
- Tenant: 4-col context card, tenant-friendly simulator labels, Close/Still-an-issue gated to Resolved
- Committed and pushed as `a31af8f`

---

## Sidebar active state fix — maintenance/maintenance-detail.html

`All Requests` sidebar link was missing `active` class on the maintenance detail page — fixed.

**Verify:** tagcheck clean; `active` class confirmed on `all-requests.html` sidebar link.

`pnpm` gates N/A — prototype + docs only; `apps/*` untouched.

---

## Task — admin/lease-detail.html (new page + unit-detail.html link sweep)

**Status:** Completed
**Started:** 2026-05-28
**Completed:** 2026-05-28

**Changes made:**

1. Created `prototype/admin/lease-detail.html` (NEW) — 5-block admin lease detail page per `docs/planning/features/2026-05-28-lease-detail-page.md`:
   - Block 1 (topbar): page title `Lease #L-2103` (text only, no tenant suffix); Renew Lease (primary) + Early Terminate (danger) buttons in the header right, each with a TODO HTML comment and `data-status-show` attribute; mobile wraps to second line via flex-wrap.
   - Block 2 (Lease Summary): read-only 2-col grid, 12 fields; Property·Unit row is full-width `md:col-span-2` combined-cell per `property-unit-combined-cell.md`; Status field carries `id="ld-status-badge"`.
   - Block 3 (Tenants): Rohan Mehta (Primary / `badge-active`) + Priya Mehta (Co-tenant / `badge-prepaid`); each row has "View profile" link to `users.html?tenant=<slug>`; no "+ Add Co-tenant" button.
   - Block 4 (Rent Change Schedule): empty state + 3-row table (1 Applied/locked + 2 Scheduled/editable); `id="ld-rcs-add"` button; Add modal (fields: rent + effective-date + optional note; validations: BL-11 60-day, < lease end, no duplicate date, no-op rent), Edit modal (prefilled, same validation, excludes self from duplicate check), Remove confirmation modal (toast + row removal + empty-state swap when all future rows removed).
   - Status Simulator: `setLeaseSimStatus(status, btn)` drives status badge, header-button visibility (via `data-status-show`), and RCS card mode: `active`=full interactive; `upcoming`=add disabled (tooltip "Schedule rent changes only on active leases. This lease starts on 15/04/2026."), future-row edit/remove disabled; `expired`/`terminated`=add hidden, future-row edit/remove hidden.
   - `gsToast.success()` / `gsToast.info()` thin wrappers defined at top of script — the toast.js `gsToast` API is `gsToast(msg, opts)` only.
   - Admin chrome: Leases sidebar link marked `active`; full Admin sidebar + MoreSheet + tabbar + account menu from `admin/unit-detail.html` pattern.

2. Swept `prototype/admin/unit-detail.html` — switched all 5 `../pm/lease-detail.html?id=...` links to `lease-detail.html?id=...` (relative to admin/). This covers the 4 Leases table "View detail" cells (L-2103, L-2245, L-1842, L-1521) and the narrative link in the Current Tenant(s) section.

**Acceptance criteria verified:**
- `node --check` (via Python extraction): exit code 0.
- Negative assertion grep counts: consent/Step N = 0; Add Co-tenant/Documents = 0; rl-start/renewLeaseDrawer = 0.
- `grep -c "pm/lease-detail.html" prototype/admin/unit-detail.html` = 0 (sweep confirmed).
- TC-LD-SUMMARY-003 (room-wise mock) — NOT wired; single unit-wise mock only. HTML comment left in the Property·Unit row noting room-wise requires extra data wiring. TC-LD-SUMMARY-003 will not pass on tester run for the room-wise path.
- TC-LD-TENANTS-002 (no co-tenant lease) — not a separate mock; the single mock has 2 tenants. Tester will need to toggle/comment one row.

**Files changed:**
- `prototype/admin/lease-detail.html` — CREATED
- `prototype/admin/unit-detail.html` — 5 href values switched

**Notes:**
- Room-wise lease variant (TC-LD-SUMMARY-003) intentionally left as a comment — wiring two full mocks required simulator-level data swap not in scope for this build.
- "Scheduled by" on newly added rows uses hardcoded "Raj Sharma · Admin" (prototype mock). Live build would use the session user.
- The 4th Leases-table row (L-1521, Terminated) also had its "View detail" link switched even though it was not in the brief's count of 3 — it was a `../pm/lease-detail.html` link and belongs in the admin context. Documented here.

---

## Task — Plans hardening + Invoicing & Billing module

**Status:** Completed
**Started:** 2026-05-28 (continued from 2026-05-27 session)
**Completed:** 2026-05-29

**Changes made:**

### Phase A — plans.js
- Added `priceInr` to each plan (Basic 99900, Standard 299900, Premium 699900 paise)
- Added `window.gsPriceLabel(plan)` helper using `en-IN` locale
- Switched plan PKs to numeric integers (1=Basic, 2=Standard, 3=Premium); added `slug` as secondary field
- Updated `renderMarketingPlans` and `renderSignupPlanTiles` to use numeric IDs as radio values and slug for HTML element ids

### Phase B — super-admin/plans.html
- Removed slug/id sub-text div and `updateIdSubtext()` / `slugify()` functions (id is DB-owned)
- `openPlanEditor(id)` now calls `Number(id)` for numeric comparison
- `savePlan()` uses `nextId = max(ids)+1` for new plans (prototype autoincrement)
- Deactivate guard: `btn-disabled` when ≤3 active plans; Reactivate always enabled (btn-primary)
- Price field added; validates > 0 whole number; stored as paise (rupees × 100)
- Deactivate confirm modal body shows live org count
- Invoices sidebar link + MoreSheet entry added

### Phase C — super-admin/organization-detail.html
- Change Plan modal rewired with `renderChangePlanTiles()` dynamic tiles from GHARSETU_PLANS
- `currentPlan` changed from string slug to numeric id (2 = Standard)
- Downgrade-impact panel with cap-breach blocker + features gained/lost
- Submit button label: Upgrade Plan / Downgrade Plan / Change Plan
- Invoices tab added to org-detail tabbar; panel-inv with 4 mock rows
- Invoices sidebar link + MoreSheet entry added

### Phase D — admin/dashboard.html
- Cap-nudge banner: `.alert` at ≥80%, `.alert-emergency` at 100%, dismissable via sessionStorage
- Prototype simulator (3 buttons)
- Billing sidebar link + MoreSheet entry added (between Settings and Delegations)

### Phase E — New pages created
- `super-admin/invoices.html` — 25-row invoice listing with KPI strip, filter tiles, filters row, paginator
- `super-admin/invoice-detail.html` — invoice detail with Mark Paid + Cancel Invoice modals, status simulator, `admin=1` query param hides action buttons

### Phase F — admin/billing.html
- New read-only admin billing page: Current Plan summary card (plan name + price via gsPriceLabel, cap usage, next invoice) + Invoices table with 4 mock rows
- Action = "View" link to `../super-admin/invoice-detail.html?id=...&admin=1`
- Billing sidebar link active + MoreSheet Billing entry active

### Phase G — Nav rollout
- Invoices sidebar link + MoreSheet added to all 11 remaining super-admin pages + 4 master-data sub-pages (total: 15 super-admin HTML files now have Invoices)
- Billing sidebar link + MoreSheet added to all remaining 17 admin pages + 5 master-data sub-pages (total: 24 admin HTML files now have Billing)

### Corrections applied
- Correction 1: Plan `id` is now numeric DB PK. String slug is secondary field. Modal no longer shows id/slug to user. `savePlan()` uses autoincrement for new plans.
- Correction 2: Reactivate button is always `btn-primary` (never disabled). Deactivate is disabled only when it would reduce active plans below 3.

**Files changed:**
- `prototype/assets/plans.js` — priceInr, numeric ids, gsPriceLabel, renderSignupPlanTiles updated
- `prototype/super-admin/plans.html` — numeric ids, slug removal, price field, deactivate guard, Invoices nav
- `prototype/super-admin/organization-detail.html` — Change Plan modal, Invoices tab, numeric plan id
- `prototype/admin/dashboard.html` — cap nudge banner, Billing nav
- `prototype/super-admin/invoices.html` — CREATED
- `prototype/super-admin/invoice-detail.html` — CREATED
- `prototype/admin/billing.html` — CREATED
- `prototype/super-admin/dashboard.html` — Invoices nav
- `prototype/super-admin/organizations.html` — Invoices nav
- `prototype/super-admin/contact-inbox.html` — Invoices nav
- `prototype/super-admin/legal-pages.html` — Invoices nav
- `prototype/super-admin/master-data.html` — Invoices nav
- `prototype/super-admin/server-logs.html` — Invoices nav
- `prototype/super-admin/profile.html` — Invoices nav
- `prototype/super-admin/master-data/business-types.html` — Invoices nav
- `prototype/super-admin/master-data/cities.html` — Invoices nav
- `prototype/super-admin/master-data/payment-methods.html` — Invoices nav
- `prototype/super-admin/master-data/states.html` — Invoices nav
- All 19 top-level admin pages + 5 master-data sub-pages — Billing nav

---

## Orchestrator-direct pass (Opus session) — 2026-05-28 evening

User asked for prototype refinements outside the Plans/Billing scope. Done here by the orchestrator rather than dispatching since the files don't overlap with the running Plans/Billing build.

### prototype/admin/create-lease.html
- Wrapped the entire 5-step wizard in a single outer `<section class="card">`; removed the nested per-step `card mb-6` wrappers (now plain `<div>`).
- Added `unitStatusBadgeHtml()` and switched the Step 3 unit grid render to use it — Available → green, Occupied → blue, Listed → blue, Maintenance → amber, Retired → grey. Was previously falling through to `badge-closed` (grey).
- Step 4 rebuilt: each tenant row now has three modes (`search` | `existing` | `new`).
  - Search mode shows a true dropdown (`openTenantDropdown`/`filterTenantDropdown`/`closeTenantDropdownLater`) with the full TENANTS directory, filtered as the user types, plus a sticky "+ Create new tenant" row at the bottom.
  - Existing-tenant mode shows a compact avatar card with **name + email only** (phone deliberately hidden as PII).
  - New-tenant mode reveals the editable Name/Mobile/Email form.
  - Validation rejects rows still in `search` mode.

### prototype/organization-signup.html + prototype/assets/business-types.js
- "Type of Business" is now a multi-select chip group (`renderBusinessTypeCheckboxes`); spans `col-span-2` so it sits on its own full-width row.
- Card widened (max-width 760 → 1100, 1200 at ≥1440px); two-column field grid now kicks in at 768px instead of 1024px; shell gutter trimmed 24px → 16px.
- State and City selects now have `data-searchable`; `searchable-select.js` loaded; cascade calls `SearchableSelect.refresh('city')`.
- `validateBizType` removed; replaced with `validateBizTypes()` (≥1 chip), wired live-clear on change.

### prototype/admin/delegations.html + new prototype/admin/delegation-new.html
- Removed "Created by" column from Active / Upcoming / Expired tables (Revoked panel keeps "Revoked by").
- "+ New Delegation" is now an `<a href="delegation-new.html">` instead of a modal trigger.
- Old modal markup, JS handlers (`openNewDelegModal`, `submitNewDeleg`, `updateChips`, `updateCounter`, `updateWindowNote`, `validateDelegDate`), and modal-only CSS (`.modal--mobile-full`, `.checkbox-group`, `.checkbox-item`, `.chips-preview`) all removed from the listing.
- Listing's Escape handler made null-safe; added a DOMContentLoaded handler that reads `?created=1&target=<tab>` and shows a toast on return from the new page.
- `delegation-new.html` carries the full form (Delegate, Tasks-granted grid, date range, reason); on Save it redirects to `delegations.html?created=1&target=<tab>`.

### CLAUDE.md
- Added Technical convention #19: every table's PK is `id INTEGER` auto-increment owned by the DB; no string slugs as PKs; URLs use `?id=<n>`; Prisma `@relation` always targets numeric `id`.
