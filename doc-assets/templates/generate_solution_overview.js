// ─────────────────────────────────────────────────────────────────────────────
// generate_solution_overview.js
// ─────────────────────────────────────────────────────────────────────────────
// Source-of-truth generator for docs/product/Solution_Overview.docx
//
// Restructured 29 May 2026 per client feedback. Document shape:
//   1. Cover (date · prepared-by · prepared-for)
//   2. Introduction (what GharSetu is + what this document covers)
//   3. Incomplete Features in Current System (8 modules — features in
//      the current build that are not working or are missing; pointer
//      to a separate Bugs & Gaps Excel sheet)
//   4. New Features as Per Requirement (5 sub-sections):
//        3.1 Leases & Tenants — Per-Room Leasing
//        3.2 Users & Access — Admin Impersonation
//        3.3 Users & Access — Task Delegation
//        3.4 Visitor Management
//        3.5 Organization Management (SAAS layer — incl. Super Admin role)
//   5. Business Rules (NR-1 … NR-8 — unchanged)
//   6. Out of Scope (custom domains/branding + manual billing — unchanged)
//   7. Next Steps (unchanged)
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

// Sub-header within a capsLabel section — navy bold, sentence case, no tracking.
const subLabel = (text) => new Paragraph({
  spacing: { before: 120, after: 60 },
  children: [new TextRun({
    text,
    bold: true,
    color: COLOR.navy,
    size: 22,
    font: 'Arial',
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

// §3 — Incomplete Features in Current System.
// Features in the current system that are not working or are missing — to be
// addressed in this engagement. The first 6 rows describe gaps in modules that
// already exist in v1; the last 2 rows surface modules that should exist but
// were baked into code instead.
// Short feature-label bullets per module — the document names the broken
// feature areas; the companion Bugs & Gaps Excel sheet carries every
// individual bug. This keeps the section to ≤ 2 pages.
const GAPS_IN_EXISTING_MODULES = [
  ['Users & Access',
    [
      'User Management',
    ],
  ],
  ['Properties & Units',
    [
      'Property Management',
      'Unit Management',
      'Reassign Property Manager',
    ],
  ],
  ['Leases & Tenants',
    [
      'Lease Creation',
      'Lease Renewal',
      'Lease Termination',
      'Rent Change Schedule',
      'Tenant Creation',
    ],
  ],
  ['Maintenance Requests',
    [
      'Request Detail View',
      'Status Lifecycle (Close & Reopen)',
      'Priority Change During Request',
      'High-Volume Request Alert',
    ],
  ],
  ['Rent Collection',
    [
      'Record Payment',
      'Partial Payment Tracking',
      'Period Filters',
    ],
  ],
  ['Dashboard',
    [
      'Admin Dashboard',
      'Property Manager Dashboard',
      'Maintenance Team Dashboard',
      'Tenant Dashboard',
    ],
  ],
  ['Settings',
    [
      'Late-Fee Rate',
      'Grace Period',
      'Rent-Change Notice Window',
    ],
  ],
  ['Master Data Management',
    [
      'Amenities',
      'Maintenance Categories',
    ],
  ],
  ['Server Hardening',
    [
      'Access control — tenant / Property Manager / Maintenance each scoped to their own data only',
      'Data integrity — balances, late fees and period status derived at query time; deposit refunds append-only',
      'Concurrency — database-level guards against two active leases on a unit and double-credited payments',
      'Observability — append-only audit log on every critical mutation (lease, termination, refund, rent change, maintenance)',
      'Performance — all list endpoints paginated; rolling 30-day maintenance counts indexed, not full-table-scanned',
      'Security — tenant PII and bank reference numbers redacted from search results except where explicitly needed',
    ],
  ],
];

// §4 — New Features as Per Requirement
// Each sub-section is rendered as a capsLabel + either bullets or a single
// body paragraph (depending on the sub-section's natural shape).

// 3.1 — Leases & Tenants — Per-Room Leasing
const PER_ROOM_LEASING_BULLETS = [
  [r('You can now add '), bn('rooms'), r(' under any unit.')],
  [r('You can now create two types of lease — '), bn('unit-wise'), r(' or '), bn('room-wise'), r(' — directly from the Create Lease page.')],
  [bn('Shared areas'), r(' can now be added at unit creation time, with an option to manage them from Master Data.')],
  [bn('Maintenance requests'), r(' are now two types for any lease — unit-wise or room-wise. On a room-based lease, the tenant can also select a '), bn('shared area'), r(' or a '), bn('specific room'), r(' as the location of the maintenance request.')],
];

// 3.2 — Users & Access — Admin Impersonation (bullets)
const IMPERSONATION_BULLETS = [
  [r('An Admin can '), bn('sign in as any other user'), r(' in their Organization (Property Manager, Maintenance Team member or Tenant) and perform actions on that user’s behalf.')],
  [r('Every action taken during the impersonation session is recorded against the '), bn('Admin'), r(', not the impersonated user.')],
];

// 3.3 — Users & Access — Task Delegation (bullets)
const DELEGATION_BULLETS = [
  [r('An Admin can '), bn('delegate selected tasks'), r(' to a Property Manager or a Maintenance Team member for a specified date range, and can revoke the delegation at any time.')],
  [r('Any action the delegate performs while the delegation is active is recorded against the '), bn('delegate'), r(', not the Admin.')],
];

// 3.3 — Delegatable tasks, grouped by area (mirrors the New Delegation page).
// Rendered as a sub-table under the Delegation sub-section.
const DELEGATION_TASKS = [
  ['Property & Inventory', 'Add Property, Edit Property Settings, Retire Property, Add Unit, Edit Unit, Edit Unit Rent, Retire Unit, Manage Rooms'],
  ['Leases', 'Create Lease, Terminate Lease, Schedule Rent Change'],
  ['Rent & Payments', 'Record Payment'],
  ['Maintenance', 'Create Maintenance Request, Assign Maintenance Staff, Close Maintenance Request, Reopen Maintenance Request'],
  ['Visitors', 'Approve / Deny Visitors, Check-in / Check-out Visitors'],
  ['Users & Team', 'Add User (PM / Maintenance), Edit User, Reset User Password, Activate / Deactivate User'],
  ['Master Data', 'Manage Property Types, Manage Amenities, Manage Specializations, Manage Categories, Manage Visit Purposes'],
  ['Audit & Reports', 'View Audit Log'],
];

// 3.4 — Visitor Management (bullets)
const VISITOR_BULLETS = [
  [r('A new '), bn('Visitor Management'), r(' page is added.')],
  [r('Tenants can '), bn('register expected visitors'), r('.')],
  [r('The Property Manager or Admin can '), bn('approve, deny and mark check-in / check-out'), r(' for each visit.')],
];

// 3.5 — Organization Management (SAAS layer) — bullets with bold-lead first phrase
const ORG_MGMT_BULLETS = [
  [bn('Multi-organization migration '), r('— the current system is converted into a multi-organization platform; existing data is migrated into a new "default" organization.')],
  [bn('Public organization sign-up '), r('— any organization can now sign up to the platform from the Sign Up page.')],
  [bn('Public website + legal pages '), r('— the current homepage is reworked into a public marketing site that displays the subscription plans, and three new public pages are added: Contact, Privacy Policy, and Terms & Conditions.')],
  [bn('New Super Admin role '), r('— a new platform-level role is introduced. The Super Admin reviews and approves organization sign-up requests; on approval the organization is provisioned and its first Admin is auto-created.')],
  [bn('Subscription Plan catalogue '), r('— the Super Admin manages the Subscription Plan catalogue (Basic / Standard / Premium) and assigns or changes the plan on any organization.')],
  [bn('Organization lifecycle '), r('— the Super Admin can view, deactivate or reactivate any organization on the platform.')],
  [bn('Invoicing '), r('— the Super Admin can manage invoices for every organization.')],
  [bn('Legal pages and contact queries '), r('— the Super Admin manages the public Legal pages (Privacy Policy, Terms & Conditions) and can view incoming Contact queries and mark their status.')],
  [bn('Platform-level Master Data '), r('— the Super Admin manages a few platform-level master lists (city, state, payment methods, etc.) so that these values stay uniform across every organization on the platform.')],
  [bn('Admin Organization view '), r('— every Admin now has a new page showing their own organization’s details, subscription plan and invoices.')],
];

// §5 — Business Rules — kept verbatim from v8.
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
            new TextRun({ text: '29 May 2026', size: 26, color: COLOR.charcoal, font: 'Arial' }),
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
        // §1 — Introduction
        // Two short paragraphs: what GharSetu is, what this document covers.
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Introduction'),

        body('GharSetu is a property-rental management platform that helps property owners and their teams run their day-to-day operations — properties, units, tenants, leases, rent collection, maintenance and visitors — in a single web-based system.', { after: 160 }),
        body('This document captures the current state of the existing GharSetu system, the new features being added in this engagement, and the rules and scope that frame the work.', { after: 200 }),
        spacer(160),

        // ────────────────────────────────────────────────────────────────────
        // §2 — Incomplete Features in Current System
        // Features in the current system that are not working or are missing —
        // to be addressed in this engagement. 8 modules total: 6 inherited
        // from the v1 gap list + 2 new module-level rows (Settings, Master
        // Data Management) that should have existed but were baked into code.
        // A closing pointer paragraph defers per-bug detail to a separate
        // Bugs & Gaps Excel sheet so this document stays readable.
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Incomplete Features in Current System'),

        // Audit summary — sets the scale before the per-module table.
        // Sourced from the GharSetu Bug Report audit (100 individual issues
        // across every operational module). Patterns are grouped so the
        // client can see the systemic nature of the defects rather than a
        // long flat bug list. The full enumeration is in the companion
        // Bugs & Gaps Excel sheet shared with this document.
        body('An audit of the existing system identified approximately 100 individual issues across every operational module — bugs, missing features and incomplete user journeys. The full enumeration is provided as a separate Bugs & Gaps Excel sheet shared alongside this document. The table below names the major incomplete features per module.', { after: 160 }),

        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [2400, 7680],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                headerCell('Module', 2400),
                headerCell('Incomplete features', 7680),
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
        // §3 — New Features as Per Requirement
        // Five sub-sections, each introduced with a saffron capsLabel and
        // followed by either bullets or a single body paragraph depending on
        // its natural shape. The Super Admin role is described inside §3.5
        // Organization Management (no separate "New Roles" section).
        // ────────────────────────────────────────────────────────────────────
        solidBanner('New Features as Per Requirement'),

        // 3.1 — Per-Room Leasing
        capsLabel('Leases & Tenants — Per-Room Leasing'),
        ...PER_ROOM_LEASING_BULLETS.map(runs => bullet(runs)),
        spacer(160),

        // 3.2 — Users & Access (Impersonation + Delegation)
        capsLabel('Users & Access'),
        subLabel('Impersonation'),
        ...IMPERSONATION_BULLETS.map(runs => bullet(runs)),
        subLabel('Delegation'),
        ...DELEGATION_BULLETS.map(runs => bullet(runs)),
        spacer(80),
        cellPara('Tasks an Admin can delegate', { bold: true, color: COLOR.navy, after: 60 }),
        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [2700, 7380],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                headerCell('Area', 2700),
                headerCell('Tasks that can be delegated', 7380),
              ],
            }),
            ...DELEGATION_TASKS.map(([area, tasks], i) => new TableRow({
              children: [
                bodyCell(area, 2700, { bold: true, color: COLOR.navy, stripe: i % 2 === 1 }),
                bodyCell(tasks, 7380, { stripe: i % 2 === 1 }),
              ],
            })),
          ],
        }),
        spacer(200),

        // 3.4 — Visitor Management
        capsLabel('Visitor Management'),
        ...VISITOR_BULLETS.map(runs => bullet(runs)),
        spacer(160),

        // 3.5 — Organization Management (SAAS layer) — includes Super Admin role
        capsLabel('Organization Management (SAAS layer)'),
        ...ORG_MGMT_BULLETS.map(runs => bullet(runs)),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §5 — Out of Scope
        // Two items only — both restated here (despite appearing in v6.5)
        // because the new SAAS scope makes them easy to assume incorrectly.
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Out of Scope'),

        bullet('Custom domains and per-organization branding (logo, colours) — not available in this engagement.'),
        bullet('Billing for Subscription Plans — manual invoicing only; no payment-gateway integration.'),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §6 — Next Steps
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
