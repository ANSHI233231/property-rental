# Feature Plan — Security Guard role + gate-initiated visitor approvals

- **Date:** 2026-06-01
- **Status:** Built (prototype) — pending commit/push

> **Build note (2026-06-01):** Prototype implemented — `security/` role (dashboard + gate console + profile, guard-only nav), tenant "Pending approvals", admin Users role + property assignment, login shortcut, admin/PM visitors "Awaiting tenant" tile + gate rows, SRS synced (role 6, matrix, enum, Module 8, page map). All new/changed inline JS passes `node --check`; security pages carry no PM-only links. Backend (`security_guard_properties`, `visitor_requests` columns, enums, RBAC) is the next phase when the app is built.
- **Touches:** new 6th role, Visitor Management module (Module 8), Tenant portal, Admin Users, SRS §3/§4/§5, prototype `security/` + `tenant/visitors.html` + `admin/users.html`, role nav/tabbar, plan gating.

## Context
Visitor Management today is a two-party flow: a **Tenant pre-approves** a visitor → a **Visitor Code** is issued → **PM/Admin approve, deny, check-in (by code), check-out**. In the real world the people at the gate are **security guards**, and many visitors arrive **unannounced** — there is no pre-approval to validate. We add a dedicated **Security Guard** role that owns the gate, plus a **reverse (gate-initiated) approval flow**: the guard logs the visitor at the gate and sends an approval request to the right tenant, who approves/denies from their portal in real time. This keeps the resident in control of who enters their unit/room while giving guards a purpose-built console.

## Decisions (confirmed)
1. **Co-tenant approval = ANY ONE** co-tenant on the unit/room lease admits the visitor; the request then closes for the others.
2. **Guard scope = assigned properties only** (gate/building level), assigned by Admin — same model as PM (`property_managers` join → add `security_guard_properties`).
3. **Common/shared-area visits** (no specific lease) are approved **directly by Guard/PM/Admin** — no tenant routing.
4. **Guard-initiated visits need NO Visitor Code** — the tenant's in-app approve/deny IS the authorization. The Visitor Code stays only for the **tenant-pre-approved** flow.

## 1. The role
- **`SECURITY_GUARD = 5`** (next free wire-stable smallint; never renumber — Scope rule G). Org-scoped (belongs to exactly one organization; not platform-level).
- **Created by Admin** on the Users page (like PM/Maintenance); **logs in by email** (email-only auth). Counts toward the org's plan **active-user cap**.
- **Assigned to one or more properties** by Admin. Sees only those properties' visitor data — never other properties, never cross-org.
- **Visitor-Management-only.** No access to leases, rent, maintenance, master data, settings, users, organization. Anything outside Visitor Management → 403.
- **Admin Impersonation** extends to Security Guard (Admin may sign in as a Guard within their org; actions audited against the Admin). Cannot impersonate Super Admin/Admin (unchanged).

## 2. RBAC matrix (additions)
| Role | Scope | Can | Cannot |
|---|---|---|---|
| **Security Guard** | Assigned properties | All Visitor Management actions (register, approve/deny common-area, check-in / check-out, **raise gate approval request to tenant**, view the gate log) | Anything outside Visitor Management · other properties · cross-org · record payments · leases / maintenance / users |
| **Tenant** (amended) | Own lease + unit/room | …existing… **+ approve/deny gate visitor requests for their unit/room** | unchanged |

## 3. Two visitor flows (unified module)
**A. Tenant-pre-approved (existing, unchanged):** Tenant pre-approves → Visitor Code (`VIS-XXXX`) → PM/Admin **or Security Guard** approve/deny → guard enters code at check-in → checked-in → checked-out.

**B. Gate-initiated (new):**
1. Visitor arrives unannounced. Guard opens the **Gate console** and logs the visit: visitor name · phone · purpose · **target = Property → Unit (→ Room)**, chosen on the guard's assigned property.
2. System routes an **approval request** to the resident(s) by **lease type**:
   - **Unit-wise lease** → the unit's tenant(s).
   - **Room-wise lease** → that specific room's tenant(s).
   - **Common/shared area** (no lease target) → no routing; Guard/PM/Admin approve directly.
3. Request appears in the **Tenant portal** as a **pending visitor approval** (in-app only — no SMS/WhatsApp/email per Scope rule K; surfaced on the tenant dashboard + a Visitors "Pending approvals" section).
4. **Any one co-tenant** approves or denies. **No auto-approval** (consistent with the platform's no-auto-approval stance) — it stays pending until acted on, or the **guard cancels** it; optional org Setting `visitor_request_expiry_hours` may mark stale requests **expired** (never auto-*approved*).
5. On **approve** → guard sees it go green and **checks the visitor in** (no code). On **deny** → visitor turned away (`denied`).
6. Departure → guard **checks out**.

## 4. Status lifecycle (visitor record)
Wire-stable smallint enum; add the new states at the next free integers (never renumber existing):
- Shared: `approved · denied · checked_in · checked_out · cancelled`.
- Tenant-pre-approved entry state: `pending_staff_approval` (awaiting PM/Admin/Guard).
- Gate-initiated entry state: **`awaiting_tenant_approval`** (new) → `approved`/`denied` by the tenant.
- Optional terminal: **`expired`** (new, only if the expiry Setting is enabled; not an approval).

## 5. New business rules (append after current NR-#, next free numbers)
- **NR-x — Gate approval routing:** A gate-initiated visitor request routes to the tenant(s) of the **lease that covers the chosen unit (unit-wise) or room (room-wise)**; common-area visits are not routed and are approved by Guard/PM/Admin directly.
- **NR-x+1 — Single co-tenant consent:** Any one co-tenant's approval admits a gate visitor; the request is then closed for the rest. (Deliberately weaker than termination's all-consent rule — flagged so it's not mistaken for BL-08/09.)
- **NR-x+2 — No auto-approval for visitors:** Visitor approval is never granted by timeout; unactioned gate requests remain pending, are cancellable by the guard, and may only become `expired` (not approved) if the org enables the expiry Setting.
- **NR-x+3 — Guard scope:** A Security Guard may act only on visitor records for their **assigned properties**; all else is 403. Every guard/tenant action writes an append-only `audit_log` row (actor = the acting role; under impersonation, the Admin).

## 6. Data model (additions; Prisma `@relation`, int PKs, snake_case, no FKs)
- `users.role` gains `SECURITY_GUARD=5`.
- `security_guard_properties (id, guard_id → users.id, property_id → properties.id)` — many-to-many gate assignment (mirrors `property_managers`).
- `visitor_requests` (or extend the existing visitors table): `initiated_by_role` (tenant | guard | pm | admin), `target_unit_id?`, `target_room_id?` (nullable — null = common area), `lease_id?` (the lease the approval routes to), `status` (enum above), `approved_by_tenant_id?`, `visitor_code?` (null for gate-initiated), plus the existing visitor fields. Partial index on `(property_id, status)` for the gate console.

## 7. Prototype work (design contract — build after SRS sync)
- **New `prototype/security/` role folder:**
  - `dashboard.html` — gate-focused KPIs (Today's visits, **Pending tenant approvals**, Checked-in now, Denied today) — all clickable to the filtered gate log.
  - `visitors.html` — **Gate console**: log a new arrival (Property→Unit→Room picker, searchable; lease-type drives whether it routes to a tenant), live status (awaiting tenant / approved / denied), Approve/Deny (common-area only), Check-in / Check-out, Cancel; filter tiles + Property/Unit/Room/Status filters + search + pagination (shared `Paginator`).
  - `profile.html`.
  - Role **tabbar / sidebar / more-sheet** scoped to Visitor Management + Profile only (no other modules). Login "Preview as Role" shortcut entry.
- **`tenant/visitors.html`** — add a **"Pending approvals"** section/tab listing gate requests for the tenant's unit/room with **Approve / Deny**; tenant dashboard gains a clickable "Visitor approvals" KPI.
- **`admin/users.html`** — add **Security Guard** to the create-user role options + a **property assignment** field; Users list shows the role.
- **`admin/visitors.html` / `pm/visitors.html`** — show `initiated_by` + the new gate-initiated rows + `awaiting_tenant_approval` status; keep their existing approve/deny/check-in/out.
- Apply the **global standards** from the listing-enhancements pass (pagination, correct filters, clickable cards) to all new pages.

## 8. Plan gating & scope
- The Security Guard role and the gate flow are part of **Visitor Management**, which is a **plan-catalogue feature**. If an org's plan doesn't include Visitor Management, the role/flow is unavailable (and Admin can't create guards). Visitor Management stays org-managed; nothing here adds SMS/WhatsApp/email, file uploads, or gate-hardware integration (all out of scope, Rule K).

## 9. SRS sync (same change)
- §2/§3: add the **Security Guard** role + `security/*` pages to the page map; note the role count moves from five to **six**.
- §4 Module 8 (Visitor Management): document both flows, the gate-initiated state, routing, single-co-tenant consent.
- §5: add the NR rules above. Role matrix row for Security Guard + amended Tenant row.
- §10 enums: `SECURITY_GUARD=5`; new visitor statuses.
- Update `feature_list.json` if a new gating row is needed; `prototype-changes.md` per page; change-log.

## 10. Verification
- RBAC: Guard hitting any non-visitor route / unassigned property → 403; tenant approving a request for a unit that isn't theirs → 403.
- Flow: gate-initiated request appears for the correct tenant by lease type; any one co-tenant approval closes it; deny turns the visitor away; no path auto-approves.
- Scope: guard pages show only assigned properties; tenant sees only their unit/room requests.
- Prototype: `node --check` inline JS on new pages; filters/pagination match the shared component; audit entries described for every action.

## Open / non-goals
- Real-time push to the tenant is **in-app only** (poll/refresh) — no notification channel (Scope rule K).
- `visitor_request_expiry_hours` Setting is **optional**; default = no expiry (purely manual).
- No gate-hardware / QR-scanner integration.
