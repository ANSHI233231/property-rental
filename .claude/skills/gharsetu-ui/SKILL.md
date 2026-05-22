---
name: gharsetu-ui
description: "GharSetu frontend UI/UX system — design tokens, component patterns, responsive rules, validation contract, and accessibility gates. Use when building or reviewing any screen, component, form, table, modal, drawer, tabbar, MoreSheet, badge, or button in apps/web; when porting from prototype/ to Next.js; when wiring forms; when fixing UI bugs or responsive issues; when checking role-scoped navigation (admin/pm/maintenance/tenant); when adding new screens that must match the static prototype 1:1. Covers: brand colors (navy/royal-blue/saffron/charcoal/slate), status colors (paid/partial/overdue/prepaid), Poppins+Inter typography, single ≤1023px breakpoint, sidebar→drawer collapse, bottom tabbar + MoreSheet pattern, no-hamburger-menu rule, role-tabbar contents per role, form validation (RHF+zod with errors below field, ⚠ glyph, no native tooltips), WCAG AA, BL-01..BL-23 UI implications, DD/MM/YYYY + en-IN locale, ₹ currency formatting."
---

# GharSetu UI/UX System

Authoritative UI rules for the GharSetu Next.js frontend. The static prototype in [prototype/](../../../prototype/) is the visual source of truth — any production page must match it 1:1. Use this skill when planning, building, or reviewing any UI work.

## Hard rules — never violate

1. **No hamburger menus.** Source-level test (`phase6.test.ts`) blocks: the `≡` glyph, `MenuIcon` / `HamburgerMenuIcon` imports, and any `aria-label` containing "open menu", "toggle menu", or "hamburger". Use **MoreSheet** (three-dot icon, `aria-label="More options"`) for overflow nav.
2. **Single breakpoint at `max-width: 1023px`.** Mobile and tablet are the same layout; sidebar only appears at ≥1024px. Defined in [apps/web/src/app/globals.css](../../../apps/web/src/app/globals.css) and [prototype/assets/styles.css](../../../prototype/assets/styles.css).
3. **No public sign-up.** Login screen says so explicitly. Accounts created by Admin or PM only.
4. **Role-scoped navigation** — never show a tab or sidebar link the role cannot use. Maintenance cannot see rent / lease / tenant financial data. Tenant cannot see other tenants.
5. **DD/MM/YYYY** date format everywhere, **en-IN** locale, **₹** currency, Indian numbering (`₹1,80,000` style — `Intl.NumberFormat('en-IN')`).
6. **Form validation: never use native browser tooltips.** Errors render below the field via `.field-error.show` with a ⚠ glyph; the input gets `.input.error` (red border + light-red bg). See [prototype/assets/validation.js](../../../prototype/assets/validation.js).
7. **Touch targets ≥ 44×44px** on mobile. Tabbar tabs, More button, drawer toggle, and avatar all conform.

## Design tokens

Ported 1:1 from [prototype/assets/styles.css](../../../prototype/assets/styles.css) to `apps/web/tailwind.config.ts`.

### Brand colors
| Token | Hex | Use |
|---|---|---|
| `navy` | `#1A237E` | Sidebar bg, page titles |
| `royal-blue` | `#1565C0` | Links, secondary actions, focus accents |
| `saffron` | `#FF6F00` | Primary CTAs, active nav, brand "Setu" |
| `charcoal` | `#212121` | Body text |
| `slate` | `#546E7A` | Muted text / icons |
| `off-white` | `#F8F9FA` | App background |
| `light-gray` | `#ECEFF1` | Dividers, disabled bg |
| `mid-gray` | `#CFD8DC` | Input borders, disabled text |

### Status colors (badge / row tint)
| Status | Fg | Bg | When |
|---|---|---|---|
| `paid` | `#2E7D32` | `#E8F5E9` | Rent paid, request resolved, lease active |
| `partial` | `#F57F17` | `#FFF8E1` | Partial rent, request open |
| `overdue` | `#C62828` | `#FFEBEE` | Overdue rent, lease terminated, emergency |
| `prepaid` | `#0277BD` | `#E1F5FE` | Prepaid rent, request in-progress, renewed |
| `closed` | `#546E7A` | `#ECEFF1` | Closed request, low priority |

### Typography
- **Poppins** (500/600/700) — headings, badges, buttons, KPIs, brand wordmark
- **Inter** (400/500) — body, table data, form fields (the default)
- Both loaded via Google Fonts. Body default is Inter (see [apps/web/src/app/layout.tsx](../../../apps/web/src/app/layout.tsx)).
- Headings: `h1 24/32 700`, `h2 20/28 600`, `h3 16/24 600`, body `15/22 400`.

## Responsive contract

| Width | Sidebar | Tabbar | Drawer toggle |
|---|---|---|---|
| ≥ 1024px | visible, fixed left 240px | hidden | hidden |
| ≤ 1023px | hidden (slides in as drawer when toggled) | bottom-fixed, 5 tabs | visible top-left |

Anatomy:
```
≥1024px:  [sidebar 240px] [main content, max-width 1440px, padding 32px 48px]
≤1023px:  [drawer-toggle topbar] [main content, padding 20px] [tabbar bottom-fixed 64px]
```

## Role tabbars (mobile bottom bar)

| Role | Tabs (5 max) | Overflow |
|---|---|---|
| Admin | Home · Units · Maint. · Rent · **More** | MoreSheet: Users, Properties, Audit Log, My Profile, Logout |
| PM | Home · Units · Tenants · Rent · **More** | MoreSheet: Leases, Maintenance, My Profile, Logout |
| Maintenance | My Requests · All Open · Profile · Logout | — (4 items fit; no MoreSheet) |
| Tenant | Lease · Rent · Maint. · Profile · Logout | — (5 items fit; no MoreSheet) |

The Logout button on Maintenance/Tenant routes to `/login`. On Admin/PM, Logout lives inside the MoreSheet.

### MoreSheet pattern
- Trigger: `<button class="tab tab-more" aria-label="More options">` with three-dot SVG (3 circles in a row).
- Sheet: bottom-anchored, slides up via `transform: translateY(0)`, max-height `80vh`, backdrop with blur + click-to-dismiss, Escape key closes.
- Items: `class="more-sheet-link"` — saffron active state, hover bg `var(--color-light-gray)`.
- Component: [apps/web/src/components/ui/MoreSheet.tsx](../../../apps/web/src/components/ui/MoreSheet.tsx). Prototype reference: `openMore()` / `closeMore()` in [prototype/assets/validation.js](../../../prototype/assets/validation.js).

## Sidebar

Each role has its own sidebar component:
- [apps/web/src/components/sidebar/AdminSidebar.tsx](../../../apps/web/src/components/sidebar/AdminSidebar.tsx)
- [apps/web/src/components/sidebar/PMSidebar.tsx](../../../apps/web/src/components/sidebar/PMSidebar.tsx)
- [apps/web/src/components/sidebar/MaintenanceSidebar.tsx](../../../apps/web/src/components/sidebar/MaintenanceSidebar.tsx)
- [apps/web/src/components/sidebar/TenantSidebar.tsx](../../../apps/web/src/components/sidebar/TenantSidebar.tsx)

Active link gets `text-saffron` + saffron-tinted SVG. Footer shows role + identifying line (e.g. `PM · Sunita Arora` / `Green Valley, Dwarka`) and a Logout link.

## Forms

- **React Hook Form + zod**. Schema lives next to the page or in a co-located `schema.ts`.
- **Visual contract** (must match prototype): label above field (`.label`), input (`.input`, 10px radius, 1.5px mid-gray border), error below field (`.field-error.show` with ⚠ glyph), input on error gets `.input.error` (red border + `#FFEBEE` bg).
- **Never** use HTML5 `required` validation tooltips — they're disabled and replaced by the validator. Set `noValidate` on `<form>`.
- Submit buttons disabled while pending; show "Saving…" / "Recording…" label.
- For min-length notes (Maintenance resolution ≥ 20 chars), show live counter below with `.counter.error` until threshold met. See BL-13.

## Tables

`.data-table` — full-width, `border-spacing 0`, sticky header optional. Numeric columns right-aligned. Status column always a `<span class="badge badge-*">`. Action column rightmost; primary action is a royal-blue text link, secondary is `btn btn-secondary !py-1 !px-3 !text-sm`.

Mobile: tables go inside `.card.p-0.overflow-x-auto` — never stack rows into cards (loses scannability).

## Buttons

| Class | Use |
|---|---|
| `btn btn-primary` | Primary CTA — saffron bg, white text. Max 1 per section. |
| `btn btn-secondary` | Royal-blue outline, transparent bg. |
| `btn btn-danger` | Overdue-red bg. Destructive (Terminate lease, Delete user). Always require confirm modal first. |
| `btn:disabled` | Light-gray bg, mid-gray text, `cursor-not-allowed`. |

Focus ring: 2px saffron outline at 2px offset. Never remove `:focus-visible`.

## Cards & sections

- `.card` — white bg, 12px radius, 1px mid-gray border, 24px padding, soft hover shadow.
- `.card-emergency` — adds 4px overdue-red left border. Use for emergency maintenance.
- `.section` — vertical rhythm wrapper, 32px bottom margin; `.section-title` h3 with bottom margin.
- `.kpi-grid` — `grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))`, 16px gap. Each `.kpi` has label (12px uppercase slate) + value (28px Poppins 700) + meta (12px muted).

## Business-rule UI implications

Critical rules that shape what the UI must display or block. Full list: [SRS_Document.md](../../../docs/product/SRS_Document.md).

| Rule | UI implication |
|---|---|
| BL-04 | Overdue 5 days after due date — show `Overdue` badge + late-fee row (auto-calculated 2%/week). |
| BL-05 | Late fee = 2% of outstanding × full weeks overdue. Display "Includes ₹X late fee" inline, not as a separate line item. |
| BL-08 | Co-tenant consent required — disable submit on co-tenant flows until all consents recorded. |
| BL-11 | 60-day notice for rent change — show countdown banner ("Your rent will change to ₹X effective DD/MM/YYYY"). Block PM scheduling within 60 days. |
| BL-13 | Maintenance resolution notes ≥ 20 chars — live counter, submit disabled until threshold. |
| BL-15 | Tenant confirms close after technician marks resolved — show "Awaiting your close" badge. |
| BL-18 | PM cannot self-record payments for their own units — hide "Record Payment" button if `lease.pm_id === current_user.id`. |
| BL-21 | Maintenance role sees zero financial data — never render rent / lease / payment columns for this role. |
| BL-23 | Audit log entries are immutable — no edit/delete affordance. |

## Accessibility floor (WCAG 2.1 AA)

- Color contrast ≥ 4.5:1 (body) / 3:1 (large text). Saffron on white **fails** for body text — use it only for ≥18px or as accent on dark bg.
- All icon-only buttons require `aria-label`.
- All interactive elements reachable by keyboard; tab order matches visual order.
- Modal / drawer / MoreSheet trap focus when open, restore on close, close on Escape.
- Form errors associated via `aria-describedby={`${id}-error`}` + `aria-invalid="true"`.
- Status changes announced via `role="status"` + `aria-live="polite"` (rent change banner already does this).

## Date, money, locale

```ts
import { format } from "date-fns";
import { enIN } from "date-fns/locale";

format(d, "dd/MM/yyyy", { locale: enIN });                  // 15/05/2026
new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(18000);
// → ₹18,000
```

Time-of-day in tables uses 24h `HH:mm`. Relative times only in audit log toasts ("3 minutes ago").

## File-level conventions

- Pages live under `apps/web/src/app/(role)/...` route groups.
- Shared UI primitives: `apps/web/src/components/ui/` (Button, Input, Badge, Card, MoreSheet, Drawer, Modal).
- Role-scoped layouts: `apps/web/src/app/(role)/layout.tsx` renders the role's Sidebar + Tabbar.
- Co-locate `schema.ts` (zod) with the page that uses it. Hooks under `apps/web/src/hooks/`. API clients under `apps/web/src/lib/api/`.

## When porting a prototype page

1. Open the prototype HTML side-by-side. Match DOM structure, class names, copy verbatim — copy is product-validated.
2. Replace static markup with React components from `apps/web/src/components/ui/`. If a primitive is missing, build it in `ui/` (don't inline).
3. Replace `onclick="alert(...)"` placeholders with the real Server Action or TanStack Query mutation.
4. Replace inline mock data with a `useQuery` call; show a skeleton while pending (reserve space — see CLS rules).
5. Verify at three widths: 360px (mobile), 768px (tablet — same layout as mobile), 1280px (desktop). Both tablet and mobile should show the tabbar, not the sidebar.
6. Verify keyboard nav: Tab through the page, ensure focus rings visible, modals trap focus.
7. Run `pnpm typecheck && pnpm lint && pnpm build` before considering the page done.

## Anti-patterns (auto-fail review)

- ❌ Hamburger icon or `≡` character anywhere
- ❌ Native `alert()` / `confirm()` — use the modal component
- ❌ Tailwind arbitrary values for brand colors (`text-[#FF6F00]`) — use `text-saffron`
- ❌ `MM/DD/YYYY` or ISO dates in user-facing copy
- ❌ Currency without ₹ symbol or without `en-IN` grouping
- ❌ Inline styles for spacing/colors (allowed only for dynamic values like progress widths)
- ❌ More than 5 items in the bottom tabbar — overflow goes in MoreSheet
- ❌ A sidebar nav item that isn't also reachable from mobile (tabbar OR MoreSheet)
- ❌ A maintenance/tenant page that fetches rent or lease data the role isn't authorized to see
- ❌ Skipping `aria-label` on icon-only buttons
- ❌ Removing focus rings

## Where to start

| Task | Read first |
|---|---|
| New page | The matching prototype HTML; this skill; `apps/web/src/app/(role)/layout.tsx` |
| New component | `apps/web/src/components/ui/` for siblings; this skill's tokens section |
| Form work | `prototype/assets/validation.js`; an existing RHF+zod page like `/login` |
| Responsive fix | This skill's responsive contract; `apps/web/src/app/globals.css` |
| Accessibility fix | This skill's accessibility floor; run axe / Lighthouse on the page |
| Role-scope question | [SRS_Document.md](../../../docs/product/SRS_Document.md) §5 (RBAC matrix); the role's sidebar component |
