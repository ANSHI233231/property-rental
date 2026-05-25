// ─────────────────────────────────────────────────────────────────────────────
// generate_solution_overview.js
// ─────────────────────────────────────────────────────────────────────────────
// Source-of-truth generator for docs/product/Solution_Overview.docx
//
// This is the v3 project-plan rewrite. It closes the v1 functional gaps
// surfaced in docs/requirement/PROJECT_REPORT.docx, introduces Master Data
// Administration + System Settings, adds per-room leasing and Visitor
// Management per the Shared Accommodation brief, switches rent collection
// over to a RentSchedule history, and presents a Day-0 → Day-11 delivery
// plan for client sign-off.
//
// Visual identity is shared with generate_project_report.js — same palette,
// same banners (solid navy + soft light-blue with chunky navy left bar),
// same ALL-CAPS saffron section labels, same callout patterns, same footer.
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
// Content data — kept at top of file for editability
// ─────────────────────────────────────────────────────────────────────────────

// §2 — Modules — Features and Current Gaps (merged in v3.8, Task 14).
// Old §4 "Current State Assessment" (2-col Module / Gaps surfaced) and old §6
// "Module-wise Feature Catalogue" (3-col Module / Features / Roles & state) are
// collapsed into a single 3-col × 10-row table: Module / Features / Gaps surfaced.
// The "Roles & state" column is dropped — §3 Who Uses the Platform already
// carries role-by-role capabilities. Existing 6 modules carry the gap bullets
// lifted verbatim from old §4; the 3 new modules carry an empty Gaps cell.
//
// Each entry: [moduleLabel, featuresArray, gapsArray]
// (gapsArray is empty [] for the 3 brand-new modules — Visitor Management,
//  Master Data Administration and Settings & Audit Log.)
const FEATURE_CATALOGUE = [
  ['1. Users & Access',
    [
      [bn('Login '), r('— role-scoped routing, password reset, self-service profile.')],
      [bn('User creation '), r('— Admin adds Property Managers and Maintenance Team.')],
      [bn('Deactivation '), r('— Admin can deactivate any user.')],
    ],
    [
      'Create User form lets Admin pick any role; only Manager and Maintenance should be selectable. Tenants must come from lease signing, not direct creation.',
    ],
  ],
  ['2. Properties & Units',
    [
      [bn('Buildings, units, amenities, city '), r('— amenities and city populated from masters.')],
      [bn('Leasing mode and unit status '), r('— Unit-based or Room-based set at creation. A new unit starts as Listed; from there PM or Admin can move it to Available, Maintenance or Retired.')],
    ],
    [
      'Property reassignment exposed in the UI but the action never completes.',
      'No Amenities master and no amenities field on the property form — catalog not editable from the UI.',
    ],
  ],
  ['3. Leases & Tenants',
    [
      [bn('Creation '), r('— tenant search reuses existing records.')],
      [bn('Primary and co-tenants '), r('— each lease has one primary tenant and may have additional co-tenants.')],
      [bn('Per-room leases (Room-based) '), r('— each room leased independently with own rent, deposit, term, end date. A 4-BHK can carry up to 4 leases.')],
      [bn('Renewals and early termination '), r('— renewal creates a new record (add/remove tenants); early termination requires consent from every tenant on the lease (rule below).')],
      [bn('Rent change '), r('— supported on a lease (rule below).')],
    ],
    [
      'Admin has no UI path to create a lease.',
      'Lease renewal cannot add or remove tenants.',
      'Early termination flow does not complete end-to-end (including tenant consent).',
    ],
  ],
  ['4. Maintenance Requests',
    [
      [bn('Raise and assign '), r('— Tenant or PM raises a request; any role can set priority and emergency flags, which drive the queue.')],
      [bn('Status flow and detail '), r('— Open → Assigned → In Progress → Resolved → Closed; close and reopen by the correct role; detail page shows the full timeline.')],
      [bn('Reassignment '), r('— PM reassigns within their property; Admin reassigns across properties. Maintenance Team cannot reassign.')],
      [bn('Categorisation '), r('— from Maintenance Categories master.')],
      [bn('Scope '), r('— Shared (whole unit) or Room-specific.')],
    ],
    [
      'No per-request detail view — only flat summary, no history.',
      'No role can close or reopen a request — status flow never ends.',
      'Admin cannot reassign across properties. Maintenance Team cannot change priority.',
      'PM-raised requests on a tenant’s unit do not appear on the tenant’s portal.',
      'Requests can be raised against vacant units (no active-lease gate); maintenance categories not modelled, no category field on the form.',
    ],
  ],
  ['5. Rent Collection',
    [
      [bn('Record payments '), r('— full / partial / advance against a lease; method from the Payment Methods master.')],
    ],
    [
      'Admin has no UI path to record a payment.',
      'Late fee and total payable populated by overnight job — stale between runs.',
      'Payment methods baked into the code — not editable from the UI.',
      'Late-fee rate, grace period and rent-change notice window baked into the code — not tunable from the UI.',
    ],
  ],
  ['6. Dashboard',
    [
      [bn('Role-specific landing '), r('— first page after login; key numbers + items needing attention.')],
      [bn('Cross-links '), r('— each summary number links into its module.')],
    ],
    [
      'Maintenance Team landing returns an error — unusable as a daily queue.',
    ],
  ],
  ['7. Visitor Management  (new)',
    [
      [bn('Tenant pre-approval '), r('— name, phone, purpose, expected time.')],
      [bn('PM approval + check-in/out '), r('— approve or deny; arrival and departure timestamped.')],
    ],
    [],
  ],
  ['8. Master Data Administration  (new)',
    [
      [bn('Reference lists '), r('— Amenities, Maintenance Categories, Payment Methods, City, State; create / edit from the UI.')],
      [bn('Deactivate '), r('— deactivated entries become unselectable on new records; existing records keep them.')],
    ],
    [],
  ],
  ['9. Settings  (new)',
    [
      [bn('Tunable settings '), r('— late-fee rate, grace period, rent-change notice window; applied when rent, balance and late fees are calculated.')],
    ],
    [],
  ],
  ['10. Organization Management  (new, SAAS layer)',
    [
      [bn('Org sign-up and approval '), r('— new organisations queue for Super Admin approval; first Admin auto-created on approval.')],
      [bn('Subscription plans '), r('— Basic / Standard / Premium catalogue managed by Super Admin.')],
      [bn('Organisation lifecycle '), r('— Super Admin can view, deactivate or change the plan on any organisation.')],
    ],
    [],
  ],
];

// §2 — Per-role key capabilities (replaces the old 4-col §6 grid AND old §8 role matrix from v3.2).
// (Was §5 in v3.6 — became §3 in v3.7 after Who-Uses moved directly under What-We-Heard.
//  Unchanged in v3.8 — Task 14 merged the Current State and Module Catalogue tables but
//  did not touch the Who Uses section.)
// Each entry: [roleLabel, capabilityBullets[]]
const ROLE_CAPABILITIES = [
  ['Super Admin', 'Manage organisations (approve, deactivate, view), Manage subscription plans, Cross-organisation oversight'],
  ['Admin', 'Everything a Property Manager can do (portfolio-wide for own organisation), Platform configuration, Oversight, Impersonate Property Manager, Maintenance or Tenant, Delegate tasks to Property Manager or Maintenance for a date range'],
  ['Property Manager', 'Operate assigned properties end-to-end, Leases and rent, Maintenance, Visitors'],
  ['Maintenance Team', 'Work on assigned maintenance requests'],
  ['Tenant', 'Lease and rent, Maintenance, Early-termination consent, Visitors'],
];

// §2 — Business rules
// (Was §7 in v3.7 — became §6 in v3.8 after old §4 Current State Assessment
//  was deleted and the data merged into §5 as a new "Gaps surfaced" column.)
const BUSINESS_RULES = [
  // Users
  ['BR-1', 'Tenant accounts are auto-created at lease signing; the Users page cannot create them.'],
  // Properties & Units
  ['BR-2', 'Each property has one active Property Manager; a Property Manager can manage multiple properties.'],
  ['BR-3', 'After reassignment, the previous Property Manager retains view-only access during handover.'],
  ['BR-4', 'Leasing mode (Unit-based or Room-based) locks once any active lease exists; switching requires terminating all active leases first.'],
  // Leases & Tenants
  ['BR-5', 'No unit holds two active leases at the same scope. On Room-based properties, each room allows one active lease, and unit-scope and room-scope leases cannot coexist on the same unit. Enforced by the system; cannot be bypassed in the UI.'],
  ['BR-6', 'An occupied unit cannot change status (to Listed, Available, Maintenance or Retired) until the active lease ends.'],
  ['BR-7', 'A lease can only be terminated early when every tenant on it consents. The Property Manager (or Admin) collects consent in person or over the phone and confirms it on the termination form; the lease is then terminated.'],
  ['BR-8', 'All tenants on a lease are jointly liable for unpaid rent.'],
  // Maintenance
  ['BR-9', 'Maintenance requests require an active lease on the unit or room.'],
  ['BR-10', 'Maintenance Team cannot raise requests; only Tenants and Property Managers can.'],
  ['BR-11', 'Only the Maintenance Team can move a request into "In Progress". Other roles can raise, assign, comment and close, but not run the work.'],
  ['BR-12', 'A resolved request can be closed by the Tenant, Property Manager or Admin; no auto-close. Resolved requests can be reopened; closed requests cannot.'],
  ['BR-13', 'Shared requests are visible to every room tenant on the unit, the Property Manager, and the Maintenance Team. Room-specific requests are visible to that room’s tenant, the Property Manager, and the Maintenance Team only.'],
  ['BR-14', 'The 5+ requests alert counts per-room for Room-specific and per-unit for Shared.'],
  // Rent Collection
  ['BR-15', 'Rent is monthly; due date matches the lease start day each calendar month.'],
  ['BR-16', 'If the lease starts on the 31st, shorter months use the last day as that month’s due date.'],
  ['BR-17', 'Rent changes are scheduled in advance with a 60-day minimum notice window; tenants are notified by email when a change is scheduled. The notice window is tunable in System Settings.'],
  ['BR-18', 'Rent collected for any period uses the rate effective on that period’s due date — never the current rate.'],
  ['BR-19', 'Overpayments auto-credit forward to the next period; overpaid periods never show a negative balance.'],
  ['BR-20', 'A unit period is shown as Overdue starting on day 6 past the due date (the 5-day grace period sits inside the first week).'],
  ['BR-21', 'Late fee: 2% of the current month’s outstanding per full week past due, non-compounding — always on the original outstanding, never on outstanding plus prior fees. The 2% rate and 5-day grace are tunable in System Settings.'],
  ['BR-22', 'Security deposit refunds are recorded as new entries; original deposit records are never edited or overwritten.'],
  // Master Data
  ['BR-23', 'Master data entries in use on active records cannot be deactivated until no longer referenced.'],
  // SAAS / Audit
  ['BR-24', 'Every user belongs to exactly one Organisation; no cross-org reads or writes, except the Super Admin.'],
  ['BR-25', 'The Organisation’s Subscription Plan caps active users; Super Admin sets it and can change it at any time.'],
  ['BR-26', 'Admin impersonation records actions under the Admin’s name, never the impersonated user’s. Admin cannot impersonate the Super Admin.'],
  ['BR-27', 'A delegated task runs under the delegate’s name (Property Manager or Maintenance) during the delegation window — never the Admin’s. Admin sets the window at creation; outside it, the delegate has no extra rights.'],
  ['BR-28', 'Administrative writes (master data, settings, leases, payments, status changes) are recorded to a permanent audit log that cannot be edited or deleted.'],
];

// §2 — Day-by-day plan
// (Was §12 in v3.7 — became §11 in v3.8 after old §4 was deleted.)
// Each day: [label, theme, deliverables[], owners, doneWhen]
const DAY_PLAN = [
  ['Day 1 — Foundations: Feature Planning and Design Documents',
    'Detail every feature, map cross-file dependencies, and lock the visual system the build will follow.',
    [
      'Detailed feature-wise planning — every feature mapped to the files it touches, including cross-file dependencies, so we know which modules are independent and which must be built together.',
      'Design Documents — page layouts, color system, typography and component spec; the visual contract every module conforms to.',
      'Output: a feature list (independent vs dependent modules) and Design Documents the build will implement against.',
    ],
    'Team Lead drives planning; design system locked.',
    'A complete feature list with cross-dependencies is published. Design Documents are approved and ready for the prototype phase.',
  ],
  ['Day 2 — Foundations: Prototype',
    'Build the prototype based on Day 1 planning and design documents.',
    [
      'Every screen exists as a static page that mirrors the Design Documents 1:1.',
      'Visual language (colors, typography, spacing, components) locked into the prototype.',
      'Output: a prototype the build phase will port 1:1 into the live application.',
    ],
    'Build prototype; Team Lead reviews.',
    'Every screen in the feature list has a corresponding prototype page. The visual contract is locked and ready for development.',
  ],
  ['Day 3 — Contracts and Development',
    'Lock the SRS, API contracts and database schema, then run development from the foundation feature list.',
    [
      'Plan and lock the requirements document and system design — features, flows, policy rules, and what each role can do on each screen.',
      'Start development — independent modules in parallel (one owner per module, end-to-end), dependent modules built together when files cross (coordinated via the locked contract).',
      'Every module ports the prototype 1:1 and respects the Design Document tokens.',
    ],
    'Development runs in parallel, coordinating via the locked contracts; Team Lead reviews cross-module integration.',
    'SRS, API contracts and DB schema are locked and signed off. Independent modules are feature-complete; dependent modules are integrated. The build is ready for testing.',
  ],
  ['Day 4 — Testing: User-Based Scenarios',
    'Test the application the way a user would interact with it — through the UI, not at the API.',
    [
      'Write test cases based on the Day 1 feature list (authored in parallel with delivery).',
      'Build a detailed scenarios sheet — every user journey, every role, every edge case.',
      'User-based testing — tests drive the browser as a real user, asserting screens, flows and outcomes.',
      'Run the full sweep; surface bugs for closure in Day 5.',
    ],
    'Tester authors scenarios and runs the test sweep; development fixes on demand.',
    'Every feature in the Day 1 list has at least one scenario covering its primary user journey. The bug list for Day 5 is published.',
  ],
  ['Day 5 — UAT Deployment and Bug Closure',
    'Deploy to UAT, close the bugs and errors surfaced in testing, sign-off.',
    [
      'Deploy to the UAT environment.',
      'Close the bugs and errors surfaced during Day 4 testing.',
      'Client smoke-test session on UAT.',
      'Capture and resolve UAT feedback.',
    ],
    'Team Lead coordinates; development closes bugs; Tester verifies fixes.',
    'UAT is clean — zero Severity-1 or Severity-2 issues open. Client signs off.',
  ],
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
          spacing: { before: 0, after: 160 },
          children: [new TextRun({
            text: 'GharSetu — Solution Overview',
            bold: true, size: 64, color: COLOR.navy, font: 'Arial',
          })],
        }),

        // Subtitle
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 400 },
          children: [new TextRun({
            text: 'Project plan to close v1 functional gaps and align the platform with current requirements.',
            italics: true, size: 26, color: COLOR.slate, font: 'Arial',
          })],
        }),

        // Saffron hairline (centred via empty inline borders — wider through margins)
        new Paragraph({
          alignment: AlignmentType.CENTER,
          border: { bottom: { style: BorderStyle.SINGLE, size: 16, color: COLOR.saffron, space: 1 } },
          spacing: { before: 0, after: 1200 },
        }),

        // Version / Date / Prepared by / Prepared for
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [
            new TextRun({ text: 'Version: ', bold: true, size: 26, color: COLOR.charcoal, font: 'Arial' }),
            new TextRun({ text: '6.5 (Draft)', size: 26, color: COLOR.charcoal, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [
            new TextRun({ text: 'Date: ', bold: true, size: 26, color: COLOR.charcoal, font: 'Arial' }),
            new TextRun({ text: '25 May 2026', size: 26, color: COLOR.charcoal, font: 'Arial' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [
            new TextRun({ text: 'Prepared by: ', bold: true, size: 26, color: COLOR.charcoal, font: 'Arial' }),
            new TextRun({ text: 'Aayush Kumar', size: 26, color: COLOR.charcoal, font: 'Arial' }),
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
        // §2 — What We Heard
        // ────────────────────────────────────────────────────────────────────
        solidBanner('What We Heard'),

        body('GharSetu is a Delhi-based property-rental platform. This project closes the v1 functional gaps your team has flagged AND pivots the platform to a multi-organisation SAAS.', { after: 160 }),

        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [5040, 5040],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [headerCell('Before', 5040), headerCell('After', 5040)],
            }),
            new TableRow({
              children: [
                bodyCell('Single-organisation deployment serving one operation.', 5040),
                bodyCell('Multi-organisation SAAS — a new Super Admin manages all organisations on the platform; your current operation becomes one of them.', 5040),
              ],
            }),
            new TableRow({
              children: [
                bodyCell('Internal-only user creation — Admin adds Managers and Maintenance Team by hand.', 5040, { stripe: true }),
                bodyCell('Public organisation sign-up. Super Admin approves; on approval the organisation’s first Admin is auto-created.', 5040, { stripe: true }),
              ],
            }),
            new TableRow({
              children: [
                bodyCell('No subscription model.', 5040),
                bodyCell('Subscription plans introduced (Basic / Standard / Premium).', 5040),
              ],
            }),
          ],
        }),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §3 — Who Uses the Platform
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Who Uses the Platform'),

        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [2160, 7920],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                headerCell('Role', 2160),
                headerCell('Key capabilities', 7920),
              ],
            }),
            ...ROLE_CAPABILITIES.map(([role, caps], i) => new TableRow({
              children: [
                bodyCell(role, 2160, { bold: true, color: COLOR.navy, stripe: i % 2 === 1 }),
                bodyCell(caps, 7920, { stripe: i % 2 === 1 }),
              ],
            })),
          ],
        }),
        spacer(200),

        // ────────────────────────────────────────────────────────────────────
        // §2 — Modules — Features and Current Gaps
        // (Task 14, 25 May 2026 — merged §4 "Current State Assessment" and
        //  §6 "Module-wise Feature Catalogue" into a single 3-col × 10-row
        //  table: Module / Features / Gaps surfaced. The old "Roles & state"
        //  column is dropped — §3 Who Uses the Platform already covers
        //  role-by-role capabilities. For the 6 existing modules the
        //  Gaps cell carries the bullets lifted verbatim from old §4; for
        //  the 3 new modules (Visitor Management, Master Data Admin,
        //  Settings & Audit Log) the Gaps cell is intentionally empty.
        //  Closing caps-label + bullet (the schema-level constraint) is
        //  preserved below the table — it crosses multiple modules so it
        //  reads naturally as a footnote to the catalogue.)
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Modules — Features and Current Gaps'),

        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [1800, 5000, 3280],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                headerCell('Module', 1800),
                headerCell('Features', 5000),
                headerCell('Gaps surfaced', 3280),
              ],
            }),
            ...FEATURE_CATALOGUE.map(([label, features, gaps], i) => new TableRow({
              children: [
                bodyCell(label, 1800, { bold: true, color: COLOR.navy, stripe: i % 2 === 1 }),
                multiCell(features.map(t => cellBullet(t)), 5000, { stripe: i % 2 === 1 }),
                multiCell(gaps.map(t => cellBullet(t)), 3280, { stripe: i % 2 === 1 }),
              ],
            })),
          ],
        }),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §x — Subscription Plans (three-card matrix)
        // Introduced in v6.5 — gives the client a visual on the plan model
        // that Module 10 (Organization Management) introduces. Exact feature
        // scope per plan is to be confirmed by the client at Day-1 planning.
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Subscription Plans'),

        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [3360, 3360, 3360],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [
                headerCell('Basic', 3360),
                headerCell('Standard', 3360),
                headerCell('Premium', 3360),
              ],
            }),
            new TableRow({
              children: [
                multiCell([
                  cellPara('Up to 5 users', { bold: true, color: COLOR.navy, after: 100 }),
                  cellPara('Limited features.', { after: 0 }),
                ], 3360),
                multiCell([
                  cellPara('Up to 20 users', { bold: true, color: COLOR.navy, after: 100 }),
                  cellPara('Core features.', { after: 0 }),
                ], 3360, { stripe: true }),
                multiCell([
                  cellPara('Unlimited users', { bold: true, color: COLOR.navy, after: 100 }),
                  cellPara('All features.', { after: 0 }),
                ], 3360),
              ],
            }),
          ],
        }),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §5 — Business Rules
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Business Rules'),

        ...BUSINESS_RULES.map(([, text]) => bullet([r(text)])),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §2 — Assumptions
        // (Promoted from a caps-label sub-section of old §11 in v4.1.)
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Assumptions'),
        // Engagement / project approach
        bullet([bn('Approach '), r('— Per-room support is added by extending the existing lease model, not replacing it.')]),
        bullet([bn('Sign-off cadence '), r('— Client approves the Solution Overview before Day 1 begins. Post-approval changes are treated as copy edits, not scope changes.')]),
        // Migration / data state
        bullet([bn('Migration '), r('— Properties in v1 all migrate to Unit-based; Room-based is opt-in per property going forward.')]),
        bullet([bn('v1 migration to SAAS '), r('— all existing single-organisation data is backfilled to the original operator as the first Organisation. Existing users, properties, leases and rent records keep their identifiers and history; they are tagged to that Organisation going forward.')]),
        bullet([bn('SAAS naming '), r('— the platform-level container is called an Organisation. The existing TENANT role (a renter) keeps that name; the two terms do not collide.')]),
        // Scope / configuration
        bullet([bn('What can be edited from the UI '), r('— Master Data is 3 entities (Amenities, Maintenance Categories, Payment Methods); Settings is 3 values (late-fee rate, grace period, rent-change notice window). Adding more extends the plan.')]),
        bullet([bn('Email scope carve-in '), r('— The rent-change schedule and tenant emails (already built in v1) stay in scope.')]),
        // Access / privacy
        bullet([bn('Role scope '), r('— Tenants, Property Managers and Maintenance Team are each scoped to their role’s boundary: tenants to their own lease, Property Managers to assigned properties, Maintenance Team to assigned requests only (no visibility into rent, lease or financial data).')]),
        bullet([bn('Data isolation '), r('— every record is tagged to its Organisation; the platform enforces this boundary so an Organisation can only read or write its own records. Super Admin sits above this boundary.')]),
        bullet([bn('Per-room privacy '), r('— In room-based units, tenants on one room never see another room’s lease, payment or personal information; shared-area maintenance is visible to every room tenant on the unit.')]),
        bullet([bn('Contact-detail visibility '), r('— Tenant phone, email and bank reference numbers are limited by role. Property Managers cannot list these details in bulk; bank references are visible only to the user who recorded the payment and to Admin.')]),
        // Operational
        bullet([bn('Simultaneous edits '), r('— When two people try the same action at once, the system accepts one and rejects the other. A second active lease on the same unit is blocked; a duplicate payment recorded at the same moment is rejected.')]),
        bullet([bn('Performance and freshness '), r('— Outstanding balance, late fees and overdue status are always current — shown live whenever a screen opens, never stale. List screens load in pages and stay fast even on large portfolios; room-based properties offer a "group by unit" view for dense lists.')]),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §7 — Delivery Approach + High-Level Timeline
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Delivery Approach and High-Level Timeline'),

        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [2580, 2580, 4920],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              tableHeader: true,
              children: [headerCell('Phase', 2580), headerCell('Duration', 2580), headerCell('Theme', 4920)],
            }),
            new TableRow({
              children: [
                bodyCell('Phase 1 — Foundations', 2580, { bold: true }),
                bodyCell('Day 1 – 2', 2580),
                bodyCell('Feature planning + Design Documents · Prototype.', 4920),
              ],
            }),
            new TableRow({
              children: [
                bodyCell('Phase 2 — Development', 2580, { bold: true, stripe: true }),
                bodyCell('Day 3', 2580, { stripe: true }),
                bodyCell('Specifications and data design locked, then build — independent modules in parallel, dependent modules coordinated.', 4920, { stripe: true }),
              ],
            }),
            new TableRow({
              children: [
                bodyCell('Phase 3 — Testing', 2580, { bold: true }),
                bodyCell('Day 4', 2580),
                bodyCell('User-based testing · scenarios sheet authored alongside.', 4920),
              ],
            }),
            new TableRow({
              children: [
                bodyCell('Phase 4 — UAT and Sign-off', 2580, { bold: true, stripe: true }),
                bodyCell('Day 5', 2580, { stripe: true }),
                bodyCell('UAT deployment, bug closure, client sign-off.', 4920, { stripe: true }),
              ],
            }),
          ],
        }),
        spacer(160),


        // ────────────────────────────────────────────────────────────────────
        // §2 — Day-by-Day Delivery Plan
        // (Was §12 in v3.7 — shifted up by one in v3.8.)
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Day-by-Day Delivery Plan'),


        ...DAY_PLAN.flatMap(([label, , deliverables]) => ([
          softBanner(label),
          spacer(100),
          ...deliverables.map(t => bullet(t)),
          spacer(200),
        ])),

        // ────────────────────────────────────────────────────────────────────
        // §9 — Out of Scope for v1
        // ────────────────────────────────────────────────────────────────────
        solidBanner('Out of Scope for v1'),

        body('The deliberate exclusions — deferred to a future phase, not dropped.', { after: 120 }),

        // Project framing
        bullet('Not a re-build of v1 — we patch and extend the existing codebase.'),
        bullet('Not a re-architecture — we extend the existing data model and framework; we do not replace them.'),
        // User-facing major features deferred
        bullet('Mobile app — the platform runs on every device, but a native app is out of scope.'),
        bullet('Online payment collection — no payment-gateway integration. Property Manager and Admin record payments by hand.'),
        bullet('Charts and analytics dashboards.'),
        bullet('File uploads — no document attachments on requests, leases or payments.'),
        // Onboarding & auth
        bullet('Tenant self-signup — tenants come from leases only.'),
        bullet('Owner and vendor login portals.'),
        bullet('Two-factor authentication — for any role, including Super Admin.'),
        bullet('Multi-session management — no "logout everywhere" or last-sign-in display.'),
        // Communications
        bullet([
          r('Bulk SMS, WhatsApp or outbound notifications, '),
          r('with one exception:', { bold: true }),
          r(' the rent-change tenant email notification supporting the rent-change schedule (already built).'),
        ]),
        bullet('Visitor Management SMS / email notifications and a dedicated guard-kiosk view (deferred to v1.1).'),
        // Per-module deferrals
        bullet('Mode-switching UI for properties — not in v1.'),
        bullet('Shared utility cost-splitting across room tenants — per-tenant share of electricity, water or internet.'),
        bullet('Maintenance chargeability for shared-area requests — common-area work is notified to all room tenants in-app; the platform does not split or attribute its cost.'),
        // SAAS-specific
        bullet('Billing and payment processing for subscription plans — manual invoicing only; no Razorpay / Stripe / PayPal integration.'),
        bullet('Custom domains and per-organisation branding (logo, colours).'),
        spacer(240),

        // ────────────────────────────────────────────────────────────────────
        // §10 — Next Steps / Sign-off
        // ────────────────────────────────────────────────────────────────────
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 120 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR.saffron, space: 8 } },
          children: [new TextRun({
            text: 'Next Steps and Sign-off',
            bold: true, size: 40, color: COLOR.navy, font: 'Arial',
          })],
        }),
        spacer(160),

        body('On approval, the team begins Day-1 work to the schedule above. Clarifications and copy edits can be returned with this document; scope changes will trigger a revised plan. Please confirm by signing below.'),
        spacer(280),

        // Sign-off block
        new Table({
          width: { size: 10080, type: WidthType.DXA },
          columnWidths: [3360, 6720],
          layout: TableLayoutType.FIXED,
          rows: [
            new TableRow({
              children: [
                bodyCell('Approved by:', 3360, { bold: true }),
                bodyCell('________________________________________________', 6720),
              ],
            }),
            new TableRow({
              children: [
                bodyCell('Date:', 3360, { bold: true, stripe: true }),
                bodyCell('________________________________________________', 6720, { stripe: true }),
              ],
            }),
            new TableRow({
              children: [
                bodyCell('Signature:', 3360, { bold: true }),
                bodyCell('________________________________________________', 6720),
              ],
            }),
          ],
        }),
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
