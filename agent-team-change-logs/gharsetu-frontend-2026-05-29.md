# gharsetu-frontend — 2026-05-29

Orchestrator-direct session (Opus). No specialist agents dispatched — all work landed in prototype/ + docs/.

## Top-level themes

1. **Anchor-day billing** introduced as a first-class concept. Every org now carries its own `billing_anchor_day` (1–28) instead of being on a single calendar-month cron.
2. **Approve modal redesigned** into a proper review surface — captures the anchor day, lets the operator edit the Primary Contact, and handles email collisions.
3. **Admin's `billing.html` absorbed into a new `admin/organization.html`** — full org-detail page with subscription history and invoices, mirroring the Super Admin layout but read-only.
4. **Payment Methods master** now wired into Mark-Paid (dropdown + dynamic ref label).
5. **Plan-related polish across all four surfaces** (Super Admin cards, marketing, sign-up, Change-Plan modal): Core constant added, unified flat 2-column feature list, signup tile redesigned.

## Files created

| File | Purpose |
|---|---|
| `prototype/admin/organization.html` | NEW — admin's org-detail page (status strip + org details + subscription card with feature chips + subscription plan history + invoices) |
| `prototype/admin/invoice-detail.html` | NEW — admin-side read-only invoice detail (no Mark Paid / Cancel; was reusing super-admin URL with `?admin=1` flag — now lives entirely under `/admin/`) |
| `prototype/admin/delegation-new.html` | NEW — full-page delegation creation form with 30 tasks across 8 capability groups (Property & Inventory · Leases · Rent & Payments · Maintenance · Visitors · Users & Team · Master Data · Audit & Reports), per-group "Select all" toggle, chips preview with count |
| `prototype/assets/payment-methods.js` | NEW — canonical Payment Methods master (UPI · NEFT · Cash · Cheque · IMPS) with `renderPaymentMethodOptions` + `gsPaymentMethodById` / `gsPaymentMethodBySlug` helpers |

## Files deleted

| File | Why |
|---|---|
| `prototype/admin/billing.html` | Content absorbed into `admin/organization.html`. All sidebar/more-sheet links across 25 admin pages re-pointed. |

## Major edits

### Approve modal (`super-admin/organization-detail.html`)

- Was: 3-line confirmation. Now: 720 px review modal with 4 sections.
- **A. Organization details** — read-only summary table (name · business type · units · location · plan chosen · submitted on).
- **B. Primary Contact** — name / email / mobile, **read-only by default**; "Change contact" toggle enables inputs; auto-enables when an email collision is flagged.
- **Email collision detection** — red banner + inline error + Approve-button gate. Prototype simulator toggle (`No conflict` / `Email already in use`) lets reviewers test both paths.
- **C. Billing cycle** — anchor day picker (1–28, default = today's date, "today (recommended)" marker), live first-invoice preview that pro-rates if anchor ≠ approval day.
- **E. Actions** — Cancel · `Approve & Provision Admin`. Toast on submit includes the chosen anchor day.
- Removed an earlier "Initial password" override block per user feedback ("we already have password reset on the Users page").

### Anchor-day billing rolled out across 5 surfaces + 2 docs

| Surface | Change |
|---|---|
| `super-admin/invoices.html` | 25 mock invoices re-anchored. 8 orgs × distinct anchor days (5, 8, 12, 15, 18, 21, 25, 28) to demonstrate billing-load spread across the calendar month. |
| `super-admin/invoice-detail.html` | Header card `Period` row + Line Items row + Status Timeline entries all use the anchor-day cycle (`21/05/2026 → 20/06/2026` for the Triline mock). |
| `admin/organization.html` | Invoices table uses the same anchor-day periods. "Next invoice" card shows `21/06/2026` computed from `BILLING_ANCHOR_DAY = 21`. |
| `admin/invoice-detail.html` | Same anchor-day Period / Issued / Due. |
| `super-admin/organization-detail.html` | Subscription card gained a "Billing anchor day · 5 (next invoice 05/06/2026)" row. Approve modal captures it at approval. |
| **`docs/product/SRS_Document.md`** | **NR-13 rewritten** to spell out anchor-day cron model ("00:00 IST cron runs **every day**, issues invoices for orgs whose anchor day equals today"). **NR-14** reworded — "current month's invoice" → "current cycle's invoice". |
| **`docs/planning/features/2026-05-28-plans-and-billing.md`** | §2.2.2 changed from "Monthly recurring cron on the 1st" to "Daily anchor-day cron"; §2.2.3 rewritten as "anchor equals approval day → full cycle / anchor overridden → pro-rated"; NR-13 row in the planning table aligned. |

### Plan / pricing UI polish

- **`prototype/assets/plans.js`** — added `GHARSETU_CORE_FEATURES` (Properties · Units · Rooms · Tenants · Leases · Users, always included), `gsCombinedFeatureList(plan, small)` helper, dropped `gsFeatureList` and `gsCoreList`. Removed Priority Support from the catalogue. Removed Task Delegation from Standard's feature list (now Premium-only).
- **`super-admin/plans.html`** — plan cards redesigned with 6 strict blocks (header / price / caps / features / org usage / actions). Two-column flat feature list. Plan editor modal got a read-only "Core (always included)" section above the editable "Optional features" checkbox grid.
- **`prototype/index.html` (via `renderMarketingPlans`)** — same flat 2-col feature list, no Core/Optional labels.
- **`organization-signup.html` (via `renderSignupPlanTiles`)** — fully redesigned tile: floating "Most Popular" badge above the card, big centred price (30 px), two KPI cap chips (`20 users` / `∞ properties`), divider, 2-col feature list (single column < 640 px). `?plan=<id>` URL param auto-checks the matching radio so "Get started" from the marketing card lands pre-selected.
- **"Generate Invoice" button** on `super-admin/invoices.html` removed (was a disabled v2 placeholder; manual generation belongs in a v2 recovery tool, not a permanent button).

### Mark Paid wiring

- `super-admin/invoice-detail.html` Mark Paid modal now opens with a **Payment Method dropdown** pulled from `GHARSETU_PAYMENT_METHODS`. The Payment Reference field's **label + placeholder swap** based on the selected method (UPI → "UPI transaction ID · e.g. 412345678901"; Cheque → "Cheque number · e.g. 000456"; etc.). Both required.
- Invoice header card gained a "Payment Method" row that shows alongside "Payment Reference" when status = paid.
- Status Timeline meta now includes the method (`28/05/2026 14:32 IST · Aayush (Super Admin) · NEFT / Bank Transfer · ref UTRN12345678`).

### `super-admin/organization-detail.html` Subscription card

- **Removed "Utilization" bar** — redundant with the "Active users · 6 of 20" row right above it. Replaced with a **Features available** chip list driven by `GHARSETU_PLANS[].features` + `GHARSETU_CORE_FEATURES`. Chips render as green-tinted pills (no ✓ tick per user feedback). 12 chips for the Standard mock.
- **Added "Billing anchor day" row** with parenthetical next-invoice date.
- **Cleaned up data inconsistencies** — removed a future 02/06/2026 Premium row from Subscription Plan History and a spurious "Plan changed Basic → Standard" row from Platform-Level Audit. History + card + JS `currentPlan` now all agree (Standard, 20 users).

### `admin/delegation-new.html`

- 30 admin tasks grouped into 8 capability cards (Property & Inventory 8 · Leases 4 · Rent & Payments 2 · Maintenance 4 · Visitors 2 · Users & Team 4 · Master Data 5 · Audit & Reports 1).
- Each group has a header with title + "0 / N" count badge + "Select all" checkbox (with indeterminate state).
- Top-of-section chips-preview box shows total selected count + live chips across groups.
- Submit validator scoped to `input[name="tasks"]:checked` (so per-group Select-all controls don't masquerade as task selections).

### Shared / single-source-of-truth additions

- `prototype/assets/payment-methods.js` (canonical master, 5 active methods × refLabel + refPlaceholder per method).
- `prototype/assets/plans.js` `GHARSETU_CORE_FEATURES` constant.
- `prototype/assets/styles.css` `.feature-chip` rule (saffron-green-tinted pill, used by org detail + future surfaces).
- `prototype/assets/business-types.js` `renderBusinessTypeCheckboxes` helper (used by signup multi-select earlier this session).

### `SearchableSelect.refresh` bug fix

- `prototype/assets/searchable-select.js` — `refresh()` used `sel.previousElementSibling` to find the wrap, but after `enhance()` the native `<select>` lives **inside** the wrap (sibling lookup returns the `<ul>` and silently no-ops). Switched to `sel.parentNode`. This is why the signup City dropdown wasn't showing options after a state was picked — the `disabled` flag wasn't being synced. Other call sites (PM/Admin maintenance cascades, visitor pickers) coincidentally still worked because their selects never toggle `disabled`.

### Admin organization rename (25 files)

`admin/billing.html` deleted; `admin/organization.html` created. Sidebar + more-sheet links across **20 admin top-level pages + 5 master-data sub-pages** updated:
- `href="billing.html"` → `href="organization.html"` (and `../billing.html` → `../organization.html` on master-data subs).
- Label `>Billing<` → `>Organization<`.
- Icon swapped from the credit-card glyph to the building glyph that the Super Admin uses for its Organizations link.
- `admin/invoice-detail.html` back-link `← Back to Billing` → `← Back to Organization`.

## Test coverage (delegated to gharsetu-tester later)

No formal tests were added this session. The major surfaces that need TCs after this:

- TC-APPROVE-MODAL-001..006 (org summary table renders, contact edit toggle, email-collision blocker enables Approve only after change, anchor day default = today, anchor preview swaps full-cycle vs pro-rated)
- TC-ANCHOR-DAY-001..004 (cron picks orgs by anchor; invoice periods derive from anchor; admin billing "Next invoice" computes from anchor; mid-cycle plan change still respects NR-14)
- TC-MARK-PAID-METHOD-001..003 (dropdown populated from `GHARSETU_PAYMENT_METHODS`; ref label swaps per method; both fields required)
- TC-ORG-PAGE-001..003 (admin/organization.html status strip + subscription card + feature chips + invoice table)

## Open follow-ups (queued for backend dispatch)

- `organizations.billing_anchor_day SMALLINT CHECK (1..28) NOT NULL` migration.
- Daily-at-00:00-IST cron with `WHERE billing_anchor_day = EXTRACT(DAY FROM CURRENT_DATE)` filter.
- `contact_messages.is_priority` column + sort key (deferred from the Priority Support discussion — moot now that Priority Support was removed from the catalogue).
- Manual invoice generation surface (removed from v1 — re-evaluate for v2).

---

## Task — Clone Admin Property & Lease pages for Property Manager (assigned-scoped)

- Status: ✅ Completed
- Plan: `docs/planning/features/2026-05-29-pm-property-lease-clone.md` (approved)

### Delivered
- **NEW `pm/create-lease.html`** — cloned from `admin/create-lease.html` (full wizard + renew mode). PM chrome swapped in (sidebar/tabbar/more-sheet/account from PM pages, Leases active, Cancel → `leases.html`). `PROPERTIES`/`UNITS`/`TENANTS` scoped to the 3 assigned properties (Green Valley id1, Sai Heights id2, Mayur Vihar id3); Rohini Greens (id4) + its unit + the lone property-4 tenant lease removed so the wizard never offers unassigned inventory. Title → Property Manager.
- **`pm/unit-detail.html`** — re-cloned from admin to parity: Rooms section + Leases "Type" column (Leases after Rooms), unit + per-room "+ Create Lease" → `create-lease.html?unitId/roomId`, gated hidden on Retired/Under-Maintenance. PM chrome; Properties marked active in sidebar/tabbar.
- **`pm/lease-detail.html`** — re-cloned from admin to parity: Renew → `create-lease.html?renew=2103`; per-co-tenant-consent Early Termination section + Terminated read-only record view; no "View profile". PM chrome.
- **`pm/leases.html`** — "+ New Lease" → `create-lease.html`; row "Renew" → `create-lease.html?renew=2103`; stub modal + `alert()` removed; banner de-references "Renewed"; the one "Renewed" row badge → "Ended".
- **`pm/properties.html` + `pm/property-detail.html`** — verified already assigned-scoped, no admin-only actions (no Reassign PM), unit rows → `pm/unit-detail.html`; left intact (kept PM past-tenure sections — an admin clone would have destroyed them).
- **Lease status labels standardized** (admin + pm): fixed set Active/Upcoming/Ended/Terminated; simulator button "Expired" → "Ended" on both lease-detail pages. Maintenance "Closed" / delegation "Expired" / unit "Listed" left untouched (not lease statuses).

### Verification
- `node --check` on extracted inline JS of pm/create-lease, pm/unit-detail, pm/lease-detail — all pass.
- Scope grep: no Rohini/Dwarka/other-org property names in PM active data.
- PM nav contains only PM links (no Users/Organization/Delegations/Master Data/Audit).

### Sync
- SRS §3 PM page row updated to add `create-lease.html` + renew/consent-termination wording.
- `docs/planning/prototype-changes.md` — 2 rows appended (PM parity + status standardization).
