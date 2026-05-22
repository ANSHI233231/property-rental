// ─────────────────────────────────────────────────────────────────────────────
// generate_project_report.js
// ─────────────────────────────────────────────────────────────────────────────
// Source-of-truth generator for docs/requirement/PROJECT_REPORT.docx
//
// The PDF sibling (docs/requirement/PROJECT_REPORT.pdf) was shared with the
// client on 2026-05-21. This generator is an editable .docx mirror of that
// PDF — same headings, same colors, same banners, same bullets, same
// language — so the client can edit a copy.
//
// Per Rule 28: this JS is the source of truth. Never hand-edit the .docx.
// Regenerate with:
//     node doc-assets/templates/generate_project_report.js
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, AlignmentType,
        LevelFormat, BorderStyle, Table, TableRow, TableCell, WidthType,
        ShadingType, Header, Footer, PageNumber, TableLayoutType } = require('docx');

const OUTPUT_PATH = path.resolve(__dirname, '..', '..', 'docs', 'requirement', 'PROJECT_REPORT.docx');

// ─────────────────────────────────────────────────────────────────────────────
// GharSetu brand palette — kept aligned with generate_solution_overview.js so
// future generators can share a single _design.js when a third doc lands.
// ─────────────────────────────────────────────────────────────────────────────
const COLOR = {
  navy:      '1A237E', // brand — title, banner fills, H1, callout accents
  royalBlue: '1565C0', // overall-observation lead, sub-banner text
  saffron:   'FF6F00', // hairline under title; ALL-CAPS section labels
  charcoal:  '212121', // body text
  slate:     '546E7A', // footer + soft secondary text
  white:     'FFFFFF',

  // Banner / callout fills picked to match the PDF
  bannerNavy:   '1A237E',  // "Functional gaps — by module" — solid navy banner
  bannerLight:  'E8EDF7',  // "Module N —" — soft light-blue/navy tint
  calloutFill:  'F1F4FA',  // Audience / Purpose callout background
  codePillFill: 'F2F3F5',  // light gray fill for the RentChangeSchedule code pill
  codePillText: 'C62828',  // muted red for mono code text
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// A run of plain charcoal body text at the document's base size.
const r = (text, opts = {}) => new TextRun({
  text,
  bold: opts.bold || false,
  italics: opts.italics || false,
  color: opts.color || COLOR.charcoal,
  size: opts.size || 22,
  font: opts.font || 'Arial',
});

// A bold navy run — used for the "Bold Lead" sentence fragments in bullets.
const bn = (text) => r(text, { bold: true, color: COLOR.navy });

// An inline code pill — small light-gray box with mono red-tinted text.
// Used for `RentChangeSchedule` in the Module 5 → Solution Overview Gap bullet.
const codeRun = (text) => new TextRun({
  text,
  font: 'Consolas',
  size: 20,
  color: COLOR.codePillText,
  shading: { fill: COLOR.codePillFill, type: ShadingType.CLEAR },
});

// A blank line of vertical spacing.
const spacer = (after = 120) => new Paragraph({
  spacing: { before: 0, after },
  children: [new TextRun('')],
});

// Body paragraph with optional inline runs.
const body = (runs, opts = {}) => new Paragraph({
  spacing: { before: opts.before ?? 0, after: opts.after ?? 120 },
  children: Array.isArray(runs) ? runs : [r(runs)],
});

// Level-0 bullet (filled disc)
const bullet = (runs) => new Paragraph({
  numbering: { reference: 'project-report-bullets', level: 0 },
  spacing: { before: 0, after: 80 },
  children: Array.isArray(runs) ? runs : [r(runs)],
});

// Level-1 nested bullet (open circle)
const subBullet = (runs) => new Paragraph({
  numbering: { reference: 'project-report-bullets', level: 1 },
  spacing: { before: 0, after: 80 },
  children: Array.isArray(runs) ? runs : [r(runs)],
});

// ALL-CAPS saffron section label — "ADMIN USER-CREATION FORM:", etc.
// Slightly smaller than body, bold, letter-spaced via the underlying font.
const capsLabel = (text) => new Paragraph({
  spacing: { before: 200, after: 80 },
  children: [new TextRun({
    text: text.toUpperCase(),
    bold: true,
    color: COLOR.saffron,
    size: 20,
    font: 'Arial',
    characterSpacing: 20, // small tracking — matches the PDF feel
  })],
});

// Solid navy banner — used for "Functional gaps — by module".
// Implemented as a single-cell full-width table with navy fill.
const solidBanner = (text) => new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [9360],
  layout: TableLayoutType.FIXED,
  borders: {
    top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideVertical:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  },
  rows: [new TableRow({
    children: [new TableCell({
      width: { size: 9360, type: WidthType.DXA },
      shading: { fill: COLOR.bannerNavy, type: ShadingType.CLEAR },
      margins: { top: 140, bottom: 140, left: 220, right: 220 },
      children: [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new TextRun({
          text, bold: true, color: COLOR.white, size: 26, font: 'Arial',
        })],
      })],
    })],
  })],
});

// Soft sub-banner — "Module N — Title" or "Cross-cutting".
// Light-blue fill, navy text, with a thicker navy bar on the left edge to
// echo the PDF.
const softBanner = (text) => new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [9360],
  layout: TableLayoutType.FIXED,
  borders: {
    top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    left:   { style: BorderStyle.SINGLE, size: 24, color: COLOR.navy }, // chunky navy left bar
    right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
    insideVertical:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  },
  rows: [new TableRow({
    children: [new TableCell({
      width: { size: 9360, type: WidthType.DXA },
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

// Audience / Purpose callout — light-fill box with a navy left-bar accent.
// Rendered as a 1-cell table; the two label/value pairs run inline inside.
const audiencePurposeCallout = () => new Table({
  width: { size: 9360, type: WidthType.DXA },
  columnWidths: [9360],
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
      width: { size: 9360, type: WidthType.DXA },
      shading: { fill: COLOR.calloutFill, type: ShadingType.CLEAR },
      margins: { top: 180, bottom: 180, left: 260, right: 260 },
      children: [new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: 'Audience: ', bold: true, color: COLOR.navy, size: 22, font: 'Arial' }),
          r('the developer who built this system, the testing team, and the project manager. '),
          new TextRun({ text: 'Purpose: ', bold: true, color: COLOR.navy, size: 22, font: 'Arial' }),
          r('snapshot of features missing or incomplete in the current build, analyzed against the '),
          r('Solution Overview document', { bold: true }),
          r(' shared by the developer.'),
        ],
      })],
    })],
  })],
});

// Saffron hairline under the title.
const titleHairline = () => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR.saffron, space: 1 } },
  spacing: { before: 0, after: 280 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'Aayush Kumar',
  title: 'GharSetu — Project Report',
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 22, color: COLOR.charcoal } },
    },
  },
  numbering: {
    config: [{
      reference: 'project-report-bullets',
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: '•', // •
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 540, hanging: 280 } } },
        },
        {
          level: 1,
          format: LevelFormat.BULLET,
          text: '◦', // ◦ open circle — matches the PDF sub-bullet glyph
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 1080, hanging: 280 } } },
        },
      ],
    }],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },           // US Letter
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }, // 0.75"
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
            new TextRun({ text: 'GharSetu  —  Project Report  ·  Page ', size: 18, color: COLOR.slate, font: 'Arial' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COLOR.slate, font: 'Arial' }),
            new TextRun({ text: ' of ', size: 18, color: COLOR.slate, font: 'Arial' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: COLOR.slate, font: 'Arial' }),
          ],
        })],
      }),
    },
    children: [
      // ═════════════════════════════════════════════════════════════════════
      // TITLE  +  saffron hairline
      // ═════════════════════════════════════════════════════════════════════
      new Paragraph({
        spacing: { before: 0, after: 120 },
        children: [new TextRun({
          text: 'GharSetu — Project Report',
          bold: true, size: 56, color: COLOR.navy, font: 'Arial',
        })],
      }),
      titleHairline(),

      // ═════════════════════════════════════════════════════════════════════
      // AUDIENCE / PURPOSE  callout
      // ═════════════════════════════════════════════════════════════════════
      audiencePurposeCallout(),
      spacer(200),

      // ═════════════════════════════════════════════════════════════════════
      // BODY intro lines
      // ═════════════════════════════════════════════════════════════════════
      body('The current build is a v1 release candidate.', { after: 160 }),
      body([
        new TextRun({
          text: 'Overall observation: none of the 5 modules from the Solution Overview is functionally complete in the current build.',
          bold: true, color: COLOR.royalBlue, size: 22, font: 'Arial',
        }),
        r(' Every module has at least one gap captured below.'),
      ], { after: 280 }),

      // ═════════════════════════════════════════════════════════════════════
      // SOLID-NAVY BANNER:  Functional gaps — by module
      // ═════════════════════════════════════════════════════════════════════
      solidBanner('Functional gaps — by module'),
      spacer(160),

      // ─────────────────────────────────────────────────────────────────────
      // Module 1 — Users & Access
      // ─────────────────────────────────────────────────────────────────────
      softBanner('Module 1 — Users & Access'),
      spacer(120),

      capsLabel('Admin user-creation form:'),
      bullet([
        r('The admin "Create user" form on the users page currently allows Admin to create any of the 4 role types — '),
        r('Admin, Manager, Maintenance, Tenant', { bold: true }),
        r('. Per the spec only '),
        r('Manager', { bold: true }),
        r(' and '),
        r('Maintenance', { bold: true }),
        r(' users should be creatable here. The other two role types should be restricted:'),
      ]),
      subBullet([
        r('Admin', { bold: true }),
        r(' users should not be creatable from this UI (admins are set up out-of-band — bootstrap seed or admin-to-admin promotion).'),
      ]),
      subBullet([
        r('Tenant', { bold: true }),
        r(' users should not be creatable from this UI — they are auto-created during lease signing (see Module 3 → '),
        r('Tenant creation', { italics: true }),
        r(').'),
      ]),

      // ─────────────────────────────────────────────────────────────────────
      // Module 2 — Properties & Units
      // ─────────────────────────────────────────────────────────────────────
      spacer(120),
      softBanner('Module 2 — Properties & Units'),
      spacer(120),

      capsLabel('Admin:'),
      bullet([
        bn('Property reassignment to a new manager is not functional.'),
        r(' The action is exposed in the UI but does not complete the reassignment.'),
      ]),

      capsLabel('Master data:'),
      bullet([
        bn('Amenities.'),
        r(' The property create / edit form has no amenities field, and there is no master for amenities. Admin cannot define or edit the amenities catalog (lift, parking, gym, etc.) that properties should be classifiable against.'),
      ]),

      // ─────────────────────────────────────────────────────────────────────
      // Module 3 — Leases & Tenants
      // ─────────────────────────────────────────────────────────────────────
      spacer(120),
      softBanner('Module 3 — Leases & Tenants'),
      spacer(120),

      capsLabel('Admin:'),
      bullet([
        bn('Cannot create new leases'),
        r(' — no UI path.'),
      ]),

      capsLabel('Tenant creation:'),
      bullet([
        bn('Tenants can be created directly.'),
        r(' Per the Solution Overview, Module 3, tenants should be auto-created only as part of lease signing. The build exposes a standalone "create tenant" path (also visible in the Module 1 finding above).'),
      ]),

      capsLabel('Lease renewal:'),
      bullet([
        bn('No option to change tenants during lease renewal.'),
        r(' Per the Solution Overview, Module 3, renewing a lease should allow the Manager to add or remove tenants as part of the renewal. The current renewal flow keeps the tenant list as-is — there is no UI path to change tenant composition at renewal time.'),
      ]),

      capsLabel('Lease termination:'),
      bullet([
        bn('"Request Early Termination" feature is incomplete.'),
        r(' The early-termination flow (per the Solution Overview, Module 3 — single-tenant and co-tenant termination, including the co-tenant consent step) does not complete end-to-end.'),
      ]),

      // ─────────────────────────────────────────────────────────────────────
      // Module 4 — Maintenance Requests
      // ─────────────────────────────────────────────────────────────────────
      spacer(120),
      softBanner('Module 4 — Maintenance Requests'),
      spacer(120),

      capsLabel('Detail view (all roles):'),
      bullet([
        bn('No complete-details view of a maintenance request.'),
        r(" All roles' maintenance screens currently show a simple table with a few summary fields. There is no per-request detail page that captures the full history — status changes, assignments, comments, resolution notes. Admin, Manager, Maintenance Staff, and Tenant all share the same incomplete table view."),
      ]),

      capsLabel('Lifecycle actions (no role can perform these):'),
      bullet([
        bn('No close action.'),
        r(' Neither Admin, Manager, nor Maintenance Staff has a UI path to close a request. The lifecycle cannot be driven to a terminal state.'),
      ]),
      bullet([
        bn('No reopen action.'),
        r(' Once a request reaches a terminal state, no role can reopen it. No UI path exists.'),
      ]),

      capsLabel('Admin:'),
      bullet('Cannot reassign a request.'),

      capsLabel('Maintenance Staff:'),
      bullet('Cannot change the priority of a request.'),
      bullet('Cannot reassign a request to another maintenance staff member.'),
      bullet('The maintenance staff main / landing page returns an error.'),

      capsLabel('Tenant:'),
      bullet([
        bn("Maintenance requests raised by the Manager for the tenant's unit or lease do not appear on the tenant's portal."),
        r(' The tenant only sees requests they themselves created.'),
      ]),

      capsLabel('Lifecycle gating:'),
      bullet([
        bn('Maintenance request lifecycle currently starts at unit / property listing.'),
        r(' Per the Solution Overview, Module 4, it should be gated by an active lease — a vacant unit should not be able to host a maintenance request.'),
      ]),

      capsLabel('Master data:'),
      bullet([
        bn('Maintenance categories.'),
        r(' The maintenance request form has no category field, and there is no master for maintenance categories. Admin cannot define or edit the categories that maintenance requests should be classified under.'),
      ]),

      // ─────────────────────────────────────────────────────────────────────
      // Module 5 — Rent Collection
      // ─────────────────────────────────────────────────────────────────────
      spacer(120),
      softBanner('Module 5 — Rent Collection'),
      spacer(120),

      capsLabel('Admin:'),
      bullet([
        bn('Cannot record / collect rent payments'),
        r(' — no UI path.'),
      ]),

      capsLabel('Rent collection UX:'),
      bullet([
        bn('Late-fee and grace-period details + handling controls are missing.'),
        r(' When recording a payment, the screen does not show the breakdown (base rent + accrued late fee + grace-period status + total due) and provides no controls to handle late fees during collection (apply / waive / partial). The Manager records payments without seeing the full state or having the right handling controls.'),
      ]),

      capsLabel('Calculation:'),
      bullet([
        bn('Rent amounts depend on cron, not query time.'),
        r(' Computed amounts (late fee, total payable) are populated by cron jobs. The API response reflects the last cron run, not "now". A tenant or manager checking balance between cron runs may see stale data. Computation should happen at query time.'),
      ]),

      capsLabel('Master data:'),
      bullet([
        bn('Payment methods are hardcoded'),
        r(' in the codebase. Admin should be able to add, rename, or retire payment options without a code change.'),
      ]),

      capsLabel('Settings (hardcoded — need an Admin Settings page):'),
      bullet([
        bn('60-day rent change notice window.'),
        r(' The minimum lookahead required when scheduling a rent change is fixed at 60 days. Should be admin-configurable.'),
      ]),
      bullet([
        bn('2% per full week late fee rate.'),
        r(' The late-fee accrual rate after the grace period expires is fixed at 2% per full week. Should be admin-configurable.'),
      ]),
      bullet([
        bn('5-day grace period.'),
        r(' The number of days after rent due date before late fees begin is fixed at 5. Should be admin-configurable.'),
      ]),

      capsLabel('Solution Overview gap:'),
      bullet([
        codeRun('RentChangeSchedule'),
        r(' '),
        bn('+ tenant email notifications: built but not documented in the Solution Overview.'),
        r(' A 60-day-advance scheduled rent-change feature with outbound email notifications to tenants is built end-to-end (backend controller + service + cron + UI + SMTP). The Solution Overview currently lists "Email business notifications" as out of scope, which contradicts what\'s in the build. The Solution Overview needs to be amended to include '),
        codeRun('RentChangeSchedule'),
        r(' (and the email-notification carve-out that supports it) as in-scope features for v1.'),
      ]),

      // ─────────────────────────────────────────────────────────────────────
      // Cross-cutting
      // ─────────────────────────────────────────────────────────────────────
      spacer(160),
      softBanner('Cross-cutting'),
      spacer(120),

      body('Items that affect the system as a whole, not a single module.', { after: 140 }),

      capsLabel('Admin management UI:'),
      bullet([
        bn('No admin screen for master data.'),
        r(' Required to manage reference lists — amenities (Module 2), maintenance categories (Module 4), payment methods (Module 5).'),
      ]),
      bullet([
        bn('No admin Settings page.'),
        r(' Required to tune the business policy values — late-fee rate, grace period, rent-change notice window (all in Module 5).'),
      ]),

      capsLabel('Form UX:'),
      bullet([
        bn('Most date input fields are open text inputs.'),
        r(' Date fields across the app (lease start/end, payment date, maintenance dates, etc.) require manual typing in DD/MM/YYYY format — there is no date-picker affordance. This is error-prone (typos, wrong format) and inconsistent with a normal app UX. A date-picker component should be applied uniformly across all date inputs.'),
      ]),
    ],
  }],
});

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT_PATH, buffer);
  console.log(`Document written to: ${OUTPUT_PATH}`);
  console.log(`Size: ${buffer.length} bytes`);
});
