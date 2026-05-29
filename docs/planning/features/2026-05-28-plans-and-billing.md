# Plans Hardening + Invoicing & Billing Module

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-28 |
| Shipped        | — |
| SRS row        | §4 Module 6 (Organizations & Subscriptions) — amend (pricing, invoicing scope, NR-13 / NR-14 / NR-15) on ship |
| Test cases     | TC-PLN-PRICE-001..006 · TC-PLN-CHGMOD-001..008 · TC-PLN-DEACT-001..006 · TC-PLN-RENAME-001..003 · TC-ADM-CAP-001..004 · TC-INV-LIST-001..006 · TC-INV-DETAIL-001..005 · TC-INV-GEN-001..006 · TC-INV-ADM-001..004 (~48 cases) |
| Prototype todo | row to be added to `./../prototype-changes.md` on ship |
| User decisions locked (2026-05-28) | Monthly-only billing · External payment collection · Public sign-up unchanged (no trial) · Invoicing data IN platform · Feature-gating in admin pages HOLD (separate session) |

## 1. Requirement (as given)

> User decisions locked in chat (2026-05-28):
>
> 1. **Plans gain a price.** ₹ amount, monthly billing only.
> 2. **Signup flow is unchanged** — public signup → Super Admin approval → org is on the chosen plan immediately. No trial period.
> 3. **Payment collection happens off-platform** (bank transfer / external). The platform does NOT handle payments.
> 4. **Invoicing + billing data live IN the platform.** Invoices are generated and tracked in GharSetu even though money moves outside.
> 5. **Feature-gating in admin pages is HELD** for a separate session — out of scope for this planning pass.
>
> Scope is the union of: (§1) closing the 6 remaining critical gaps on the Plans flow (gap #6 — feature gating — held), and (§2) designing the new Invoicing & Billing module end-to-end.

## 2. Plan

### 2.0 Mock pricing — what numbers ship in `plans.js`

Pricing is per organization per month — flat fee, no per-user tier. (Per-user would punish growth and conflict with the active-user cap which is already the gating mechanism.)

| Plan | Monthly price (₹) | paise (`priceInr`) | Rationale |
|---|---:|---:|---|
| **Basic**    | ₹999/mo  | 99,900 | Loss-leader for very small landlords (5 users / 1 property cap). Lets the platform compete with spreadsheets + WhatsApp on price alone. ₹999 reads as "under ₹1,000" — a common India SaaS psychological threshold. |
| **Standard** | ₹2,999/mo | 2,99,900 | Mid-tier, the **Most Popular** plan. 20 users / unlimited properties. ₹3k/mo for an org running ~5–10 buildings reads as a serious-business spend; 60 user-equivalent or ~120 unit-equivalent landlord economics still leave a healthy margin. |
| **Premium**  | ₹6,999/mo | 6,99,900 | Top tier — unlimited users / unlimited properties / Data Export / Priority Support. The reference deployment (120 units, 18 buildings) would land here. ₹7k/mo for a property-management business at that scale is roughly one rent collection on a single unit per month — easy ROI story. |

Numbers chosen against the Delhi rental market: an organization managing 5–10 units (Basic tier) typically grosses ~₹50–80k/mo in rent, so a ₹999 software cost is ~1.5%. A larger PM business at the Standard tier grosses ~₹3–6 L/mo; ₹2,999 is ~0.7%. Premium-tier orgs gross ₹15 L+/mo; ₹6,999 is ~0.5%. Cost-as-percentage-of-revenue **decreases** with scale — the right shape for retaining the largest customers.

**No free tier.** A free tier turns into a permanent freeloader segment that consumes support and complicates user-cap enforcement; for an Indian SMB SaaS at this price point, a paid Basic that costs less than a Netflix subscription is the right entry point.

**No annual discount.** Locked monthly per user direction. The Add/Edit plan form omits the billing-cycle question entirely; the period is implicit.

These mock prices live in `prototype/assets/plans.js` as `priceInr` paise-integers (Tech convention #12 — money in paise as BIGINT). Display formatting goes through a new `gsPriceLabel(plan)` helper that returns `"₹999/mo"` with Indian grouping (₹2,999 / ₹6,999 / ₹12,345 — never Western 2,999.00).

### 2.1 Plans hardening — the 6 gaps (gap #6 held)

#### Gap 1 — Add pricing to plans

- `prototype/assets/plans.js`:
  - Each plan object gets `priceInr: <paise-integer>`.
  - New helper `window.gsPriceLabel = function (plan) { return '₹' + (plan.priceInr / 100).toLocaleString('en-IN') + '/mo'; }`.
  - The existing helpers (`renderMarketingPlans`, `renderSignupPlanTiles`) emit the price prominently between the plan name and the cap line. The current "Pricing on request" placeholder is removed.
- `prototype/index.html`: pricing cards already wired via `renderMarketingPlans`. After the helper update, they will render `₹999/mo` / `₹2,999/mo` / `₹6,999/mo` automatically. No template change needed beyond a one-time verify.
- `prototype/organization-signup.html`: same — `renderSignupPlanTiles` will render the price line. Verify.
- `prototype/super-admin/plans.html`:
  - Plan cards in the listing show the price as a large display number above the cap line.
  - The Add/Edit Plan modal gains a **"Monthly price (₹)"** number input (whole rupees in the UI; converted to paise on save). Required, > 0, integer.
  - Validation: `priceInr > 0`; integer; no upper bound in v1.
  - Helper text on the field: none (per `no-helper-caption-text.md`).
- `prototype/super-admin/organization-detail.html` Change Plan modal: the picker tiles also show the price label. Combined with §2.1 gap 2, the modal becomes a real decision tool.

#### Gap 2 — Change Plan modal: downgrade-impact preview

The Change Plan modal on `super-admin/organization-detail.html` currently shows the three plan tiles and a Save button. After the user selects a different plan, before Save:

- A **`Change impact` panel** appears between the tiles and the footer. Three sub-blocks:
  - **Caps comparison.** Current cap (e.g. `Active users: 18 / 20 (Standard)`) vs new cap (`Premium: unlimited`). If downgrade and current usage exceeds new cap, the row turns red and a blocker line appears:
    `⚠ This org has 18 active users; the new plan caps at 5. You must reduce users before downgrading.`
    Submit is disabled. Plus a property-cap variant of the same check.
  - **Features GAINED.** A green ✓ list of features in `new.features` ∖ `current.features` ("You will gain: Per-Room Leasing, Task Delegation"). Empty if downgrade.
  - **Features LOST.** A red ✗ list of features in `current.features` ∖ `new.features`, plus a sentence: `Existing data is preserved but these features become read-only or hidden until the plan is upgraded again.` Empty if upgrade.
- The submit button label changes:
  - **Upgrade** (more expensive plan): `Upgrade Plan` — primary saffron.
  - **Downgrade** (less expensive plan): `Downgrade Plan` — danger red.
  - **Lateral** (same price): `Change Plan` — secondary neutral.
  Comparison is on `priceInr` (numeric), not by name.
- Submit is disabled when:
  - Selection equals current plan (existing behavior — kept).
  - A cap is breached (new behavior).

The impact panel uses no new tokens — reuses `.badge`, `.field-error`, `.alert-emergency` (for cap-blocker) and the existing card patterns.

#### Gap 3 — Deactivate-plan guard

`super-admin/plans.html` `askPlanStatus(id, 'deactivate')` confirmation modal currently reads:

> Organizations already on this plan keep it. You cannot assign it to new organizations until reactivated.

Replace with:

> **N organization(s) are currently on this plan.** They keep it; no new organization can be assigned to this plan until reactivated. Continue?

`N` is the live count from `PLANS[id].orgs` (already tracked in `plans.js`). Cosmetic phrasing change + dynamic count interpolation. Same modal pattern.

#### Gap 4 — "Never below 3 defaults" enforced

SRS line 166: *"Subscription Plans — Basic / Standard / Premium (Super-Admin-managed CRUD: add / edit / deactivate, never below the 3 defaults)."*

**Definition adopted:** the rule is **"at least 3 active plans must exist at all times."** Specifically:
- It is **NOT** "the three specific ids `basic / standard / premium` must remain active" — that would lock branding (renames) and prevent the original three from ever being retired even after they've been logically replaced.
- It **IS** a count check: deactivating a plan that would leave `active_count < 3` is blocked.
- New plans the Super Admin adds count toward the 3 minimum.
- The reason for the rule: the public landing page is built to display three pricing tiles. Fewer than three would degrade the marketing surface and force a landing-page redesign on every plan deactivation. Three is the floor.

**Implementation in the prototype:**
- A `Deactivate` button on a plan card is **disabled** (with `title` tooltip) when the would-be-resulting active count is `< 3`. Tooltip wording:
  `Cannot deactivate — at least 3 active plans must exist. Add a new plan first, then deactivate this one.`
- Reactivate is always allowed (it only ever increases the active count).
- The Add-Plan flow has no minimum-related guard.
- Edit (rename, re-cap, re-feature, re-price) does not change the active count and is unaffected.

The rule is recorded as part of the SRS Module 6 amendment on ship. Wire-stable rule ID: this is a clarification of the existing line, not a new NR — no new rule ID needed. If the user prefers it formalized as a numbered NR, it would be NR-16 (after NR-13/14/15 below).

#### Gap 5 — Plan id locked on edit

`prototype/super-admin/plans.html` lines 322–342 currently slugify the plan name on save in both add and edit paths. The risk: renaming `Standard` → `Standard Plus` re-slugifies to `standard-plus`, orphaning every org that carried `plan_id = 'standard'`.

**Fix:**
- Assign `id` exactly once at creation via `slugify(name)` (existing logic), falling back to `plan-N` if slugify returns empty.
- On edit, **do not re-slugify.** The `id` field is read from `editingId` and preserved.
- On the Add/Edit Plan modal in edit mode, the form shows a read-only sub-text under the Name input:
  `id: standard — locked`
  Using `<div class="text-xs muted font-mono">id: standard — locked</div>` (no input — purely display).
- On the Add modal (creating a new plan), the id sub-text shows the **live preview** of the id as the operator types the name: `id: standard-plus (will be locked after save)`. Same `font-mono muted` styling.

This is a one-line bug fix + a small UI clarification. Backend implication: `plans.id` is the wire-stable key for every reference (organization.plan_id_snapshot on invoices, audit logs, etc.). Never re-derive from `name`.

#### Gap 7 — Admin dashboard "approaching cap" nudge

`prototype/admin/dashboard.html` currently has a KPI row + Overdue Leases + Recent Open Maintenance. Insert a **dismissable banner** at the top of the page, above the KPI row, when:
- The org's plan has a finite user cap (`cap \!== null`).
- The org's current active-user count is `≥ 0.8 × cap` (i.e. 80% threshold).

Banner content:
```
Approaching user cap: 18 / 20 active users. Contact your account manager to upgrade.       [Dismiss ×]
```

- Banner class reuses the existing `.alert` token (with the `bg-prepaid` blue background — informational, not warning, until the cap is **actually** breached).
- At 100% (`current == cap`), the banner upgrades to `.alert-emergency` (red) with content `User cap reached: 20 / 20. New user invites will be rejected.`
- Dismissable: a small `×` on the right hides the banner for the session (`sessionStorage`); it re-appears on the next visit. (No permanent dismiss — the cap situation is ongoing.)
- For unlimited plans (`cap === null`): no banner ever.

Mock data on `admin/dashboard.html` should seed a believable active-user count near the threshold (e.g. 17/20) so the banner is visible on the static prototype. A small toggle in the prototype (similar to the status simulator on unit-detail) lets the reviewer flip between "under threshold", "approaching", "at cap" states to verify the three banner states.

### 2.2 Invoicing & Billing module — NEW

A separate operational concern from Plans, sharing only the `plans` and `organizations` tables for snapshotting.

#### 2.2.1 Data model

```
invoices
  id                      INT PK (autoincrement — Scope rule H)
  organization_id         INT (Prisma @relation, no FK constraint per Tech rule #13)
  plan_id_snapshot        TEXT  -- denormalized at issue time; surviving plan renames/deactivations
  plan_name_snapshot      TEXT  -- "Standard" — denormalized at issue time for display
  plan_price_inr_paise    BIGINT -- denormalized at issue time
  period_start            DATE   -- inclusive
  period_end              DATE   -- inclusive
  amount_inr_paise        BIGINT -- sum of line items (in v1 just plan_price_inr_paise; future-proof for proration)
  status                  SMALLINT -- 1=draft, 2=issued, 3=paid, 4=cancelled (wire-stable per Scope rule G)
  invoice_number          TEXT   -- human-readable, e.g. "INV-2026-05-0042" — generated at issue
  issued_on               DATE   -- when status went 1→2
  due_on                  DATE   -- issued_on + 7 days (configurable in Settings later)
  paid_on                 DATE NULLABLE  -- when status went 2→3
  payment_reference       TEXT NULLABLE  -- manual entry from Super Admin (bank UTR, NEFT ref, cheque #, etc.)
  cancelled_on            DATE NULLABLE
  cancellation_reason     TEXT NULLABLE
  created_at              TIMESTAMPTZ
  updated_at              TIMESTAMPTZ

invoice_line_items (optional in v1 — recommended for proration headroom; can ship later)
  id                      INT PK
  invoice_id              INT (Prisma @relation)
  description             TEXT   -- "Standard plan — May 2026" / "Pro-rated credit from Basic"
  amount_inr_paise        BIGINT -- can be negative for credits
  created_at              TIMESTAMPTZ
```

**Status enum (wire-stable per Scope rule G):**

| Value | Status | Semantics |
|---|---|---|
| 1 | draft | Created but not yet issued. Cron writes drafts at 00:00, transitions to issued at 00:05. Internal only. |
| 2 | issued | Visible to the org's Admin. Awaiting payment. |
| 3 | paid | Super Admin recorded payment via Mark Paid. Terminal. |
| 4 | cancelled | Super Admin cancelled (e.g. duplicate, org disputed) with required reason. Terminal. |

**Snapshot policy.** `plan_*_snapshot` columns capture the plan's facts at the moment of invoice issue. If the plan is later renamed, re-priced, or deactivated, **existing invoices are unaffected**. This is a hard requirement: an issued invoice is a historical record.

#### 2.2.2 Generation flow

Three triggers:

| Trigger | When | What |
|---|---|---|
| **A. Approval-time invoice** | On Super Admin approving an org's sign-up | Generate an invoice covering `[approval_date, end_of_calendar_month]`. Amount = pro-rated based on calendar days. (See §2.2.3 for the math.) Status = `issued` immediately. Due = `issued_on + 7 days`. |
| **B. Daily anchor-day cron** | 00:00 IST **every day** | The cron iterates every `Active` org and generates a new invoice for any whose `billing_anchor_day` equals today's date (1–28). Each new invoice covers `[anchor of this month, anchor − 1 of next month]`. Amount = full plan price (no proration on full cycles — see §2.2.4 for the mid-cycle plan-change policy). Status = `draft` → `issued` at 00:05 IST (separate transition keeps the invoice creation idempotent and lets the cron retry). Due = `issued_on + 7 days`. **Why daily, not monthly?** Each org's billing cycle is anchored to its own approval date, so a single first-of-month run no longer fits — the cron has to check every calendar day to catch orgs anchored on that day. |
| **C. Manual generation** | Super Admin → invoice listing → `+ Generate Invoice` button (rare — for fixing missed cron runs) | Same as B but for a specific org + month range. Audit-logged. Out of v1 prototype scope — flag in §4 Q4. |

Email/SMS notifications **out of scope** (Scope rule K). Invoices appear in-app only. The Admin sees a "New invoice issued" item in their notifications feed (existing pattern, surface separately if not already present — not in this plan).

#### 2.2.3 First invoice math — anchor-day billing

At approval the operator picks a `billing_anchor_day` for the org (1–28; default = approval day; values 29/30/31 excluded because they skip February). The first invoice's shape depends on whether the chosen anchor day equals the approval day:

**Case 1 — Anchor equals approval day (the default / recommended path):**
The first invoice is a clean **full cycle** — no pro-ration. Period = `[approval_day, anchor − 1 of next month]`. Amount = full plan price.

Example: Standard plan (₹2,999/mo) approved on 15 May 2026 with anchor day kept at 15:
- `period_start = 15/05/2026`
- `period_end   = 14/06/2026`
- `amount       = ₹2,999` (full cycle)

**Case 2 — Operator overrode the anchor (e.g. to 1 for calendar-month billing, or to the org's fiscal month-end):**
The first invoice is **pro-rated** from the approval day to the day before the next anchor.

```
days_covered = (next anchor occurrence after approval) − approval_day
amount_paise = round(plan.priceInr * days_covered / cycle_length)
period_start = approval_day
period_end   = (next anchor occurrence) − 1 day
```

Example: Standard plan approved on 15 May 2026 with operator override anchor = 1 (calendar):
- Next anchor occurrence = 01/06/2026
- `period_start = 15/05/2026, period_end = 31/05/2026` (17 days)
- `amount_paise = round(299900 × 17/31) = 164,477` ≈ **₹1,644.77**

After the first invoice, every subsequent invoice is a full anchor-day cycle at full plan price; no pro-ration ever runs again.

#### 2.2.4 Mid-cycle plan change — the user's open question (RESOLVED here)

Three options were on the table; the recommended resolution is a **hybrid**, restated cleanly:

> **On mid-cycle plan change:**
> - The new plan's **cap takes effect immediately.** New user/property additions are gated by the new cap as of the change moment.
> - The new plan's **features take effect immediately.** Newly-enabled features become available; newly-disabled features become read-only/hidden. (Feature-gating implementation in Admin pages is a separate session per user direction — but the policy is locked here.)
> - The **current cycle's invoice is NOT amended.** The old plan's invoice for the cycle stands. (A cycle is the org's `billing_anchor_day → anchor − 1` window per NR-13.)
> - The **next cycle's invoice (next anchor-day cron run for this org) bills the new plan price.** No proration, no debit/credit line item.
>
> This is **Option C-with-hybrid-feature-flip** in the user's table. Pros: simplest model · no mutation of issued invoices · matches industry norm (Stripe / Chargebee defaults). Trade-off accepted: the org receives the new plan's features + cap immediately but pays the new price only from next month. This is a small giveaway in the org's favor on upgrades (1–30 days of bonus features) and a small loss on downgrades (1–30 days of higher cap they don't pay for) — symmetric, audit-clean, low-stakes.

**This recommendation is flagged as needing user confirmation before backend implementation** (§4 Q1). It is the most consequential decision in this plan.

NR-14 (below) encodes this rule.

#### 2.2.5 Super Admin invoicing pages

**A. `prototype/super-admin/invoices.html` (NEW)**

Org-wide invoice listing. Layout mirrors `super-admin/organizations.html` and the Revision 3 `admin/leases.html`:

- KPI strip: Total Issued · Outstanding (issued + cancelled aren't counted — only issued past due) · Paid This Month · Cancelled This Month.
- Filter tiles: `All · Issued · Paid · Cancelled` (no Draft — draft is internal-only and never surfaces on this listing).
- Filters: org dropdown · month range (start month / end month) · plan dropdown.
- Search: by invoice number.
- Table columns: `# · Invoice # · Org · Plan (snapshot) · Period · Amount · Status · Issued · Due · Actions`
  - **Org** cell uses combined-cell convention: org name on top, contact email muted beneath.
  - **Plan (snapshot)** shows `plan_name_snapshot` as a small subtle text (not the live plan name — important for snapshot integrity).
  - **Period** shows `DD/MM/YYYY → DD/MM/YYYY` muted.
  - **Status** badges: Issued = `badge-prepaid` blue · Paid = `badge-paid` green · Cancelled = `badge-closed` gray.
  - **Actions**: single `View detail` link (per the standing pattern from Revision 3 of the master lease plan — no inline action buttons on listings).
- `+ Generate Invoice` button (top-right of the page) — placeholder for the manual generation trigger (§2.2.2 C). Disabled in v1 prototype with `title` tooltip: `Manual invoice generation is a v2 feature. Invoices auto-generate monthly.`
- Pagination via the existing `paginate.js` pattern.

Mock seed: ~25 invoices across 8 orgs over 4 months — mix of issued, paid, cancelled — so all four filter tiles have counts.

**B. `prototype/super-admin/invoice-detail.html` (NEW)**

Per-invoice read-only view + Mark Paid + Cancel actions in the page header (top-right of the title), per the lease-detail pattern.

Page layout:
- Header: `Invoice INV-2026-05-0042` · `[Mark Paid]` `[Cancel Invoice]` (status-aware: both hidden on `paid` and `cancelled` invoices; both visible on `issued`; both hidden on `draft`).
- **Invoice Header card** (read-only — same pattern as the lease-detail Lease Summary card):
  - Organization (combined-cell: name + email muted)
  - Plan: `Standard` (snapshot) · `₹2,999/mo`
  - Period: 01/05/2026 → 31/05/2026
  - Issued on / Due on / Paid on (if paid) / Cancelled on (if cancelled)
  - Payment reference (if paid) · Cancellation reason (if cancelled)
- **Line Items card** (read-only) — a small table with description + amount. v1 has one line item per invoice; the table is future-proofed for proration.
- **Status timeline card** — vertical timeline of state transitions with timestamps + actor. e.g.:
  - 01/05/2026 00:00 IST — Created (system)
  - 01/05/2026 00:05 IST — Issued (system)
  - 05/05/2026 14:32 IST — Marked Paid by Super Admin Aayush · ref UTRN12345678
- **Mark Paid modal**: required Payment reference (free text — bank UTR, NEFT ref, cheque #, etc.) · optional Paid on date (DD/MM/YYYY, defaults today) · optional Note. Submit fires `gsToast.success('Invoice marked paid')`.
- **Cancel Invoice modal**: required Cancellation reason (free text, min 20 chars) · confirms with `gsToast.success('Invoice cancelled')`. Cancellation is terminal — a cancelled invoice cannot be re-opened. To "undo" a cancellation, the Super Admin must manually generate a replacement invoice (see §2.2.2 C, deferred).

Status-aware page behavior:
- `draft` invoices: not reachable (no listing surfaces them). If somebody navigates by URL, render a placeholder banner: `This invoice is in draft and not yet visible to the organization.`
- `issued`: full edit affordances (Mark Paid, Cancel).
- `paid`: read-only. Header buttons hidden. Display the payment reference in the header card prominently.
- `cancelled`: read-only. Header buttons hidden. Display cancellation reason prominently in a red `.alert` banner.

**C. `super-admin/organization-detail.html` — Invoices sub-section on the org's detail page**

Add a new tab between **Subscription Plan History** and **Platform-Level Audit**: `Invoices`. The tab panel lists this org's invoices in a compact table — same columns as the org-wide listing minus the Org column. Each row clickable to `invoice-detail.html?id=INV-...`.

Mock seed: 4 invoices for the example org (`Triline Properties`) — one paid, two issued (one approaching due, one past due), one cancelled.

**D. Sidebar nav rollout (all 10 Super Admin pages + Master Data sub-pages)**

Add `Invoices` sidebar link between `Organizations` and `Plans`. Mirror into the MoreSheet on each page. Total touch: 13 files (10 super-admin/*.html + 3 super-admin/master-data/*.html). Use the existing sidebar pattern; the link's `href="invoices.html"` (relative paths preserved).

#### 2.2.6 Admin-side visibility — `prototype/admin/billing.html` (NEW)

The org's own admin sees their own invoices, read-only. Cannot Mark Paid, cannot Cancel.

Page layout:
- Header: `Billing` page title. No action buttons in the header (Admin is read-only here).
- Top card: **Current Plan summary**. Plan name · monthly price · cap usage (e.g. `18 / 20 active users`) · next invoice date (next 1st of the month).
- Invoices table: columns `# · Invoice # · Period · Amount · Status · Issued · Due · Paid on · Action`. Action = `View detail` link → opens a read-only variant of `invoice-detail.html` scoped to the org (no Mark Paid / Cancel buttons).

The Admin's view of `invoice-detail.html` reuses the same page (same file) — the Mark Paid + Cancel buttons in the header are role-guarded with a `data-role-show="super-admin"` attribute (mirror the existing impersonation pattern) and a small JS check at the bottom of the page. In the prototype, the page is hard-coded for the Super Admin view; a comment indicates the Admin variant is the same page minus the two header buttons. In the live build this is a real role guard.

Sidebar/MoreSheet rollout: add `Billing` link to all admin pages. Placement: between **Settings** and **Delegations** in the sidebar (low-frequency operational pages cluster). Total touch: ~17 admin/*.html files.

### 2.3 BL / NR rules — additions

| Rule | Status | Statement |
|---|---|---|
| **NR-13 (new)** | new | **Billing is anchored to each organization, not to the calendar.** Every Organization carries a `billing_anchor_day` (1–28) set at approval (default = approval day, operator-overridable; values 29/30/31 excluded). A 00:00 IST cron runs **every day** and issues an invoice for any Active org whose `billing_anchor_day` equals today, covering `[anchor of this month, anchor − 1 of next month]`. The first invoice (issued at approval) is a full cycle if the anchor equals the approval day, or pro-rated otherwise. Each org has at most one open `issued` invoice per cycle. |
| **NR-14 (new)** | new | On mid-cycle plan change: the new plan's **cap and features take effect immediately**; the **current month's invoice is not amended**; **billing changes from the next monthly cycle**. There is no proration debit/credit on the current invoice. (Subject to final user confirmation — see §4 Q1.) |
| **NR-15 (new)** | new | Invoices are append-only once `issued`. The only mutation paths are: (a) `issued → paid` via Mark Paid (records `payment_reference` + `paid_on`, audited); (b) `issued → cancelled` via Cancel Invoice (records `cancellation_reason` + `cancelled_on`, audited). `paid` and `cancelled` are terminal. Plan snapshot columns (`plan_id_snapshot`, `plan_name_snapshot`, `plan_price_inr_paise`) are frozen at issue time and never updated thereafter. |
| **Plans clarification (Gap 4)** | clarification | The SRS phrase "never below the 3 defaults" (§4 Module 6) is operationalized as: **at least 3 active plans must exist at all times.** Deactivating a plan that would drop active_count < 3 is blocked at the UI (disabled button + tooltip) and at the API (returns 400). Not a new NR ID — a clarification of existing scope. |

Rule IDs respect Scope rule G — NR-13 / 14 / 15 take the next free integers after NR-10 / 11 / 12 (NR-11 + 12 came from earlier 2026-05-28 sessions — lease NR-11 and rent-change applier NR-12). Wire-stable.

### 2.4 Files the implementation will touch

| File | Change | Touched by |
|---|---|---|
| `prototype/assets/plans.js` | Add `priceInr` per plan; new `gsPriceLabel(plan)` helper; remove `slugify(name)` on edit path (id locked); update `renderMarketingPlans` + `renderSignupPlanTiles` to emit the price line; drop "Pricing on request" placeholder. | gharsetu-frontend |
| `prototype/index.html` | Verify only — pricing cards already wired via the helper. | gharsetu-frontend (verify) |
| `prototype/organization-signup.html` | Verify only — tiles already wired via the helper. | gharsetu-frontend (verify) |
| `prototype/super-admin/plans.html` | Add "Monthly price (₹)" input to Add/Edit Plan modal; show price prominently on plan cards; lock id on edit + show `id: standard — locked` sub-text under Name; deactivate-confirm modal shows live org count; deactivate button disabled when active_count would drop below 3 (with tooltip). | gharsetu-frontend |
| `prototype/super-admin/organization-detail.html` | Change Plan modal: live downgrade-impact panel (caps comparison · features gained · features lost); submit label flips (Upgrade Plan / Downgrade Plan / Change Plan); cap-breach blocker. Add new tab "Invoices" with org-scoped invoice table. | gharsetu-frontend |
| `prototype/admin/dashboard.html` | "Approaching user cap" banner at ≥80%; "Cap reached" red variant at 100%; no banner for unlimited plans; dismiss via sessionStorage; prototype simulator to toggle the three states. | gharsetu-frontend |
| `prototype/super-admin/invoices.html` | NEW page — org-wide invoice listing per §2.2.5 A. | gharsetu-frontend |
| `prototype/super-admin/invoice-detail.html` | NEW page — invoice detail + Mark Paid / Cancel modals per §2.2.5 B. | gharsetu-frontend |
| `prototype/admin/billing.html` | NEW page — admin's read-only own-org billing per §2.2.6. | gharsetu-frontend |
| `prototype/super-admin/dashboard.html` and the other 9 super-admin pages + 3 master-data sub-pages | Add `Invoices` sidebar link (between Organizations and Plans) + MoreSheet entry. Total: 13 files. | gharsetu-frontend |
| `prototype/admin/dashboard.html` and the other 16 admin pages | Add `Billing` sidebar link (between Settings and Delegations) + MoreSheet entry. Total: 17 files. | gharsetu-frontend |
| `docs/product/SRS_Document.md` §4 Module 6 | Append invoicing scope statement + the three new NRs (13/14/15) + pricing-on-plans bullet + the "≥3 active plans" clarification. | gharsetu-lead (in this Task) |
| `docs/planning/prototype-changes.md` | (deferred to ship) | gharsetu-frontend |

**Out of scope this build (deferred):**

- **Feature gating in Admin app pages** (gap #6) — user explicitly held for a separate session.
- **Manual invoice generation UI** — the `+ Generate Invoice` button is a disabled placeholder.
- **Tax handling (GST)** — flagged in §4 Q3 below.
- **PDF download** — the Download PDF action is a stub; the prototype `gsToast.info('PDF download — coming in v2')`. Live build needs a server-side PDF generator (Puppeteer or similar).
- **Backend implementation** — schema + 00:00 + 00:05 + 00:15 crons + the audit trail. Separate backend dispatch.
- **Multi-currency** — ₹ only per Scope rule J.
- **Email/SMS invoice notifications** — Scope rule K. In-app feed only.

### 2.5 Open dependencies before code starts

(See §4 for the full open-question set. The three blocking decisions are: §4 Q1 — proration policy; §4 Q3 — GST/tax treatment; §4 Q4 — manual generation surface. Q1 is the most consequential.)

---

## 3. Test cases (designed up front)

Nine namespaces, ~48 cases total. Priority: H = High, M = Medium, L = Low.

### TC-PLN-PRICE — pricing in plans.js + render surfaces (§2.1 Gap 1)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-PLN-PRICE-001 | Each plan carries a price | Open `plans.js` | Inspect `GHARSETU_PLANS` | Each entry has `priceInr: <integer-paise>` | H |
| TC-PLN-PRICE-002 | Helper renders Indian grouping | Console: `gsPriceLabel({priceInr: 299900})` | Read return | `"₹2,999/mo"` (Indian grouping; no `.00`) | H |
| TC-PLN-PRICE-003 | Home pricing cards display price | Open `index.html` | Read each card | `₹999/mo` · `₹2,999/mo` · `₹6,999/mo` visible; no "Pricing on request" anywhere | H |
| TC-PLN-PRICE-004 | Signup tiles display price | Open `organization-signup.html` | Read each tile | Same as -003 | H |
| TC-PLN-PRICE-005 | Super Admin plan cards show price | Open `super-admin/plans.html` | Read each card | Price shown prominently above cap line | H |
| TC-PLN-PRICE-006 | Add Plan modal has price field | Open Add Plan modal | Inspect | "Monthly price (₹)" number input present, required, > 0 | H |

### TC-PLN-CHGMOD — Change Plan modal impact preview (§2.1 Gap 2)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-PLN-CHGMOD-001 | Cap-conflict blocker on downgrade | Org on Standard (20 cap) with 18 active users; pick Basic (5 cap) | Inspect modal | Red row: "This org has 18 active users; the new plan caps at 5. You must reduce users before downgrading."; submit disabled | H |
| TC-PLN-CHGMOD-002 | Features gained list on upgrade | Org on Basic; pick Premium | Inspect | Green ✓ list of features in Premium ∖ Basic | H |
| TC-PLN-CHGMOD-003 | Features lost list on downgrade | Org on Premium; pick Basic | Inspect | Red ✗ list of features in Premium ∖ Basic + "Existing data is preserved but these features become read-only or hidden..." note | H |
| TC-PLN-CHGMOD-004 | Submit label: Upgrade Plan | Pick a more expensive plan | Inspect button | Label `Upgrade Plan`, primary saffron | H |
| TC-PLN-CHGMOD-005 | Submit label: Downgrade Plan | Pick a less expensive plan (no cap breach) | Inspect button | Label `Downgrade Plan`, danger red | H |
| TC-PLN-CHGMOD-006 | Submit label: Change Plan (lateral) | Pick a plan with equal price (mock if needed) | Inspect | Label `Change Plan`, secondary neutral | M |
| TC-PLN-CHGMOD-007 | Submit disabled when selection equals current | Pick the current plan | Inspect | Save / submit button disabled (existing behavior preserved) | H |
| TC-PLN-CHGMOD-008 | Property-cap breach blocker | Org with 8 properties on Standard (unlimited); pick Basic (1 property cap) | Inspect | Row: "This org has 8 properties; the new plan caps at 1. ..."; submit disabled | M |

### TC-PLN-DEACT — Deactivate guards (§2.1 Gaps 3 + 4)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-PLN-DEACT-001 | Deactivate confirm shows org count | Standard plan has 5 orgs | Click Deactivate | Modal body: `5 organization(s) are currently on this plan. They keep it; ...` | H |
| TC-PLN-DEACT-002 | Deactivate confirm with 0 orgs | A plan with `orgs: 0` | Click Deactivate | Modal body: `0 organization(s) are currently on this plan. ...` (rendered with 0; no special-case copy) | M |
| TC-PLN-DEACT-003 | Deactivate disabled when at 3 active | All 3 default plans active; no extras | Inspect Deactivate buttons | All three Deactivate buttons disabled with tooltip `Cannot deactivate — at least 3 active plans must exist...` | H |
| TC-PLN-DEACT-004 | Deactivate enabled when 4 active | Add a 4th plan; all 4 active | Inspect | Every Deactivate button enabled | H |
| TC-PLN-DEACT-005 | Add a plan then deactivate the old one (3 stays satisfied) | Start with 3 active; add a 4th; deactivate any one | Confirm | Active count stays at 3; no block | M |
| TC-PLN-DEACT-006 | Reactivate is always allowed | A deactivated plan | Click Reactivate | No guards; succeeds | M |

### TC-PLN-RENAME — Plan id locked on edit (§2.1 Gap 5)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-PLN-RENAME-001 | Edit a plan and rename | Open Edit for `standard` plan; rename to `Standard Plus`; save | Inspect `PLANS` | `id` stays `standard`; `name` becomes `Standard Plus` | H |
| TC-PLN-RENAME-002 | Edit modal shows locked id sub-text | Open Edit on any plan | Inspect form | Sub-text under Name reads `id: standard — locked` in `font-mono muted` | H |
| TC-PLN-RENAME-003 | Add modal shows live id preview | Open Add Plan; type "Enterprise" in Name | Inspect form | Sub-text under Name reads `id: enterprise (will be locked after save)` | M |

### TC-ADM-CAP — Admin dashboard cap nudge (§2.1 Gap 7)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-ADM-CAP-001 | No banner when under threshold | Org on Standard (20 cap); 10 active users (50%) | Open `admin/dashboard.html` | No banner visible | H |
| TC-ADM-CAP-002 | Blue banner at ≥80% | Same org; 17 active users (85%) | Open page | `.alert` blue banner: `Approaching user cap: 17 / 20 active users. Contact your account manager to upgrade.` Dismiss × visible | H |
| TC-ADM-CAP-003 | Red banner at 100% | Same org; 20 active users | Open page | `.alert-emergency` red banner: `User cap reached: 20 / 20. New user invites will be rejected.` | H |
| TC-ADM-CAP-004 | No banner for unlimited plan | Org on Premium (unlimited) | Open page | No banner ever, at any user count | H |

### TC-INV-LIST — Super Admin invoices listing (§2.2.5 A)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-INV-LIST-001 | Page exists with correct structure | Open `super-admin/invoices.html` | Read columns | `# · Invoice # · Org · Plan · Period · Amount · Status · Issued · Due · Action` | H |
| TC-INV-LIST-002 | Filter tiles present | Inspect | Read tile labels | `All · Issued · Paid · Cancelled` (no Draft) | H |
| TC-INV-LIST-003 | Org cell uses combined-cell convention | Inspect any row's Org cell | Read | Org name on top + email muted beneath | H |
| TC-INV-LIST-004 | Plan column shows snapshot | Org's current plan is Premium; invoice was issued when org was on Standard | Inspect | Plan cell shows `Standard` (snapshot), not `Premium` | H |
| TC-INV-LIST-005 | Action cell is View detail only | Inspect any row | Read Action cell | Single `View detail` link; no inline buttons | H |
| TC-INV-LIST-006 | "+ Generate Invoice" disabled with tooltip | Inspect top-right button | Hover | Disabled state with `title="Manual invoice generation is a v2 feature..."` | M |

### TC-INV-DETAIL — Super Admin invoice detail (§2.2.5 B)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-INV-DETAIL-001 | Issued invoice — both header buttons visible | Open detail for an `issued` invoice | Inspect header | Title + `Mark Paid` + `Cancel Invoice` buttons | H |
| TC-INV-DETAIL-002 | Paid invoice — header buttons hidden + ref visible | Open detail for a `paid` invoice | Inspect | No header action buttons; payment reference displayed prominently in the header card | H |
| TC-INV-DETAIL-003 | Cancelled invoice — red alert with reason | Open detail for a `cancelled` invoice | Inspect | Red `.alert` banner with the cancellation reason | H |
| TC-INV-DETAIL-004 | Mark Paid modal validates reference | Open Mark Paid; submit empty | Inspect | Field error on Payment reference | H |
| TC-INV-DETAIL-005 | Cancel modal validates reason min length | Cancel with reason of 5 chars | Inspect | Field error: min 20 chars | H |

### TC-INV-GEN — Invoice generation policy (§2.2.2 + §2.2.3 + §2.2.4)

(These are policy-level test cases — the prototype seeds the data; the live build runs the cron.)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-INV-GEN-001 | Approval-time invoice covers partial month | Mock: an org approved on 15/05/2026 | Inspect their first invoice | `period_start = 15/05/2026`, `period_end = 31/05/2026`, amount = `round(plan_price × 17/31)` | H |
| TC-INV-GEN-002 | Monthly recurring invoice covers full month | Same org, second invoice (June) | Inspect | `period_start = 01/06/2026`, `period_end = 30/06/2026`, amount = full plan price | H |
| TC-INV-GEN-003 | Plan change mid-cycle — current invoice unchanged | Org changes from Standard to Premium on 15/05/2026; May invoice already issued | Inspect May invoice | Amount + plan snapshot unchanged (still Standard's price) | H |
| TC-INV-GEN-004 | Plan change mid-cycle — next invoice reflects new plan | Same scenario; inspect June invoice | Inspect | Plan snapshot = Premium; amount = Premium's price | H |
| TC-INV-GEN-005 | Plan snapshot survives rename | Plan renamed Standard → Standard Plus after invoice issued | Inspect the invoice | Plan name on the invoice stays `Standard` (the snapshot at issue time) | H |
| TC-INV-GEN-006 | Plan snapshot survives deactivation | Plan deactivated after invoice issued | Inspect the invoice | Invoice still reads correctly; the plan tile in the listing still shows the snapshot | M |

### TC-INV-ADM — Admin own-org billing visibility (§2.2.6)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-INV-ADM-001 | Admin sees own-org invoices | Admin signed in to org with 4 invoices | Open `admin/billing.html` | All 4 invoices in table | H |
| TC-INV-ADM-002 | Admin invoice detail has no Mark Paid / Cancel buttons | Click View detail on any invoice | Inspect header | No `Mark Paid`, no `Cancel Invoice` buttons | H |
| TC-INV-ADM-003 | Current Plan summary present | Inspect top card | Read | Plan name · monthly price · cap usage · next invoice date | H |
| TC-INV-ADM-004 | Admin cannot see other orgs' invoices | Admin tries to navigate to `invoice-detail.html?id=<other-org-invoice>` | Inspect | Page renders an access-denied banner (prototype: just shows it but with a "Not your org's invoice" notice — backend enforces 403 in the live build) | M |

---

## 4. Open questions

These need user input before downstream builds. The prototype build itself does not block on most — it implements the proposed defaults; the user can refine before the backend dispatch. Q1 is the consequential one.

### Q1 — Mid-cycle plan-change proration policy (BLOCKING backend dispatch — NOT this prototype build)

The user surfaced three options and asked the Lead to resolve. **Recommendation: Option C-with-hybrid-feature-flip** (NR-14 above):
- **Caps and features flip immediately** on plan change.
- **Current month's invoice is not amended** (no proration credit/debit).
- **New plan price applies from the next monthly cycle.**

Rationale:
1. Matches industry default (Stripe billing-cycle anchors; Chargebee no-proration mode).
2. Cleanest audit trail — `issued` invoices stay immutable. NR-15 stays clean.
3. Simplest implementation — no line-item algebra, no negative-amount line items, no edge cases around mid-cycle multi-change scenarios (org changes plan twice in one month).
4. The asymmetry (immediate features, delayed billing) is small (1–30 days) and favors the org. Operators see this as a courtesy on upgrades; on downgrades they pay for one more month at the higher rate, which is normal and absorbed without friction.

**Alternative if the user prefers Option A (new invoice immediately):** the model becomes more complex but more "accurate". Each plan period gets its own invoice. NR-14 would read differently and NR-13 would need amending (no longer "at most one issued per month"). Recommend NOT taking this option unless the user has a regulatory reason (e.g. customers demanding exact per-day billing).

**Alternative if the user prefers Option B (amend current invoice):** mutating `issued` invoices breaks NR-15's append-only contract. Recommend strongly against. The prototype's `invoice_line_items` table is in the schema to support this if the user insists — but the recommendation stands at C-hybrid.

**Confirmation needed from user before backend implementation.** The prototype can build against any of the three; this plan implements C-hybrid in mock data + audit-timeline annotations.

### Q2 — Tax handling (GST)

GharSetu is Indian SaaS — GST (18% on SaaS at the time of writing) is legally required on B2B invoices. The user's brief did not address this.

Sub-questions:
1. Does the displayed plan price (₹999) include GST or exclude it? Industry convention is split; Indian B2B SaaS tends toward GST-exclusive list prices ("₹999 + 18% GST = ₹1,178.82").
2. Does the org provide a GSTIN at sign-up for input-credit eligibility?
3. Where does the invoice show the GST breakdown? (Line items at the very least; the invoice header carrying the org's GSTIN if provided.)

**Recommendation:** add GST handling as a follow-on planning file (`<date>-billing-gst.md`). Out of this prototype build. The mock invoices use **inclusive** prices for simplicity; a comment in `invoice-detail.html` notes the GST line is deferred. Confirm with user.

### Q3 — Manual invoice generation surface

The `+ Generate Invoice` button on `super-admin/invoices.html` is a disabled placeholder. Sub-questions:
1. Who can trigger it — Super Admin only, or also Admin (for self-billing requests)?
2. What's the use case in v1? (Probably: fixing a missed cron run; back-filling a manually-onboarded org.)
3. Does it need a full form (org, period, line items) or just "(re-)generate next month for org X"?

**Recommendation:** keep it deferred to v2. In v1, the monthly cron + approval-time auto-generation cover 99% of cases. Document the placeholder.

### Q4 — Payment reference format

The Mark Paid modal accepts free-text payment reference. Sub-questions:
1. Should the field validate against bank transfer formats (UTR is 12–22 digits; NEFT/IMPS refs are longer)? Or stay free-text?
2. Should the field be a select with options (UTR / NEFT / IMPS / Cheque / Cash / Other)?

**Recommendation:** free-text in v1, with placeholder examples in the input. A structured selector can come later with a dedicated payment-methods catalog.

### Q5 — Invoice number format

Proposed: `INV-YYYY-MM-NNNN` (e.g. `INV-2026-05-0042`). Sub-question: is `NNNN` global (incrementing across the platform) or per-org (each org has its own sequence)?

**Recommendation:** global. Per-org gets messy when orgs are created and removed. Global is simple and the format already encodes the month for human readability. The legal requirement (Indian Income Tax Act §31) only mandates uniqueness, not per-customer numbering — global satisfies it.

### Q6 — Display of cancelled invoices to the Admin

When the Super Admin cancels an invoice, should the org's Admin see it on `admin/billing.html`? Options:
1. Show it with `Cancelled` badge + reason visible (transparency, recommended).
2. Hide it entirely (cleaner UX but the Admin won't know what happened).

**Recommendation:** option 1 — visible with the cancellation reason. Audit + transparency.

### Q7 — Tax for invoices generated post-deactivation

If an org is deactivated mid-month, does it still get the partial-month invoice? Recommendation: **No.** Deactivation is a hard stop; the last issued invoice is the last one. The org's status flipping to `Deactivated` blocks the next 1st-of-month cron from including it.

(Note: an `issued` invoice on a deactivated org stays on its detail page forever — historical.)

---

## 5. Execution log

| Date | Event |
|---|---|
| 2026-05-28 | Planning file drafted by gharsetu-lead. Status: `proposed`. SRS §4 Module 6 amendment included in the same Task. NR-13/14/15 + Gap-4 clarification added in §2.3. Mock pricing locked at ₹999 / ₹2,999 / ₹6,999. Q1 resolved with a clear recommendation; awaiting user confirmation. Dispatch brief drafted in the orchestrator's return message — paste-ready. |

## 6. Files changed

| File | Change | Touched by |
|---|---|---|
| `docs/planning/features/2026-05-28-plans-and-billing.md` | This planning file | gharsetu-lead |
| `docs/product/SRS_Document.md` | §4 Module 6 amendment (pricing, invoicing scope, NR-13/14/15, Gap-4 clarification) | gharsetu-lead |
| `agent-team-change-logs/gharsetu-lead-2026-05-28.md` | Task 7 entry | gharsetu-lead |
| `prototype/assets/plans.js` | (pending — price + helper + locked id) | gharsetu-frontend |
| `prototype/index.html` | (verify only) | gharsetu-frontend |
| `prototype/organization-signup.html` | (verify only) | gharsetu-frontend |
| `prototype/super-admin/plans.html` | (pending — Add/Edit price field; locked id sub-text; deactivate guards) | gharsetu-frontend |
| `prototype/super-admin/organization-detail.html` | (pending — Change Plan impact panel; Invoices tab) | gharsetu-frontend |
| `prototype/admin/dashboard.html` | (pending — cap-nudge banner + simulator) | gharsetu-frontend |
| `prototype/super-admin/invoices.html` | (new) | gharsetu-frontend |
| `prototype/super-admin/invoice-detail.html` | (new) | gharsetu-frontend |
| `prototype/admin/billing.html` | (new) | gharsetu-frontend |
| 13 super-admin pages | (pending — Invoices sidebar link + MoreSheet) | gharsetu-frontend |
| 17 admin pages | (pending — Billing sidebar link + MoreSheet) | gharsetu-frontend |
| `docs/planning/prototype-changes.md` | (deferred to ship) | gharsetu-frontend |
| **Deferred** | Feature-gating in admin app pages (gap #6) · GST/tax · Manual invoice generation UI · PDF backend · Email/SMS notifications · Multi-currency · Backend schema + crons | — |

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead     | Plan + SRS amendment + dispatch brief                                                                     | ✅ accepted |
| gharsetu-frontend | Build the 9 prototype touches (3 new pages + 6 existing + 30-file nav rollout)                            | — pending — |
| gharsetu-tester   | TC-PLN-* / TC-ADM-CAP-* / TC-INV-* execution (~48 cases)                                                  | — pending — |
| gharsetu-backend  | Invoice schema + monthly cron + approval-time cron + Mark Paid / Cancel endpoints + plan id wire-stable enforcement (deferred — separate dispatch) | — deferred — |
| gharsetu-security | VAPT on the Mark Paid surface (admin should never see it; only Super Admin) + role-scope leak audit (deferred — separate dispatch) | — deferred — |

## 8. Post-deploy

No issues yet — feature is at `proposed` status.

## 9. Cross-references

- SRS §4 Module 6 (Organizations & Subscriptions) — amended this Task.
- SRS §5 NR-13 / NR-14 / NR-15 — added this Task.
- SRS §9 Out of Scope — "Subscription billing integration" line needs a follow-up edit: invoicing **data** is now in-platform; only payment **collection** stays external. To be folded on ship.
- [`./2026-05-26-super-admin-pages.md`](./2026-05-26-super-admin-pages.md) — original Super Admin page planning; this file extends it.
- [`./2026-05-27-plans-most-popular-control.md`](./2026-05-27-plans-most-popular-control.md) (if present — or the inline planning embedded in `2026-05-27` session log) — the "Most Popular" plan flag; this file does not change that surface but updates the editor next to it.
- [`./2026-05-28-lease-detail-page.md`](./2026-05-28-lease-detail-page.md) — sibling planning file from the same session. The `admin/billing.html` page reuses the same "page header + action buttons + read-only card stack" pattern.
- TEST_CASES — TC-PLN-PRICE-001..006, TC-PLN-CHGMOD-001..008, TC-PLN-DEACT-001..006, TC-PLN-RENAME-001..003, TC-ADM-CAP-001..004, TC-INV-LIST-001..006, TC-INV-DETAIL-001..005, TC-INV-GEN-001..006, TC-INV-ADM-001..004 (promoted on ship).
- User conventions: [`property-unit-combined-cell.md`](../../../.claude/projects/-Users-aayushsaini-projects-property-rental/memory/property-unit-combined-cell.md), [`no-helper-caption-text.md`](../../../.claude/projects/-Users-aayushsaini-projects-property-rental/memory/no-helper-caption-text.md), [`no-back-links-on-detail-pages.md`](../../../.claude/projects/-Users-aayushsaini-projects-property-rental/memory/no-back-links-on-detail-pages.md).
- [`./../prototype-changes.md`](./../prototype-changes.md) — row to be added on ship.
