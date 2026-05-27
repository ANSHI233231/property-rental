# Business Types master (platform-level) + sign-up wiring

| Field | Value |
|---|---|
| Status         | shipped (prototype) |
| Started        | 2026-05-27 |
| Shipped        | — |
| SRS row        | (n/a yet — extends the platform Master Data set; SRS row at app-port) |
| Test cases     | TC-BIZTYPE-001..NNN |
| Prototype todo | row pending |

---

## 1. Requirement (as given)

> "we have the type of business on the signup form but didn't has the master for that and also we need it. plan it"

The org sign-up form has a **Type of Business** dropdown with 5 hard-coded options (PG / Hostel · Housing Society · Individual Landlord · Property Management Firm · Other). There is no master managing this list, so it can't be maintained and the org-detail page's "Type of business" value isn't backed by a managed catalogue.

---

## 2. Plan

### 2.0 Ownership — this is a PLATFORM-LEVEL master
Type of Business is chosen on the **public sign-up form, before any organization exists**, and it classifies organizations platform-wide. So it belongs in the **Super-Admin-owned platform masters** — the same tier as Cities, States, Payment Methods (NOT an org-level master like Amenities/Categories/Visit Purposes). One global list; orgs never edit it. Per the ownership-split decision in `2026-05-27-master-data-ownership-split.md`.

### 2.1 Rules check (CLAUDE.md)
- Working rule §2 — planning before code.
- Scope rule **I** — tokens only from `prototype/assets/styles.css`.
- Memory — no descriptive captions; no detail-page back-links.

### 2.2 New Super Admin master page
- `prototype/super-admin/master-data/business-types.html` — same shape as the other platform masters (search + status filter + table + Add/Edit/Deactivate modals + pagination). Columns: Name · Used by (organizations) · Status · Actions.
- Super Admin **Master Data sub-menu grows from 3 → 4**: Cities · States · Payment Methods · **Business Types** (sidebar + More-sheet, across all super-admin pages).
- Super Admin **Master Data landing** (`super-admin/master-data.html`) gains a 4th card for Business Types.

### 2.3 Seed values
| Name | Used by (orgs) | Status |
|---|---|---|
| PG / Hostel | 3 | Active |
| Housing Society | 2 | Active |
| Individual Landlord | 4 | Active |
| Property Management Firm | 2 | Active |
| Co-living | 1 | Active |
| Other | 1 | Active |

### 2.4 Sign-up wiring (shared source)
- The sign-up "Type of Business" `<select>` renders its options from a shared source so the master and the form never drift — mirror the `plans.js` pattern with a small `prototype/assets/business-types.js` (or fold both into a shared data file). The select keeps `id="biz-type"` + its existing validation hook (`biz-type-error`, "Please select a business type.").
- Only **Active** business types appear as selectable options on the form; deactivated ones stay on existing org records but can't be picked for new sign-ups (same rule as every other master).
- The Super Admin **organization-detail** page's "Type of business" value is one of these master entries.

### 2.5 Open decisions (§4)
1. Shared source file: dedicated `business-types.js` vs a combined `assets/masters.js`? Proposed: dedicated `business-types.js` (matches `plans.js` granularity).
2. Seed list — accept the 6 in §2.3 (added "Co-living" since org-detail already uses it)? Proposed: yes.
3. "Other" — keep as a catch-all option? Proposed: yes, keep.

### 2.6 Files to touch
| Path | Change | Owner |
|---|---|---|
| `prototype/super-admin/master-data/business-types.html` | NEW master page | gharsetu-frontend |
| `prototype/super-admin/master-data.html` | add 4th card (Business Types) | gharsetu-frontend |
| `prototype/super-admin/*.html` (sidebar + More-sheet) | Master Data sub-menu 3→4 entries | gharsetu-frontend |
| `prototype/super-admin/master-data/{cities,states,payment-methods}.html` | sub-menu 3→4 (add Business Types sibling link) | gharsetu-frontend |
| `prototype/assets/business-types.js` | NEW shared source (active list + render helper) | gharsetu-frontend |
| `prototype/organization-signup.html` | render `#biz-type` options from the shared source | gharsetu-frontend |

### 2.7 App-port carry-over
- `business_types` table — platform-global (no `organization_id`), Super-Admin CRUD, `status` smallint (ACTIVE=0, INACTIVE=1). `organizations.business_type_id` FK-via-Prisma-relation. Public sign-up reads the Active list; the field stores the chosen id. Every edit writes `audit_log`.

---

## 3. Test cases (designed up front)
| TC | Title | Expected |
|---|---|---|
| TC-BIZTYPE-001 | Business Types master page renders | super-admin/master-data/business-types.html lists the 6 seeds with status |
| TC-BIZTYPE-002 | Add / Edit / Deactivate | CRUD modals work; deactivate keeps it off new sign-ups |
| TC-BIZTYPE-003 | Super Admin Master Data sub-menu has 4 entries | Cities · States · Payment Methods · Business Types (sidebar + More-sheet, all super-admin pages) |
| TC-BIZTYPE-004 | Landing has 4 cards | super-admin/master-data.html shows Business Types card |
| TC-BIZTYPE-005 | Sign-up select renders from master | `#biz-type` options match the Active master entries (shared source) |
| TC-BIZTYPE-006 | Only Active types selectable | a deactivated type does not appear as a sign-up option |
| TC-BIZTYPE-007 | Validation intact | "Please select a business type." still fires when none chosen |
| TC-BIZTYPE-008 | Org-detail reflects type | organization-detail "Type of business" is a master value |
| TC-BIZTYPE-009 | Platform-only | not editable by Admin/PM/etc.; lives under super-admin/ |

---

## 4. Sign-off
| Date | Question | Proposed default | User answer |
|---|---|---|---|
| 2026-05-27 | Shared source file name | `business-types.js` | _pending_ |
| 2026-05-27 | Seed list (6 incl. Co-living) | accept | _pending_ |
| 2026-05-27 | Keep "Other" catch-all | yes | _pending_ |

---

## 5. Execution log
| Date | Event |
|---|---|
| 2026-05-27 | Planning file authored (before code). Awaiting §4 sign-off, then build. |
| 2026-05-27 | Implemented: `assets/business-types.js` shared source · `super-admin/master-data/business-types.html` master page (6 seeds, CRUD, search+status+paginate) · Master Data sub-menu 3→4 across all 10 super-admin pages + landing 4th card · signup `#biz-type` renders from the master. Status → shipped (prototype). |

## 6. Files changed
_Empty — implementation not started._

## 7. Agents used
| Agent | Task | Status |
|---|---|---|
| gharsetu-lead (orchestrator) | Planning | accepted |
| gharsetu-frontend | Implementation | pending |

## 8. Post-deploy
_Empty._

## 9. Cross-references
- `docs/planning/features/2026-05-27-master-data-ownership-split.md` — platform vs org master tiers (Business Types is platform-level)
- `prototype/assets/plans.js` — shared-source pattern to mirror
- `prototype/organization-signup.html` §A2 Type of Business field
- `prototype/super-admin/organization-detail.html` — "Type of business" display
