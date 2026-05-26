# Master Data ownership split — platform vs organization

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-27 |
| Shipped        | — |
| SRS row        | (n/a — UI restructure of an existing module; SRS row to be added when the API spec is ported) |
| Test cases     | TC-MDOWN-001..NNN (role-scope + sidebar + visibility) |
| Prototype todo | row pending |

---

## 1. Requirement (as given)

> User asked: "geneuly who should have access to add update these data? superadmin or admin of any org"
>
> After per-entity analysis and discussion of three architectural options (all-Admin · strict-split · hybrid), the user chose **strict split**: Super Admin owns the platform-level masters; Admin owns the org-level masters.

---

## 2. Plan

### 2.0 Why split

The prior restructure (`2026-05-27-master-data-restructure.md`) put all six masters under Admin. That's wrong for three of them — they describe **platform-level** facts (geographic data; the set of payment rails the platform supports) that should be canonical across all organizations:

| Master | Owner | Why |
|---|---|---|
| Cities | **Super Admin (platform)** | "Delhi" is one objective place. If 50 orgs each maintain their own list, names drift and reporting across orgs breaks. |
| States | **Super Admin (platform)** | Same — DL, HR, UP are objective. |
| Payment Methods | **Super Admin (platform)** | UPI, Bank Transfer, Cash, Cheque, Card map to platform-level integrations. An org doesn't invent payment rails. |
| Amenities | **Admin (org)** | Most are universal (Lift, Parking) but each org wants the freedom to add specific ones (Co-working space, EV charging, Pet area). |
| Maintenance Categories | **Admin (org)** | Plumbing/Electrical are universal but specialty properties need bespoke categories (Pool maintenance, Lift AMC). |
| Visit Purposes | **Admin (org)** | The 6 defaults cover 95% of cases but specialty orgs (co-living, corporate stays) need bespoke purposes (Client meeting, Inspection). |

### 2.1 Storage model implications (carry-over for the app port)

In the multi-tenant Postgres model (shared schema + `organization_id` + RLS):

- Platform-level masters: tables WITHOUT an `organization_id` column. Single global list. Read access for all roles (PM/Tenant/Admin all need to see Cities to record a property's location). Write access for Super Admin only.
- Org-level masters: tables WITH a NOT-NULL `organization_id`. RLS policies scope reads/writes per org. Admin writes; PM/Tenant read.
- Hybrid (future, not in this scope): nullable `organization_id` — platform-seeded rows have NULL; org-specific extras have the org id. The API merges both at read time.

This is **not in scope** for the current prototype iteration. It's documented here so the app-port team carries the right schema model.

### 2.2 Prototype changes

**A. Move 3 platform-level pages from Admin to Super Admin**

Files to relocate:
- `prototype/admin/master-data/cities.html` → `prototype/super-admin/master-data/cities.html`
- `prototype/admin/master-data/states.html` → `prototype/super-admin/master-data/states.html`
- `prototype/admin/master-data/payment-methods.html` → `prototype/super-admin/master-data/payment-methods.html`

Adjustments per file when relocating:
- Asset paths: `../../assets/styles.css` (unchanged — same depth).
- Sibling links: `../dashboard.html` → `../dashboard.html` (still works — super-admin/dashboard exists).
- Sidebar nav: replace the Admin nav block with the Super Admin nav block (Dashboard, Organizations, Plans + Master Data section + Account menu — see §2.3).
- Account menu / sheet: identity becomes **Aayush · Super Admin · AK** (instead of Raj · Admin · RS).
- Sign-out path: `../../login.html` (still correct — same depth).
- Mobile tabbar: Super Admin's 4-tab pattern (Dashboard · Orgs · Plans · Account) replaces the Admin's 5-tab + More pattern.
- The body content of each page (the entity table + Add/Edit/Deactivate modals + helper text) stays unchanged.

**B. Add a Super Admin Master Data sub-menu**

Updated Super Admin sidebar nav across all 5 super-admin pages:

```
Dashboard
Organizations
─── divider ───
Plans
Master Data ▾
  Cities
  States
  Payment Methods
```

Same `.sidebar-section-header` pattern used on Admin pages — default closed, click to toggle, header `.active` when on a Master Data sub-page.

**C. Add a Super Admin Master Data landing**

New file: `prototype/super-admin/master-data.html` — 3-card landing matching the Admin landing pattern. Each card: entity name + count + description + "Manage →" link.

**D. Remove the 3 platform-level masters from Admin nav**

Admin sidebar Master Data sub-menu drops to 3 entries:
```
Master Data ▾
  Amenities
  Categories
  Visit Purposes
```

Same change in the mobile More-sheet.

Files to touch (15 admin files: 12 top-level + master-data.html + 3 remaining sub-pages):
- 12 admin top-level pages — sidebar Master Data sub-menu trimmed to 3 children · More-sheet Master Data section trimmed to 3 children
- `prototype/admin/master-data.html` — rewritten as 3-card landing (Amenities · Categories · Visit Purposes); sub-menu in sidebar trimmed
- `prototype/admin/master-data/amenities.html` — sidebar sub-menu trimmed to 3 children · More-sheet trimmed
- `prototype/admin/master-data/categories.html` — same
- `prototype/admin/master-data/visit-purposes.html` — same

**E. Delete the 3 moved files from Admin**

After relocation, delete from `prototype/admin/master-data/`:
- `cities.html`
- `states.html`
- `payment-methods.html`

**F. Verify no broken cross-references**

Grep for hard-coded links to the deleted Admin paths. Any `<a href="master-data/cities.html">` or similar in Admin pages must be updated (or removed if it pointed to a master that no longer exists in that role's nav).

### 2.3 Solution Overview + SRS update (carry-over)

The Solution Overview v8 currently describes Master Data as a single Admin-managed feature. After this change, it should be re-worded in two sections:

- **Super Admin section**: lists Cities, States, Payment Methods as platform-level masters.
- **Admin section**: lists Amenities, Categories, Visit Purposes as org-level masters; mentions that platform-level entries are read-only at this role.

The Solution Overview docx is generated from `doc-assets/templates/generate_solution_overview.js` — that file is the edit point. **Not in scope this iteration** — flagged for the next Solution Overview pass.

### 2.4 Open decisions (none — all defaulted)

All five sign-off questions from the parent restructure (always-expanded · "Other" reveal · subfolder layout · 3-card landing · expanded More-sheet) carry forward unchanged. No new decisions needed.

---

## 3. Test cases (designed up front)

### 3.1 Role-scope visibility (TC-MDOWN-001..010)

| TC-ID | Title | Pre | Steps | Expected | Priority |
|---|---|---|---|---|---|
| TC-MDOWN-001 | Super Admin sidebar shows Master Data section with 3 children | Logged-in Super Admin | Open sidebar | Master Data ▾ with Cities, States, Payment Methods | H |
| TC-MDOWN-002 | Admin sidebar shows Master Data section with 3 children | Logged-in Admin | Open sidebar | Master Data ▾ with Amenities, Categories, Visit Purposes | H |
| TC-MDOWN-003 | Super Admin cannot see Amenities/Categories/Visit Purposes in nav | Super Admin sidebar | Inspect | Those 3 are NOT in the sub-menu | H |
| TC-MDOWN-004 | Admin cannot see Cities/States/Payment Methods in nav | Admin sidebar | Inspect | Those 3 are NOT in the sub-menu | H |
| TC-MDOWN-005 | Direct URL to platform master from Admin role | Logged-in Admin | Visit `/admin/master-data/cities.html` | 404 (file removed) — production app should also 403 server-side | H |
| TC-MDOWN-006 | Direct URL to org master from Super Admin | Logged-in Super Admin | Visit `/admin/master-data/amenities.html` | Out-of-scope for Super Admin in production; current prototype renders the page (since file still exists). App port enforces RBAC. | M |
| TC-MDOWN-007 | Super Admin landing page renders 3 cards | Visit `/super-admin/master-data.html` | Inspect | 3 cards: Cities, States, Payment Methods | H |
| TC-MDOWN-008 | Admin landing page renders 3 cards | Visit `/admin/master-data.html` | Inspect | 3 cards: Amenities, Categories, Visit Purposes | H |
| TC-MDOWN-009 | Mobile More-sheet — Super Admin no longer has the 6-row Master Data block | Super Admin had no More-sheet before; sidebar pattern is the only nav | Inspect mobile | Master Data shows as a tabbar/sheet entry (Super Admin tabbar still 4 slots; Master Data accessible via sidebar drawer) | M |
| TC-MDOWN-010 | Mobile More-sheet — Admin Master Data block has 3 children | <1024px, logged-in Admin | Open More-sheet | Master Data section + Amenities + Categories + Visit Purposes | H |

### 3.2 Page-level functionality (TC-MDOWN-020..028)

For each relocated page (Cities, States, Payment Methods) under Super Admin — same 3 checks each:

| TC-ID | Title | Pre | Steps | Expected | Priority |
|---|---|---|---|---|---|
| TC-MDOWN-020..022 | Page renders with super-admin chrome | Visit each relocated page | Inspect sidebar | Super Admin nav (Dashboard, Orgs, Plans, Master Data) — NOT Admin nav | H |
| TC-MDOWN-023..025 | Account menu shows Aayush · Super Admin · AK | Each relocated page | Open account menu | Correct identity for the role | H |
| TC-MDOWN-026..028 | Body content unchanged (table + modals) | Each relocated page | Inspect main | Entity table + Add/Edit/Deactivate modals identical to pre-move behavior | M |

### 3.3 Cross-cutting

- The "Used by" counts on the Cities table now span all organizations (because the list is platform-global). The current mock data ("9 properties · 1 city") represents the anchor org; in production this becomes a cross-org aggregate.
- Audit log: changes to a platform-level master log to a platform-scoped audit (no `organization_id`). Changes to an org-level master log to the org's audit. Out of scope for the prototype; flagged for the app port.

---

## 4. Sign-off

| Date | Question | Default | User answer |
|---|---|---|---|
| 2026-05-27 | Ownership model | Strict split | **Strict split (selected)** |
| 2026-05-27 | Add a Super Admin master-data.html landing for consistency? | Yes | Yes (default) |
| 2026-05-27 | Should the Solution Overview be updated this iteration or batched with the next Solution Overview pass? | Batched | Batched (default) |

---

## 5. Execution log

| Date | Event |
|---|---|
| 2026-05-27 | Planning file authored (BEFORE code, per Working rule §2). Executing now. |
| 2026-05-27 | Executed: created `prototype/super-admin/master-data/{cities,states,payment-methods}.html` (3 platform-level pages, with Super Admin chrome — Dashboard/Organizations/Plans sidebar + Aayush/Super Admin/AK identity + 4-tab tabbar, no More-sheet); created `prototype/super-admin/master-data.html` landing (3-card grid); added Master Data sub-menu (collapsed by default, active when on a sub-page) to the 5 Super Admin sidebar pages (dashboard · organizations · organization-detail · plans · profile); trimmed the Admin sidebar + More-sheet Master Data sub-menu from 6 to 3 children across 13 admin top-level pages + the 3 remaining admin sub-pages (16 patches); rewrote `prototype/admin/master-data.html` landing from 6 cards to 3 cards; deleted `prototype/admin/master-data/{cities,states,payment-methods}.html`. Verified: Admin masters = 3 files (amenities, categories, visit-purposes); Super Admin masters = 3 files (cities, states, payment-methods); 0 stale references to the deleted Admin paths; all admin and super-admin pages now show exactly 3 children under their Master Data section. |

---

## 6. Files changed

| File | Change | Touched by |
|---|---|---|
| `./../../../prototype/super-admin/master-data/cities.html` | NEW (moved from admin/master-data/, sidebar swapped to super-admin) | orchestrator |
| `./../../../prototype/super-admin/master-data/states.html` | NEW (moved + sidebar swap) | orchestrator |
| `./../../../prototype/super-admin/master-data/payment-methods.html` | NEW (moved + sidebar swap) | orchestrator |
| `./../../../prototype/super-admin/master-data.html` | NEW landing — 3-card grid | orchestrator |
| `./../../../prototype/super-admin/dashboard.html` | Sidebar: add Master Data sub-menu | orchestrator |
| `./../../../prototype/super-admin/organizations.html` | Same | orchestrator |
| `./../../../prototype/super-admin/organization-detail.html` | Same | orchestrator |
| `./../../../prototype/super-admin/plans.html` | Same | orchestrator |
| `./../../../prototype/super-admin/profile.html` | Same | orchestrator |
| `./../../../prototype/admin/master-data/cities.html` | DELETE | orchestrator |
| `./../../../prototype/admin/master-data/states.html` | DELETE | orchestrator |
| `./../../../prototype/admin/master-data/payment-methods.html` | DELETE | orchestrator |
| `./../../../prototype/admin/master-data.html` | Rewrite — 3-card landing (drop the 3 platform cards) | orchestrator |
| `./../../../prototype/admin/master-data/amenities.html` | Sidebar sub-menu trimmed to 3 children · More-sheet trimmed | orchestrator |
| `./../../../prototype/admin/master-data/categories.html` | Same | orchestrator |
| `./../../../prototype/admin/master-data/visit-purposes.html` | Same | orchestrator |
| `./../../../prototype/admin/{audit-log,dashboard,delegations,maintenance,maintenance-detail,profile,properties,property-detail,rent,settings,units,users}.html` | Sidebar + More-sheet trimmed to 3 Master Data children | orchestrator |
| `./../prototype-changes.md` | Pending — to add on ship | gharsetu-frontend |
| Solution Overview docx | Deferred — flagged for next Solution Overview pass | document-agent |

---

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead (orchestrator) | Per-entity analysis + recommendation + planning + execution | accepted |

No specialist dispatch — pure file relocation + sidebar trim. Orchestrator handles directly.

---

## 8. Post-deploy

_Empty — prototype only. The schema model in §2.1 should be revisited when the app port begins so the `organization_id`-nullable vs `organization_id`-not-null distinction is captured in the Prisma schema for each masters table._

---

## 9. Cross-references

- `docs/planning/features/2026-05-27-master-data-restructure.md` — parent restructure (this file is the role-ownership refinement).
- `docs/planning/features/2026-05-26-admin-module-additions.md` — original Master Data feature; now needs an addendum noting the split.
- `docs/planning/features/2026-05-26-super-admin-pages.md` — Super Admin role definition; this file adds a new sub-area.
- `docs/product/Solution_Overview.docx` — needs an update in the next Solution Overview pass to reflect the platform vs org master-data ownership.
- `doc-assets/templates/generate_solution_overview.js` — edit point for that update.
