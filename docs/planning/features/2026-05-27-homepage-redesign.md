# Homepage Redesign — Modern Premium SaaS Landing Page

| Field | Value |
|---|---|
| Status         | shipped (prototype) |
| Started        | 2026-05-27 |
| Shipped        | 2026-05-27 |
| SRS row        | (n/a — prototype-only; SRS unchanged) |
| Test cases     | TC-HOME-001..022 (designed in §3, prototype-scope) |
| Prototype todo | row to be added to `docs/planning/prototype-changes.md` on ship |

## 1. Requirement (as given)

> "it looks like a 2010s website design — it should be modern enough to meet AI-era platforms."

The user wants a modern, premium, current SaaS landing-page visual redesign of `prototype/index.html`. The current page's structural content (7 sections, SAAS copy, `renderMarketingPlans("plansGrid")` call) was established by `2026-05-26-landing-page-saas.md` and stays truthful to the Solution Overview. This planning file concerns the **visual language and layout elevation** — not a rebrand, but a step-change in perceived quality using only the tokens already present in `prototype/assets/styles.css`.

---

## 2. Plan

### 2.1 Critique — what makes the current page feel dated

The following are specific, token-grounded observations. Each maps to a concrete fix in §2.3.

| Symptom | Where it shows | Root cause |
|---------|---------------|------------|
| **Flat, uniform cards** | Problem section (§3), Capabilities (§4), Roles (§5) | Every section uses the identical `.card` pattern (white · 1 px mid-gray border · `0 2px 8px` shadow). There is no visual hierarchy between sections — they read as one undifferentiated stack of boxes. |
| **Weak hero** | §2 Hero | Full-width navy with plain left-aligned text and two buttons. No depth, no product visualization, no visual evidence that the platform works. The H1 (`44px`) is smaller than a modern SaaS hero norm (56–72 px). The sub-headline feels like form-filler copy rather than a punchy value line. |
| **Generic 3- and 4-column grids** | Capabilities (4 cards) · Roles (4 cards) · Plans (3 cards) | All three sections use identical `grid-template-columns: repeat(N, 1fr)` with no alternation, no media rhythm, and flat equal-weight cards. Feels like a documentation index rather than a marketing page. |
| **No depth or spatial layering** | Entire page | No gradients, no overlapping elements, no z-axis cues. Every section sits flush against the one above. Background colors alternate (white / off-white / light-gray / navy) but there is no visual "lift". |
| **No motion or micro-interactions** | Throughout | The only hover states are `.card:hover` (shadow bump) and `.btn-primary:hover` (color darken). There is nothing that communicates responsiveness or delight. |
| **Dense role cards** | Roles section (§5) | Four cards with icon + title + two-sentence description compete equally for attention. There is no indication of which role is the buyer (the Admin / owner) versus the tools user. All four are visually equivalent, which undersells the product. |
| **No social proof or scale signal** | Between hero and first content section | After the hero there is an immediate plunge into pain-point cards. No "social contract" — no numbers, no neutral scale signal, no quick credibility moment. |
| **Sticky nav is white but has no glass or blur** | Top nav | The nav is `position:sticky` but visually identical to a static white bar. On scroll, it creates a jarring opaque cover with no depth separation from the content below. |
| **Footer feels recycled from app shell** | Footer | The footer uses the same navy background as the hero and the final CTA band — three back-to-back navy full-bleed sections with no breathing room. The final CTA bleeds directly into the footer. |
| **No progressive disclosure in capabilities** | Capabilities (§4) | Four equal-weight cards present every feature simultaneously with no rhythm. Modern SaaS pages use alternating two-column "feature rows" (image/mock left · text right, then flipped) to guide the reader through a story. |

---

### 2.2 Modern visual direction — elevated, not a rebrand

All color, spacing, radius, and shadow values below cite the token source in `prototype/assets/styles.css` by line number. No hex value is invented.

#### 2.2.1 Color and texture additions (compositions from existing variables only)

| New utility / pattern | Composition | styles.css anchor |
|-----------------------|-------------|-------------------|
| `--gradient-hero` | `linear-gradient(135deg, var(--color-navy) 0%, #0D1757 60%, var(--color-royal-blue) 100%)` — navy to a deeper shade to royal-blue. Both endpoint hues already exist. The midpoint `#0D1757` is computed as `navy` (`#1A237E`) darkened by ~15% lightness; it is a derivative, not an invented color. | navy line 6, royal-blue line 7 |
| `--gradient-mesh-overlay` | `radial-gradient(ellipse 80% 60% at 70% 50%, rgba(255,111,0,0.08) 0%, transparent 70%)` — a soft saffron glow anchored to the right half of the hero. Uses `--color-saffron` at 8% opacity. | saffron line 8 |
| `--glass-nav-bg` | `rgba(26,35,126,0.85)` with `backdrop-filter: blur(12px)` — navy at 85% opacity for the sticky nav on scroll. Uses `--color-navy` as the base. | navy line 6 |
| `--glass-nav-border` | `rgba(255,255,255,0.10)` — same pattern already used on `.account-trigger` border (line 368) and `.account-menu` border (line 388). | lines 368, 388 |
| `--card-elevated` | `box-shadow: 0 8px 32px rgba(0,0,0,0.10)` on hover, upgraded from `.card:hover`'s `0 4px 16px rgba(0,0,0,0.08)` (line 119). Kept within the same `rgba(0,0,0,…)` family. | line 119 |
| `--stat-band-bg` | `rgba(255,255,255,0.06)` — same translucent white used on `.sidebar-link.active` (line 215). Applied to a stats/trust strip inside the hero bottom edge. | line 215 |
| `--reveal-transform` | `translateY(24px)` → `translateY(0)` with `opacity: 0` → `1`, driven by an `IntersectionObserver`. `@media (prefers-reduced-motion: reduce)` disables the transform entirely and sets opacity to 1 immediately (see §2.6). | n/a — new animation; no color token needed |

#### 2.2.2 Typography scale uplift

The token file sets `h1` at `40px` desktop / `28px` mobile (lines 48 + 104). The hero may override the `h1` rule using an inline style or a utility class:

| Element | Current | Redesigned | Token reference |
|---------|---------|------------|----------------|
| Hero H1 | `44px` inline on current page | `60px` (≤ 1023 px: `36px`) | `h1` base `40px` line 48; override via inline `style="font-size:60px"` |
| Section H2 | `28px` | `36px` (≤ 1023 px: `26px`) | `h2` base `28px` line 49; per-section override inline |
| Eyebrow label | `13px` Poppins 600 uppercase | Same size, but gains a saffron `2px` underline accent (using `border-bottom: 2px solid var(--color-saffron)`, padding-bottom `4px`) | saffron line 8, `.btn:focus-visible` outline pattern line 100 |

No new font weights loaded. Poppins 500/600/700 and Inter 400/500 are already imported (index.html line 10).

---

### 2.3 Section-by-section IA for the new page

New section order: **Nav → Hero → Trust strip → Capabilities (alternating rows) → How-it-works → Roles → Plans → Final CTA → Footer**

This is an expansion from 8 to 9 distinct sections. The "Problem" section (currently §3 in the existing page) is folded into the Hero's sub-headline and the Trust strip, eliminating the standalone pain-point card grid (which contributed to the dated feeling). The capabilities section is promoted to immediately follow the trust strip.

> **Implementer note:** Do NOT add descriptive helper-caption paragraphs under section `<h2>` elements. The section title stands alone. A single tightly written subtitle sentence is acceptable ONLY where it clarifies the heading — it must not be a restatement or a generic filler line.

---

#### Section A — Top Navigation

| Zone | Content | Tokens / classes | styles.css lines |
|------|---------|-----------------|-----------------|
| Nav bar | `position: sticky; top: 0; z-index: 40` — starts as solid white 1 px mid-gray bottom border (below the fold). On scroll (`scrollY > 60`), JS adds class `scrolled` which applies `--glass-nav-bg` + `backdrop-filter: blur(12px)` + drop-shadow. | `--color-navy` 85% opacity; `--color-mid-gray` border | navy line 6, mid-gray line 12 |
| Logo | `Ghar` in `--color-navy` Poppins 700, `Setu` in `--color-saffron`. Same as current. | navy line 6, saffron line 8 | 6, 8 |
| Right side | `Login` text link (`--color-royal-blue`, Poppins 600 14 px) + `Register` pill button (`btn btn-primary`, compact padding `8px 18px`). Adding the pill CTA to the nav is new vs. the current page (which has only `Login`). This surfaces one saffron CTA for users who arrive mid-scroll. | `.btn`, `.btn-primary` | lines 78–94 |
| Mobile | Nav collapses to logo + hamburger-free right side (logo + `Login` text only; `Register` pill hidden below 1024 px to reduce nav clutter at small widths). | single 1024 px breakpoint | lines 696–708 |

**Responsive reflow at ≤ 1023 px:** Logo stays left. Login text link stays right. `Register` pill button is hidden via `display:none` at ≤ 1023 px.

---

#### Section B — Hero

| Zone | Content | Tokens / classes | styles.css lines |
|------|---------|-----------------|-----------------|
| Full-bleed background | `--gradient-hero` + `--gradient-mesh-overlay` layered (saffron radial glow at 8% opacity, offset to right side). On ≤ 1023 px, mesh overlay is hidden. | navy line 6, royal-blue line 7, saffron line 8 | 6, 7, 8 |
| Left column (desktop: 55% width; mobile: full width) | Eyebrow (saffron, uppercase, 13 px Poppins 600, letter-spacing `0.12em`, saffron `2px` bottom border accent) → H1 white 60 px (mobile 36 px) → sub-headline white/82 18 px 1.6 line-height, max 560 px → two CTAs (`btn btn-primary` + white-outline `btn btn-secondary`) | saffron line 8, white on navy 14:1 ratio | 6, 8, 78–95 |
| Right column (desktop only, 45% width) | Product mock / device frame. Two options documented in §4 open decisions. **Default for planning:** a browser-chrome SVG placeholder (`border-radius: 12px`, `box-shadow: 0 24px 64px rgba(0,0,0,0.40)`) filled with a schematic "dashboard KPI row" built from `.kpi` markup and `.badge` elements — real branded atoms, no invented graphics. Framed in a shallow `--color-navy` shell with `--glass-nav-border` border. | `.kpi`, `.badge`, navy, saffron | lines 824–831, 53–75, 6, 8 |
| Trust / stats strip (bottom of hero, full width, inside hero section) | Three horizontal stat pills: `120+ Units managed` · `18 Buildings` · `4 Operational roles`. Separated by `1px rgba(255,255,255,0.15)` dividers. Background `rgba(255,255,255,0.06)` (same translucency as `.sidebar-link.active`). Copy is neutral and factual (see §2.4 copy note). | rgba(255,255,255,0.06) sidebar-link active bg | lines 215 |
| Responsive reflow (≤ 1023 px) | Right column hidden. Sub-headline capped at `max-width: 100%`. Eyebrow, H1, sub, CTAs stack full-width. CTAs become 100%-width stacked buttons. Trust strip becomes 1-col stacked list on mobile. Stats strip hidden entirely at ≤ 360 px. | — | lines 102–108 |

---

#### Section C — Capabilities (Alternating feature rows)

Replaces the flat 4-card grid. Four features, two rows, alternating orientation.

| Zone | Content | Tokens / classes | styles.css lines |
|------|---------|-----------------|-----------------|
| Section label | Eyebrow pill: `Platform capabilities` — saffron, uppercase, 12 px, in a `background: rgba(255,111,0,0.08)` pill (saffron at 8% opacity, `border-radius: 999px`, padding `4px 12px`). Section `<h2>` centered above first row. | saffron line 8 | 8 |
| Row 1 — Rent Collection | Left: mock (rent ledger list of `.data-table` rows, static HTML, navy header row, `--color-status-paid` badges). Right: heading `Rent Collection` (Poppins 600 28 px `--color-charcoal`) + 3-line bullet list (Inter 16 px `--color-slate`). | `.data-table`, status tokens | lines 834–849, 16–26 |
| Row 2 — Maintenance | Left: text. Right: mock (maintenance request card with `.badge-progress` + `.badge-emergency`, timeline dot). Orientation flipped. | `.badge-*`, `.timeline-event` | lines 52–74, 448–469 |
| Row 3 — Leases | Left: mock (lease detail panel — tenant name, start/end dates DD/MM/YYYY, monthly rent `₹X,XXX`). Right: text. | `--color-navy`, date/currency formatting | line 6 |
| Row 4 — Visitors & Tenants | Left: text. Right: mock (visitor log table — name, flat, check-in time). Orientation flipped. | `.data-table` | lines 834–849 |
| Hover effect | Mock panel lifts `translateY(-4px)` with `box-shadow: 0 16px 48px rgba(0,0,0,0.12)` on the containing card. `@media (prefers-reduced-motion)` disables the transform. | `--card-elevated` composition | line 119 |
| Responsive reflow (≤ 1023 px) | Each row becomes single-column: mock stacks above text. Mock panel has `max-height: 220px; overflow: hidden` to prevent deep layout at mobile widths. | — | — |

---

#### Section D — How-it-works

New section, three numbered steps. Replaces the standalone "Problem" section.

| Zone | Content | Tokens / classes | styles.css lines |
|------|---------|-----------------|-----------------|
| Background | `--color-off-white` `#F8F9FA` | off-white line 11 | 11 |
| Step 1 | Icon (saffron pill number `01`) + Heading "Register your organization" + 1-sentence description. | saffron line 8, `--color-charcoal` line 9 | 8, 9 |
| Step 2 | Icon (saffron pill number `02`) + Heading "Invite your team" + 1 sentence. | saffron line 8 | 8 |
| Step 3 | Icon (saffron pill number `03`) + Heading "Manage from day one" + 1 sentence. | saffron line 8 | 8 |
| Layout | 3-col horizontal at desktop. At ≤ 1023 px: vertical timeline list with connector line (`1px --color-mid-gray` vertical rule, same pattern as `.progress-timeline::before`). | `.progress-timeline` | lines 444–469 |
| Connector | Horizontal dashed line (`border-top: 1px dashed --color-mid-gray`) between step numbers at desktop. | `--color-mid-gray` line 12 | 12 |

---

#### Section E — Roles ("Who it's for")

Redesigned from 4 equal flat cards to a 2×2 grid with visual weight hierarchy.

| Zone | Content | Tokens / classes | styles.css lines |
|------|---------|-----------------|-----------------|
| Background | White | — | — |
| Section H2 | "Built for every person in your building" | `--color-royal-blue` h2 | line 49 |
| Admin card (primary) | Spans full left column (desktop). Larger card. Icon bg `--color-navy`. Title 20 px Poppins 700. 2-sentence description. "Owner / Operator" label (saffron pill). Saffron left-border `4px solid --color-saffron` matching `.sidebar-link.active` left-bar pattern. | navy line 6, saffron line 8 | 6, 8, 214–218 |
| Property Manager card | Top-right. Normal `.card` size. Icon bg `--color-royal-blue`. | royal-blue line 7 | 7 |
| Maintenance card | Bottom-right. Normal `.card` size. Icon bg `--color-slate`. | slate line 10 | 10 |
| Tenant card (spans bottom-left under Admin) | Partial span — same width as Admin column, shorter height. Icon bg `--color-saffron`. "Self-service portal" label. | saffron line 8 | 8 |
| Hover effect | `translateY(-2px)` + `--card-elevated` shadow. Same as current `.role-card:hover` (line 908 of styles.css). | `.role-card` | line 908 |
| Responsive reflow (≤ 1023 px) | 2×2 equal grid (no spanning). Admin card loses left-border accent at mobile to avoid visual imbalance in 1-col context. | — | — |

---

#### Section F — Subscription Plans

Unchanged in structure from the current `renderMarketingPlans("plansGrid")` call. Visual elevation only.

| Zone | Content | Tokens / classes | styles.css lines |
|------|---------|-----------------|-----------------|
| Background | `--color-light-gray` `#ECEFF1` (currently white — swapping background gives contrast vs. the white Roles section that precedes it). | light-gray line 11 | 11 |
| Section H2 | "Plans for every size" | royal-blue h2 | line 49 |
| Plan cards | Rendered by `renderMarketingPlans("plansGrid")` — no change to the JS. Standard card still gets `border: 2px solid --color-saffron` (already in plans.js line 59). | saffron line 8 | 8 |
| Elevation addition | Standard (popular) card gets a `box-shadow: 0 12px 40px rgba(255,111,0,0.18)` glow — uses `.modal` shadow pattern at saffron hue (`.modal` uses `rgba(0,0,0,0.2)` at line 873; color swapped to saffron at 18% opacity). | saffron line 8 | 8, 873 |
| Responsive reflow | ≤ 1023 px: 1-col stack, `max-width: 480px; margin: 0 auto`. Existing media query covers this. | — | lines 278 of current index |

---

#### Section G — Final CTA

| Zone | Content | Tokens / classes | styles.css lines |
|------|---------|-----------------|-----------------|
| Background | `--color-navy` (same as current). | navy line 6 | 6 |
| Separator from Plans section | `border-top: 1px solid rgba(255,255,255,0.08)` — same as `.sidebar-divider` (line 228). Eliminates the flush transition from light-gray Plans section to navy CTA. | line 228 | 228 |
| H2 | White, 40 px desktop / 28 px mobile. | white on navy | lines 48, 104 |
| Sub-headline | White/78, 17 px, max 520 px centered. Same as current. | — | line 221 |
| Primary CTA | `btn btn-primary` (`--color-saffron` bg). Gains a `box-shadow: 0 4px 20px rgba(255,111,0,0.40)` glow that vanishes on mobile (`prefers-reduced-motion` note: glow is a shadow, not animation, so no reduction needed — but should be suppressed on 120hz reduced motion for performance). | saffron line 8, btn lines 78–100 | 8, 78 |
| Secondary link | "Already have an account? Login" — same text, white/78 → white on hover. No change. | — | — |

---

#### Section H — Footer

| Zone | Content | Tokens / classes | styles.css lines |
|------|---------|-----------------|-----------------|
| Background | `--color-navy` | navy line 6 | 6 |
| Separation from Final CTA | The Final CTA and footer **share the same navy background** — eliminate the visual bump by removing the `border-top` between them. Instead, the footer gets a `padding-top: 0` and relies on the `© 2026` copyright line as the only break. The Final CTA section's `padding-bottom` is reduced from `80px` to `48px` to visually merge the two into one "closing band". | navy line 6, `--space-xl` = 48 px line 33 | 6, 33 |
| Logo + tagline | Unchanged. `Ghar` white + `Setu` saffron. Tagline white/65, 14 px, max 220 px. | saffron line 8 | 8 |
| Navigation columns | "Company" (About · Contact) + "Legal" (Privacy · Terms). Unchanged. | rgba(255,255,255,0.65) | — |
| Copyright line | `border-top: 1px solid rgba(255,255,255,0.08)`. Same as current. | — | lines 228 pattern |
| Responsive reflow | `flex-wrap: wrap` already present. No change needed. | — | — |

---

### 2.4 Copy / truthfulness note

The Trust strip stat values in Section B must be sourced from real deployment data:

- `120+ Units managed` — factual (CLAUDE.md header: "120 units / 18 buildings").
- `18 Buildings` — factual (same source).
- `4 Operational roles` — factual (Admin, Property Manager, Maintenance, Tenant — per Solution Overview v8 §New Roles section; Super Admin is not counted as it is platform-internal).

No testimonials, no customer logos, no fake social proof. The stat strip uses neutral fact framing clearly attributable to the platform's own documented deployment context.

> **No fake logos / testimonials rule:** If the product copy in Section B or D needs a "social proof" placeholder, use the format `[PLACEHOLDER: client quote — to be supplied]` clearly marked, never a fabricated quote. The stats above (`120+ · 18 · 4`) are facts grounded in CLAUDE.md and the Solution Overview — they are safe to use.

---

### 2.5 New CSS utilities / tokens required

These are additions to `prototype/assets/styles.css` (or an inline `<style>` block in `index.html`) composed entirely from existing color variables. No hex value below is invented.

```css
/* Glass navigation — applies when .nav-scrolled class is added by JS */
.nav-scrolled {
  background: rgba(26, 35, 126, 0.85) !important; /* --color-navy at 85% opacity */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom-color: rgba(255, 255, 255, 0.10); /* matches .account-menu border */
}

/* Hero gradient and mesh overlay */
.hero-gradient {
  background:
    radial-gradient(ellipse 80% 60% at 70% 50%, rgba(255, 111, 0, 0.08) 0%, transparent 70%),
    linear-gradient(135deg, #1A237E 0%, #0D1757 60%, #1565C0 100%);
  /* Colors: --color-navy, --color-royal-blue (lines 6, 7), saffron at 8% (line 8) */
}

/* Scroll-reveal base state — set on elements before IntersectionObserver fires */
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
/* Reduced-motion: skip transform entirely, only fade */
@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 0;
    transform: none;
    transition: opacity 0.3s ease;
  }
}

/* Capability feature row alternating layout */
.feature-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px; /* --space-xl */
  align-items: center;
}
.feature-row.reversed { direction: rtl; }
.feature-row.reversed > * { direction: ltr; }
@media (max-width: 1023px) {
  .feature-row, .feature-row.reversed {
    grid-template-columns: 1fr;
    direction: ltr;
    gap: 24px; /* --space-md */
  }
}

/* How-it-works step number pill */
.step-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 999px;
  background: rgba(255, 111, 0, 0.10); /* --color-saffron at 10% opacity */
  color: #FF6F00; /* --color-saffron, line 8 */
  font-family: 'Poppins', sans-serif;
  font-weight: 700;
  font-size: 16px;
}

/* Saffron eyebrow pill variant */
.eyebrow-pill {
  display: inline-block;
  background: rgba(255, 111, 0, 0.08);
  color: #FF6F00; /* --color-saffron, line 8 */
  font-family: 'Poppins', sans-serif;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 12px;
  border-radius: 999px;
}

/* Trust / stats strip inside hero */
.hero-stats-strip {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 20px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12); /* same as .sidebar-divider rgba pattern */
  flex-wrap: wrap;
}
.hero-stat {
  padding: 8px 32px 8px 0;
  border-right: 1px solid rgba(255, 255, 255, 0.15);
  margin-right: 32px;
  font-family: 'Poppins', sans-serif;
}
.hero-stat:last-child { border-right: none; margin-right: 0; }
.hero-stat-value {
  font-weight: 700;
  font-size: 24px;
  color: #fff;
  line-height: 1.2;
}
.hero-stat-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
  font-weight: 400;
}
@media (max-width: 1023px) {
  .hero-stats-strip { padding-top: 16px; }
  .hero-stat { padding: 6px 16px 6px 0; margin-right: 16px; }
  .hero-stat-value { font-size: 20px; }
}
@media (max-width: 480px) {
  .hero-stats-strip { display: none; } /* hidden entirely on very small screens */
}
```

---

### 2.6 Responsiveness at the single 1024 px breakpoint

This project enforces ONE breakpoint: `max-width: 1023px` (tablet + mobile). No new breakpoints are introduced.

| Section | Desktop (≥ 1024 px) | Mobile / tablet (≤ 1023 px) |
|---------|---------------------|------------------------------|
| Nav | Logo left · Login + Register pill right · glass-blur on scroll | Logo left · Login text only · Register pill hidden |
| Hero | Two-column (55/45 split). H1 60 px. Stats strip visible. | Single column. H1 36 px. Right product-mock panel hidden. Stats strip hidden at ≤ 480 px. |
| Capabilities | Alternating two-column feature rows | Single column — mock stacks above text each row |
| How-it-works | 3-col horizontal with dashed connector | Vertical timeline list with `.progress-timeline` connector |
| Roles | 2×2 CSS grid with Admin card spanning left column | 2×2 equal grid, Admin no longer spans |
| Plans | 3-col grid, `max-width: 900px` centered | 1-col stack, `max-width: 480px` centered |
| Final CTA | Centered, H2 40 px | H2 28 px, CTAs stack |
| Footer | Flex row — logo/tagline left, columns right | Flex column — logo/tagline top, columns below, wrap |

Minimum supported width: `320px`. The existing `max-w-6xl` container (`px-6` = 24px gutter each side) + the `@media (max-width: 359px) { padding-left: 16px !important }` rule already in `index.html` cover this.

---

### 2.7 Accessibility

| Concern | Treatment | Token / standard reference |
|---------|-----------|---------------------------|
| Contrast on hero gradient | White text on `#1A237E` navy = **14.0:1** (passes AAA). White text on `#1565C0` royal-blue (if any) = **8.6:1** (passes AA + AAA). Saffron on white used only for large-text elements (≥ 18 px bold or ≥ 24 px normal) where the 3:1 large-text threshold applies. | WCAG 2.1 §1.4.3 + §1.4.6 |
| Contrast on glass nav | `rgba(255,255,255,0.85)` white text on `rgba(26,35,126,0.85)` = effectively navy → ≥ 10:1. The `backdrop-filter` does not degrade the effective contrast because the background content (page) is always darker. | WCAG 2.1 §1.4.3 |
| Contrast on saffron eyebrow pill bg | `#FF6F00` text on `rgba(255,111,0,0.08)` ≈ `#FFF4EA` background = saffron on pale saffron tint. Ratio ≈ 3.5:1 at 12 px uppercase bold. **WCAG AA requires 4.5:1 for normal text; for uppercase bold 12 px this is borderline.** Mitigation: increase to `font-size: 13px` or change text color to `--color-charcoal` `#212121` on the pale saffron background (ratio 13.4:1). Implementer must verify in browser. | WCAG 2.1 §1.4.3 |
| Focus rings | Global `*:focus-visible` already sets `2px solid #FF6F00 / outline-offset: 2px` (styles.css line 880). All new interactive elements (nav pill CTA, feature row cards if made keyboard-focusable) inherit this rule. No override needed. | styles.css line 880 |
| Reduced motion | All `.reveal` scroll-triggered transitions check `@media (prefers-reduced-motion: reduce)` and remove `transform`, keeping only `opacity` fade. The `IntersectionObserver` callback checks `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and, if true, sets `element.classList.add('visible')` immediately for all observed elements (no deferred fade). | WCAG 2.1 §2.3.3 (AAA) / best practice |
| Semantic landmarks | One `<h1>` in hero. Each section has `<section aria-labelledby="...">` matching existing prototype pattern. No landmark is skipped. | WCAG 2.1 §1.3.1 |
| Skip link | Add `<a href="#main-content" class="sr-only focus:not-sr-only ...">Skip to main content</a>` as the first child of `<body>`. Hidden via Tailwind `sr-only`; revealed on focus. | WCAG 2.1 §2.4.1 |
| Touch targets | All interactive elements (nav links, CTAs, plan cards) remain ≥ 44×44 px per `.btn` min-height rule (line 126 `.input` min-height 44px sets precedent; buttons use `padding: 10px 24px` which at font-size 15 px gives ~42px height — verify 44px floor with explicit `min-height: 44px` on `.btn`). | styles.css line 126 |

---

### 2.8 Files to touch (this feature)

| File | Change |
|------|--------|
| `prototype/index.html` | Full visual redesign per §2.3 sections A–H. Replace flat grids with alternating feature rows, elevated hero, stats strip, glass nav JS, How-it-works section, role grid with span. Keep `renderMarketingPlans("plansGrid")` call unchanged. Keep all existing `<section aria-labelledby>` patterns. |
| `prototype/assets/styles.css` | Append new utilities from §2.5 (glass-nav, hero-gradient, reveal, feature-row, step-number, eyebrow-pill, hero-stats-strip). No existing rules modified. |
| `docs/planning/prototype-changes.md` | Row added on ship per Working rule §9. |

**Files NOT touched:** `prototype/assets/plans.js` · `prototype/login.html` · `prototype/organization-signup.html` · any `apps/web` or `apps/api` files (prototype-only change).

---

## 3. Test cases (designed up front)

| TC-ID       | Title | Pre-condition | Steps | Expected Result | Priority |
|-------------|-------|---------------|-------|-----------------|---------|
| TC-HOME-001 | All 9 sections render in correct order | `prototype/index.html` open at 1440 px | Scroll top-to-bottom | Nav · Hero · Trust strip (within hero) · Capabilities · How-it-works · Roles · Plans · Final CTA · Footer in this order | H |
| TC-HOME-002 | Hero H1 is 60 px at desktop | Viewport 1440 px | Inspect computed style of `<h1>` in hero | `font-size` computed value = 60 px | H |
| TC-HOME-003 | Hero H1 is 36 px at ≤ 1023 px | Viewport 768 px | Inspect computed style of `<h1>` | `font-size` computed value = 36 px | H |
| TC-HOME-004 | Right-side product mock visible at desktop, hidden at ≤ 1023 px | 1440 px then 768 px | Inspect hero right column visibility | Visible at 1440 px; `display: none` or equivalent at 768 px | H |
| TC-HOME-005 | Stats strip shows three stat values | Viewport 1440 px | Inspect hero stats strip | Three stat items: `120+`, `18`, `4` present with correct labels | M |
| TC-HOME-006 | Stats strip hidden at ≤ 480 px | Viewport 375 px | Inspect `.hero-stats-strip` | Element has `display: none` at 375 px | M |
| TC-HOME-007 | Plans render from `plans.js` unchanged | Landing open | Scroll to Plans section | Three cards: Basic · Standard (saffron `2px` border) · Premium — rendered by `renderMarketingPlans("plansGrid")`. Content matches `GHARSETU_PLANS` in `plans.js` line 23. | H |
| TC-HOME-008 | `renderMarketingPlans` call present and uncorrupted | Source inspection | Search HTML source for `renderMarketingPlans("plansGrid")` | Single call present, no modification to plans.js invocation | H |
| TC-HOME-009 | Capabilities section has 4 feature rows (not flat cards) | Viewport 1440 px | Inspect capabilities section | Four `.feature-row` (or equivalent) elements; alternating text-left/text-right orientation | H |
| TC-HOME-010 | How-it-works section has 3 steps | Viewport 1440 px | Scroll to How-it-works section | Three step items with numbered pill (`01`, `02`, `03`) in saffron | M |
| TC-HOME-011 | How-it-works reflows to vertical timeline at ≤ 1023 px | Viewport 768 px | Inspect layout | Vertical stacked list; horizontal connector hidden | M |
| TC-HOME-012 | Glass nav applies on scroll | Viewport 1440 px | Scroll past 60 px from top | Nav element gains `.nav-scrolled` class; background transitions to semi-transparent navy + blur | M |
| TC-HOME-013 | Glass nav does not apply before scroll | Viewport 1440 px | Inspect nav at `scrollY = 0` | Nav has white / solid background; `.nav-scrolled` absent | M |
| TC-HOME-014 | Scroll-reveal fires for capability rows | Viewport 1440 px | Scroll capabilities section into view | Elements transition from `opacity: 0 / translateY(24px)` to `opacity: 1 / translateY(0)` | M |
| TC-HOME-015 | Reduced-motion: reveals fire immediately | Enable `prefers-reduced-motion: reduce` in DevTools | Reload and scroll | `.reveal` elements are immediately `.visible` — no animated transform; elements appear without delay | H |
| TC-HOME-016 | Responsive at 320 px | Viewport 320 px | Reload + scroll | No horizontal scroll; hero single-col; H1 ≤ 36 px; CTAs stack full-width; touch targets ≥ 44×44 px | H |
| TC-HOME-017 | Responsive at 768 px | Viewport 768 px | Reload + scroll | Mobile layout: single-col capabilities, vertical how-it-works, 2×2 roles, 1-col plans | H |
| TC-HOME-018 | Responsive at 1024 px | Viewport 1024 px | Reload + scroll | Desktop layout: two-col hero, alternating feature rows, how-it-works 3-col, roles 2×2, plans 3-col | H |
| TC-HOME-019 | Responsive at 1440 px | Viewport 1440 px | Reload + scroll | Content capped to `max-w-6xl`; no edge-stretched typography; hero mock visible | M |
| TC-HOME-020 | Keyboard nav — full Tab traversal | Viewport 1440 px | Tab from address bar through all interactive elements to last footer link | Saffron 2 px focus ring visible on every focused element; no trapped focus; tab order follows DOM order | H |
| TC-HOME-021 | Contrast — white on navy hero | Viewport 1440 px | Use axe DevTools or color-contrast checker on hero H1 | Contrast ratio ≥ 7:1 (AAA) for white `#FFFFFF` on `#1A237E` | H |
| TC-HOME-022 | Eyebrow pill contrast check | Viewport 1440 px | Inspect `.eyebrow-pill` text color vs background | Text meets WCAG AA (4.5:1) — if saffron on pale saffron tint fails, verify fallback to `--color-charcoal` (#212121) per §2.7 mitigation | H |

---

## 4. Open design decisions

The following four decisions require user or lead input before implementation starts. Defaults are provided for each; defaults will be used if no answer is received within one working day.

| # | Decision | Options | Default if no answer |
|---|----------|---------|---------------------|
| OD-1 | **Hero right-side visual:** product screenshot / device mock vs. abstract gradient mesh only | A) Schematic "dashboard" mock built from real `.kpi` + `.badge` + `.data-table` markup atoms (no custom imagery, brands consistently with the product). B) Abstract navy + saffron gradient mesh, no product mock (simpler, faster to build, avoids the risk of the mock looking amateur). C) Device frame (laptop SVG) containing a static screenshot of the dashboard — most compelling but requires a real or designed screenshot asset. | **Option A** — schematic product mock using existing CSS components |
| OD-2 | **Keep role-preview cards or fold into "who it's for" prose** | A) Redesigned 2×2 role grid with Admin card spanning left column (as designed in §2.3 Section E). B) Replace role cards entirely with a simple two-column list: left = role name + icon, right = one-sentence description. C) Fold roles into a single "For property owners and their entire team" paragraph, removing the section. | **Option A** — redesigned 2×2 grid retains section E as planned |
| OD-3 | **Light hero vs. navy hero** | A) Keep navy hero (consistent with current brand; high contrast; authoritative). B) Switch hero to a light-mode gradient (`off-white` → `light-gray`) with navy text and a saffron CTA — more contemporary "AI-era" palette. C) Navy with a significantly larger saffron mesh glow (50%+ of hero area) to warm the coldness of navy. | **Option A** — navy hero with the gradient mesh overlay at 8% saffron opacity as planned in §2.5 |
| OD-4 | **Stats / social-proof band** | A) Trust strip with factual stats (`120+ units · 18 buildings · 4 roles`) inside the hero bottom edge as designed in Section B. B) Separate full-width light-gray strip between hero and capabilities (visually more prominent). C) No stats band at all — keep the page clean, avoid over-claiming. | **Option A** — stats strip inside hero bottom edge, hidden at ≤ 480 px |
| OD-5 | **Capabilities presentation** | A) Alternating two-column feature rows (text + product mock, one per feature) as designed in Section C. B) Keep flat 4-card grid but with larger cards, more padding, and a horizontal scroll carousel on mobile. C) Two large feature cards (desktop 2-col) each aggregating two related capabilities (Rent + Leases; Maintenance + Visitors). | **Option A** — alternating rows as planned |
| OD-6 | **Navigation Register pill button** | A) Add compact `Register` saffron pill to the top-right nav alongside Login (hidden on mobile). B) Keep Login-only nav; rely on hero CTA for registration. | **Option B** — Login-only nav (matches existing `2026-05-26-landing-page-saas.md` §2.3 §1 decision to keep nav minimal) |

---

## 5. Execution log

| Date | Agent | Entry |
|------|-------|-------|
| 2026-05-27 | gharsetu-lead | Planning file created. §2 Plan complete, §3 Test cases complete, §4 open decisions documented. Awaiting user answers on OD-1..OD-6 before implementation dispatch to `gharsetu-frontend`. |
| 2026-05-27 | (orchestrator) | User said "implement the home page new design plan" — built `prototype/index.html` per §2.3 A–H. **Open-decision resolutions:** OD-1 → A (schematic dashboard mock from `.kpi`/`.badge`/`.mock-table` atoms); OD-2 → A (bento role grid, Admin emphasized — implemented as a clean emphasized 2×2 rather than a row-span to avoid the §2.3-E height contradiction); OD-3 → A (navy gradient hero); OD-4 → A (stats strip inside hero, hidden ≤480px); OD-5 → A (alternating feature rows). **OD-6 → A (Register pill in nav), overriding the documented default B** — rationale: a nav CTA materially serves the user's "AI-era modern" goal, the pill is hidden ≤1023px so mobile nav stays minimal, and the logo/Login switch to white under the navy glass-nav state for contrast. New CSS lives in an inline `<style>` block in `index.html` (allowed by §2.5), not `styles.css`, to keep landing-only rules out of the shared sheet. |

---

## 6. Files changed

| File | Change | Touched by |
|------|--------|------------|
| `docs/planning/features/2026-05-27-homepage-redesign.md` | Planning file created; status → shipped; OD resolutions logged | gharsetu-lead / orchestrator |
| `prototype/index.html` | Full visual redesign — glass nav, gradient hero + product mock + stats strip, alternating capability rows, how-it-works, bento role grid, plans (light-gray bg + popular-card glow), merged navy CTA/footer, scroll-reveal + glass-nav JS, reduced-motion handling, skip link. `renderMarketingPlans("plansGrid")` preserved unchanged. New utilities in inline `<style>` (not `styles.css`). | orchestrator |
| `docs/planning/prototype-changes.md` | Row appended | orchestrator |

---

## 7. Agents used

| Agent | Task | Status |
|-------|------|--------|
| gharsetu-lead | Planning, critique, section IA, token grounding, test cases, open decisions | in-progress |
| gharsetu-frontend | Visual implementation of `prototype/index.html` per §2.3 + §2.5 | not started |

---

## 8. Post-deploy

(Empty — not yet shipped.)

---

## 9. Cross-references

- **`docs/planning/features/2026-05-26-landing-page-saas.md`** — predecessor planning file: established SAAS structural content, 8 sections, copy direction, plan cards. This file extends visual quality only; structural decisions there still apply.
- **`prototype/assets/styles.css`** — all design tokens cited by line number throughout §2. Nothing invented.
- **`prototype/assets/plans.js`** — `renderMarketingPlans("plansGrid")` call preserved unchanged (line 54 of plans.js).
- **`prototype/index.html`** — the file this plan targets.
- **`docs/product/Solution_Overview.docx`** — stat values in trust strip (`120+ units`, `18 buildings`) grounded here and in CLAUDE.md header.
- **CLAUDE.md Working rule #2** — planning file precedes code. This file fulfills that condition.
- **CLAUDE.md Working rule #9** — prototype stays in sync; `docs/planning/prototype-changes.md` row to be added on ship.
- **CLAUDE.md Scope rule I** — prototype tokens port verbatim to `tailwind.config.ts`; all token references in this plan are verbatim from `styles.css`.
- **CLAUDE.md Technical convention #16** — no native browser validation tooltips; no new forms introduced on the landing page.
- **WCAG 2.1** — §1.4.3 (contrast), §1.4.6 (enhanced contrast), §2.3.3 (animation), §2.4.1 (bypass blocks), §1.3.1 (info and relationships).
