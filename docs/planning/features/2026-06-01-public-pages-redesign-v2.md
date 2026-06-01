# Public Pages Redesign v2 — Glassmorphism / Bento (Hybrid)

**Date:** 2026-06-01
**Area:** `prototype/` public surface (8 pages) + shared chrome/auth styles
**Type:** Visual refresh — no new features, no business-rule changes
**Source:** Google Stitch mockup (homepage) supplied by client, adapted to the GharSetu design contract.

## 1. Goal

Refresh the look of all public-facing pages with a modern **glassmorphism + bento** treatment,
while staying 100% on the existing GharSetu design system. Decision (confirmed with user):

- **Fidelity: Hybrid** — take the Stitch *layout* (bento capability grid, persona grid,
  numbered steps, gradient hero, glass cards, ambient blobs) but render it in GharSetu's own
  **Poppins + Inter** fonts and **navy / royal-blue / saffron** tokens. No Manrope/Hanken,
  no Material-3 token names, no external Stitch image URLs, no WebGL shader.
- **Scope: All public pages** — `index`, `login`, `organization-signup`, `forgot-password`,
  `reset-password`, `contact`, `privacy`, `terms`.
- **Pricing: keep `plans.js`** — marketing cards still render from `renderMarketingPlans`
  (single source shared with sign-up + Super Admin).

## 2. Plan

### Shared (`assets/styles.css`) — benefits multiple pages from one edit
- Enhance `.auth-shell`: navy gradient + saffron radial mesh + decorative ambient blobs
  (`::before`/`::after`), `position:relative; overflow:hidden`. Covers login, forgot, reset, signup.
- Enhance `.auth-card`: 16px radius, layered shadow, thin saffron top accent, `z-index:1`.
- Add shared `.public-band` (slim navy+mesh title header) and `.glass-panel` (frosted content card)
  for contact / privacy / terms.
- All new values **compose existing `:root` tokens** — nothing invented (Scope rule I / FE rule).

### Homepage (`index.html`) — landing-only inline `<style>` (existing pattern)
- Sticky glass nav (shared chrome, unchanged).
- Hero: navy gradient + saffron mesh, copy left, **CSS-built browser-framed dashboard mock**
  (keep — no external images), float animation, stats strip (120+ / 18 / 4).
- **Bento capability grid** (12-col): Rent 7 · Maintenance 5 · Leases 5 · Visitors 7, glass cards,
  eyebrow pills, CSS mini-mocks (no external images).
- **How it works**: navy band, 3 saffron circular numbered badges.
- **Personas**: 5 cards — Admin (emphasized), Property Manager, Tenant, Maintenance, **Security Guard**
  (matches the 5 operational roles now in the prototype; Super Admin is platform-level, omitted).
- **Pricing**: `renderMarketingPlans` (unchanged source), section lightly glass-framed.
- **Final CTA**: navy rounded panel + ambient blobs, merges toward footer (shared chrome).
- `IntersectionObserver` reveal + `prefers-reduced-motion` handling + skip link retained.

### Auth pages
- Inherit `.auth-shell` / `.auth-card` upgrade automatically. No structural change.
- Verify password toggle, role shortcuts strip, and validation contract still render correctly.

### Legal/contact
- Add `.public-band` title header + wrap body content in `.glass-panel`.

## 3. Non-negotiables carried through
- Poppins+Inter only · navy/royal-blue/saffron tokens only · DD/MM/YYYY · ₹ Indian grouping.
- Single 1023px breakpoint · 44px touch targets · WCAG AA contrast (saffron on large only).
- Errors below field, ⚠ glyph, no native tooltips (validation.js unchanged).
- No external image hosts (Stitch `lh3.googleusercontent.com` URLs dropped — CSS mocks instead).
- No new fonts, no new brand colours, no WebGL.

## 4. Files changed
- `prototype/assets/styles.css` — auth-shell/auth-card upgrade + `.public-band` / `.glass-panel`.
- `prototype/index.html` — full hybrid rebuild.
- `prototype/contact.html`, `prototype/privacy.html`, `prototype/terms.html` — band + glass panel.
- `prototype/login.html`, `forgot-password.html`, `reset-password.html`, `organization-signup.html` —
  inherit shared upgrade; minor verification only.
- `docs/planning/prototype-changes.md` — log row.

## 5. Execution log
- 2026-06-01 — planning file created.
- 2026-06-01 — **COMPLETED.** All 8 public pages shipped (light-forward glass, hybrid token mapping). Mid-build the full Stitch kit (`stitch_modern_design_overhaul/`) confirmed the design is light-surface-forward; hero + auth flipped navy→light accordingly. Cool-blue surface tokens added to `styles.css`. Icons inline-SVG. Verified: JS parses, no external image/font deps. Logs: `agent-team-change-logs/gharsetu-frontend-2026-06-01.md` (Task 7) + `docs/planning/prototype-changes.md`.
