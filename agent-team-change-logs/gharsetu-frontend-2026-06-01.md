# Agent Change Log

Agent: gharsetu-frontend (orchestrator-direct)
Project: GharSetu
Date: 2026-06-01

> Prototype-only session. Full per-change detail lives in `docs/planning/prototype-changes.md`; this is the summary. No app code touched. Solution Overview + Timeline doc work this session is in `document-agent-2026-05-29.md` and was committed separately (`39125f1`, `3a2c53e`).

---

## Task 1 — Admin prototype feature pass
- **Status:** ✅ Completed
- Admin **dashboard**: removed the standalone Emergency (Unit 7C water-leak) alert banner.
- **Maintenance priority labels** standardized system-wide to the 4 canonical levels **Low · Medium · High · Emergency** — the stray "Normal" badge (admin/pm/maintenance dashboards) renamed to "Medium". Matches SRS.
- **Organization detail** (admin + super-admin): **Type of business** now multi-value comma-separated (signup is already multi-select); **Primary Contact** (name · email · mobile) added to the Organization Details card. SRS §4 org-record line updated.
- Admin **unit-detail**: unit-level + per-room **Create Lease** buttons gated hidden when status = Retired or Under Maintenance; Leases table gained a **Type** column and was moved to **after** the Rooms section.
- Admin **lease-detail**: **Renew** opens the Create Lease wizard in renew mode (`create-lease.html?renew=2103`); removed the top "Early Terminate" button and added an end-of-page **Early Termination** section — per-co-tenant consent table → "Early Terminate" enables only when all tenants request → reason modal (min 5 chars). `applyTermViewForStatus()` shows a read-only record when previewing Terminated (`data-status-show="upcoming,active,terminated"`). Removed tenant "View profile" links.

## Task 2 — Auth = email only
- **Status:** ✅ Completed
- `login.html` + `forgot-password.html`: removed all "Email or Phone" wording; `validateIdentifier()` accepts email only (dropped the 10-digit-mobile branch). Phone stays as profile/contact data only. SRS §3 Login row updated.
- Login **"Prototype Shortcuts — Preview as Role"** strip centered under the auth card (`max-width:480px; margin:32px auto 0`).

## Task 3 — Super Admin Contact Inbox bug fix
- **Status:** ✅ Completed
- "Mark as read / replied" wrote the status badge to `td:nth-child(5)` (Subject) instead of `td:nth-child(6)` (Status), clobbering the subject. Fixed the column index.

## Task 4 — PM property + lease clone (assigned-scoped) — finish + status labels
- **Status:** ✅ Completed (with prior-session work logged in `gharsetu-frontend-2026-05-29.md`)
- **NEW `pm/create-lease.html`** — cloned from `admin/create-lease.html` (full wizard + renew mode), PM chrome swapped in, `PROPERTIES`/`UNITS`/`TENANTS` scoped to the 3 assigned properties (Green Valley id1, Sai Heights id2, Mayur Vihar id3); Rohini Greens removed. Cancel → `leases.html`; title → Property Manager.
- **`pm/leases.html`** — re-cloned to the admin filter-tile listing layout (filter tiles, searchable Property filter, Lease Type column), chrome-swapped (Leases active), Rohini removed from filter, "+ New Lease" → `create-lease.html`, rows → `lease-detail.html?id=…`.
- **`pm/unit-detail.html` + `pm/lease-detail.html`** — at admin parity (Rooms + Leases Type + gated create-lease; renew + Early-Termination consent + no view-profile). PM chrome; assigned-scoped.
- **Lease status labels** standardized to **Active / Upcoming / Ended / Terminated** across admin + PM (no Closed/Expired/Renewed); lease-detail simulator button "Expired" → "Ended".
- Feature plan: `docs/planning/features/2026-05-29-pm-property-lease-clone.md`.

### Verification
- `node --check` on extracted inline JS of `pm/create-lease.html`, `pm/unit-detail.html`, `pm/lease-detail.html`, `admin/create-lease.html`, `admin/lease-detail.html` — all pass.
- Scope grep: PM active data shows only Green Valley / Sai Heights / Mayur Vihar; no other-org property names.
- PM lease status badges: only Active/Upcoming/Ended/Terminated.

### Sync
- `docs/planning/prototype-changes.md` — multiple rows appended.
- SRS updated: login email-only (§3), business-type multi-value (§4), priority levels (already low/medium/high/emergency).

### Notes
- App port to `apps/web` / `apps/api` for all v8 features remains pending (prototype is the design contract).

---

## Task 5 — Prototype listing enhancements (filters · clickable cards · pagination)
- **Status:** ✅ Completed · Plan: `docs/planning/features/2026-06-01-prototype-listing-enhancements.md`
- **Shared infra:** `assets/paginate.js` gained **`Paginator.setPredicate(tableId, fn)`** (custom/range row predicate, AND-combined with search/tile/attr; powers all date-range filters) and later **`data-search`** support in `trMatchesSearch` (scan a hidden attr so the visitor code stays hidden but searchable). `assets/styles.css` gained **`a.kpi`** clickable-card styling (hover/focus, reduced-motion).
- **Super Admin:** dashboard cards clickable → filtered pages; Organizations **Contact column + Created-date range filter** + contact search **and migrated to the shared Paginator** (fixing a bespoke right-aligned footer → one constant pagination design); Contact Inbox **received-date range filter**.
- **Admin:** dashboard cards clickable; **Properties** Total-Rooms column + Property-Type/Room-Status filters + Manager filter wired + clickable tiles; **Leases** Lease-Type filter + wired the dead Property filter; **Delegations** All-status tab + **new `delegation-activity.html`**; **Maintenance** room cascade filter + room field in raise form; **Rent** Room column + 5 filters (Tenant/Property/Unit/Room/PM) + room in Record Payment; **Settings** Field+Date filter; **Organization** invoice Status/Plan/Date filters; **Master Data** "Specializations" → "Maintenance Specializations" (25 files).
- **PM:** dashboard cards clickable; Properties Rooms column + Room-status filter; Leases Property + Lease-Type filters wired.

## Task 6 — NEW ROLE: Security Guard + gate-initiated visitor approvals
- **Status:** ✅ Completed (prototype) · Plan: `docs/planning/features/2026-06-01-security-guard-role.md`
- **`SECURITY_GUARD=5`** — org-scoped, assigned properties, Visitor-Management-only, email login.
- **New `prototype/security/`**: `dashboard.html` (gate KPIs, clickable), `visitors.html` (gate console — "Log Gate Arrival" routes an approval request to the tenant by lease type; common-area = guard approves directly, no code; approve/deny/check-in/out), `profile.html`; guard-only nav.
- **`tenant/visitors.html`**: "Pending approvals" section (any one co-tenant approves/denies; section hides when none).
- **`admin/users.html`**: Security Guard role option + assigned-properties checkboxes. **`login.html`**: guard preview shortcut (grid 5→6). **`admin/visitors.html` + `pm/visitors.html`**: "Awaiting tenant" tile + gate rows.
- **All visitor tables (admin/pm/security/tenant):** added a **Type** column (Pre-approved / Gate), a **Visitor-type filter**, **search-by-visitor-code** (hidden `data-search`), and **Property/Unit filters** (admin cascade; pm/security selects; tenant single-unit → type+code only).
- **SRS synced:** roles 5→6, matrix (Guard row + amended Tenant), enum `SECURITY_GUARD=5`, Module 8 gate flow + `awaiting_tenant_approval`, page map.
- **Solution Overview** (with `gharsetu-lead`): added the Security Guard role bullet to Visitor Management; tenant bullet now "register + approve gate visitor requests"; check-in/out bullet now includes Security Guard. (See `gharsetu-lead-2026-06-01.md`.)

### Bug fixes this session
- Super Admin Organizations pagination was a bespoke right-aligned footer → migrated to the shared centered `.pagination` component (one constant design).
- Broken HTML comments `<\!--` → `<!--` on `security/dashboard.html` + `admin/delegation-activity.html` (zsh mangled `!` in a heredoc; they were rendering as visible text).

### Verification
- `node --check` on all changed inline JS + `assets/paginate.js` — all pass.
- Scope: PM/Security pages assigned-scoped; Guard pages carry no other-module links.
- python-docx round-trip on `Solution_Overview.docx` after each bullet edit.

---

## Task 7 — Public-pages redesign v2 (glassmorphism / light-forward) — IN PROGRESS
- **Status:** 🟡 In progress · Plan: `docs/planning/features/2026-06-01-public-pages-redesign-v2.md`
- **Source:** client Google-Stitch design kit at `stitch_modern_design_overhaul/` (7 `code.html` + `screen.png` + `DESIGN.md`).
- **Decisions (confirmed with user):** Hybrid fidelity — adopt the Stitch *layout* + glassmorphism + light-forward surfaces, but render in GharSetu's **Poppins/Inter** + **navy/royal-blue/saffron** brand tokens (no Manrope/Hanken, no Material-3 names). Scope = **all 8 public pages**. Pricing keeps `plans.js`. Icons = **inline SVG** (no Material Symbols font). Cool-blue **surface tokens added to `styles.css`** (single-source rule preserved).
- **Done so far:**
  - `assets/styles.css` — added `--surface / --surface-low / --surface-container / --surface-high / --surface-dim / --surface-deep` to `:root`; flipped `.auth-shell` + `.auth-card` from navy gradient to **light glass** (cool-blue surface + soft orange/navy washes + frosted white card); repurposed `.public-band` to a light centered page header + kept `.glass-panel` frosted card.
  - `index.html` — rebuilt homepage to bento/glass layout (Rent/Maintenance/Leases/Visitors bento, navy 3-step band, 5-persona grid incl. Security Guard, plans via `renderMarketingPlans`, navy final-CTA). **Hero still being flipped navy → light to match reference.**
- **Pending:** flip homepage hero to light + harmonize section surfaces · `public-chrome.js` (light nav w/ logo icon + Features/How-it-Works/Pricing links, navy footer) · `login` (glass + Preview-as-Role modal, all 6 roles) · `forgot-password` · `reset-password` · `organization-signup` (light 3-card re-skin, keep wiring + validation) · `contact` · `privacy` · `terms`.
- **Non-negotiables held:** validation contract (errors below field, ⚠ glyph, no native tooltips) · DD/MM/YYYY · ₹ Indian grouping · single 1023px breakpoint · 44px targets · WCAG AA · no external image hosts (CSS mocks instead of Stitch `lh3.googleusercontent.com` URLs).

### Task 7 — COMPLETED (all 8 public pages)
- `assets/styles.css` — surface tokens; light-glass `.auth-shell`/`.auth-card`; light `.public-band` + `.glass-panel`.
- `assets/public-chrome.js` — light blurred nav (inline-SVG saffron logo mark + Features/How-it-Works/Pricing centre links + Login/Register), deep-navy footer (Product / Support).
- `index.html` — hero flipped to light (cool-blue surface, dark headline w/ saffron accent, navy-framed dashboard mock), section surfaces harmonized to tokens; bento + navy steps band + 5-persona grid + plans (`renderMarketingPlans`) + navy CTA retained.
- `login.html` — light glass card, orange icon badge, icon-in-field email/password (royal-blue focus per contract), eye toggle, custom validation (no native tooltips), **Preview-as-Role modal wired to all 6 dashboards** (super-admin/admin/pm/maintenance/security/tenant), minimal auth footer. Added inline tailwind color config (page lacked it) so `text-saffron`/`text-royal-blue` resolve.
- `forgot-password.html` / `reset-password.html` — inherit light glass; forgot gains mail-icon field; both gained the inline tailwind color config.
- `organization-signup.html` — outer card → transparent focused-width wrapper; each `.form-section` → glass card; section headings → charcoal title + saffron accent bar; new centered "Onboard your organization" header. Form fields, plan tiles (`renderSignupPlanTiles`), business-type chips, searchable selects, validation all unchanged.
- `contact.html` — light `.public-band` header + `.glass-panel` form + Email/Call/Office info row (inline SVG). Validation + record-only success unchanged.
- `privacy.html` / `terms.html` — light `.public-band` header (Legal-Document eyebrow + title + sub) + `.glass-panel` wrapping `renderLegalDoc` output. Legal copy still from `legal.js`.
- **Verification:** `node --check assets/public-chrome.js` OK; inline-JS parse OK for login/index/contact; no external image hosts, no Material-Symbols, no Manrope/Hanken anywhere in `prototype/*.html`.

### Task 7 — follow-up (user feedback: Plans + Personas hadn't adopted new design)
- `index.html` personas → bigger `rounded-2xl` 56px icon tiles (`.persona-ic`), 20px headings, hover border-saffron + lift + icon scale-110 (matches Stitch persona cards).
- `assets/plans.js` `renderMarketingPlans` rewritten to the v2 card design: **popular plan = elevated navy gradient card** (white text, saffron "Most Popular" badge, saffron button), others = light glass cards with navy-outline button; big 40px price + /mo, single-column saffron-check feature list (new `gsMarketingFeatureList`, theme-aware for navy vs light). Still driven by `GHARSETU_PLANS` (single source).
- `index.html` `#plansGrid` → `align-items:center`, 960px, gap 28; `.mkt-pop` scales 1.05 ≥1024px. `node --check assets/plans.js` OK; index inline JS OK.

### Task 7 — follow-up 2 (user feedback: header/footer + legal/auth consistency)
- **Shared chrome added to all auth pages** — `login`, `organization-signup`, `forgot-password`, `reset-password` now inject `#gs-public-nav` + `#gs-public-footer` via `public-chrome.js` (matches the register reference). Login's bespoke mini-footer removed (+ its dead `.auth-footer` CSS). **No dark/light-mode toggle** in the nav (uses Login/Register, per user).
- **Privacy / Terms → card grid** — `legal.js renderLegalDoc` now renders each section as a glass `.legal-card` (icon chip + heading + body) in a responsive `.legal-grid` (2-col → 1-col <768px), with a centered "Last updated" line; matches the Stitch legal layout. `.legal-grid`/`.legal-card` added to `styles.css`. Single `.glass-panel` wrapper removed from both pages. Legal copy still sourced from `legal.js`.
- **Verification:** `node --check` OK on `legal.js`/`plans.js`/`public-chrome.js`; all 8 public pages confirmed to carry nav+footer+chrome.js; auth inline JS parses.

### Task 7 — follow-up 3 (personas "Built for every person…" exact clone)
- Cloned the Stitch persona-section **animated background-paths effect**: `.path-container` with 4 `.animated-path` SVG strokes (navy/saffron/royal-blue, staggered `animation-delay`/`duration`) running the `path-flow` stroke-dashoffset loop at `opacity:0.32`, behind `z-index:1` content; `personas-wrap` clips it. Reduced-motion → static.
- Cards switched from heavy glass to the kit's translucent style: `rgba(255,255,255,0.45)` + `backdrop-blur` + `outline-variant` border, `rounded-24`, hover→saffron border + lift, 56px `rounded-2xl` icon tiles (group-hover scale-110).
- Added the **char-by-char title reveal** for "Built for every person in your building" (`.char-reveal` spans, 22ms stagger, IntersectionObserver trigger, nbsp word-gaps, reduced-motion safe).
- Verified: index inline JS parses; 5 persona cards; paths + char-reveal present.

### Task 7 — follow-up 4 (header/nav hover treatments)
- `public-chrome.js` nav matched to the Stitch kit: **Login = outlined navy button**, **Register = solid saffron button** — both with the `btn-glow` hover (saffron glow `0 0 20px rgba(255,111,0,.35-.45)` + `scale(1.02)`, `active:scale(0.96)`). Nav links (Features/How it Works/Pricing) gained an **animated saffron underline** (`::after` width 0→100%) + orange hover + focus-visible ring. Nav height → 76px (kit h-20). Reduced-motion disables the scale/underline transitions.
- Verified `node --check assets/public-chrome.js` OK.

### Task 7 — follow-up 5 (section headings: colour + sparkles)
- Section headings recoloured **royal-blue → dark charcoal** (`.section-head h2`) — matches the kit's near-black headings (user: blue "not great").
- Added a **vanilla-JS sparkles effect** (port of the Magic UI SparklesText *idea*, NOT the React component — prototype is static HTML, so no React/framer-motion/three install). Brand colours via `data-sparkle`: saffron+royal-blue on light sections (capabilities, plans), saffron+white on the navy bands (how, final-CTA). 7 looping `gs-sparkle` star SVGs per heading, periodically re-seeded; reduced-motion disables them. Personas heading keeps its char-reveal (no conflict).
- Verified index inline JS parses.

### Task 7 — follow-up 6 (animated brand background on form pages)
- New `assets/auth-bg.js` — a **vanilla WebGL** transparent overlay that layers slow brand-tinted (navy/royal-blue/saffron) flowing-noise motion over the EXISTING light surface (colours unchanged). Original compact fbm shader (NOT the three.js/React snippet — prototype is static HTML; no three/lucide/framer installed). Host-aware: inside `.auth-shell` (login/forgot/reset) or fixed-behind-content (contact, `body.gs-aurora-on` raises main/footer). Graceful: no-WebGL/compile-fail → canvas removed, static bg kept. Reduced-motion → single still frame. DPR capped 1.5; SRC_ALPHA blend; low alpha (~0.1) to stay subtle.
- Included on `login`, `forgot-password`, `reset-password`, `contact`. `node --check assets/auth-bg.js` OK.

### Task 7 — follow-up 7 (sparkles on form/legal page titles + shared refactor)
- Extracted the sparkles effect to a **shared `assets/sparkles.js`** + moved its CSS into `assets/styles.css` (`.sparkle-host`/`.sparkle`/`gs-sparkle`). Homepage now consumes the shared script (inline sparkle CSS + JS removed; `sparkles.js` loaded after the inline char-reveal so personas heading still gets both). `data-sparkle` colours + optional `data-sparkle-count`; reduced-motion safe; re-wrap guard; exposes `window.gsSparkleDecorate`.
- Applied `sparkle-text` to page titles: **Contact us · Privacy Policy · Terms of Service · "Onboard your organization" (register) · "Welcome Back" (login)** — saffron+royal-blue. `sparkles.js` included on each. Legal pages got sparkles only (NOT the animated bg — that stays scoped to auth+contact per the earlier request).
- Left forgot/reset out (their prominent text is a 14px tagline — sparkles would crowd it). Verified `node --check assets/sparkles.js` OK; index inline JS OK.

### Task 7 — follow-up 8 (privacy/terms → bento + trust strip, matching reference)
- `legal.js renderLegalDoc` rebuilt from a uniform 2-col grid to the kit's **bento**: featured "Overview" card (`col-8`, larger heading + CSS gradient panel instead of the stock photo — no external images), two stacked cards in a right `col-4` column, two `col-6` cards on the bottom row, extras full-width. Coloured **left-border accents** (saffron / royal-blue / slate). Added the navy **"Bank-Grade Security" trust strip** (icon + copy + ghost cross-link to the sibling legal doc + saffron "Contact support" CTA → contact.html). Legal copy still 100% from `legal.js`.
- `assets/styles.css` legal block replaced (`.legal-bento`/`.legal-col-*`/`.legal-right`/`.legal-card` accents/`.legal-feat-panel`/`.legal-strip*`); responsive → single column < 1024px.
- `privacy.html`/`terms.html` content width 820 → 1080px so the bento breathes.
- `node --check assets/legal.js` OK.

### Task 7 — follow-up 9 (homepage "deck" mode: section-as-screen + zoom-through)
- Homepage-only, **desktop ≥1024px + motion-allowed only**. The 6 sections (hero/capabilities/how/personas/plans/final-CTA) tagged `.screen`; `<html>` gets `deck-on` → native **CSS scroll-snap (y proximity)**, each screen `min-height:100vh; scroll-snap-align:center`, content flex-centred.
- **Zoom-through** 3D feel via a rAF scroll-driven controller: each `.screen` gets `--sx` (scale) / `--so` (opacity) from its distance to viewport centre — centred = crisp; leaving upward = scale↑ + fade; arriving from below = zoom-in from smaller. `perspective:1200px` on body for depth.
- **< 1024px or prefers-reduced-motion → normal flowing homepage** (deck disabled + inline vars cleared on resize; matchMedia listeners toggle live). Scrollbar/trackpad/anchor nav all still native (no scroll-hijack). Other pages untouched.
- Verified index inline JS parses.

### Task 7 — follow-up 10 (deck scroll fix: half-screen sticking)
- Root cause: `scroll-snap-type: y proximity` rests between sections. Switched to **`y mandatory`** + `scroll-snap-align: start` + `scroll-snap-stop: always` so each gesture always settles on a full screen.
- `.screen` now `height:100vh; overflow:hidden; box-sizing:border-box` (fixed full screen, no trap/half-rest). Deck-mode spacing tightened (section-head margin, bento gap/padding, personas/plans gap) so tall screens fit one viewport. Footer excluded from snap. Added a `max-height:740px` fallback that lets an over-tall screen scroll internally instead of clipping.
- Verified index inline JS parses.

### Task 7 — follow-up 11 (deck: stop stretching sections / restore original design)
- User report: fixed `height:100vh` + `overflow:hidden` + `justify-content:center` + tightened gaps stretched/distorted the sections. Reverted to a **minimal** deck: `.screen { min-height:100vh; scroll-snap-align:start; }` only — no fixed height, no clipping, no forced centring, no spacing overrides. Each section keeps its exact original design/padding and is simply ≥1 screen tall. Kept `scroll-snap-type: y mandatory` (fixes the earlier half-screen rest) + the zoom-through transform. Removed the `scroll-snap-stop:always`, the content-tightening rules, and the short-desktop overflow fallback.
- Verified index inline JS parses.

### Task 7 — follow-up 12 (deck: header offset + focus-pull blur)
- Sticky header was covering each screen's top → added `scroll-padding-top:76px` + `scroll-margin-top:76px` so snapped sections sit just below the 76px header.
- Turned the leaving-section fade into an intentional **focus-pull**: `.screen` now also gets `filter: blur(var(--bl))` driven by distance to viewport centre — 0px (sharp) when centred, up to 6px off-centre — so scrolling a section into view sharpens it. Softened the opacity fade (arriving 0.40 / leaving 0.55, was 0.65/0.85) so sections blur into depth rather than ghosting out. `--bl` cleared with the others below 1024px.
- Verified index inline JS parses.

### Task 7 — follow-up 13 (Playwright-verified deck scroll fix)
- **Tested with Playwright** (apps/web @playwright/test 1.59 + cached chromium-1223 headless shell; sandbox disabled for the Mach-port launch). Findings: deck active + header offset OK, but **content sections measure ~1100–1240px tall vs a 900px viewport** → per the scroll-snap spec, snapping never settles inside a section taller than the scrollport, which IS the "stuck half-screen" behaviour. Also found a double-offset bug (`scroll-padding-top:76` + `scroll-margin-top:76` = 152px).
- **Fix:** dropped rigid scroll-snap (it cannot work with sections taller than the screen); switched to **smooth free scroll + a dead-zone focus-pull**: a section stays fully sharp (blur 0 / opacity 1 / scale 1) while it dominates the viewport (|d|<0.45), then zooms/blurs only as it clearly leaves. Removed `scroll-margin-top`; kept `scroll-padding-top:84px` for anchor jumps + `scroll-behavior:smooth`. Effect ramp now `e=(|d|-0.45)/0.85`.
- **Re-tested:** dominant section blur 0.00px / opacity 1 at 71–100% coverage across all 6 sections; transitions blur ~0.4–1.2px only. No half-screen rest. Inline JS parses.

### Task 7 — follow-up 14 (Playwright: fix scroll-up "empty/stuck" + transition double-blur)
- Screenshots showed the real issue: `min-height:100vh` on shorter-than-screen sections left big dead whitespace bands (worst on scroll-up), and the centre-distance blur math blurred BOTH sections during a hand-off.
- Fixes: (1) **removed forced `min-height:100vh`** + flex-centring — sections keep natural height and flow continuously (no dead gaps). (2) **Focus math reworked to centre-coverage from layout geometry** (`offsetTop`/`offsetHeight`, transform-feedback-free): a section is fully sharp whenever it covers the viewport centre line; it only recedes/blurs once entirely above (leaving, zoom-through) or below (arriving, zoom-in). One dominant sharp section at all times.
- Playwright re-verified up + down: dominant section `blur 0.00px` at every rest (coverage 64–83%), neighbours blurred only in transition; no empty band. Inline JS parses. Temp test files removed.

### Task 7 — follow-up 15 (true full-page deck: flip-per-gesture, centred, non-sticky header, no h-overflow)
- Reworked the homepage deck per user direction into a **fullPage-style flip**:
  - `.screen` = `height:100vh; overflow-y:auto` (inner scrollbar hidden) with `justify-content: safe center` → content **vertically centred** when it fits, **scrolls internally** when taller (no clip, no blank-top).
  - **Wheel/key navigator** flips exactly **one section per gesture** (cooldown-debounced); a tall section scrolls internally first, then advances. Keyboard: ↑/↓/PgUp/PgDn/Space/Home/End.
  - **Header not sticky** on the deck (`#siteNav { position:absolute \!important }` → scrolls away with the hero); other pages keep the sticky chrome.
  - **No horizontal overflow**: focus scale kept `<=1` (recede) + `overflow-x:hidden`.
- **Playwright-verified:** navPos=absolute; hOverflow=0; one 40px wheel → scrollY=900 (full flip) + navTop=-900 (header gone); `how` content centre 450==viewport centre 450; capabilities internally scrollable (338px). Inline JS parses.

## Task 7 — Rent views (Lease/Property tabs) + Lease collection schedule
- `assets/styles.css`: added `.view-tabs`/`.view-tab` segmented control (navy active).
- `admin/rent.html`: added Lease-wise/Property-wise view tabs + shared Month control; generalised the rent-ledger script to `render(tab, scope)`; added `propertyRows()` aggregation; tab switching hides the lease filter card and resets lease filters. View-only.
- `admin/lease-detail.html`: added Block 4b "Rent Collection" — month-by-month table (Month/Rent/Collected/Late Fee/Status) generated from lease start→end + rent-change schedule, with a lease-total footer.
- Plan: `docs/planning/features/2026-06-01-rent-views-and-lease-collection-schedule.md`.
- Verified: `node --check` both pages; DOM-stub harness for all rent tab×scope combos and the 13-row collection schedule. No commit (awaiting user).

### Task 7 — follow-up 16 (slim header back + CTA & footer on one screen)
- **Header back, slim:** `#siteNav` fixed on the deck at **56px** height (was scrolled-away absolute); screens get `padding-top:72px` so content clears it.
- **Tall-section fix:** replaced unreliable `justify-content: safe center` with a JS `is-tall` class (a section taller than the screen → `flex-start` + internal scroll; else centred). Playwright: capabilities/plans tagged tall; CAP heading now at 133 (clear of header), not -118.
- **Closing screen:** wrapped the final-CTA section + footer slot in one `#closing .screen`; navigator's last index is now this screen (footer no longer a separate stop). Shrunk the CTA panel (padding/font/button) so **CTA + footer fit one viewport together** — Playwright (instant-scroll, settled): CTA heading 263, footer 515–759, footer fully visible.
- hOverflow 0; one-wheel flip + slim fixed header verified. Inline JS parses.

### Task 7 — follow-up 17 (plans cards: 2-column feature list + wider cards)
- `plans.js renderMarketingPlans`: feature `<ul>` switched from single flex column to **2-column grid** (`grid-template-columns:1fr 1fr; column-gap:18px; row-gap:9px`); feature rows 14px→13px, gap 10→8 for fit.
- `index.html` `#plansGrid` widened **960 → 1180px** (cards ~377px) to host the two columns; gap 28→24.
- Playwright: ul is grid w/ 2 cols (~150px each), 14 features, hOverflow 0; **plans screen now fits one viewport** (no longer `is-tall`). Screenshot confirms clean 2-col layout.

## Task 8 — Leases ↔ Rent ↔ Lease-detail data reconciliation
- `admin/leases.html`: replaced 8 static rows with a JS-generated `LEASES` roster of 24 (20 active mirroring the rent ROSTER + 2 upcoming/1 ended/1 terminated). Generated before paginate.js.
- `admin/rent.html`: ROSTER values unchanged (canonical active set); added mirror comment (L-2101..L-2120).
- `admin/lease-detail.html`: re-pointed to L-2114 (Raj Sharma + Priya, Green Valley 3A, ₹18,000) — title, renew link, tenant cards, consent-table names.
- Result: rent roll (20) = active subset of all leases (24); per-tenant unit/rent identical across screens; detail matches its list row.
- Verified: node --check all 3; DOM-stub confirms 24 rows / 20 active / Rohan 7C ₹22,000 both / L-2114 match. No commit.

### Task 7 — follow-up 18 (closing screen layout fix)
- Closing screen was centring the whole CTA+footer block → footer floated mid-lower with dead space below it. Fixed: `#closing` is `justify-content:flex-start` with the `.final-cta-wrap` set `flex:1` (CTA centred in the upper area) and `.gs-footer` set `flex:0 0 auto` → **footer pinned to the screen bottom**. Added `#closing { background:#fff }` so the upper area is seamless. Playwright: footerBottom=900 (pinned), CTA top 263, both fully visible.

### Task 7 — follow-up 19 (fit the capabilities bento to one screen)
- Capabilities (bento) measured 1214px vs 900px viewport → 314px over (the one section that overflowed the deck screen). Added **deck-only compaction** for `#capabilities` (tighter cell padding 36→20, mini-mock 18→12, mock-table row padding, feature-list gap, feature-h size/margins, section-head margin 56→22, h2 38→30, bento gap, padding-bottom 96→28). Normal/mobile layout unchanged.
- Playwright: capScrollH 901 ≈ clientH 900 (overBy 1, within tolerance) → no longer `is-tall`; centres as one screen. Screenshot confirms all 4 cards + heading fit, not cramped.

### Task 7 — follow-up 20 (deck polish: viewport-relative sizing across major desktop heights)
- **Status:** Completed
- **Started:** 2026-06-01
- **Completed:** 2026-06-01
- **ui-ux-pro-max skill guidance applied:**
  - Animation §7 `easing` + `duration-timing`: added `transition: opacity/filter/transform 180ms ease-out` on `.screen` for crisp enter/sharpen feel.
  - Depth effect §7 `transform-performance`: reworked `depthFactor()` — intensity scales with `vh/900` (0.75..1.6 capped) so tall monitors get more dramatic depth, short laptops stay readable. Added a 0.10 flat-zone (no ramp below 10% offset) so the dominant section stays fully sharp per the "dominant section must remain fully sharp" principle.
  - Opacity floor raised (never below ~0.58 for off-screen neighbours; was 0.5), blur scales 0→5px×df (was fixed 6px).
  - `primary-action` / CTA presence: enlarged closing CTA card with `clamp()` — padding `40→72px`, h2 `30→44px`, button `14→17px/12→16px` — all responsive across 768→1440.
  - `spacing-scale`: replaced all fixed-px deck overrides with `clamp()`/`vh`/`vmin` expressions for capabilities, plans, hero, how, roles sections.
- **Changes (prototype/index.html):**
  - Deck CSS `@media` block: `.screen padding-top` → `clamp(64px, 7vh, 88px)` (replaces hard 72px).
  - `transition` added to `.screen` for 180ms ease-out enter.
  - `depthFactor()` JS function added; all three depth vars (`--sx`, `--so`, `--bl`) now scaled by vhFactor; flat-zone of 0.10 before ramp.
  - `#closing .final-cta` padding/h2/p/btn — all `clamp()` for vmin-based scaling.
  - `#capabilities` — all 12 compaction properties converted from fixed-px to `clamp(floor, vmin/vh, ceil)`.
  - `#plans .mkt-plan` — card padding/radius/price font/feature list spacing overridden via `!important clamp()` (inline-style cards from plans.js).
  - `#hero`, `#how`, `#roles`, `#plans` section-head margins + heading sizes — all `clamp()`.
- **Playwright results (1440px wide, 3 heights):**
  | Height | h-overflow | nav fixed | hero | cap | how | roles | plans | closing | CTA inView | footer inView |
  |--------|-----------|-----------|------|-----|-----|-------|-------|---------|-----------|--------------|
  | 768    | 0         | yes (top:0)| fits | fits* | fits | fits | fits | fits | yes | yes |
  | 900    | 0         | yes (top:0)| fits | fits | fits | fits | fits | fits | yes | yes |
  | 1080   | 0         | yes (top:0)| fits | fits | fits | fits | fits | fits | yes | yes |
  - *capabilities at 768: scrollH=770 vs clientH=768 (2px subpixel rounding → `is-tall` tag fires but content fully readable; `fits` check passes at ≤4px tolerance). All other sections fit exactly. JS parses: true on all heights.
- **Files changed:** `prototype/index.html` (deck CSS + JS — no other pages, no shared assets touched)
- **Notes:** Normal/mobile flowing layout unchanged (deck CSS gated in `@media (min-width:1024px) and (prefers-reduced-motion:no-preference)`). `prototype/assets/plans.js` read-only (not edited). Temp Playwright test files cleaned up.

## Task 9 — Rent filters: combined cell, lease-type filter, payment-status dropdown
- `admin/rent.html`: Lease-wise views now lead with a bold combined **Property · Unit (· Room)** column; Tenant de-emphasised to a normal column. Headers updated (cumulative 8 cols, monthly 7).
- Added **Lease type** filter (data-lease-type on rows) + **Payment status** dropdown (mirrors tiles via shared `rentSetStatus()`, re-rendered per view). Both reset on tab-switch.
- Relabelled the status control "Payment status" per user (it's collection status, not lease status; lease status lives on the Leases page).
- Cascade (Property→Unit→Room) confirmed intact.
- Verified: node --check + DOM-stub (combined column, 8/7 cols, dropdown opts sync). Also: leases.html defaults to Active. No commit.

### Task 7 — follow-up 21 (plans cards alignment fix)
- Popular (Standard) card was inflated + staggered: removed `.mkt-pop { transform:scale(1.05) }` (emphasis now navy fill + badge only) and changed `#plansGrid` `align-items:center`→`stretch` so all three cards are equal height with bottom-aligned "Get started" buttons.
- `plans.js` feature rows 13→12px + `align-items:flex-start` (top-aligned checks) → long labels (Maintenance Requests / Admin Impersonation) no longer wrap to 2 lines.
- Playwright (1440×900): all 3 cards identical geometry (top 268, bottom 720, h 452). plans.js parses.

### Task 7 — SESSION CLOSE (public-pages redesign v2 + homepage deck)
Scope of THIS session's work (frontend / prototype only — no apps/, no SRS, no feature_list state changes):
- **Shared assets:** `assets/styles.css` (surface tokens, light-glass auth-shell/auth-card, public-band, glass-panel, legal bento + trust strip, sparkles styles); `assets/public-chrome.js` (light nav w/ logo mark + centre links + outlined-Login/solid-Register glow buttons; navy footer); `assets/plans.js` (`renderMarketingPlans` rebuilt: navy popular card, 2-col feature grid, equal-height alignment); `assets/legal.js` (`renderLegalDoc` → bento + Bank-Grade-Security strip); NEW `assets/auth-bg.js` (WebGL brand background, login/forgot/reset/contact); NEW `assets/sparkles.js` (shared magic-text headings).
- **Pages:** `index.html` (hybrid bento/glass homepage + full-page DECK: desktop-only flip-per-gesture, slim fixed 56px header, is-tall internal-scroll, focus zoom/blur, clamp()-responsive 768→1440, closing CTA+footer screen), `login` (glass + Preview-as-Role modal), `forgot-password`, `reset-password`, `organization-signup` (glass 3-card), `contact` (glass form + info), `privacy`/`terms` (legal bento). Domain placeholders → `anshika.tlitech.net`. Section headings → sparkles; personas char-reveal + animated paths.
- **Verification:** all touched JS parses; deck behaviour Playwright-verified across 768/900/1080 (no h-overflow, header fixed on every screen, all sections fit, CTA+footer together). Records: `docs/planning/features/2026-06-01-public-pages-redesign-v2.md` + `docs/planning/prototype-changes.md` row + this log (follow-ups 1–21).
- **NOT done (intentionally):** apps/web port, SRS edits, feature_list.json state flips (worker≠checker). Deck is homepage-only; mobile/reduced-motion keep the normal flowing layout.
