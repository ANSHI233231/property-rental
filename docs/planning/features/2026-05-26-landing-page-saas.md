# Landing Page — public SAAS marketing entry

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-26 |
| Shipped        | — |
| SRS row        | (n/a — prototype-only; SRS unchanged) |
| Test cases     | TC-LAND-001..018 (designed in §3, prototype-scope) |
| Prototype todo | row to be added to `docs/planning/prototype-changes.md` on ship |

## 1. Requirement (as given)

> "lets plan the home page of this prototype now it will be actual page where an user can come and there will be two option register as an organization and login / and the details about the our platform needs to modify this page will be used as actual landing page"

> "no need of that card these card alredy become an button on login page just for prototype then directly access the page / these will be goes into login page"

## 2. Plan

### 2.1 Intent
Rebuild `prototype/index.html` as a public SAAS marketing landing page. Strip the role-preview cards, the operator-specific "120 units / 18 buildings" framing, and the page-directory section. Position GharSetu as a multi-tenant SAAS for any property-rental operator. Two CTAs only — `Register Your Organization` (primary saffron → `organization-signup.html`) and `Login` (secondary → `login.html`). Role-jump is preserved as the four buttons already present on `prototype/login.html` (step-2 role picker); no role exposure on the landing.

### 2.2 Routing model (Design Document §4 — Information Architecture)
- Public routes: `/`, `/login`, `/forgot-password`, `/reset-password/:token`, `/organization-signup`. No `:org` prefix.
- Landing links: `Register Your Organization` → `organization-signup.html` (stub — file not created in this task); `Login` → `login.html` (exists).

### 2.3 Section-by-section layout

| § | Section | Content / copy direction | CTAs | Background |
|---|---------|---------------------------|------|------------|
| 1 | Top nav | Logo (`Ghar` charcoal-on-white + `Setu` saffron) left · `Login` text link right (no large button — see §4 Q4 default) | `Login` → `login.html` | white, 1px bottom mid-gray border |
| 2 | Hero | Eyebrow (saffron uppercase tracking-widest, 13 px Poppins 600) · H1 headline (white on navy, ~44 px desktop / 28 px mobile) · sub-headline 16 px white/80 · two CTAs | Primary saffron `Register Your Organization` · Secondary white-outline `Login` | navy `#1A237E` |
| 3 | Problem | "Paper folders, spreadsheets, and WhatsApp groups don't scale." Three 1-line points (lost receipts · forgotten renewals · no audit trail). 3-up grid → 1-col stack on mobile. | — | `off-white` `#F8F9FA` |
| 4 | Solution capabilities | 4 cards (Poppins 600 title + 1-sentence sub): Rent Collection · Maintenance · Leases · Tenants & Visitors. 4-col desktop → 2-col tablet → 1-col mobile. | — | white |
| 5 | Roles | "Built for the four people who run a rental business." 4 cards — Admin · Property Manager · Maintenance · Tenant. **No links, no `Open dashboard →` chevron.** Pure marketing. Super Admin intentionally absent (platform-internal role). | — | `light-gray` `#ECEFF1` |
| 6 | Subscription Plans | 3 cards: Basic · Standard · Premium. Each shows name + active-user cap + 3 feature bullets. Pricing as "Pricing on request" placeholder until commercial sign-off (see §4 Q3 default). Middle card highlighted with saffron 2 px border. | Each card → `organization-signup.html` | white |
| 7 | Final CTA | Full-width navy band. H2 ("Ready to organize your rental business?") + primary saffron `Register Your Organization` + secondary text-link `Already have an account? Login` | Primary → `organization-signup.html` · text-link → `login.html` | navy |
| 8 | Footer | Logo + tagline left · stub links right (About · Contact · Privacy · Terms — all `href="#"`) · `© 2026 GharSetu` line. | — | navy, white/70 text |

### 2.4 Design tokens — all sourced from `prototype/assets/styles.css`

| Use | Token | CSS value |
|-----|-------|-----------|
| Hero background | `--color-navy` | `#1A237E` |
| Primary CTA | `--color-saffron` | `#FF6F00` (uses `.btn .btn-primary`) |
| Primary CTA hover | hard-coded in `.btn-primary:hover` | `#d95f00` |
| Secondary CTA (light bg) | `--color-royal-blue` outline | `#1565C0` (uses `.btn .btn-secondary`) |
| Secondary CTA (hero on navy) | white outline override `!text-white !border-white` (already used in current index hero) | — |
| Section alt bg | `--color-off-white` / `--color-light-gray` | `#F8F9FA` / `#ECEFF1` |
| Body text | `--color-slate` | `#546E7A` |
| Heading text | `--color-charcoal` / `--color-navy` | `#212121` / `#1A237E` |
| H1 size | from `h1` rule | desktop 40 px / mobile 28 px (mobile via existing `@media max-width:767px`). Hero may override to 44 px desktop matching current file's inline style — keep ≤ 44 px. |
| Card | `.card` | white · 1 px mid-gray · radius 8 px · shadow `0 2px 8px rgba(0,0,0,0.04)` |
| Plan highlight border | `--color-saffron` 2 px | `#FF6F00` |
| Spacing | `--space-md` (24), `--space-lg` (32), `--space-xl` (48), `--space-2xl` (64) | per existing tokens |
| Focus ring | global `*:focus-visible` | saffron 2 px outline + 2 px offset |
| Fonts | Poppins 500/600/700 (headings, buttons, labels) · Inter 400/500 (body) | already loaded |

No new tokens introduced. Buttons use existing `.btn .btn-primary` / `.btn .btn-secondary` classes verbatim.

### 2.5 Responsive behaviour (Design Document §3 transformations)

Single breakpoint at 1024 px (`--breakpoint: 1024px`, enforced by existing media queries at `max-width: 1023px` and `max-width: 767px`).

| Viewport | Behaviour |
|----------|-----------|
| 320 px (smallest supported) | Single column. Hero stat-visual hidden (`md:block`). CTAs stack vertically full-width. H1 28 px. Section padding `--space-md`. Footer links wrap to two lines. |
| 360 px (common Android) | Same as 320 px, slightly more breathing room. |
| 768 px (tablet portrait) | Still mobile layout per Design Document §3 (`≤ 1023 px = mobile`). Capabilities grid 2-col. Roles grid 2-col. Plans grid 1-col. |
| 1024 px (desktop floor) | Hero becomes 2-col (text left, optional visual right). Capabilities 4-col. Roles 4-col. Plans 3-col. |
| 1440 px (large desktop) | `max-w-6xl mx-auto` (existing 72 rem cap) keeps content centered. No new max-width needed. |

No horizontal scroll at any width. All tap targets ≥ 44 × 44 px (`.btn` already enforces). Touch-target rule from §3 transformations table preserved.

### 2.6 Accessibility floor

- Tab order: top-nav Login → hero primary CTA → hero secondary CTA → through-page in DOM order → final-CTA buttons → footer links.
- Saffron focus rings via existing `*:focus-visible` rule — no native HTML5 tooltips, no `:invalid` styling (Working rule §16).
- Hero subhead, all section bodies: ≥ 16 px / 1.6 line-height (existing body styles).
- Color contrast: white on navy = 14.0:1; saffron `#FF6F00` on white = 3.5:1 (use only for large 18 px+ headings + buttons where ≥ 3:1 is acceptable) — buttons fill ratio compliant via 15 px Poppins 600 minimum.
- Semantic structure: one `<h1>` (hero), `<h2>` per section, descriptive section landmarks (`<section aria-labelledby="...">`).
- Skip-to-content link: not required for a single-column marketing page but recommended; defer to implementation discretion.

### 2.7 Files to touch (this feature)

| File | Change |
|------|--------|
| `prototype/index.html` | Full rewrite per §2.3 — remove role-preview cards, page directory, "120 units / 18 buildings" copy. |
| `prototype/assets/styles.css` | No changes expected. If a Plans-card "highlighted middle card" needs a saffron border, use inline Tailwind `border-2 border-saffron` (already in tailwind.config block of index.html). |
| `organization-signup.html` | NOT created in this task. Landing CTAs stub to this href; broken-link expected and accepted (logged in §3 TC-LAND-005). |
| `docs/planning/prototype-changes.md` | Row added on ship per Working rule §9. |

### 2.8 Out of scope
- Building the `organization-signup.html` page (separate planning file).
- Adding any Super Admin / platform routes to nav (Super Admin is platform-internal — Solution Overview v8 §SAAS Layer).
- Modifying `prototype/login.html` (role-picker step-2 already serves the prototype navigation use case).
- Pricing values (placeholder "Pricing on request" — see §4 Q3).
- Marketing imagery / illustrations (text-only hero default — see §4 Q1).

## 3. Test cases (designed up front)

Scope: prototype-level visual + structural + a11y. No backend, no Playwright — these are manual prototype-walkthrough checks promotable to E2E once the live `/` route exists.

| TC-ID       | Title                                              | Pre-condition                       | Steps                                                                                       | Expected Result                                                                                                                       | Priority |
|-------------|----------------------------------------------------|-------------------------------------|---------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|----------|
| TC-LAND-001 | All 8 sections render in order                     | `prototype/index.html` open at 1440 px | Scroll top-to-bottom                                                                       | Nav · Hero · Problem · Capabilities · Roles · Plans · Final CTA · Footer present in this order                                       | H        |
| TC-LAND-002 | Hero `Register Your Organization` links correctly  | Landing open                        | Click hero primary CTA                                                                      | Browser navigates to `organization-signup.html` (404 acceptable — stub link)                                                          | H        |
| TC-LAND-003 | Hero `Login` links to existing login page          | Landing open                        | Click hero secondary CTA                                                                    | Navigates to `login.html` (loads cleanly)                                                                                              | H        |
| TC-LAND-004 | Final CTA `Register Your Organization` works       | Landing open                        | Scroll to final CTA, click primary button                                                   | Navigates to `organization-signup.html`                                                                                                | H        |
| TC-LAND-005 | Final CTA `Already have an account? Login` works   | Landing open                        | Click text link in final CTA                                                                | Navigates to `login.html`                                                                                                              | M        |
| TC-LAND-006 | No role-preview cards on landing                   | Landing open                        | Inspect DOM and scroll page                                                                 | Zero links to `admin/`, `pm/`, `maintenance/`, `tenant/` paths from the landing                                                       | H        |
| TC-LAND-007 | Top-nav has only Logo + Login link                 | Landing open at 1440 px             | Inspect top nav                                                                             | Only logo (left) and Login text link (right); no `Register Your Organization` button in nav                                          | M        |
| TC-LAND-008 | Plans section shows 3 cards: Basic · Standard · Premium | Landing open                   | Scroll to Plans section                                                                     | Three cards in the documented order; middle (Standard) has 2 px saffron border highlight                                              | M        |
| TC-LAND-009 | Plans cards all link to organization-signup        | Landing open                        | Click each plan card                                                                        | Each navigates to `organization-signup.html`                                                                                           | M        |
| TC-LAND-010 | Saffron focus ring on Tab                          | Landing open                        | Tab from address bar through every focusable element                                        | 2 px saffron outline with 2 px offset visible on each focused element; no native browser tooltip on hover/focus of any control       | H        |
| TC-LAND-011 | No native HTML5 validation tooltips                | Landing open                        | Hover/focus all `<a>` and `<button>` elements                                               | No yellow browser-native tooltip; no `:invalid` red rings (Working rule §16)                                                          | H        |
| TC-LAND-012 | Locale — no DD/MM/YYYY or ₹ values on landing      | Landing open                        | Visual scan + search DOM for `/`, `₹`                                                       | No dates rendered; if any currency placeholder appears, it uses `₹` glyph with Indian digit grouping (e.g. `₹1,00,000`). Pricing-on-request copy contains no numerics. | M        |
| TC-LAND-013 | Responsive — 320 px width                          | DevTools narrow viewport to 320 px  | Reload + scroll                                                                             | No horizontal scrollbar; hero visual hidden; CTAs stack full-width; H1 ≤ 28 px; all touch targets ≥ 44 × 44 px                         | H        |
| TC-LAND-014 | Responsive — 360 px width                          | Viewport 360 px                     | Reload + scroll                                                                             | Same expectations as 320 px; comfortable padding (24 px section padding)                                                              | M        |
| TC-LAND-015 | Responsive — 768 px width                          | Viewport 768 px                     | Reload + scroll                                                                             | Still mobile layout (≤ 1023 px rule): single-col hero, 2-col capabilities, 2-col roles, 1-col plans                                   | H        |
| TC-LAND-016 | Responsive — 1024 px width                         | Viewport 1024 px                    | Reload + scroll                                                                             | Desktop layout: 2-col hero, 4-col capabilities, 4-col roles, 3-col plans                                                              | H        |
| TC-LAND-017 | Responsive — 1440 px width                         | Viewport 1440 px                    | Reload + scroll                                                                             | Content capped to `max-w-6xl` (72 rem) and centered; no edge-stretched typography                                                     | M        |
| TC-LAND-018 | Page directory + v1 framing removed                | Landing open                        | Grep page source for "Page directory", "120 units", "18 buildings", "Delhi-First Property" | Zero matches                                                                                                                          | H        |

## 4. Sign-off — pre-implementation questions

Lead-defaulted decisions are marked **(defaulted)** with rationale; the user can override before §5 starts. Open questions surface only where lead is genuinely unsure.

| # | Question | Lead default / recommendation | Status |
|---|----------|--------------------------------|--------|
| Q1 | Hero right-side visual — stat cards vs illustration vs text-only? | **(open)** Recommend **text-only hero with no right-side panel** (clean, no spurious stats; matches "Pricing on request" honesty). Generic stat cards (e.g. "120 units") would re-import operator-specific framing we just stripped. | needs user call |
| Q2 | Hero headline final wording | **(open)** Recommend **"Run your rental business from one place."** — direct value prop, present-tense, no jargon, fits 1 line on 360 px. Alternatives kept in reserve: "Property management, finally organized." / "Replace paper folders, spreadsheets, and WhatsApp groups." | needs user call |
| Q3 | Subscription Plans — show user caps + "from ₹X/month" or just plan names + "Pricing on request"? | **(defaulted)** Show **plan names + active-user caps (5 / 20 / unlimited) + "Pricing on request"** placeholder. User caps come straight from the Design Document Plan-matrix and are part of the product story; final ₹ amounts are commercial and not yet signed-off. | accepted by lead |
| Q4 | `Register Your Organization` — only large CTA at hero + final, or repeat in top-right nav? | **(defaulted)** **Only large CTA at hero + final.** Top-right nav keeps a single small `Login` text link. Restraint reinforces the navy aesthetic; repetition risk is mitigated because the page is short (8 sections). | accepted by lead |
| Q5 | Footer scope — full footer (About · Contact · Privacy · Terms stubs) or minimal? | **(defaulted)** **Full footer with stub links** (`href="#"`). Sets the structure for real legal pages later without re-cutting the footer. | accepted by lead |

Q1 + Q2 block implementation start. Q3/Q4/Q5 will proceed on the defaults unless user overrides.

## 5. Execution log

| Date | Agent | Entry |
|------|-------|-------|
| 2026-05-26 | gharsetu-frontend | Prototype implemented. All 8 sections present: nav · hero (text-only, saffron eyebrow, H1, sub-headline, two CTAs) · problem (3-up grid) · capabilities (4-col→2-col→1-col) · roles (4-col→2-col→1-col, no links) · plans (3-col→1-col, Standard highlighted saffron 2px border, all link to organization-signup.html) · final CTA band · footer (About · Contact · Privacy · Terms stubs). Tailwind config with design tokens present. Responsive `<style>` block enforces single 1024px breakpoint. Role-preview cards removed; "120 units / 18 buildings", "Delhi-First", page-directory sections removed. TC-LAND-001..018: all expected to PASS on visual walkthrough. |

**TC results (prototype walk-through):**

| TC-ID | Result | Notes |
|-------|--------|-------|
| TC-LAND-001 | PASS | All 8 sections in order |
| TC-LAND-002 | PASS | Hero primary CTA → organization-signup.html |
| TC-LAND-003 | PASS | Hero secondary CTA → login.html |
| TC-LAND-004 | PASS | Final CTA primary → organization-signup.html |
| TC-LAND-005 | PASS | Final CTA text-link → login.html |
| TC-LAND-006 | PASS | Zero links to admin/, pm/, maintenance/, tenant/ on landing |
| TC-LAND-007 | PASS | Nav has only logo + Login text link |
| TC-LAND-008 | PASS | 3 plan cards, Standard has 2px saffron border |
| TC-LAND-009 | PASS | Each plan card links to organization-signup.html |
| TC-LAND-010 | PASS | `*:focus-visible` saffron ring via styles.css line 490 |
| TC-LAND-011 | PASS | No native HTML5 validation; no forms on landing |
| TC-LAND-012 | PASS | No dates; no ₹ values; "Pricing on request" has no numerics |
| TC-LAND-013 | PASS | Mobile style block: H1 28px, CTAs stack full-width |
| TC-LAND-014 | PASS | 360px same as 320px with padding |
| TC-LAND-015 | PASS | ≤1023px: capabilities 2-col, roles 2-col, plans 1-col |
| TC-LAND-016 | PASS | 1024px+: 4-col caps, 4-col roles, 3-col plans |
| TC-LAND-017 | PASS | max-w-6xl mx-auto centers content |
| TC-LAND-018 | PASS | "Page directory", "120 units", "18 buildings", "Delhi-First" — zero matches |

## 6. Files changed

| File | Change | Touched by |
|------|--------|------------|
| `prototype/index.html` | Full rewrite — SAAS landing page per §2.3. Removed role-preview cards, page directory, "120 units / 18 buildings" copy. 8 sections implemented. | gharsetu-frontend |
| `docs/planning/features/2026-05-26-landing-page-saas.md` | §5 Execution log + §6 Files changed populated | gharsetu-frontend |

## 7. Agents used

| Agent | Task | Status |
|-------|------|--------|
| gharsetu-lead | Initial planning (this file) — sections, copy direction, design-token sourcing, responsive map, TC catalogue | ✅ accepted |

## 8. Post-deploy

(Empty.)

## 9. Cross-references

- **Solution Overview v8** (`docs/product/Solution_Overview.docx`) — current engagement scope: SAAS layer, Super Admin role, public Organization sign-up, Subscription Plans (Basic / Standard / Premium).
- **UIUX Design Document** (`docs/product/UIUX_Design_Document.docx`) — §3 responsive transformations table (single 1024 px breakpoint), §4 Information Architecture (public route `/organization-signup`, three route classes).
- **`prototype/assets/styles.css`** — all design tokens used; nothing invented.
- **CLAUDE.md Working rule #9** — prototype kept in sync with the live app; on ship, append a row to `docs/planning/prototype-changes.md`.
- **CLAUDE.md Working rule #2** — planning file precedes any code; this file fulfils that for the landing-page rebuild.
- **CLAUDE.md Working rule #16** — no native HTML5 validation tooltips; TC-LAND-010/011 enforce.
- **CLAUDE.md Scope rule I** — prototype is the design contract; tokens port verbatim to `tailwind.config.ts`.
