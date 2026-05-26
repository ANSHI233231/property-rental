// ─────────────────────────────────────────────────────────────────────────────
// generate_solution_overview.js
// ─────────────────────────────────────────────────────────────────────────────
// Source-of-truth generator for docs/product/Solution_Overview.docx
//
// v8 — Delta-style document. Cover marker now reads "DRAFT" (no version).
// Scope: gap closure on existing modules + new features (per-room leasing,
// Admin Impersonation, Task Delegation, Visitor Management, Master Data
// Administration, Settings, SAAS / Organization Management layer) +
// a new Super Admin role + the new business rules that come with them.
//
// The timeline (phase plan + module-by-module schedule) is no longer in
// this document — it lives in the companion Timeline.xlsx, generated from
// doc-assets/templates/generate_timeline.js.
//
// Out of this document: impersonation and task delegation (still deferred);
// subscription billing / payment processing (manual only); custom domains
// and per-organization branding.
//
// Why the redesign (rejection feedback on v6.5):
//   1. Too much repetition of v1 material already in prior Solution Overviews.
//   2. The Modules table mixed v1 features (already shipped) with new work.
//   3. Assumptions section was carrying nothing new since v6.5.
// Fixes applied:
//   - Single-line framing replaces the Before/After table.
//   - Existing modules show ONLY gaps (features column dropped — every
//     listed item is a feature that is not working or missing).
//   - Master Data Administration and Settings appear as missing-module gaps
//     (they should have been in v1 but were baked into code instead).
//   - "New Modules" renamed to "New Features".
//   - Business Rules split into "New" and "Updated"; pure duplicates of
//     existing v1 BLs are removed.
//   - Assumptions section removed (no new assumptions since v6.5).
//   - Out of Scope trimmed to items still relevant.
//
// Per Rule 28: this JS is the source of truth. Never hand-edit the .docx.
// Regenerate with:
//     node doc-assets/templates/generate_solution_overview.js
// or
//     npm --prefix doc-assets run build:solution-overview
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, AlignmentType,
        LevelFormat, BorderStyle, Table, TableRow, TableCell, WidthType,
        ShadingType, Header, Footer, PageNumber, TableLayoutType,
        PageBreak, HeightRule } = require('docx');

const OUTPUT_PATH = path.resolve(__dirname, '..', '..', 'docs', 'product', 'Solution_Overview.docx');

// ─────────────────────────────────────────────────────────────────────────────
// GharSetu brand palette — kept aligned with generate_project_report.js so the
// two documents read as a single visual family.
// ─────────────────────────────────────────────────────────────────────────────
const COLOR = {
  navy:        '1A237E', // title, banners, H1, callout accents
  royalBlue:   '1565C0', // emphasis lead lines, sub-banner accents
  saffron:     'FF6F00', // hairline, ALL-CAPS labels, highlight callouts
  charcoal:    '212121', // body text
  slate:       '546E7A', // footer + soft secondary text
  white:       'FFFFFF',
  red:         'C62828', // status flags

  // Banner + callout fills (match project_report)
  bannerNavy:    '1A237E', // solid navy major banner
  bannerLight:   'E8EDF7', // soft light-navy sub-banner fill
  calloutFill:   'F1F4FA', // off-white callout
  saffronWash:   'FFF4E6', // soft saffron callout fill ("What this is NOT")
  tableHeadNavy: '1A237E', // table header row
  tableStripe:   'F4F6FB', // alternating row stripe
  border:        'CFD8DC',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Plain charcoal body run at base size 22 (11pt).
const r = (text, opts = {}) => new TextRun({
  text,
  bold: opts.bold || false,
  italics: opts.italics || false,
  color: opts.color || COLOR.charcoal,
  size: opts.size || 22,
  font: opts.font || 'Arial',
});

// Bold navy run — used as "bold lead" sentence starters in bullets.
const bn = (text) => r(text, { bold: true, color: COLOR.navy });

// Blank spacing line.
const spacer = (after = 120) => new Paragraph({
  spacing: { before: 0, after },
  children: [new TextRun('')],
});

// Body paragraph — accepts a string or an array of TextRuns.
const body = (runs, opts = {}) => new Paragraph({
  alignment: opts.alignment,
  spacing: { before: opts.before ?? 0, after: opts.after ?? 120 },
  children: Array.isArray(runs) ? runs : [r(runs)],
});

// Level-0 bullet (filled disc)
const bullet = (runs, opts = {}) => new Paragraph({
  numbering: { reference: 'so-bullets', level: 0 },
  spacing: { before: 0, after: opts.after ?? 80 },
  children: Array.isArray(runs) ? runs : [r(runs)],
});

// Level-1 nested bullet (open circle)
const subBullet = (runs) => new Paragraph({
  numbering: { reference: 'so-bullets', level: 1 },
  spacing: { before: 0, after: 80 },
  children: Array.isArray(runs) ? runs : [r(runs)],
});

// ALL-CAPS saffron section label with letter tracking.
const capsLabel = (text) => new Paragraph({
  spacing: { before: 200, after: 80 },
  children: [new TextRun({
    text: text.toUpperCase(),
    bold: true,
    color: COLOR.saffron,
    size: 20,
    font: 'Arial',
    characterSpacing: 20,
  })],
});

// Major section header — large navy text with saffron hairline underneath
// (no fill, large title, saffron rule — same style used on the cover hairline).
const solidBanner = (text) => new Paragraph({
  spacing: { before: 0, after: 280 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR.saffron, space: 1 } },
  children: [new TextRun({
    text, bold: true, size: 40, color: COLOR.navy, font: 'Arial',
  })],
});

// Soft sub-banner — module / day header. Light fill + chunky navy left bar.
const softBanner = (text) => new Table({
  width: { size: 10080, type: WidthType.DXA },
  columnWidths: [10080],
  layout: TableLayoutType.FIXED,
  borders: {
    top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left:   { style: BorderStyle.SINGLE, size: 24, color: COLOR.navy },
    right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideVertical:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  },
  rows: [new TableRow({
    children: [new TableCell({
      width: { size: 10080, type: WidthType.DXA },
      shading: { fill: COLOR.bannerLight, type: ShadingType.CLEAR },
      margins: { top: 120, bottom: 120, left: 220, right: 220 },
      children: [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({
          text, bold: true, color: COLOR.navy, size: 24, font: 'Arial',
        })],
      })],
    })],
  })],
});

// Saffron-bar callout — used for "What this is NOT" / "Out of scope" highlights.
const saffronCallout = (titleText, lines) => new Table({
  width: { size: 10080, type: WidthType.DXA },
  columnWidths: [10080],
  layout: TableLayoutType.FIXED,
  borders: {
    top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left:   { style: BorderStyle.SINGLE, size: 24, color: COLOR.saffron },
    right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideVertical:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  },
  rows: [new TableRow({
    children: [new TableCell({
      width: { size: 10080, type: WidthType.DXA },
      shading: { fill: COLOR.saffronWash, type: ShadingType.CLEAR },
      margins: { top: 180, bottom: 180, left: 260, right: 260 },
      children: [
        new Paragraph({
          spacing: { before: 0, after: 120 },
          children: [new TextRun({
            text: titleText, bold: true, color: COLOR.saffron, size: 22, font: 'Arial',
          })],
        }),
        ...lines.map(line => new Paragraph({
          spacing: { before: 0, after: 60 },
          children: Array.isArray(line) ? line : [r(line)],
        })),
      ],
    })],
  })],
});

// Plain navy-bar callout (audience / purpose style).
const navyCallout = (paragraphs) => new Table({
  width: { size: 10080, type: WidthType.DXA },
  columnWidths: [10080],
  layout: TableLayoutType.FIXED,
  borders: {
    top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left:   { style: BorderStyle.SINGLE, size: 24, color: COLOR.navy },
    right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideVertical:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  },
  rows: [new TableRow({
    children: [new TableCell({
      width: { size: 10080, type: WidthType.DXA },
      shading: { fill: COLOR.calloutFill, type: ShadingType.CLEAR },
      margins: { top: 180, bottom: 180, left: 260, right: 260 },
      children: paragraphs,
    })],
  })],
});

// Saffron hairline (cover-page accent)
const titleHairline = () => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR.saffron, space: 1 } },
  spacing: { before: 0, after: 280 },
});

// Cell helpers for grid tables
const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: COLOR.border };
const cellBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

const headerCell = (text, width) => new TableCell({
  borders: cellBorders,
  width: { size: width, type: WidthType.DXA },
  shading: { fill: COLOR.tableHeadNavy, type: ShadingType.CLEAR },
  margins: { top: 100, bottom: 100, left: 140, right: 140 },
  children: [new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({ text, bold: true, color: COLOR.white, size: 20, font: 'Arial' })],
  })],
});

const bodyCell = (text, width, opts = {}) => new TableCell({
  borders: cellBorders,
  width: { size: width, type: WidthType.DXA },
  shading: opts.stripe ? { fill: COLOR.tableStripe, type: ShadingType.CLEAR } : undefined,
  margins: { top: 90, bottom: 90, left: 140, right: 140 },
  children: [new Paragraph({
    spacing: { before: 0, after: 0 },
    children: [new TextRun({
      text, bold: !!opts.bold,
      color: opts.color || COLOR.charcoal,
      size: 20, font: 'Arial',
    })],
  })],
});

// Cell containing multiple paragraphs (typically bullets).
const multiCell = (paragraphs, width, opts = {}) => new TableCell({
  borders: cellBorders,
  width: { size: width, type: WidthType.DXA },
  shading: opts.stripe ? { fill: COLOR.tableStripe, type: ShadingType.CLEAR } : undefined,
  margins: { top: 90, bottom: 90, left: 140, right: 140 },
  children: paragraphs,
});

// Small cell-internal bullet (size 20 to fit table density).
const cellBullet = (runs) => new Paragraph({
  numbering: { reference: 'so-bullets', level: 0 },
  spacing: { before: 0, after: 40 },
  children: Array.isArray(runs)
    ? runs
    : [new TextRun({ text: runs, size: 22, font: 'Arial', color: COLOR.charcoal })],
});

// Small cell paragraph (no bullet — useful when a cell needs prose, not list).
const cellPara = (text, opts = {}) => new Paragraph({
  spacing: { before: 0, after: opts.after ?? 0 },
  children: [new TextRun({
    text, bold: !!opts.bold,
    size: 20, font: 'Arial',
    color: opts.color || COLOR.charcoal,
  })],
});

// ─────────────────────────────────────────────────────────────────────────────
// Content data
// ─────────────────────────────────────────────────────────────────────────────

// §2 — Gaps in Existing Modules (v3.1).
// Two-column table: Module / Features that are not working today.
// (v6.5's Features column is dropped — every entry here is a feature that
//  does not work or is missing. The whole table IS the gap list.)
const GAPS_IN_EXISTING_MODULES = [
  ['Users & Access',
    [
      'Create User form lets Admin pick any role; only Property Manager and Maintenance Team should be selectable. Tenants must come from lease signing, not direct creation.',
    ],
  ],
  ['Properties & Units',
    [
      'Property reassignment exposed in the UI but the action never completes.',
      'No amenities field on the property form — amenity selection cannot be recorded against a unit.',
    ],
  ],
  ['Leases & Tenants',
    [
      'Admin has no UI path to create a lease.',
      'Lease renewal cannot add or remove tenants.',
      'Early termination flow does not complete end-to-end (including tenant consent).',
    ],
  ],
  ['Maintenance Requests',
    [
      'No per-request detail view — only flat summary, no history.',
      'No role can close or reopen a request — status flow never ends.',
      'Admin cannot reassign across properties. Maintenance Team cannot change priority.',
      'PM-raised requests on a tenant’s unit do not appear on the tenant’s portal.',
      'Requests can be raised against vacant units (no active-lease gate); maintenance categories not modelled, no category field on the form.',
      '5+ maintenance requests alert missing on the Admin dashboard — when a single lease (or a single room in shared accommodation) raises 5 or more requests in one calendar month, the Admin should see an alert on the dashboard; this is not surfaced today.',
    ],
  ],
  ['Rent Collection',
    [
      'Admin has no UI path to record a payment.',
      'Late fee and outstanding amount only refresh once a day — figures on screen can be a day out of date between refreshes.',
    ],
  ],
  ['Dashboard',
    [
      'Admin and Property Manager dashboards incomplete — missing rent collection %, overdue tenant count, open maintenance by priority, and upcoming lease expirations.',
      'Maintenance Team has no working dashboard — landing errors. Needs a daily queue (assigned tickets by priority and status).',
      'Tenant has no dashboard — only a lease snapshot today. Needs rent status, outstanding, recent payments and active maintenance in one place.',
    ],
  ],
];

// §4 — New Features.
// Three brand-new feature areas to be built in this engagement.
// Same shape as the gaps table — Module / feature bullets.
const NEW_FEATURES = [
  ['Leases & Tenants — Per-Room Leasing',
    [
      [bn('Room-based leasing mode '), r('— a property is set to Room-based at creation; each room of a unit can carry its own active lease. A 4-BHK can hold up to 4 independent leases.')],
      [bn('Per-room rent, deposit, term, end date '), r('— each room lease is independent of the others on the same unit.')],
      [bn('Shared common areas '), r('— maintenance on shared areas is visible to every room tenant; room-specific work is private to the room’s tenant.')],
    ],
  ],
  ['Users & Access — Admin Impersonation',
    [
      [bn('Login-as '), r('— Admin can start an impersonation session as any Property Manager, Maintenance Team member or Tenant within their own Organization; the Admin can end the session at any time.')],
    ],
  ],
  ['Users & Access — Task Delegation',
    [
      [bn('Delegate from Admin '), r('— Admin assigns specific tasks to a Property Manager or Maintenance Team member for a defined date range.')],
      [bn('Window-bounded rights '), r('— the delegate has the extra rights only inside the window; before or after it, normal role-scope rules apply.')],
    ],
  ],
  ['Visitor Management',
    [
      [bn('Tenant pre-approval '), r('— name, phone, purpose, expected date and time.')],
      [bn('PM approval + check-in / out '), r('— approve or deny; arrival and departure timestamped.')],
    ],
  ],
  ['Master Data Administration',
    [
      [bn('Reference lists '), r('— Amenities, Maintenance Categories, Payment Methods, City, State; Admin creates, edits and deactivates them from the UI.')],
      [bn('Deactivate '), r('— deactivated entries become unselectable on new records (deactivation is only permitted once no records reference them).')],
    ],
  ],
  ['Settings',
    [
      [bn('Tunable values '), r('— late-fee rate, grace period and rent-change notice window; Admin tunes them from the UI.')],
    ],
  ],
  ['Organization Management (SAAS layer)',
    [
      [bn('Public organization sign-up '), r('— prospects submit an organization application; the request queues for Super Admin review.')],
      [bn('Super Admin approval '), r('— on approval the organization is provisioned and its first Admin is auto-created.')],
      [bn('Subscription plans '), r('— Basic / Standard / Premium catalogue managed by Super Admin; the plan caps active users.')],
      [bn('Organization lifecycle '), r('— Super Admin can view, deactivate or change the plan on any organization.')],
    ],
  ],
];

// §5 — Business Rules — only the rules that did not already appear in a
// previous Solution Overview. Restatements of existing rules (whether v1 BLs
// or rules already documented in v6.5 and earlier) are not repeated here —
// the client has those documents.
const NEW_BUSINESS_RULES = [
  ['NR-1', 'Leasing mode (Unit-based or Room-based) locks once any active lease exists on a property; switching requires terminating all active leases first.'],
  ['NR-2', 'Shared (whole-unit) maintenance requests are visible to every room tenant on the unit, the Property Manager and the Maintenance Team. Room-specific requests are visible to that room’s tenant, the Property Manager and the Maintenance Team only.'],
  ['NR-3', 'Amenities, Maintenance Categories and Payment Methods are sourced from Master Data (Admin-managed). Forms read the active list from Master Data at the time of selection; values are no longer hardcoded anywhere in the system.'],
  ['NR-4', 'Master Data entries that are in use on active records cannot be deactivated until they are no longer referenced.'],
  ['NR-5', 'Every user belongs to exactly one Organization, with the sole exception of the Super Admin. The Super Admin is a platform-level role and sits above all organizations. No other role — including Admin — can read or write outside its own Organization; the platform enforces this on every request.'],
  ['NR-6', 'Each Organization has exactly one Subscription Plan (Basic / Standard / Premium). The plan caps active users; the Super Admin can change an Organization’s plan at any time, and the new cap applies immediately to subsequent user additions.'],
  ['NR-7', 'During an Admin impersonation session, every action is recorded against the Admin in the audit log — never the impersonated user. The Admin cannot impersonate the Super Admin, and cannot impersonate users outside their own Organization.'],
  ['NR-8', 'A delegated task runs under the delegate (Property Manager or Maintenance Team) inside the Admin-defined date range. Actions during the delegation window are recorded against the delegate, not the Admin. Outside the window the delegate has no extra rights.'],
];

// Timeline moved out — see doc-assets/templates/generate_timeline.js
// (Phase Overview + Module Schedule sheets in docs/product/Timeline.xlsx).

// ─────────────────────────────────────────────────────────────────────────────
// §5 — Details data: Subscription Plans, Impersonation Scope, Settings Defaults
// (Delegation is rendered as a single-paragraph broad-framing statement —
//  no table needed for it.)
// ─────────────────────────────────────────────────────────────────────────────

const SUBSCRIPTION_PLANS = [
  ['Plan',     'Active-user cap', 'Scope'],
  ['Basic',    '5 users',         'Limited features'],
  ['Standard', '20 users',        'Core features'],
  ['Premium',  'Unlimited',       'All features'],
];

const IMPERSONATION_SCOPE = [
  ['Target role',      'Within own Organization', 'Cross-organization'],
  ['Property Manager', '✓',                       '✗'],
  ['Maintenance Team', '✓',                       '✗'],
  ['Tenant',           '✓',                       '✗'],
  ['Super Admin',      '✗',                       '✗'],
];

const SETTINGS_DEFAULTS = [
  ['Setting',                 'Default',             'Tunable range'],
  ['Late-fee rate',           '2% per full week',    '0% – 10%'],
  ['Grace period',            '5 days',              '0 – 15 days'],
  ['Rent-change notice window','60 days',            '30 – 90 days'],
];

// ─────────────────────────────────────────────────────────────────────────────
// §6 — Assumptions
// Kept tight (5 bullets max). Bullets stating what the platform assumes
// about data, IDs, communications and sign-off cadence.
// ─────────────────────────────────────────────────────────────────────────────
const ASSUMPTIONS = [
  [bn('Data migration '), r('— existing v1 data (users, properties, units, leases, payments, audit log) is moved into a single default Organization. Working name: '), r('GharSetu Solutions', { bold: true }), r(' — final name to be confirmed before kickoff.')],
  [bn('ID continuity '), r('— existing user, property, unit, lease and payment IDs are preserved through the migration; no external integration breaks.')],
  [bn('Email scope '), r('— existing transactional emails (password reset, rent-change notification) continue working unchanged.')],
];

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'Aayush Kumar',
  title: 'GharSetu — Solution Overview',
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 22, color: COLOR.charcoal } },
    },
  },
  numbering: {
    config: [{
      reference: 'so-bullets',
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 540, hanging: 280 } } },
        },
        {
          level: 1,
          format: LevelFormat.BULLET,
          text: '◦',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 280 } } },
        },
      ],
    }],
  },
  sections: [
    // ════════════════════════════════════════════════════════════════════════
    // SECTION 1 — Cover page (portrait, no footer)
    // ════════════════════════════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1080, bottom: 1080, left: 1080 },
        },
        titlePage: true,
      },
      headers: {
        default: new Header({ children: [new Paragraph({ children: [new TextRun('')] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ children: [new TextRun('')] })] }),
      },
      children: [
        // top breathing room
        new Paragraph({ spacing: { before: 2400, after: 0 }, children: [new TextRun('')] }),

        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 480 },
          children: [new TextRun({
            text: 'GharSetu — Solution Overview',
            bold: true, size: 64, color: COLOR.navy, font: 'Arial',
          })],
        }),

        // Saffron hairline (centred via empty inline borders — wider through margins)
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: COLOR.saffron, space: 1 } },
          spacing: { before: 0, after: 1200 },
        }),

        // Draft marker / Date / Prepared by + contact / Prepared for
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 240 },
          children: [
            new TextRun({ text: 'DRAFT', bold: true, italics: true, size: 28, color: COLOR.saffron, font: 'Arial', characterSpacing: 40 }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [
            new TextRun({ text: 'Date: ', bold: true, size: 26, color: COLOR.charcoal, font: 'Arial' }),
            new TextRun({ text: '26 May 2026', size: 26, color: COLOR.charcoal, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 80 },
          children: [
            new TextRun({ text: 'Prepared by: ', bold: true, size: 26, color: COLOR.charcoal, font: 'Arial' }),
            new TextRun({ text: 'Aayush Kumar, Triline', size: 26, color: COLOR.charcoal, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [
            new TextRun({ text: 'Contact: ', bold: true, size: 22, color: COLOR.slate, font: 'Arial' }),
            new TextRun({ text: 'aayush@triline.co.in', size: 22, color: COLOR.slate, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new TextRun({ text: 'Prepared for: ', bold: true, size: 26, color: COLOR.charcoal, font: 'Arial' }),
            new TextRun({ text: 'GharSetu Operations', size: 26, color: COLOR.charcoal, font: 'Arial' }),
          ],
        }),

        // Page break to start the body
        new Paragraph({ children: [new PageBreak()] }),
      ],
    },

    // ════════════════════════════════════════════════════════════════════════
    // SECTION 2 — Body (portrait, footer with page N of M)
    // ════════════════════════════════════════════════════════════════════════
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      headers: {
        default: new Header({ children: [new Paragraph({ children: [new TextRun('')] })] }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'GharSetu  —  Solution Overview  ·  Page ', size: 18, color: COLOR.slate, font: 'Arial' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COLOR.slate, font: 'Arial' }),
              new TextRun({ text: ' of ', size: 18, color: COLOR.slate, font: 'Arial' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: COLOR.slate, font: 'Arial' }),
            ],
          })],
        }),
      },
      children: [
        // ────────────────────────────────────────────────────────────────────
        // §1 — Fixes in Existing Modules
        // (Single-column gap list — each row names the module and the fixes
        //  we will deliver for it in this engagement.)
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Fixes in Existing Modules'),

        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [2400, 7680],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                headerCell('Module', 2400),
                headerCell('Fixes', 7680),
              ],
            }),
            ...GAPS_IN_EXISTING_MODULES.map(([label, gaps], i) => new TableRow({
              children: [
                bodyCell(label, 2400, { bold: true, color: COLOR.navy, stripe: i % 2 === 1 }),
                multiCell(gaps.map(t => cellBullet(t)), 7680, { stripe: i % 2 === 1 }),
              ],
            })),
          ],
        }),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §2 — New Roles
        // One new role: Super Admin (platform-level, above all organizations).
        // The four existing roles (Admin, Property Manager, Maintenance Team,
        // Tenant) continue unchanged — Admin remains scoped to its own
        // organization; only Super Admin crosses organization boundaries.
        // ────────────────────────────────────────────────────────────────────
        solidBanner('New Roles'),

        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [2400, 7680],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                headerCell('Role', 2400),
                headerCell('Key capabilities', 7680),
              ],
            }),
            new TableRow({
              children: [
                bodyCell('Super Admin', 2400, { bold: true, color: COLOR.navy }),
                multiCell([
                  cellBullet('Review and approve organization sign-up requests; on approval, provision the organization and auto-create its first Admin.'),
                  cellBullet('Manage the Subscription Plan catalogue (Basic / Standard / Premium) and assign or change the plan on any organization.'),
                  cellBullet('View, deactivate or reactivate any organization on the platform.'),
                  cellBullet('Cross-organization visibility — the only role that reads across organization boundaries.'),
                ], 7680),
              ],
            }),
          ],
        }),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §3 — New Features
        // (Renamed from "New Modules". Same shape as §1: Module / bullets.)
        // ────────────────────────────────────────────────────────────────────
        solidBanner('New Features'),

        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [2400, 7680],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                headerCell('Module', 2400),
                headerCell('Features added', 7680),
              ],
            }),
            ...NEW_FEATURES.map(([label, features], i) => new TableRow({
              children: [
                bodyCell(label, 2400, { bold: true, color: COLOR.navy, stripe: i % 2 === 1 }),
                multiCell(features.map(t => cellBullet(t)), 7680, { stripe: i % 2 === 1 }),
              ],
            })),
          ],
        }),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §4 — Business Rules
        // Only rules that are genuinely new in this engagement. Restatements
        // of v1 BLs or of rules already documented in earlier Solution
        // Overviews are not repeated — the client has those documents.
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Business Rules'),

        ...NEW_BUSINESS_RULES.map(([, text]) => bullet([r(text)])),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §5 — Details
        // Three reference tables that turn the vague phrases in §3 / §4 into
        // concrete numbers + scope grids:
        //   • Subscription Plans (caps + scope)
        //   • Admin Impersonation Scope (who can be impersonated)
        //   • Settings Defaults (default values + tunable ranges)
        // Plus a single-paragraph framing for Admin Task Delegation.
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Details'),

        capsLabel('Subscription Plans'),
        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [2400, 3000, 4680],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: SUBSCRIPTION_PLANS[0].map((h, i) =>
                headerCell(h, [2400, 3000, 4680][i])
              ),
            }),
            ...SUBSCRIPTION_PLANS.slice(1).map((row, i) => new TableRow({
              children: row.map((v, c) =>
                bodyCell(v, [2400, 3000, 4680][c], { bold: c === 0, color: c === 0 ? COLOR.navy : COLOR.charcoal, stripe: i % 2 === 1 })
              ),
            })),
          ],
        }),
        spacer(200),

        capsLabel('Admin Impersonation Scope'),
        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [3360, 3360, 3360],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: IMPERSONATION_SCOPE[0].map((h, i) =>
                headerCell(h, [3360, 3360, 3360][i])
              ),
            }),
            ...IMPERSONATION_SCOPE.slice(1).map((row, i) => new TableRow({
              children: row.map((v, c) =>
                bodyCell(v, [3360, 3360, 3360][c], { bold: c === 0, color: c === 0 ? COLOR.navy : COLOR.charcoal, stripe: i % 2 === 1 })
              ),
            })),
          ],
        }),
        spacer(200),

        capsLabel('Admin Task Delegation'),
        body('An Admin can delegate any action they themselves are authorised to perform, to a Property Manager or Maintenance Team member within their own Organization, for a defined date range. Outside that window the delegate has no extra rights.', { after: 200 }),

        capsLabel('Settings — Defaults and Tunable Ranges'),
        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [3360, 3360, 3360],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: SETTINGS_DEFAULTS[0].map((h, i) =>
                headerCell(h, [3360, 3360, 3360][i])
              ),
            }),
            ...SETTINGS_DEFAULTS.slice(1).map((row, i) => new TableRow({
              children: row.map((v, c) =>
                bodyCell(v, [3360, 3360, 3360][c], { bold: c === 0, color: c === 0 ? COLOR.navy : COLOR.charcoal, stripe: i % 2 === 1 })
              ),
            })),
          ],
        }),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §6 — Assumptions
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Assumptions'),

        ...ASSUMPTIONS.map(runs => bullet(runs)),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §7 — Out of Scope
        // Two items only — both restated here (despite appearing in v6.5)
        // because the new SAAS scope makes them easy to assume incorrectly.
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Out of Scope'),

        bullet('Custom domains and per-organization branding (logo, colours) — not available in this engagement.'),
        bullet('Billing for Subscription Plans — manual invoicing only; no payment-gateway integration.'),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §8 — Next Steps
        // Draft. No formal sign-off block — once the scope is locked, a final
        // version will be issued with the approval block re-added.
        // ────────────────────────────────────────────────────────────────────
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR.saffron, space: 8 } },
          children: [new TextRun({
            text: 'Next Steps',
            bold: true, size: 40, color: COLOR.navy, font: 'Arial',
          })],
        }),
        spacer(160),

        body('Once the scope is confirmed, work begins. Any clarifications or copy edits may be returned with this document; scope changes will trigger a revised plan.'),
        spacer(360),

        // Closing saffron hairline
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR.saffron, space: 1 } },
          spacing: { before: 200, after: 0 },
        }),
      ],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT_PATH, buffer);
  console.log(`Document written to: ${OUTPUT_PATH}`);
  console.log(`Size: ${buffer.length} bytes`);
});
