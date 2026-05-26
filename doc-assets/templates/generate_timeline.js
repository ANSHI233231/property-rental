// ─────────────────────────────────────────────────────────────────────────────
// generate_timeline.js
// ─────────────────────────────────────────────────────────────────────────────
// Source-of-truth generator for docs/product/Timeline.xlsx
//
// The timeline used to live inside Solution_Overview.docx (§Delivery Approach
// + §Day-by-Day Plan). It has been split out into a separate spreadsheet so
// reviewers can sort / filter / mark up the schedule per module without
// re-opening the proposal.
//
// Two sheets:
//   1. "Phase Overview"   — at-a-glance 4-phase plan
//   2. "Module Schedule"  — every fix and new feature mapped to the 5-day
//                           plan (Plan / Prototype / Build / Test / UAT).
//
// Per Rule 28: this JS is the source of truth. Never hand-edit the .xlsx.
// Regenerate with:
//     node doc-assets/templates/generate_timeline.js
// or
//     npm --prefix doc-assets run build:timeline
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const ExcelJS = require('exceljs');

const OUTPUT_PATH = path.resolve(__dirname, '..', '..', 'docs', 'product', 'Timeline.xlsx');

// ─────────────────────────────────────────────────────────────────────────────
// Brand palette — kept aligned with the .docx generators so the artifacts
// read as a single visual family. ARGB format (alpha + RGB) per exceljs.
// ─────────────────────────────────────────────────────────────────────────────
const COLOR = {
  navy:       'FF1A237E',
  saffron:    'FFFF6F00',
  charcoal:   'FF212121',
  slate:      'FF546E7A',
  white:      'FFFFFFFF',
  stripe:     'FFF4F6FB',
  border:     'FFCFD8DC',
  fillFix:    'FFE3F2FD', // soft blue for fix rows
  fillNew:    'FFFFF4E6', // soft saffron for new-feature rows
  headerNavy: 'FF1A237E',
};

// ─────────────────────────────────────────────────────────────────────────────
// Phase Overview — same 4-phase table that used to be in §Delivery Approach
// ─────────────────────────────────────────────────────────────────────────────
const PHASES = [
  ['Phase 1 — Foundations',        'Day 1 – 2', 'Feature planning + Design Documents · Prototype.'],
  ['Phase 2 — Development',        'Day 3',     'Specifications and data design locked, then build — independent modules in parallel, dependent modules coordinated.'],
  ['Phase 3 — Testing',            'Day 4',     'User-based testing · scenarios sheet authored alongside.'],
  ['Phase 4 — UAT and Sign-off',   'Day 5',     'UAT deployment, bug closure, client sign-off.'],
];

// ─────────────────────────────────────────────────────────────────────────────
// Module Schedule — every Fix and every New Feature, mapped across the 5-day
// flow. Day cells use these short labels:
//   "Plan"   — feature planning + design (Day 1)
//   "Proto"  — prototype screen (Day 2)
//   "Build"  — implement end-to-end (Day 3)
//   "Test"   — scenario testing (Day 4)
//   "UAT"    — UAT + bug close (Day 5)
//
// Each row: [#, module/area, type, item, day1, day2, day3, day4, day5, owner]
// type is "Fix" or "New Feature".
// ─────────────────────────────────────────────────────────────────────────────
const SCHEDULE = [
  // —— Fixes (one row per module — items collapsed to a single line) ————
  [ 1, 'Users & Access',         'Fix', 'Restrict Create User form to PM and Maintenance roles only.',                                                                                     'Plan', 'Proto', 'Build', 'Test', 'UAT', 'BE + FE'],
  [ 2, 'Properties & Units',     'Fix', 'Property reassignment completes end-to-end; Amenities field surfaces on the property form.',                                                       'Plan', 'Proto', 'Build', 'Test', 'UAT', 'BE + FE'],
  [ 3, 'Leases & Tenants',       'Fix', 'Admin can create leases from UI; renewal add/remove tenants; early-termination flow completes incl. tenant consent.',                              'Plan', 'Proto', 'Build', 'Test', 'UAT', 'BE + FE'],
  [ 4, 'Maintenance Requests',   'Fix', 'Per-request detail view; close/reopen workflow; Admin cross-property reassign; active-lease gate; category field; PM-raised requests on tenant portal.', 'Plan', 'Proto', 'Build', 'Test', 'UAT', 'BE + FE'],
  [ 5, 'Rent Collection',        'Fix', 'Admin record-payment UI; live late fee + balance (not overnight job).',                                                                            'Plan', 'Proto', 'Build', 'Test', 'UAT', 'BE + FE'],
  [ 6, 'Dashboard',              'Fix', 'PM dashboard revamp (full list locked Day 1); Maintenance dashboard built; Tenant dashboard built.',                                               'Plan', 'Proto', 'Build', 'Test', 'UAT', 'FE'],

  // —— New Features ————————————————————————————————————————————————————
  [ 7, 'Leases & Tenants',       'New Feature', 'Per-Room Leasing — Room-based mode at property creation; per-room rent/deposit/term; shared common areas.',                                'Plan', 'Proto', 'Build', 'Test', 'UAT', 'BE + FE + DBA'],
  [ 8, 'Users & Access',         'New Feature', 'Admin Impersonation — login-as a PM/Maintenance/Tenant within own Org; audit logs as Admin; cannot impersonate Super Admin.',              'Plan', 'Proto', 'Build', 'Test', 'UAT', 'BE + FE'],
  [ 9, 'Users & Access',         'New Feature', 'Task Delegation — Admin assigns date-range tasks to PM/Maintenance; audit logs as delegate inside the window.',                            'Plan', 'Proto', 'Build', 'Test', 'UAT', 'BE + FE'],
  [10, 'Visitor Management',     'New Feature', 'Tenant pre-approval + PM approval/deny + check-in/out timestamps (per-property log).',                                                     'Plan', 'Proto', 'Build', 'Test', 'UAT', 'BE + FE'],
  [11, 'Master Data Administration', 'New Feature', 'Amenities, Maintenance Categories, Payment Methods, City, State — create/edit/deactivate by Admin; forms read live from Master Data.', 'Plan', 'Proto', 'Build', 'Test', 'UAT', 'BE + FE'],
  [12, 'Settings',               'New Feature', 'Tunable late-fee rate, grace period, rent-change notice window — Admin tunes from UI.',                                                    'Plan', 'Proto', 'Build', 'Test', 'UAT', 'BE + FE'],
  [13, 'Organization Management', 'New Feature', 'SAAS layer — public org sign-up + Super Admin approval; Subscription Plans (Basic/Standard/Premium) capping active users; org lifecycle.', 'Plan', 'Proto', 'Build', 'Test', 'UAT', 'BE + FE + DBA'],
];

// ─────────────────────────────────────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────────────────────────────────────
const fontTitle  = { name: 'Arial', size: 18, bold: true, color: { argb: COLOR.navy } };
const fontHeader = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR.white } };
const fontBody   = { name: 'Arial', size: 10,             color: { argb: COLOR.charcoal } };
const fontDay    = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR.navy } };

const fillHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerNavy } };
const fillStripe = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.stripe } };
const fillFix    = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.fillFix } };
const fillNew    = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.fillNew } };

const thinBorder = { style: 'thin', color: { argb: COLOR.border } };
const borderAll  = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };

const alignCenter = { vertical: 'middle', horizontal: 'center', wrapText: true };
const alignLeft   = { vertical: 'middle', horizontal: 'left',   wrapText: true };

// ─────────────────────────────────────────────────────────────────────────────
// Build the workbook
// ─────────────────────────────────────────────────────────────────────────────
async function build() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Aayush Kumar';
  wb.created = new Date();
  wb.modified = new Date();
  wb.title = 'GharSetu — Timeline';

  // ── Sheet 1: Phase Overview ───────────────────────────────────────────────
  const phaseSheet = wb.addWorksheet('Phase Overview', {
    properties: { tabColor: { argb: COLOR.navy } },
    views: [{ showGridLines: false, state: 'normal' }],
  });

  phaseSheet.columns = [
    { header: 'Phase',    key: 'phase',    width: 32 },
    { header: 'Duration', key: 'duration', width: 16 },
    { header: 'Theme',    key: 'theme',    width: 80 },
  ];

  // Title block (row 1: spacer, row 2: title)
  phaseSheet.mergeCells('A1:C1');
  phaseSheet.getRow(1).height = 8;

  phaseSheet.mergeCells('A2:C2');
  const titleCell = phaseSheet.getCell('A2');
  titleCell.value = 'GharSetu — Project Timeline';
  titleCell.font = fontTitle;
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  phaseSheet.getRow(2).height = 28;

  phaseSheet.mergeCells('A3:C3');
  const subtitle = phaseSheet.getCell('A3');
  subtitle.value = 'Companion to Solution_Overview.docx. Two sheets: Phase Overview (this) and Module Schedule.';
  subtitle.font = { name: 'Arial', size: 10, italic: true, color: { argb: COLOR.slate } };
  subtitle.alignment = { vertical: 'middle', horizontal: 'left' };
  phaseSheet.getRow(3).height = 18;

  phaseSheet.getRow(4).height = 8;

  // Header row at row 5
  const headerRowIdx = 5;
  const headerRow = phaseSheet.getRow(headerRowIdx);
  headerRow.values = ['Phase', 'Duration', 'Theme'];
  headerRow.font = fontHeader;
  headerRow.fill = fillHeader;
  headerRow.alignment = alignCenter;
  headerRow.height = 22;
  headerRow.eachCell((c) => { c.border = borderAll; });

  // Phase rows
  PHASES.forEach((p, i) => {
    const r = phaseSheet.getRow(headerRowIdx + 1 + i);
    r.values = p;
    r.font = fontBody;
    r.alignment = alignLeft;
    r.height = 28;
    if (i % 2 === 1) r.fill = fillStripe;
    r.eachCell((c) => { c.border = borderAll; });
    r.getCell(1).font = { ...fontBody, bold: true, color: { argb: COLOR.navy } };
    r.getCell(2).alignment = alignCenter;
  });

  // ── Sheet 2: Module Schedule ──────────────────────────────────────────────
  const schedSheet = wb.addWorksheet('Module Schedule', {
    properties: { tabColor: { argb: COLOR.saffron } },
    views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }],
  });

  schedSheet.columns = [
    { header: '#',                key: 'n',     width: 5  },
    { header: 'Module / Area',    key: 'mod',   width: 26 },
    { header: 'Type',             key: 'type',  width: 12 },
    { header: 'Item',             key: 'item',  width: 60 },
    { header: 'Day 1 — Planning', key: 'd1',    width: 14 },
    { header: 'Day 2 — Prototype',key: 'd2',    width: 14 },
    { header: 'Day 3 — Build',    key: 'd3',    width: 14 },
    { header: 'Day 4 — Testing',  key: 'd4',    width: 14 },
    { header: 'Day 5 — UAT',      key: 'd5',    width: 14 },
    { header: 'Owner',            key: 'owner', width: 18 },
  ];

  schedSheet.mergeCells('A1:J1');
  schedSheet.getRow(1).height = 8;

  schedSheet.mergeCells('A2:J2');
  const sTitle = schedSheet.getCell('A2');
  sTitle.value = 'Module Schedule — Fixes and New Features';
  sTitle.font = fontTitle;
  sTitle.alignment = { vertical: 'middle', horizontal: 'left' };
  schedSheet.getRow(2).height = 28;

  schedSheet.mergeCells('A3:J3');
  const sSubtitle = schedSheet.getCell('A3');
  sSubtitle.value = 'Each row is one Fix or one New Feature. Cells in Day columns name the activity for that day. Blue rows = Fixes. Saffron rows = New Features.';
  sSubtitle.font = { name: 'Arial', size: 10, italic: true, color: { argb: COLOR.slate } };
  sSubtitle.alignment = { vertical: 'middle', horizontal: 'left' };
  schedSheet.getRow(3).height = 18;

  schedSheet.getRow(4).height = 8;

  // Header row at row 5
  const sHeaderRow = schedSheet.getRow(5);
  sHeaderRow.values = ['#', 'Module / Area', 'Type', 'Item', 'Day 1 — Planning', 'Day 2 — Prototype', 'Day 3 — Build', 'Day 4 — Testing', 'Day 5 — UAT', 'Owner'];
  sHeaderRow.font = fontHeader;
  sHeaderRow.fill = fillHeader;
  sHeaderRow.alignment = alignCenter;
  sHeaderRow.height = 30;
  sHeaderRow.eachCell((c) => { c.border = borderAll; });

  // Data rows
  SCHEDULE.forEach((row, i) => {
    const r = schedSheet.getRow(6 + i);
    r.values = row;
    r.font = fontBody;
    r.alignment = alignLeft;
    r.height = 34;
    r.fill = row[2] === 'Fix' ? fillFix : fillNew;
    r.eachCell((c) => { c.border = borderAll; });

    // Centre the first 3 cols + the day cols + the owner col
    [1, 3, 5, 6, 7, 8, 9, 10].forEach((col) => {
      r.getCell(col).alignment = alignCenter;
    });
    // Day cells in bold navy for emphasis
    [5, 6, 7, 8, 9].forEach((col) => {
      r.getCell(col).font = fontDay;
    });
    // Module column bold navy
    r.getCell(2).font = { ...fontBody, bold: true, color: { argb: COLOR.navy } };
    // Type column with subtle emphasis
    r.getCell(3).font = { ...fontBody, bold: true, color: { argb: row[2] === 'Fix' ? COLOR.navy : COLOR.saffron } };
  });

  // Auto-filter on the header row
  schedSheet.autoFilter = { from: 'A5', to: 'J5' };

  await wb.xlsx.writeFile(OUTPUT_PATH);
  console.log(`Document written to: ${OUTPUT_PATH}`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
