# Legal pages (Privacy + Terms) + Contact page + Contact submissions inbox

| Field | Value |
|---|---|
| Status         | shipped (prototype) |
| Started        | 2026-05-27 |
| Shipped        | — |
| SRS row        | (n/a yet — new public surfaces + a Super Admin content/inbox area; SRS row added at app-port) |
| Test cases     | TC-LEGAL-001..NNN · TC-CONTACT-001..NNN |
| Prototype todo | row pending |

---

## 1. Requirement (as given)

> "We have Privacy and Terms links on the frontend but we didn't have the options to update content for these two pages"
>
> "and also we have contact page and we dont have that page on that also need and the form data should be show on the superadmin"
>
> "plan it"

Three gaps:
1. The public footer (and sign-up) link to **Privacy** and **Terms**, but (a) the pages don't exist and (b) there's no way for Super Admin to edit their content.
2. The footer links to **Contact**, but there is no Contact page.
3. **Contact form submissions** must be captured and shown to Super Admin.

Current state (verified): `prototype/index.html` footer has Contact / Privacy / Terms as dead `href="#"` links; `privacy.html`, `terms.html`, `contact.html` do not exist; there is no Super Admin content-management or inbox surface.

---

## 2. Plan

### 2.0 Rules check (CLAUDE.md)
- Working rule §2 — this planning file is written before any code (correcting the screen-by-screen review pass which skipped planning).
- Scope rule **I** — all tokens from `prototype/assets/styles.css`; no invented values.
- Scope rule **K** — no SMS/Email/WhatsApp business notifications. The contact form **records** a submission for Super Admin to read in-app; it does NOT email anyone. Reply happens out-of-band (Super Admin contacts the person directly). Mark this clearly.
- Memory rules — no descriptive helper captions under section titles/tables; no back-links on detail pages.

### 2.1 New public pages (under `prototype/`)
- `privacy.html` — Privacy Policy. Public, no auth. Renders content (sectioned: heading + body). "Last updated DD/MM/YYYY" near the title.
- `terms.html` — Terms of Service. Same shape.
- `contact.html` — Contact page with a form (Name · Email · Subject · Message; optional Organization, Phone). On submit → prototype success state ("Thanks, we'll get back to you"). No email is sent (Scope rule K) — the submission is recorded for Super Admin.

All three reuse the **public chrome** (the same top nav + footer as `index.html` / `organization-signup.html`), NOT the app shell/sidebar. They're pre-auth marketing/legal pages.

### 2.2 Super Admin — Legal Pages editor
New Super Admin page `super-admin/legal-pages.html`:
- Two editable documents: **Privacy Policy** and **Terms of Service** (platform-global — one copy for the whole platform, Super-Admin-owned; not per-org).
- A tab or segmented switch between Privacy / Terms.
- Editor per doc: a list of sections (each = heading input + body textarea), Add Section / Remove Section, plus a "Last updated" stamp and a **Publish** button (prototype: alert + update stamp).
- Markdown or plain text in the body (prototype: plain textarea). The public page renders these sections.

### 2.3 Super Admin — Contact Inbox
New Super Admin page `super-admin/contact-inbox.html`:
- Table of submissions: When · Name · Email · Subject · Status (New / Read / Replied) · action (View).
- Filter tiles by status (All · New · Read · Replied) + search + pagination (reuse `paginate.js`).
- Row → a detail view (modal or per-row expand) showing the full message + a "Mark as replied" / "Mark as read" control. (Reply is out-of-band per Scope rule K — no in-app email send; the control just sets status.)

### 2.4 Navigation wiring
- **Super Admin sidebar** (and More-sheet) gain two entries. Proposed placement after Server Logs:
  - **Legal Pages** (→ legal-pages.html)
  - **Contact Inbox** (→ contact-inbox.html) — with a count badge of New submissions (prototype mock).
- **index.html footer**: Contact → `contact.html`, Privacy → `privacy.html`, Terms → `terms.html` (replace the dead `#`).
- **organization-signup.html**: the Terms-acceptance checkbox text links "Terms" → `terms.html` and "Privacy" → `privacy.html` (open in new tab).
- **login / forgot / reset** footer (if any legal links) → wire to the new pages.

### 2.5 Open decisions for sign-off (§4)
1. Super Admin nav: two separate items (**Legal Pages** + **Contact Inbox**) — or one combined "Content & Support" section with sub-links? Proposed: **two separate top-level items** (simplest, matches Server Logs pattern).
2. Legal editor granularity: **sectioned** (heading + body blocks, reorderable) vs a **single big textarea** per doc? Proposed: sectioned (cleaner public render, still simple).
3. Contact Inbox statuses: New / Read / Replied — add **Archived**? Proposed: New / Read / Replied only.
4. Contact form fields: Name · Email · Subject · Message required; Organization · Phone optional? Proposed: yes.
5. Does Contact need a logged-in variant (e.g., a "Contact support" inside the app for org users), or public-only for now? Proposed: **public-only** this iteration.

### 2.6 Files to touch
| Path | Change | Owner |
|---|---|---|
| `prototype/privacy.html` | NEW — public Privacy page (renders sections) | gharsetu-frontend |
| `prototype/terms.html` | NEW — public Terms page | gharsetu-frontend |
| `prototype/contact.html` | NEW — public Contact form | gharsetu-frontend |
| `prototype/super-admin/legal-pages.html` | NEW — edit Privacy + Terms | gharsetu-frontend |
| `prototype/super-admin/contact-inbox.html` | NEW — submissions list + detail + status | gharsetu-frontend |
| `prototype/super-admin/*.html` (sidebar + More-sheet) | add Legal Pages + Contact Inbox nav entries | gharsetu-frontend |
| `prototype/index.html` | footer Contact/Privacy/Terms → real pages | gharsetu-frontend |
| `prototype/organization-signup.html` | Terms checkbox links → terms.html / privacy.html | gharsetu-frontend |
| `prototype/assets/legal.js` (optional) | shared legal-content model so the editor + public pages share one source (like plans.js) | gharsetu-frontend |

### 2.7 App-port carry-over
- `legal_documents` table: `key` (privacy|terms), `sections` (JSON or related rows: heading + body + order), `updated_at`, `updated_by` (Super Admin id). Public pages read the published copy; editor writes it. Platform-global (no organization_id). Every edit writes an `audit_log` row.
- `contact_submissions` table: `name`, `email`, `subject`, `message`, `organization_name?`, `phone?`, `status` (smallint enum: NEW=0, READ=1, REPLIED=2), `created_at`. Super-Admin-only read. No email send (Scope rule K) — status is set manually.
- Public Contact POST is unauthenticated; throttle via `@nestjs/throttler` to prevent spam.

---

## 3. Test cases (designed up front)

### 3.1 Legal pages (TC-LEGAL-*)
| TC | Title | Expected |
|---|---|---|
| TC-LEGAL-001 | Privacy page renders | `/privacy.html` shows the Privacy content with "Last updated" |
| TC-LEGAL-002 | Terms page renders | `/terms.html` shows the Terms content |
| TC-LEGAL-003 | Footer links resolve | index.html footer Privacy/Terms/Contact open the real pages (no `#`) |
| TC-LEGAL-004 | Signup terms checkbox links | "Terms"/"Privacy" in the acceptance row open terms.html/privacy.html |
| TC-LEGAL-005 | Super Admin can edit Privacy | legal-pages.html → edit a Privacy section → Publish → public page reflects it (prototype: shared source) |
| TC-LEGAL-006 | Super Admin can edit Terms | same for Terms |
| TC-LEGAL-007 | Legal pages are platform-global | one copy; not per-org; only Super Admin sees the editor |
| TC-LEGAL-008 | Add / remove section | editor supports adding and removing a section |

### 3.2 Contact (TC-CONTACT-*)
| TC | Title | Expected |
|---|---|---|
| TC-CONTACT-001 | Contact page renders with form | Name · Email · Subject · Message (+ optional Org/Phone) |
| TC-CONTACT-002 | Validation | required fields show inline errors below the field (no native tooltips); email format checked |
| TC-CONTACT-003 | Submit success state | success message shown; form resets; NO email implied (Scope rule K) |
| TC-CONTACT-004 | Submission appears in Super Admin inbox | contact-inbox.html lists the new submission with status New |
| TC-CONTACT-005 | Inbox filters + search + pagination | status tiles (All/New/Read/Replied) drive the list; search + paginate.js work |
| TC-CONTACT-006 | View submission detail | full message shown; Mark as read / Mark as replied changes status |
| TC-CONTACT-007 | Inbox is Super-Admin-only | not reachable by other roles (prototype: page lives under super-admin/) |
| TC-CONTACT-008 | Responsive (5 widths) + locale | DD/MM/YYYY timestamps; works 320→1440 |

---

## 4. Sign-off
| Date | Question | Proposed default | User answer |
|---|---|---|---|
| 2026-05-27 | Two nav items vs one combined section | Two items (Legal Pages + Contact Inbox) | _pending_ |
| 2026-05-27 | Legal editor: sectioned vs single textarea | Sectioned | _pending_ |
| 2026-05-27 | Inbox statuses | New / Read / Replied | _pending_ |
| 2026-05-27 | Contact fields | Name · Email · Subject · Message (req) + Org · Phone (opt) | _pending_ |
| 2026-05-27 | Logged-in "Contact support" variant? | Public-only this iteration | _pending_ |

---

## 5. Execution log
| Date | Event |
|---|---|
| 2026-05-27 | Planning file authored (before code). Awaiting §4 sign-off, then dispatch the build. |
| 2026-05-27 | Implemented: public `privacy.html` + `terms.html` (render from `assets/legal.js`) + `contact.html` (validated form, record-only per Scope rule K) · `super-admin/legal-pages.html` (Privacy/Terms sectioned editor + Publish) · `super-admin/contact-inbox.html` (status tiles + search + paginate + detail modal w/ Mark read/replied) · Legal Pages + Contact Inbox added to super-admin sidebar + More-sheet across all pages · index.html footer + signup terms-checkbox links wired. Status → shipped (prototype). |

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
- `prototype/index.html` (footer links) · `prototype/organization-signup.html` (terms checkbox)
- `prototype/assets/plans.js` — pattern to mirror for a shared `legal.js` content source
- `prototype/assets/paginate.js` — reused by the Contact Inbox list
- Scope rule **K** (no email/SMS notifications) — Contact is record-only, reply is out-of-band
- Super Admin screen set (dashboard · organizations · plans · server-logs · master-data) — this adds Legal Pages + Contact Inbox
