# GharSetu v2 — SAAS Platform Roadmap

> **⚠️ Status updated 2026-05-26 (final-close) — most streams superseded.**
>
> The **SAAS layer + Super Admin role + Subscription Plans + multi-org sign-up + Admin Impersonation + Admin Task Delegation** have all been **pulled forward into the current engagement** (see [Solution_Overview.docx](../product/Solution_Overview.docx) v8 final-close).
>
> **What's now in the current engagement** (Streams A, B, C from this document):
> - Multi-organisation SAAS architecture
> - Public organisation sign-up + Super Admin approval workflow
> - Super Admin role (cross-organisation oversight)
> - Subscription Plans (Basic / Standard / Premium) with active-user caps
> - Shared-schema + `organisation_id` + Postgres RLS data isolation
> - **Admin Impersonation** (Stream B — Session Injection)
> - **Admin Task Delegation** (Stream C)
>
> **What still sits as deferred** (post-current-engagement):
> - **Subscription billing integration** — manual invoicing only for now
> - **Custom domains + per-organisation branding**
>
> Only those two items remain. The four foundational decisions in the table below remain valid; the *sequencing* lock was updated (see [feature_list.json](../../feature_list.json) → `saas_design_decisions_locked.LOCK-01`).

---

**Original status (superseded sections retained for context):** Future engagement, captured 2026-05-24.

**Original framing — superseded.** ~~Current engagement (v3.1) ships first. Per-room leasing, RentSchedule, Visitor Management, Master Data + Settings, gap closure, bug fixes — all per the 12-business-day plan in `docs/product/Solution_Overview.docx`. Only after v3.1 is signed off and delivered does this v2 scope come into play.~~ Replaced 2026-05-26 — SAAS folded into current engagement.

---

## What v2 is

Three streams added by the client on 24 May 2026:

### A. SAAS / Multi-Tenancy
- Multi-tenant SAAS architecture for all applications
- Public sign-up page for organisation onboarding
- New **Super Admin** role (organisation-level access only, not full system)
- Subscription / plan model: Basic / Standard / Premium with user-count limits and feature gates
- Exact plan structure pending from client

### B. Session Injection (Admin Impersonation)
- Admin can switch into any user's session and perform tasks on their behalf
- All actions logged under the **Admin's** name, not the impersonated user

### C. Task & Action Delegation
- Admin assigns/delegates tasks to any user in advance, for a date range
- Example: Admin OOO 25 May – 5 June; delegations created 19 May activate from 25 May
- Delegated user sees tasks for that specific date range
- During delegation, actions appear under the **delegate's** name (asymmetric vs. impersonation — intentional)

---

## Foundational decisions locked on 24 May 2026

These four answers gate everything else in the v2 plan. Confirmed by user.

| Decision | Locked value |
|---|---|
| **Sequencing** | v3.1 (existing engagement) ships first. v2 SAAS is a separate, later engagement. No interleaving. |
| **Naming** for the SAAS-level entity | **Organisation**. The existing `TENANT` role (a renter) keeps that name. New columns: `organisation_id`. Zero collision. |
| **Data isolation model** | **Shared schema + `organisation_id` column on every table + Postgres Row-Level Security**. Cheapest, fastest to ship, industry-standard. |
| **Billing / payment integration** | **Forever out of scope.** Plans + user-count enforcement are in v2, but Razorpay/Stripe/etc. payment processing is NOT — always manual billing offline. |

---

## Open decisions for v2 kickoff (NOT answered yet)

The lead surfaced 35 questions in the impact analysis. Four are locked above. The remaining 31 will need answers when v2 work begins. Key ones to revisit then:

### Multi-Tenancy
- **Routing**: subdomain (`acme.gharsetu.app`) vs path (`gharsetu.app/t/acme/…`) vs single-domain + session-resolved
- **Self-signup gate**: open / email-verify / admin-approval / payment-first
- **Existing v1 data migration**: backfill current records under one "GharSetu Operations" organisation? Or blank slate?
- **Free trial**: yes/no, length?
- **Plan-feature matrix**: who defines features per plan? Dynamic feature flags or hardcoded tiers?
- **User-count enforcement**: hard block at limit / soft warning / overage billing
- **2FA stance**: still out (SRS §11.3 wins) / mandatory for Super Admin only / mandatory for all
- **Transactional emails**: welcome, verify, invoice, dunning — which are in scope?
- **Cancellation policy**: immediate purge / 30/90-day grace / indefinite archive
- **Custom domains + branding** per organisation: in scope?

### Super Admin Role
- **Relationship to existing Admin**: rebrand / above / replace / beside (5-role model)
- **Auto-created on signup** or **Platform Admin creates**?
- **Is there a Platform Admin tier** above Super Admin (i.e. GharSetu's own staff who run the SAAS)? If yes, what powers?

### Session Injection (Impersonation)
- **Scope**: any role / downward only / configurable
- **Token shape**: token-swap vs dual-actor claim
- **Audit-log column shape**: `actor_user_id` = Admin + `acting_as_user_id`? Or reverse? **Load-bearing for every future report.**
- **Time limits**: indefinite / auto-expire 30 min / per-tenant configurable
- **Notification** to the impersonated user: silent / in-app banner / email after the fact

### Task Delegation
- **Granularity**: all-of-Admin's-powers / by role / per-action checklist
- **Action attribution asymmetry** (impersonation logs as Admin; delegation logs as delegate): confirm intentional
- **Concurrent delegator**: can Admin still act during the delegation window?
- **Early revocation**: can Admin return early and revoke?
- **Cross-role delegation**: Manager → Maintenance? Tenant → co-tenant? Or only Admin → someone?
- **Time precision**: dates only / specific times
- **What counts as a "task"**: permission delegation (RBAC scope) or work-item queue (explicit assigned tasks)?

---

## Conflicts with current SRS / Solution Overview

When v2 work begins, these must be resolved:

| # | Conflict | Resolution direction |
|---|---|---|
| 1 | SRS §9 forbids public sign-up | v2 reverses; needs SRS §9 update |
| 2 | SRS §11.3 defers 2FA | v2 likely re-enables for Super Admin (TBC) |
| 3 | SRS §11.3 forbids multi-session UI | impersonation needs careful handling — not full multi-session, but related |
| 4 | 4-role wire-stable enum (Admin=0..Tenant=3) | v2 adds Super Admin=4; possibly Platform Admin=5. Enum extension only, no renumbering |
| 5 | Audit log `actor_user_id` single-column model | v2 adds `acting_as_user_id` (impersonation) + `under_delegation_id` (delegation) |
| 6 | Email scope locked to rent-change tenant emails | v2 expands: welcome, verify, invoice (out — manual billing), delegation start/end, impersonation alerts (if chosen) |
| 7 | "Patch + extend v1 codebase" framing | v2 is closer to re-platforming the foundation; positioning needs to be honest |
| 8 | Solution Overview v3.1 describes the v3.1 engagement | v2 gets its own Solution Overview (clean rewrite, not amendment) |
| 9 | BL-19 "one PM per property" (global partial unique) | becomes per-organisation scoped |
| 10 | All 23 BLs assume single tenancy | each needs re-read for organisation-scope under SAAS |
| 11 | `@nestjs/schedule` in-process cron (SRS §10.2) | strained under multi-org timezone-aware jobs; BullMQ on Redis becomes necessary |

---

## Effort estimate (held loosely)

The lead's first-pass estimate for v2 with the four locked answers (shared schema + RLS, no billing, Organisation naming, sequential after v3.1):

**4–6 weeks** of full-team work in coordinated rotation (FE + BE + tester + security). This is a bracket, not a commitment — the remaining 31 open questions can each move the number.

---

## When v2 kicks off

Trigger conditions:
1. v3.1 engagement signed off by client (Day 11 UAT complete)
2. Client confirms v2 is the next engagement
3. The remaining 31 questions above answered (or recommended-defaults accepted)

At that point: a fresh planning task to the team lead, a fresh Solution Overview (v4 — clean SAAS rewrite, not an amendment to v3.1), a fresh SRS extension, and a phased delivery plan with realistic week-scale timelines.

---

**Last updated:** 2026-05-24
**Owner:** Team Lead (gharsetu-lead)
**Status:** Documented; awaiting v3.1 completion before kickoff
