// ─────────────────────────────────────────────────────────────────────────────
// generate_design_document.js
// ─────────────────────────────────────────────────────────────────────────────
// Source-of-truth generator for docs/product/UIUX_Design_Document.docx
//
// v3 — UI/UX Design Document.
// This is the design spec that the prototype builds against. It contains
// ONLY UI/UX content — no database schema, no API design, no auth code,
// no system architecture. Engineering / system docs live elsewhere.
//
// Scope is aligned with Solution_Overview.docx v8 (final close 2026-05-26):
// Super Admin role, Impersonation, Delegation, Master Data, Settings,
// Visitor Management, SAAS / Organization Management. Pages that do not
// yet exist in the prototype are listed here as scope for the next build.
//
// Per Rule 28: this JS is the source of truth. Never hand-edit the .docx.
// Regenerate with:
//     node doc-assets/templates/generate_design_document.js
// or
//     npm --prefix doc-assets run build:design
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, AlignmentType,
        LevelFormat, BorderStyle, Table, TableRow, TableCell, WidthType,
        ShadingType, Header, Footer, PageNumber, TableLayoutType,
        PageBreak } = require('docx');

const OUTPUT_PATH = path.resolve(__dirname, '..', '..', 'docs', 'product', 'UIUX_Design_Document.docx');

// ─────────────────────────────────────────────────────────────────────────────
// Brand palette — aligned with the .docx family + prototype/assets/styles.css
// ─────────────────────────────────────────────────────────────────────────────
const COLOR = {
  navy: '1A237E', royalBlue: '1565C0', saffron: 'FF6F00',
  charcoal: '212121', slate: '546E7A', white: 'FFFFFF', red: 'C62828',
  bannerNavy: '1A237E', bannerLight: 'E8EDF7', calloutFill: 'F1F4FA',
  saffronWash: 'FFF4E6', tableHeadNavy: '1A237E', tableStripe: 'F4F6FB',
  border: 'CFD8DC',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const r = (text, opts = {}) => new TextRun({
  text, bold: opts.bold || false, italics: opts.italics || false,
  color: opts.color || COLOR.charcoal, size: opts.size || 22, font: opts.font || 'Arial',
});
const bn = (text) => r(text, { bold: true, color: COLOR.navy });
const spacer = (after = 120) => new Paragraph({ spacing: { before: 0, after }, children: [new TextRun('')] });
const body = (runs, opts = {}) => new Paragraph({
  alignment: opts.alignment,
  spacing: { before: opts.before ?? 0, after: opts.after ?? 120 },
  children: Array.isArray(runs) ? runs : [r(runs)],
});
const bullet = (runs, opts = {}) => new Paragraph({
  numbering: { reference: 'dd-bullets', level: 0 },
  spacing: { before: 0, after: opts.after ?? 80 },
  children: Array.isArray(runs) ? runs : [r(runs)],
});
const capsLabel = (text) => new Paragraph({
  spacing: { before: 200, after: 80 },
  children: [new TextRun({ text: text.toUpperCase(), bold: true, color: COLOR.saffron, size: 20, font: 'Arial', characterSpacing: 20 })],
});
const solidBanner = (text) => new Paragraph({
  spacing: { before: 0, after: 280 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR.saffron, space: 1 } },
  children: [new TextRun({ text, bold: true, size: 40, color: COLOR.navy, font: 'Arial' })],
});

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: COLOR.border };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const headerCell = (text, width) => new TableCell({
  borders: cellBorders, width: { size: width, type: WidthType.DXA },
  shading: { fill: COLOR.tableHeadNavy, type: ShadingType.CLEAR },
  margins: { top: 100, bottom: 100, left: 140, right: 140 },
  children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text, bold: true, color: COLOR.white, size: 20, font: 'Arial' })] })],
});
const bodyCell = (text, width, opts = {}) => new TableCell({
  borders: cellBorders, width: { size: width, type: WidthType.DXA },
  shading: opts.stripe ? { fill: COLOR.tableStripe, type: ShadingType.CLEAR } : undefined,
  margins: { top: 90, bottom: 90, left: 140, right: 140 },
  children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun({ text, bold: !!opts.bold, color: opts.color || COLOR.charcoal, size: 20, font: 'Arial' })] })],
});
const colorSwatchCell = (hex, width) => new TableCell({
  borders: cellBorders, width: { size: width, type: WidthType.DXA },
  shading: { fill: hex.replace('#', ''), type: ShadingType.CLEAR },
  margins: { top: 200, bottom: 200, left: 140, right: 140 },
  children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: [new TextRun('')] })],
});

// Monospace pre-formatted line (for ASCII wireframes)
const pre = (text, opts = {}) => new Paragraph({
  spacing: { before: 0, after: opts.after ?? 0, line: 240 },
  children: [new TextRun({
    text: text || ' ', // empty lines need a space so Word doesn't collapse them
    font: 'Courier New', size: 16, color: COLOR.charcoal,
  })],
});

const renderTable = (columnWidths, headers, rows) => new Table({
  width: { size: columnWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
  columnWidths,
  layout: TableLayoutType.FIXED,
  rows: [
    new TableRow({ tableHeader: true, children: headers.map((h, i) => headerCell(h, columnWidths[i])) }),
    ...rows.map((row, i) => new TableRow({
      children: row.map((v, c) => bodyCell(v, columnWidths[c], { bold: c === 0, color: c === 0 ? COLOR.navy : COLOR.charcoal, stripe: i % 2 === 1 })),
    })),
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// §1 — Design Principles
// ─────────────────────────────────────────────────────────────────────────────
const PRINCIPLES = [
  [bn('Trustworthy, simple, Delhi-first '), r('— the brand voice is calm and operational; nothing flashy. Visual weight goes to data, not chrome.')],
  [bn('Mid-range Android is the primary target '), r('— every screen must work on a 360 × 640 viewport with no horizontal scroll, no native browser tooltips, and no hover-only affordances.')],
  [bn('One layout per page, no exceptions '), r('— the layout shifts at exactly 1024 px. There is no tablet-specific or "comfortable" middle state.')],
  [bn('Fluid from 320 px to 1440 px+ '), r('— every page renders without horizontal scroll, content cut-off or broken touch targets at any viewport width between 320 px (smallest supported mobile) and 1440 px+ (large desktop). Components transform predictably at the breakpoint per the §3 responsive-transformations table; nothing layout-shifts on resize.')],
  [bn('Errors live below the field '), r('— form validation messages render below the input that produced them, never as a native browser tooltip. Format is fixed: red 14 px, prefixed with the ⚠ glyph.')],
  [bn('No hamburger menu '), r('— navigation is always visible: sidebar above the breakpoint, bottom tab bar below it. The tab bar holds at most five items; the rest live in a MoreSheet that slides up.')],
  [bn('Role first, scope second '), r('— every page is owned by exactly one role. The same data may appear under different roles, but the screen, navigation, and primary actions are tailored to the role.')],
  [bn('Three route classes '), r('— routes are partitioned by their dependency on an organization context. (1) ')  , bn('Org-scoped routes '), r('carry the organization slug as the first path segment (for example, /acme/dashboard, /acme/users, /acme/maintenance). The slug names which organization the user is operating inside; the role determines which variant of the page renders. (2) '), bn('Platform routes '), r('(Super Admin only — cross-organization by definition) and (3) '), bn('Public routes '), r('(landing, login, password reset, organization sign-up) carry no slug and behave like flat top-level paths. The prototype\'s per-role folder structure (prototype/admin/, prototype/pm/, …) is a design-time convenience only; the live application does not mirror it.')],
  [bn('Locale baked in '), r('— times in Asia/Kolkata, dates in DD/MM/YYYY, money in ₹ with Indian digit grouping. Midnight renders as 00:00 — never 24:00.')],
  [bn('Accessibility is a floor, not a goal '), r('— WCAG 2.1 AA contrast and keyboard navigation are non-negotiable. Every interactive element is reachable with Tab; focus rings are never removed.')],
];

// ─────────────────────────────────────────────────────────────────────────────
// §2 — Design Tokens (from prototype/assets/styles.css)
// ─────────────────────────────────────────────────────────────────────────────
const TOKENS_BRAND = [
  ['Navy', '#1A237E', 'Primary brand · headings · sidebars · primary CTAs'],
  ['Royal Blue', '#1565C0', 'Secondary brand · sub-headings · emphasis links'],
  ['Saffron', '#FF6F00', 'Accent · active indicators · hairlines · highlights'],
  ['Charcoal', '#212121', 'Body text (primary)'],
  ['Slate', '#546E7A', 'Body text (secondary) · placeholders · meta'],
  ['Off-white', '#F8F9FA', 'Page background'],
  ['Light gray', '#ECEFF1', 'Section dividers · disabled fills'],
  ['Mid gray', '#CFD8DC', 'Borders · subtle separators'],
];
const TOKENS_STATUS = [
  ['Paid / Active / Resolved', '#2E7D32', '#E8F5E9'],
  ['Partial / Open', '#F57F17', '#FFF8E1'],
  ['Overdue / Terminated / Emergency', '#C62828', '#FFEBEE'],
  ['Prepaid / In Progress / Renewed', '#0277BD', '#E3F2FD'],
  ['Closed', '#546E7A', '#ECEFF1'],
];
const TOKENS_TYPOGRAPHY = [
  ['Display / H1',  'Poppins', '700 bold',     '40 px', '28 px', '1.3'],
  ['H2',            'Poppins', '600 semibold', '28 px', '22 px', '1.3'],
  ['H3',            'Poppins', '600 semibold', '20 px', '18 px', '1.3'],
  ['Body',          'Inter',   '400 regular',  '16 px', '15 px', '1.6'],
  ['Body small',    'Inter',   '400 regular',  '14 px', '13 px', '1.55'],
  ['Table / Data',  'Inter',   '400 regular',  '14 px', '13 px', '1.5'],
  ['Labels / Meta', 'Inter',   '500 medium',   '13 px', '12 px', '1.4'],
  ['Caption',       'Inter',   '400 regular',  '12 px', '11 px', '1.4'],
  ['Badge',         'Poppins', '600 semibold', '12 px (UPPERCASE, 0.4 px tracking)', '12 px', '1.2'],
  ['Button',        'Poppins', '600 semibold', '15 px', '14 px', '1.2'],
];

// Color usage rules (where each brand color is allowed)
const COLOR_USAGE_RULES = [
  [bn('Saffron (#FF6F00) '), r('— used sparingly. Only on CTA buttons, active-state indicators (sidebar accent, tabbar accent), focus outlines, and brand marks. Never as a fill behind large blocks of text.')],
  [bn('Navy (#1A237E) '), r('— sidebar background, page headers, dark section backgrounds, and as the heading colour for H1 / page titles.')],
  [bn('Royal Blue (#1565C0) '), r('— H2 headings, in-progress / prepaid status, secondary-button border and text, input focus border, emphasis links.')],
  [bn('Slate (#546E7A) '), r('— all body text and meta. Easier on the eye than pure black for daily long-form use.')],
  [bn('Off-white (#F8F9FA) '), r('— page background. Feels like paper; never use pure #FFFFFF as the page background.')],
];

// Readability settings (line height, paragraph rhythm, reading width)
const READABILITY_RULES = [
  ['Body line height',       '1.6'],
  ['Headings line height',   '1.3'],
  ['Table / data line height','1.5'],
  ['Paragraph spacing',      '1.4 em between paragraphs'],
  ['Max reading line length','680 px (text columns wider than this should wrap or be split)'],
  ['Date format',            'DD/MM/YYYY everywhere'],
  ['Time format',            'HH:mm in Asia/Kolkata (24-hour); midnight renders as 00:00 — never 24:00'],
  ['Currency format',        '₹ prefix · Indian digit grouping (en-IN) · no decimal places for whole rupees'],
];
const TOKENS_SPACING = [
  ['xs', '8 px', 'Tight gaps inside dense controls (badge padding, table cell padding)'],
  ['sm', '16 px', 'Default form-field gap, card inner padding'],
  ['md', '24 px', 'Section block gap, card section padding'],
  ['lg', '32 px', 'Top-level container padding'],
  ['xl', '48 px', 'Page-level vertical rhythm'],
  ['2xl', '64 px', 'Hero / banner padding'],
];
const TOKENS_RADIUS_SHADOW = [
  ['Radius — focus outline', '4 px',   'The 2 px saffron outline-offset focus ring'],
  ['Radius — control',       '6 px',   'Buttons, inputs, textareas, selects'],
  ['Radius — small panel',   '8 px',   'Small panels and inline cards'],
  ['Radius — card / modal',  '12 px',  'Cards, modals, drawers, auth cards, role-icon tiles'],
  ['Radius — circle',        '50 %',   'Avatars, status dots'],
  ['Radius — pill',          '999 px', 'Status badges, segmented controls'],
  ['Shadow — card (rest)',   '0 2px 8px rgba(0,0,0,0.04)',     'Default card resting shadow'],
  ['Shadow — card (hover)',  '0 4px 16px rgba(0,0,0,0.08)',    'Card on hover'],
  ['Shadow — role-card hover','0 8px 24px rgba(0,0,0,0.12)',   'Role-tile hover (landing role picker)'],
  ['Shadow — bottom slide-up','0 -8px 32px rgba(0,0,0,0.12)',  'MoreSheet, bottom drawer'],
  ['Shadow — modal',         '0 12px 40px rgba(0,0,0,0.2)',    'Modal box'],
  ['Shadow — auth card',     '0 16px 48px rgba(0,0,0,0.18)',   'Login / forgot / reset cards'],
];

// ─────────────────────────────────────────────────────────────────────────────
// §3 — Layout Foundations
// ─────────────────────────────────────────────────────────────────────────────
const BREAKPOINT_RULES = [
  ['≥ 1024 px', 'Desktop / tablet landscape', 'Fixed 240 px Navy sidebar on the left, main content right of it, optional right rail for filters or details.'],
  ['≤ 1023 px', 'Mobile / tablet portrait', 'Sidebar collapses into a slide-in drawer (opened by a drawer button in the header). A bottom tab bar (max 5 items) is visible at all times. Items beyond 4 live in a MoreSheet that slides up from the bottom.'],
];
const SIDEBAR_SPEC = [
  ['Width', '240 px (fixed)'],
  ['Background', 'Navy (#1A237E)'],
  ['Item type', 'Icon (20 px) + label (15 px Poppins 600 white)'],
  ['Active item', 'Saffron 4 px left border, slightly darker background tint'],
  ['Hover item', 'Lighter background tint, no border'],
  ['Sections', 'One group of items per role; group titles in 12 px UPPERCASE saffron with 0.4 px tracking'],
  ['Footer area', 'Compact "Logged in as" block with role badge and quick-switch-to-profile link'],
];
const TABBAR_SPEC = [
  ['Height', '64 px (excluding bottom safe area)'],
  ['Background', 'White with 1 px top border in mid-gray'],
  ['Items', 'Max 5; equal width; icon (24 px) + label (12 px Poppins 600)'],
  ['Active item', 'Navy icon + label, saffron 3 px top accent bar above the active cell'],
  ['Inactive item', 'Slate icon + label'],
  ['More', 'If a role has more than 4 contextual items, item 5 is "More" which opens the MoreSheet'],
  ['MoreSheet', 'Bottom slide-up, 12 px top corners, shadow 0 -8px 32px rgba(0,0,0,0.12). Lists overflow items as 56 px tap rows. Backdrop rgba(0,0,0,0.5); tap outside or swipe down to dismiss.'],
];

// How each element transforms across the 1024 px breakpoint.
// One row per element/component, two columns (desktop vs mobile behaviour).
const RESPONSIVE_TRANSFORMS = [
  ['Page chrome',     'Fixed 240 px sidebar on the left · main content area to its right · optional right rail.', 'Sidebar collapses into a slide-in drawer (opened by a drawer button in the header) · bottom tab bar visible at all times · drawer-backdrop dismisses by tap.'],
  ['Page header',     'Page title (Poppins 600) on the left · primary action button on the right.', 'Page title shrinks (H1 28 px) · primary action moves to a sticky bottom-of-screen button OR into the top-right depending on screen.'],
  ['Dashboard',       '4-card KPI strip across the top · 2-column section (recent activity + queue) below.', 'KPI cards stack vertically · 2-column section becomes single column · cards full width.'],
  ['List / table',    'Striped or border-bottom table with sticky header row · all columns visible · row hover tint.', 'Table transforms into a stack of cards — one card per row · key columns surface as title + meta · the rest collapse into an expandable detail.'],
  ['Detail view',     'Two-column or sectioned layout · meta strip at top · drawers trigger from each section.', 'Single column · meta strip stacks · sections render vertically · drawers slide up from the bottom instead of from the right.'],
  ['Form',            'Single column max 480 px; labels above inputs.', 'Same single column but max width = viewport - 32 px padding · inputs span full width · footer actions stack (primary first, then Cancel below).'],
  ['Modal',           'Centered, max-width 480 px, 32 px padding.', 'Becomes near-full-screen: 16 px side padding · top-aligned (≥ 24 px from top) · max-height 100vh - 48 px · scrolls internally if content overflows.'],
  ['Drawer',          'Slides in from the right · max-width 480 px · backdrop rgba(0,0,0,0.5).', 'Slides up from the bottom · 12 px top corners · shadow 0 -8px 32px · same backdrop · close affordance is a drag handle at the top edge.'],
  ['Toast',           'Slides in top-right · 320 px width · auto-dismiss 4 s.', 'Slides down from the top · spans full width minus 16 px on each side · same auto-dismiss · stacks vertically when multiple appear.'],
  ['Sub-nav (tabs)',  'Horizontal tab strip with all tabs visible.', 'Same horizontal strip; if it overflows, becomes horizontally scrollable with a subtle right-edge fade indicator.'],
  ['Filter bar',      'Inline filter chips + search input in a single row above the table.', 'Filter chips wrap to multiple rows; search input moves to its own full-width row above the chips.'],
  ['Stat / KPI card', '320 px width · 24 px padding · large number (32 px Poppins 700) + label.', 'Full row width · 16 px padding · large number scales to 28 px · label unchanged.'],
  ['Touch targets',   'All ≥ 32 × 32 px (mouse).',                                                              'All ≥ 44 × 44 px (touch) · including buttons, icon buttons, tab bar cells, MoreSheet rows.'],
  ['Spacing',         'lg (32 px) and xl (48 px) used freely for section breaks.', 'Section breaks step down one notch — lg becomes md (24 px), xl becomes lg (32 px) — so vertical rhythm stays comfortable in the narrower viewport.'],
];

// ─────────────────────────────────────────────────────────────────────────────
// §4 — Information Architecture
// Routes are partitioned into three buckets:
//   • Public  — no auth, no org context  (e.g. /login)
//   • Platform — Super Admin only, no org context  (e.g. /organizations)
//   • Org-scoped — first path segment is the org slug (e.g. /acme/dashboard)
// Pages marked NEW are scope for the next build and do not yet exist in the
// prototype.
// ─────────────────────────────────────────────────────────────────────────────

const PAGES_PUBLIC = [
  ['Landing / role picker', '/',                            'Marketing intro + Sign in CTA + Organization sign-up link.'],
  ['Login',                  '/login',                      'Email + password. Forgot-password link below.'],
  ['Forgot password',        '/forgot-password',            'Email entry → success toast → back to login.'],
  ['Reset password',         '/reset-password/:token',      'New + confirm password. Token validated on mount.'],
  ['Organization sign-up',   '/organization-signup',        'NEW. Public form for organization onboarding; queues for Super Admin review.'],
];

const PAGES_PLATFORM = [
  ['Dashboard',          '/dashboard',           'Super Admin', 'Cross-organization KPIs: organizations active, pending sign-ups, plan distribution, total active users.'],
  ['Organizations',      '/organizations',       'Super Admin', 'NEW. List of all organizations · status filter (Pending / Active / Deactivated).'],
  ['Organization detail','/organizations/:id',   'Super Admin', 'NEW. Approve / deactivate / change plan · view org users · audit trail.'],
  ['Plans',              '/plans',               'Super Admin', 'NEW. Manage Subscription Plans (Basic / Standard / Premium) · active-user caps.'],
  ['Audit log',          '/audit-log',           'Super Admin', 'Cross-organization audit log (read-only, paginated).'],
  ['Profile',            '/profile',             'Super Admin', 'Account, password, member-since, recent activity.'],
];

const PAGES_ORG = [
  ['Dashboard',        '/:org/dashboard',         'Admin, PM, Maintenance, Tenant', 'Role-aware home. Admin: org-wide KPIs + alerts. PM: property KPIs + maintenance queue + recent payments. Maintenance: assigned tickets queue. Tenant: lease summary + rent status + active maintenance.'],
  ['Profile',          '/:org/profile',           'Admin, PM, Maintenance, Tenant', 'Account, password, member-since, recent activity. Maintenance also shows specialization + work stats; Tenant also shows lease quick-view.'],
  ['Maintenance',      '/:org/maintenance',       'Admin, PM, Maintenance, Tenant', 'Admin: every request in this org + 5+ alerts. PM: requests for own properties + assign / resolve / close. Maintenance: assigned tickets with status actions. Tenant: own requests, raise new, close own resolved.'],
  ['Users',            '/:org/users',             'Admin',          'Manage Admin / PM / Maintenance accounts within this organization. Tenants are created at lease signing — not here.'],
  ['Properties',       '/:org/properties',        'Admin',          'List of all properties in this organization.'],
  ['Property detail',  '/:org/properties/:id',    'Admin',          'Property + units + assigned PM + transfer-PM action.'],
  ['Units',            '/:org/units',             'Admin, PM',      'Admin: cross-property unit list with state filter. PM: units in assigned properties with state controls.'],
  ['Tenants',          '/:org/tenants',           'PM',             'Tenants in assigned properties.'],
  ['Tenant detail',    '/:org/tenants/:id',       'PM',             'Single tenant: lease summary, payments, maintenance history.'],
  ['Leases',           '/:org/leases',            'PM',             'Active + expired leases · renew · terminate-request actions.'],
  ['Lease detail',     '/:org/leases/:id',        'PM',             'Single lease: tenants, rent periods, terminations, deposit refunds.'],
  ['Rent',             '/:org/rent',              'Admin, Tenant',  'Admin: org-wide rent collection overview + overdue tenants. Tenant: own payment history + outstanding balance + late-fee breakdown.'],
  ['Rent Collection',  '/:org/rent-collection',   'PM',             'Per-unit rent periods · record-payment drawer (idempotent).'],
  ['Visitors',         '/:org/visitors',          'PM, Tenant',     'NEW. PM: visitor pre-approvals · approve / deny · check-in / out timestamps. Tenant: pre-approve visitors · see status.'],
  ['All Open',         '/:org/all-open',          'Maintenance',    'Read-only view of every open request across all properties in this organization.'],
  ['Master Data',      '/:org/master-data',       'Admin',          'NEW. Amenities · Maintenance Categories · Payment Methods · City · State. Add / edit / deactivate.'],
  ['Settings',         '/:org/settings',          'Admin',          'NEW. Late-fee rate · grace period · rent-change notice window. Audit-log entry on every change.'],
  ['Delegations',      '/:org/delegations',       'Admin',          'NEW. Create + revoke task delegations to PM / Maintenance for a date range.'],
  ['Audit log',        '/:org/audit-log',         'Admin',          'Read-only paginated audit trail for this organization.'],
];

// ─────────────────────────────────────────────────────────────────────────────
// §5 — Page Layout Templates
// ─────────────────────────────────────────────────────────────────────────────
const LAYOUT_TEMPLATES = [
  ['Dashboard',
    'KPI strip (4 metric cards across, stack vertically on mobile) → alerts row → 2-column section (recent activity left, queue right; stack on mobile) → quick-action button group at the bottom.',
    'Recurring metric card (label · big number · trend chip) · alert pill · activity feed item · quick-action button',
  ],
  ['List view',
    'Sticky page header (title + primary action) → filter / search row → striped table (desktop) or card list (mobile). Empty state with icon + helper + primary CTA when no rows.',
    'Page header · filter chip · search input · table row · card row · empty state',
  ],
  ['Detail view',
    'Page header with title + status badge + actions menu → meta strip (key fields, 2-3 lines) → tabbed or sectioned content → action drawer triggers at the bottom of each section.',
    'Page header · status badge · meta strip · section header · section body · action button group',
  ],
  ['Form page',
    'Page header → form card (sm shadow, 24 px padding) with labelled fields → footer actions (Cancel left, primary Save right). Validation errors render below each field.',
    'Form field · helper text · error text · footer action row',
  ],
  ['Drawer flow',
    'Triggered from a list or detail row. Slides in from the right (desktop) or up (mobile). Contains a single form. Saves close the drawer and emit a success toast.',
    'Drawer header · form fields · footer action row · success toast',
  ],
];

// ─────────────────────────────────────────────────────────────────────────────
// §6 — Wireframes (zone-level layout descriptions for the key screens)
// Each screen is described as a list of [Zone, Content] rows so Word renders
// it consistently as a real table — easier to scan than ASCII art that breaks
// in narrow viewports. Sidebar nav reflects the v1 baseline; v8 additions
// (Master Data, Settings, Delegations for Admin · Visitors for PM and Tenant ·
// Super Admin screens) follow the same templates from §5 and will be added
// once their content is locked.
// ─────────────────────────────────────────────────────────────────────────────
const WIREFRAMES = [
  {
    title: 'Admin — Dashboard',
    zones: [
      ['Top bar',              'GharSetu logo (left) · "Admin: Raj Singh" (right) · Logout button'],
      ['Sidebar (≥ 1024 px)',  'Dashboard (active) · Properties · Units · Users · Maintenance · Rent · Audit Log · My Profile'],
      ['Tab bar (≤ 1023 px)',  'Dashboard · Properties · Users · Maintenance · More (→ Rent · Audit Log · Profile)'],
      ['Main — KPI strip',     '4 cards across (stack on mobile): "Properties: 18" · "Units: 120" · "Occupied: 94%" · "Overdue: ₹3L"'],
      ['Main — Alert row',     '⚠ ADMIN ALERT — "Unit 4B — 6 requests in 30 days. Review tenant."'],
      ['Main — Rent overview', 'Card: Collected ₹12L · Overdue ₹3L · Partial 8 units'],
      ['Main — Maintenance',   'Card: Emergency 2 · High 5 · Open 14'],
    ],
  },
  {
    title: 'Property Manager — Dashboard',
    zones: [
      ['Top bar',              'GharSetu logo · "PM: Sunita Arora" · Logout'],
      ['Sidebar (≥ 1024 px)',  'Dashboard (active) · Units · Tenants · Leases · Rent Collection · Maintenance · My Profile'],
      ['Tab bar (≤ 1023 px)',  'Dashboard · Tenants · Leases · Rent · More (→ Maintenance · Units · Profile)'],
      ['Main — Page title',    '"Green Valley Apartments, Dwarka"'],
      ['Main — KPI strip',     '4 cards: Total 40 · Occupied 36 · Available 4 · Overdue 3'],
      ['Main — Alert row',     '⚠ Leases expiring in 30 days: 2'],
      ['Main — Maintenance queue', '3 rows (priority badge + description): [EMERGENCY] Unit 7C — Water leakage · [HIGH] Unit 2A — AC not working · [MEDIUM] Unit 5B — Door lock'],
      ['Main — Recent payments', 'Table: Tenant + Unit · Amount · Method · Status. Sharma 3A ₹18,000 UPI [Paid] · Gupta 1B ₹22,000 Cash [Paid]'],
    ],
  },
  {
    title: 'Maintenance Staff — Dashboard',
    zones: [
      ['Top bar',              'GharSetu logo · "Staff: Raju" · Logout'],
      ['Sidebar (≥ 1024 px)',  'My Requests (active) · All Open · My Profile'],
      ['Tab bar (≤ 1023 px)',  'My Requests · All Open · Profile (3 items, no MoreSheet)'],
      ['Main — Page title',    '"My Assigned Requests"'],
      ['Main — Ticket 1',      '[EMERGENCY] Unit 7C — Water leakage · Assigned today · button [Move to In-Progress]'],
      ['Main — Ticket 2',      '[HIGH] Unit 2A — AC not working · Status: In-Progress · Resolution notes textarea (min 20 chars) · button [Mark Resolved]'],
      ['Main — Ticket 3',      '[MEDIUM] Unit 5B — Door lock broken · Status: Assigned · button [Move to In-Progress]'],
      ['Out-of-scope note',    'Footer reminder: "Cannot see: Rent · Leases · Tenant financial data"'],
    ],
  },
  {
    title: 'Tenant — Dashboard',
    zones: [
      ['Top bar',              'GharSetu logo · "Raj Sharma" · Logout'],
      ['Sidebar (≥ 1024 px)',  'My Lease (active) · Rent · Maintenance · Visitors · My Profile'],
      ['Tab bar (≤ 1023 px)',  'My Lease · Rent · Maintenance · Visitors · Profile (5 items, no MoreSheet)'],
      ['Main — Lease card',    'Unit 3A, Green Valley, Dwarka · Start 01/04/2025, End 31/03/2026 · Monthly Rent ₹18,000 · Status [ACTIVE] · Co-tenant: Priya Sharma'],
      ['Main — Rent status',   'May 2026 [OVERDUE]: ₹18,000 due + Late Fee ₹360 added · italic note "(Payment is recorded by your Property Manager)" · Apr 2026 [PAID]: ₹18,000 on 03/04/2026'],
    ],
  },
  {
    title: 'Rent Collection (PM)',
    zones: [
      ['Top bar + nav',        'Same chrome as PM Dashboard'],
      ['Main — Page title',    '"Rent Collection — Unit: [3A ▼]" (unit dropdown switches the period list below)'],
      ['Main — Period list',   'Table columns: Period · Due Date · Status · Due · Paid. Rows: May 2026 / 05/05/2026 / [OVERDUE] / ₹18,000 / ₹0 (with Late Fee ₹360 + [Record Payment] button) · Apr 2026 / 05/04/2026 / [PAID] / ₹18,000 / ₹18,000 · Mar 2026 / 05/03/2026 / [PAID] / ₹18,000 / ₹18,000'],
      ['Record Payment drawer','Triggered by [Record Payment]. Fields: Amount · Date (DD/MM/YYYY) · Method (dropdown from Master Data: Cash / UPI / NEFT / Cheque) · Ref (free text) · "Recorded by: Sunita Arora" auto-filled. Footer: [Save Payment] [Cancel]'],
    ],
  },
  {
    title: 'Lease Management (PM)',
    zones: [
      ['Top bar + nav',        'Same chrome as PM Dashboard'],
      ['Main — Page title',    '"Leases — Green Valley Apartments" with [+ New Lease] button on the right'],
      ['Main — Lease list',    'Table columns: Tenant(s) · Unit · Start · End · Status. Active lease row exposes [Renew] [Early Terminate] [Deposit Refund] buttons; Expired row exposes none.'],
      ['Footnotes',            'Renewal: new lease start auto-set to old lease end + 1 day · Early Terminate: opens co-tenant consent panel if any'],
    ],
  },
  {
    title: 'Tenant — Maintenance',
    zones: [
      ['Top bar + nav',        'Same chrome as Tenant Dashboard'],
      ['Main — Page title',    '"My Maintenance Requests" with [+ Raise New Request] button on the right'],
      ['Main — Request 1',     '[OPEN] Water leakage in kitchen · Raised 05/05/2026 · Priority Emergency · Assigned to Raju'],
      ['Main — Request 2',     '[RESOLVED] AC not working · Raised 10/04/2026 · Resolved 12/04/2026 · button [Close Request] (tenant action)'],
      ['Main — Request 3',     '[CLOSED] Door lock broken · Raised 01/03/2026 · italic note "No further action available"'],
      ['Raise New drawer',     'Triggered by [+ Raise New Request]. Fields: Category (dropdown from Master Data) · Priority (Low / Medium / High / Emergency) · Description textarea (0/30 min chars) · button [Submit Request]'],
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// §7 — Components
// ─────────────────────────────────────────────────────────────────────────────
const COMPONENTS = [
  ['Button', 'Primary = Saffron #FF6F00 bg + white text (hover #d95f00). Secondary = transparent bg + 2 px Royal Blue border + Royal Blue text (hover rgba(21,101,192,0.06)). Danger = #C62828 bg + white text (hover #a51a1a). Disabled = light-gray bg + mid-gray text. All buttons: 15 px Poppins 600, 6 px radius, 10 / 24 padding. Focus-visible: 2 px saffron outline at 2 px offset.'],
  ['Input', 'Min-height 44 px, 10 / 14 padding, Inter 15 px / 400 charcoal, white bg, 1 px mid-gray border, 6 px radius. Focus: 2 px Royal Blue border (replaces resting border). Error: 2 px overdue-red border + light-red background (#FFEBEE) + ⚠ error text below the field.'],
  ['Select', 'Same chrome as input · chevron-down icon · keyboard-navigable list popup.'],
  ['Form field', 'Label (Poppins 600 charcoal) → input → helper text (slate 14 px) → error text (red 14 px, prefixed with ⚠).'],
  ['Required marker', 'Saffron asterisk * suffixed to the label. Optional fields are unmarked.'],
  ['Table', 'White background, 14 / 16 cell padding, 14 px Inter body text. Header row in Poppins 600. Rows separated by 1 px light-gray (#ECEFF1) bottom border (no zebra stripe). Row hover: rgba(21,101,192,0.03) Royal-Blue tint. Right-aligned numerics + currency. Dates render DD/MM/YYYY.'],
  ['Card', 'White fill, mid-gray border, 12 px radius. Resting shadow 0 2px 8px rgba(0,0,0,0.04); hover shadow 0 4px 16px rgba(0,0,0,0.08). Title in Poppins 600 charcoal, meta in slate.'],
  ['Modal', 'Centered, 12 px radius, max-width 480 px, 32 px padding, shadow 0 12px 40px rgba(0,0,0,0.2). Backdrop rgba(0,0,0,0.5). Header (navy 600), body, footer (right-aligned actions).'],
  ['Drawer', 'Right-side slide on desktop · bottom slide on mobile. 12 px radius. Backdrop rgba(0,0,0,0.5). Bottom slide-up uses shadow 0 -8px 32px rgba(0,0,0,0.12).'],
  ['MoreSheet', 'Bottom slide-up on ≤ 1023 px. 12 px top corners. Items beyond 4 from the tabbar appear as 56 px tap rows. Shadow 0 -8px 32px rgba(0,0,0,0.12). Backdrop rgba(0,0,0,0.5) dismisses.'],
  ['Badge', 'Pill, 12 px Poppins 600 UPPERCASE with 0.4 px tracking. Colour pair from the Status palette in §2.'],
  ['Toast', 'Top-right slide-in on desktop · top slide-down on mobile. 320 px width. Success (green left bar), error (red), info (royal blue), warning (saffron). Auto-dismiss 4 s; manual X.'],
  ['Empty state', 'Centered icon + headline (Poppins 600) + helper text (slate) + primary action. Used on dashboards, lists, search.'],
  ['Loading state', 'Skeleton rows match the final layout shape; never a centred spinner on a list screen. Spinners only inside button labels during submit.'],
  ['Error state', 'Inline panel (red left bar, light-red background) above the affected area, with a retry action. Never an alert(). Never blocks the whole page unless the page can\'t load.'],
  ['Banner', 'Full-width strip below the header. Saffron for warnings, navy for info, red for errors. Used for impersonation indicator, scheduled rent change notice, and similar global signals.'],
  ['Impersonation banner', 'Persistent saffron banner shown to an Admin during an impersonation session — text: "Acting as <name>" + an End session button on the right.'],
];

// ─────────────────────────────────────────────────────────────────────────────
// §7 — Interaction Patterns
// ─────────────────────────────────────────────────────────────────────────────
const INTERACTION_PATTERNS = [
  [bn('Form validation '), r('— validate on blur and on submit; never on keystroke. On submit, scroll to the first error and focus it. Disable the submit button only while the request is in flight (with a spinner inside its label); never disable it pre-emptively for unknown reasons.')],
  [bn('Modal vs drawer choice '), r('— modals are for confirmations and short forms (≤ 4 fields). Drawers are for record-and-keep-context flows (record payment, raise maintenance, edit profile). Multi-step flows that need page real estate get their own page.')],
  [bn('Save feedback '), r('— success path is a green toast top-right ("Payment recorded · ₹15,000") + the list refreshes silently. Failure path keeps the drawer/modal open with the error inline; never lose the user\'s typed input.')],
  [bn('Destructive confirmations '), r('— terminate-lease, deactivate-user, end-impersonation use a modal with a red Confirm button. The user must type the entity name (e.g. "ROOM 3B") to enable the button. Cancel is the default focus.')],
  [bn('Empty → first action '), r('— every empty state has exactly one primary CTA. Example: empty leases list → "Create the first lease" button (PM); empty audit log → no CTA, just a friendly explanation.')],
  [bn('Optimistic UI rules '), r('— never optimistically update money or lease state. Always wait for the server. UI feels fast through skeleton states and toast feedback, not through pretending writes succeeded.')],
  [bn('Pagination '), r('— page-size 25 default, with a sticky page footer showing "Showing 26 – 50 of 184". Long-list URLs reflect page state. Search filters debounce 300 ms before firing.')],
];

// ─────────────────────────────────────────────────────────────────────────────
// §10 — Launch checklist (UI / UX only — engineering items in Solution Overview)
// ─────────────────────────────────────────────────────────────────────────────
const LAUNCH_CHECKLIST = [
  ['Color',         'CSS custom properties for the full brand + status palette are defined and used everywhere'],
  ['Color',         'Status badges show the correct fg + bg pair for every state (Paid · Partial · Overdue · Prepaid · Active · Renewed · Terminated · Open · In Progress · Resolved · Closed · Emergency)'],
  ['Typography',    'Poppins (600 + 700) and Inter (400 + 500) load before first paint'],
  ['Typography',    'Desktop sizes apply at ≥ 1024 px; mobile sizes apply at ≤ 1023 px'],
  ['Typography',    'DD/MM/YYYY date format used on every screen; ₹ Indian digit grouping on every amount; midnight renders as 00:00'],
  ['Layout',        'Sidebar nav working on ≥ 1024 px; bottom tab bar working on ≤ 1023 px; sidebar drawer opens / closes on mobile'],
  ['Layout',        'Every screen has been viewed at 320 × 640 px and 1440 px without horizontal scroll or content cut-off'],
  ['Layout',        'MoreSheet opens for roles whose tabbar overflows (Admin, PM)'],
  ['Roles',         'Super Admin sees cross-organization data only'],
  ['Roles',         'Admin sees data scoped to own organization only'],
  ['Roles',         'Property Manager sees data scoped to their assigned property only'],
  ['Roles',         'Maintenance Team sees zero financial / lease data'],
  ['Roles',         'Tenant sees own data only (own lease, own rent, own maintenance, own visitors)'],
  ['Behaviour',     'Rent field disabled / read-only on occupied units'],
  ['Behaviour',     'Late fee is included in the payable amount shown on screen'],
  ['Behaviour',     'Closed maintenance requests show no action buttons for any role'],
  ['Behaviour',     'Record-payment surfaces are visible to Property Manager and Admin only'],
  ['Behaviour',     'Maintenance Team can read + update assigned tickets; no create-new control is shown to them'],
  ['Behaviour',     'Admin dashboard surfaces the 5+ maintenance requests alert when a single lease (or single room) raises 5+ requests in one calendar month'],
  ['Behaviour',     'Impersonation banner is visible at all times during an Admin impersonation session'],
  ['Accessibility', 'Every text + background combination meets WCAG AA contrast'],
  ['Accessibility', 'Keyboard navigation tested end-to-end on every screen; Tab order matches reading order'],
  ['Accessibility', 'Focus rings (2 px Saffron outline, 2 px offset) are visible on every focusable element'],
  ['Testing',       'Verified on Chrome, Firefox, Safari, Edge'],
  ['Testing',       'Verified on Android (mid-range) and iOS'],
];

// ─────────────────────────────────────────────────────────────────────────────
// §9 — Accessibility
// ─────────────────────────────────────────────────────────────────────────────
const A11Y_RULES = [
  [bn('WCAG 2.1 AA floor '), r('— contrast ≥ 4.5:1 for text under 18 px / 3:1 for ≥ 18 px and UI components. Measured ratios on the off-white page background: Navy (#1A237E) on white = 15 : 1 (passes AAA); Slate (#546E7A) on off-white = 8.4 : 1 (passes AAA); Saffron is reserved for large elements (CTAs, focus rings, badges) — never small body text.')],
  [bn('Keyboard navigation '), r('— every interactive element is reachable by Tab in source order; focus ring is a 2 px Saffron (#FF6F00) outline at 2 px offset with a 4 px border-radius on the outline (never removed by CSS). Inputs are the exception — they swap their resting mid-gray border for a 2 px Royal Blue border when focused, instead of getting an outer ring.')],
  [bn('Skip-to-content '), r('— first Tab on any page focuses a "Skip to content" link that jumps to the main region.')],
  [bn('Form errors below field '), r('— validation messages render directly below the input, never as a native browser tooltip. Format is fixed (red 14 px, ⚠ glyph). Errors are also surfaced via aria-describedby on the input.')],
  [bn('Required field marking '), r('— labels for required inputs are suffixed with a Saffron asterisk *. The asterisk is decorative; the input also carries aria-required="true".')],
  [bn('Screen-reader landmarks '), r('— every page has explicit role attributes: <header>, <nav>, <main>, <aside>. Status badges include an aria-label that spells out the status.')],
  [bn('Touch targets '), r('— interactive targets are at least 44 × 44 px on touch viewports. The bottom tab bar and the MoreSheet rows both meet this floor.')],
  [bn('Time, dates, currency '), r('— times render in Asia/Kolkata; dates render DD/MM/YYYY; currency renders as ₹ with Indian digit grouping (locale en-IN). Midnight is 00:00 — never 24:00 (BL-22 / BL-23).')],
];

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'Aayush Kumar',
  title: 'GharSetu — UI/UX Design Document',
  styles: { default: { document: { run: { font: 'Arial', size: 22, color: COLOR.charcoal } } } },
  numbering: {
    config: [{
      reference: 'dd-bullets',
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 540, hanging: 280 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 280 } } } },
      ],
    }],
  },
  sections: [
    // Cover
    {
      properties: {
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1080, bottom: 1080, left: 1080 } },
        titlePage: true,
      },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun('')] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun('')] })] }) },
      children: [
        new Paragraph({ spacing: { before: 2400, after: 0 }, children: [new TextRun('')] }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 0, after: 480 },
          children: [new TextRun({ text: 'GharSetu — UI / UX Design Document', bold: true, size: 56, color: COLOR.navy, font: 'Arial' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: COLOR.saffron, space: 1 } },
          spacing: { before: 0, after: 1200 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 0, after: 240 },
          children: [new TextRun({ text: 'DRAFT', bold: true, italics: true, size: 28, color: COLOR.saffron, font: 'Arial', characterSpacing: 40 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 },
          children: [
            new TextRun({ text: 'Date: ', bold: true, size: 26, color: COLOR.charcoal, font: 'Arial' }),
            new TextRun({ text: '26 May 2026', size: 26, color: COLOR.charcoal, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 0, after: 80 },
          children: [
            new TextRun({ text: 'Prepared by: ', bold: true, size: 26, color: COLOR.charcoal, font: 'Arial' }),
            new TextRun({ text: 'Aayush Kumar, Triline', size: 26, color: COLOR.charcoal, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 },
          children: [
            new TextRun({ text: 'Contact: ', bold: true, size: 22, color: COLOR.slate, font: 'Arial' }),
            new TextRun({ text: 'aayush@triline.co.in', size: 22, color: COLOR.slate, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 },
          children: [
            new TextRun({ text: 'Prepared for: ', bold: true, size: 26, color: COLOR.charcoal, font: 'Arial' }),
            new TextRun({ text: 'GharSetu Operations', size: 26, color: COLOR.charcoal, font: 'Arial' }),
          ],
        }),
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },

    // Body
    {
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun('')] })] }) },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'GharSetu  —  UI / UX Design Document  ·  Page ', size: 18, color: COLOR.slate, font: 'Arial' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COLOR.slate, font: 'Arial' }),
              new TextRun({ text: ' of ', size: 18, color: COLOR.slate, font: 'Arial' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: COLOR.slate, font: 'Arial' }),
            ],
          })],
        }),
      },
      children: [
        // §1 Design Principles
        solidBanner('1. Design Principles'),
        body('GharSetu is a tool for an operations team to run a 120-unit Delhi rental business — and, after the SAAS layer, to host other organizations doing the same. These principles set the tone for every screen, component and interaction in the application.', { after: 200 }),
        ...PRINCIPLES.map(runs => bullet(runs)),
        spacer(280),

        // §2 Design Tokens
        solidBanner('2. Design Tokens'),
        capsLabel('Brand colors'),
        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [2200, 1400, 1400, 5080],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell('Name', 2200), headerCell('Swatch', 1400), headerCell('Hex', 1400), headerCell('Use', 5080)] }),
            ...TOKENS_BRAND.map(([name, hex, use], i) => new TableRow({
              children: [
                bodyCell(name, 2200, { bold: true, color: COLOR.navy, stripe: i % 2 === 1 }),
                colorSwatchCell(hex, 1400),
                bodyCell(hex, 1400, { stripe: i % 2 === 1 }),
                bodyCell(use, 5080, { stripe: i % 2 === 1 }),
              ],
            })),
          ],
        }),
        spacer(200),

        capsLabel('Status palette'),
        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [4200, 1400, 1400, 3080],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell('Status group', 4200), headerCell('Foreground', 1400), headerCell('Background', 1400), headerCell('Hex pair', 3080)] }),
            ...TOKENS_STATUS.map(([label, fg, bg], i) => new TableRow({
              children: [
                bodyCell(label, 4200, { bold: true, color: COLOR.navy, stripe: i % 2 === 1 }),
                colorSwatchCell(fg, 1400),
                colorSwatchCell(bg, 1400),
                bodyCell(`${fg}  /  ${bg}`, 3080, { stripe: i % 2 === 1 }),
              ],
            })),
          ],
        }),
        spacer(200),

        capsLabel('Typography — Desktop and mobile sizes'),
        renderTable([1800, 1400, 1700, 1500, 1500, 2180],
          ['Role', 'Family', 'Weight', 'Desktop', 'Mobile', 'Line height'],
          TOKENS_TYPOGRAPHY,
        ),
        spacer(200),

        capsLabel('Readability settings'),
        renderTable([3200, 6880], ['Setting', 'Value'], READABILITY_RULES),
        spacer(200),

        capsLabel('Color usage rules'),
        ...COLOR_USAGE_RULES.map(runs => bullet(runs)),
        spacer(200),

        capsLabel('Spacing scale (8 px base)'),
        renderTable([1800, 1800, 6480], ['Token', 'Value', 'Use'], TOKENS_SPACING),
        spacer(200),

        capsLabel('Radius and shadow'),
        renderTable([3200, 3200, 3680], ['Token', 'Value', 'Use'], TOKENS_RADIUS_SHADOW),
        spacer(280),

        // §3 Layout Foundations
        solidBanner('3. Layout Foundations'),
        capsLabel('Breakpoint contract — single split at 1024 px'),
        renderTable([1800, 2800, 5480], ['Width', 'Audience', 'Layout'], BREAKPOINT_RULES),
        spacer(200),

        capsLabel('Sidebar specification (≥ 1024 px)'),
        renderTable([2600, 7480], ['Attribute', 'Value'], SIDEBAR_SPEC),
        spacer(200),

        capsLabel('Bottom tab bar + MoreSheet (≤ 1023 px)'),
        renderTable([2600, 7480], ['Attribute', 'Value'], TABBAR_SPEC),
        spacer(200),

        capsLabel('Responsive transformations — how every element behaves across the breakpoint'),
        renderTable([1800, 4140, 4140], ['Element', 'Desktop (≥ 1024 px)', 'Mobile (≤ 1023 px)'], RESPONSIVE_TRANSFORMS),
        spacer(280),

        // §4 Information Architecture
        solidBanner('4. Information Architecture'),
        body('Routes are partitioned into three classes. Public pages have no auth and no organization context. Platform pages belong to the Super Admin and are also outside any organization context. Org-scoped pages carry the organization slug as the first path segment (for example, /acme/dashboard) — the slug names which organization the user is operating inside, and the role determines which variant of the page renders. Pages marked NEW are scope for the next build.', { after: 200 }),

        capsLabel('Public pages — no auth, no organization context'),
        renderTable([2400, 3200, 4480], ['Page', 'Path', 'Purpose'], PAGES_PUBLIC),
        spacer(200),

        capsLabel('Platform pages — Super Admin only, no organization context'),
        renderTable([2200, 2400, 1600, 3880], ['Page', 'Path', 'Role', 'Purpose'], PAGES_PLATFORM),
        spacer(200),

        capsLabel('Org-scoped pages — first segment is the organization slug (e.g. /acme/...)'),
        renderTable([1900, 2400, 1800, 3980], ['Page', 'Path', 'Roles', 'Behaviour per role'], PAGES_ORG),
        spacer(280),

        // §5 Page Layout Templates
        solidBanner('5. Page Layout Templates'),
        body('Most screens follow one of five layout templates. A template defines the page zones, their order, and the components used; per-page differences live in the content, not the structure.', { after: 200 }),
        renderTable([2000, 5080, 3000],
          ['Template', 'Zones (top to bottom)', 'Recurring components'],
          LAYOUT_TEMPLATES,
        ),
        spacer(280),

        // §6 Wireframes (zone-level layouts as structured tables)
        solidBanner('6. Wireframes'),
        body('Zone-level layouts for the key v1 screens — the structural baseline the next prototype builds against. Each screen is described as a list of zones (top to bottom on desktop) with the content and interactions inside each zone. Sidebar nav items shown are v1; the v8 build adds Master Data / Settings / Delegations to the Admin sidebar, Visitors to the PM and Tenant sidebars, and new Super Admin screens follow the same templates from §5.', { after: 200 }),
        ...WIREFRAMES.flatMap(({ title, zones }) => [
          capsLabel(title),
          renderTable([2600, 7480], ['Zone', 'Content'], zones),
          spacer(200),
        ]),
        spacer(80),

        // §7 Components
        solidBanner('7. Components'),
        renderTable([2200, 7880], ['Component', 'Spec'], COMPONENTS),
        spacer(280),

        // §8 Interaction Patterns
        solidBanner('8. Interaction Patterns'),
        ...INTERACTION_PATTERNS.map(runs => bullet(runs)),
        spacer(280),

        // §9 Accessibility
        solidBanner('9. Accessibility'),
        ...A11Y_RULES.map(runs => bullet(runs)),
        spacer(280),

        // §10 Launch Checklist (grouped by Area for scannability)
        solidBanner('10. Launch Checklist'),
        body('Pre-launch verification. UI / UX-only items here, grouped by area; engineering checks live in the Solution Overview and Timeline.', { after: 200 }),
        ...Object.entries(
          LAUNCH_CHECKLIST.reduce((acc, [area, item]) => {
            (acc[area] = acc[area] || []).push(item);
            return acc;
          }, {})
        ).flatMap(([area, items]) => [
          capsLabel(area),
          renderTable([8800, 1280], ['Item', 'Done'], items.map(i => [i, '☐'])),
          spacer(160),
        ]),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR.saffron, space: 1 } },
          spacing: { before: 400, after: 0 },
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT_PATH, buffer);
  console.log(`Document written to: ${OUTPUT_PATH}`);
  console.log(`Size: ${buffer.length} bytes`);
});
