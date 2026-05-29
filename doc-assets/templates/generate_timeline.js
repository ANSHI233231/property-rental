// ─────────────────────────────────────────────────────────────────────────────
// generate_timeline.js
// ─────────────────────────────────────────────────────────────────────────────
// Source-of-truth generator for docs/product/Timeline.xlsx
//
// This timeline is the delivery companion to Solution_Overview.docx. It begins
// AFTER the Solution Overview and the prototype have been shared with the client
// and signed off — there is NO prototype/design phase inside this schedule.
//
// PACING MODEL: all build work is done by MULTIPLE AUTONOMOUS AI AGENT TEAMS
// running IN PARALLEL (Backend, Frontend, DBA, QA, Security). Because the design
// and prototype are already locked, each work item is delivered (built + tested
// + VAPT-checked by its agent team) within a single working day, and many items
// run concurrently on the same day. The whole engagement is ~8 working days, not
// weeks. Time is in relative working days (Day 1 … Day N): Day 1 = first working
// day after sign-off. No calendar dates (they get fixed once the start is agreed).
//
// Structure mirrors the Solution Overview 1:1 and in the same order:
//   Phase A — Close the Gaps      (Days 1–3)
//   Phase B — New Features        (Days 4–6)
//   Phase C — Integration, VAPT & Release (Days 7–8)
//
// Audience: client, developer(s)/agents, tester(s) and project manager.
//
// Per Rule 28: this JS is the source of truth. Never hand-edit the .xlsx.
// Regenerate with:
//     node doc-assets/templates/generate_timeline.js
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const ExcelJS = require('exceljs');

const OUTPUT_PATH = path.resolve(__dirname, '..', '..', 'docs', 'product', 'Timeline.xlsx');

// ─────────────────────────────────────────────────────────────────────────────
// Brand palette — aligned with the .docx generators. ARGB (alpha + RGB).
// ─────────────────────────────────────────────────────────────────────────────
const COLOR = {
  navy:    'FF1A237E',
  saffron: 'FFFF6F00',
  charcoal:'FF212121',
  slate:   'FF546E7A',
  white:   'FFFFFFFF',
  stripe:  'FFF4F6FB',
  border:  'FFCFD8DC',
  fillGap: 'FFE3F2FD', // soft blue   — Phase A (Close the Gaps)
  fillNew: 'FFFFF4E6', // soft saffron — Phase B (New Features)
  fillRel: 'FFECEFF1', // soft grey   — Phase C (Integration / VAPT / Release)
  green:   'FF2E7D32',
};

// ─────────────────────────────────────────────────────────────────────────────
// THE WORK — every row mirrors the Solution Overview, in the same order.
// `day` = the working day the item is delivered. Items sharing a day run IN
// PARALLEL across different AI agent teams. `kind` shapes the per-item lifecycle:
//   'feature' (default) — Build · Auto tests · Manual QA · VAPT check (same day)
//   'qa'   — integration + automated/manual regression
//   'vapt' — consolidated full-platform security assessment
//   'uat'  — client acceptance testing
//   'fix'  — bug closure + re-test + sign-off
// ─────────────────────────────────────────────────────────────────────────────
const ITEMS = [
  // ===== PHASE A — CLOSE THE GAPS (Days 1–3) =====
  { phase: 'A', day: 1, module: 'Users & Access',         item: 'User Management — create/edit users, role-restricted creation.',                                            agents: 'Backend · Frontend' },
  { phase: 'A', day: 1, module: 'Properties & Units',     item: 'Property Management, Unit Management, Reassign Property Manager — complete end-to-end.',                     agents: 'Backend · Frontend' },
  { phase: 'A', day: 1, module: 'Settings',               item: 'Late-Fee Rate, Grace Period, Rent-Change Notice Window — Admin-tunable.',                                   agents: 'Backend · Frontend' },
  { phase: 'A', day: 1, module: 'Master Data Management', item: 'Amenities, Maintenance Categories — Admin-managed; in-use entries protected.',                              agents: 'Backend · Frontend' },
  { phase: 'A', day: 2, module: 'Leases & Tenants',       item: 'Lease Creation, Lease Renewal, Lease Termination, Rent Change Schedule, Tenant Creation.',                  agents: 'Backend · Frontend' },
  { phase: 'A', day: 2, module: 'Maintenance Requests',   item: 'Request Detail View, Status Lifecycle (Close & Reopen), Priority Change During Request, High-Volume Alert.', agents: 'Backend · Frontend' },
  { phase: 'A', day: 2, module: 'Rent Collection',        item: 'Record Payment, Partial Payment Tracking, Period Filters.',                                                 agents: 'Backend · Frontend' },
  { phase: 'A', day: 3, module: 'Dashboard',              item: 'Admin, Property Manager, Maintenance Team and Tenant dashboards.',                                          agents: 'Frontend · Backend' },
  { phase: 'A', day: 3, module: 'Server Hardening',       item: 'Access control, Data integrity, Concurrency, Observability, Performance, Security.',                        agents: 'Backend · Security' },

  // ===== PHASE B — NEW FEATURES (Days 4–6) =====
  { phase: 'B', day: 4, module: 'Leases & Tenants',       item: 'Per-Room Leasing — rooms under units; unit-wise & room-wise lease types; shared areas; room/shared-area maintenance scope.', agents: 'Backend · Frontend · DBA' },
  { phase: 'B', day: 4, module: 'Users & Access',         item: 'Impersonation — Admin signs in as an Org user; actions audited against the Admin.',                         agents: 'Backend · Frontend' },
  { phase: 'B', day: 4, module: 'Users & Access',         item: 'Delegation — date-range task delegation to PM / Maintenance; revocable; audited against the delegate.',     agents: 'Backend · Frontend' },
  { phase: 'B', day: 4, module: 'Visitor Management',     item: 'Tenant registers expected visitors; PM / Admin approve, deny, check-in / check-out.',                       agents: 'Backend · Frontend' },
  // Organization Management (SAAS layer) — broken into its sub-items
  { phase: 'B', day: 5, module: 'Organization Management', item: 'Multi-organization migration — convert to multi-org; migrate existing data into a "default" organization.', agents: 'Backend · DBA' },
  { phase: 'B', day: 5, module: 'Organization Management', item: 'Public organization sign-up — Sign Up page and sign-up request flow.',                                      agents: 'Frontend · Backend' },
  { phase: 'B', day: 5, module: 'Organization Management', item: 'Public website + legal pages — marketing site with plans; Contact, Privacy Policy, Terms & Conditions.',    agents: 'Frontend' },
  { phase: 'B', day: 5, module: 'Organization Management', item: 'Super Admin role — review/approve sign-ups; provision org and auto-create its first Admin.',                agents: 'Backend · Frontend' },
  { phase: 'B', day: 6, module: 'Organization Management', item: 'Subscription Plan catalogue — Basic / Standard / Premium; assign or change plan per org; user caps.',       agents: 'Backend · Frontend' },
  { phase: 'B', day: 6, module: 'Organization Management', item: 'Organization lifecycle — view, deactivate, reactivate any organization.',                                  agents: 'Backend · Frontend' },
  { phase: 'B', day: 6, module: 'Organization Management', item: 'Invoicing — Super Admin manages invoices for every organization.',                                         agents: 'Backend · Frontend' },
  { phase: 'B', day: 6, module: 'Organization Management', item: 'Legal pages & contact queries — manage legal content; view and triage contact queries.',                   agents: 'Backend · Frontend' },
  { phase: 'B', day: 6, module: 'Organization Management', item: 'Platform-level Master Data — City, State, Payment Methods managed centrally for all orgs.',                 agents: 'Backend · Frontend' },
  { phase: 'B', day: 6, module: 'Organization Management', item: 'Admin Organization view — Admin page showing own org details, plan and invoices.',                         agents: 'Frontend · Backend' },

  // ===== PHASE C — INTEGRATION, VAPT & RELEASE (Days 7–8) =====
  { phase: 'C', day: 7, kind: 'qa',   module: 'Release', item: 'Integration & end-to-end regression — full automated + manual pass across all modules.', agents: 'QA · Backend · Frontend' },
  { phase: 'C', day: 7, kind: 'vapt', module: 'Release', item: 'Full-platform VAPT — OWASP Top 10, role-scope leak audit, payment-write authorization, auth/session.', agents: 'Security' },
  { phase: 'C', day: 8, kind: 'uat',  module: 'Release', item: 'UAT deployment & client acceptance testing.',                                            agents: 'PM · QA · Client' },
  { phase: 'C', day: 8, kind: 'fix',  module: 'Release', item: 'Bug closure, re-test and final client sign-off.',                                         agents: 'All agents' },
];

const PHASE_LABEL = {
  A: 'A — Close the Gaps',
  B: 'B — New Features',
  C: 'C — Integration, VAPT & Release',
};
const PHASE_THEME = {
  A: 'Repair every broken or missing area in the current system, module by module, in Solution-Overview order. Multiple agent teams work in parallel each day.',
  B: 'Build the new features in Solution-Overview order: Per-Room Leasing, Impersonation, Delegation, Visitor Management, then the Organization Management (SAAS) layer — parallelised across agent teams.',
  C: 'Whole-platform regression, a consolidated security assessment (VAPT), client UAT, and sign-off.',
};

// Per-item lifecycle description (everything happens within the item's day).
const INCLUDES = {
  feature: 'Build · Automated tests · Manual QA · VAPT check',
  qa:      'Automated + manual regression (all modules)',
  vapt:    'Security assessment — OWASP, role-scope, payments, auth',
  uat:     'Client acceptance testing on UAT environment',
  fix:     'Fixes · re-test · client sign-off',
};

const fmtDay = (n) => `Day ${n}`;

// ─────────────────────────────────────────────────────────────────────────────
// Style helpers
// ─────────────────────────────────────────────────────────────────────────────
const fontTitle    = { name: 'Arial', size: 18, bold: true, color: { argb: COLOR.navy } };
const fontSubtitle = { name: 'Arial', size: 10, italic: true, color: { argb: COLOR.slate } };
const fontHeader   = { name: 'Arial', size: 11, bold: true, color: { argb: COLOR.white } };
const fontBody     = { name: 'Arial', size: 10, color: { argb: COLOR.charcoal } };
const fontBold     = { name: 'Arial', size: 10, bold: true, color: { argb: COLOR.navy } };

const fillHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.navy } };
const phaseFill  = (p) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: p === 'A' ? COLOR.fillGap : p === 'B' ? COLOR.fillNew : COLOR.fillRel } });

const thin = { style: 'thin', color: { argb: COLOR.border } };
const borderAll = { top: thin, left: thin, bottom: thin, right: thin };
const center = { vertical: 'middle', horizontal: 'center', wrapText: true };
const left   = { vertical: 'middle', horizontal: 'left', wrapText: true };

// ─────────────────────────────────────────────────────────────────────────────
// Build the workbook
// ─────────────────────────────────────────────────────────────────────────────
async function build() {
  const rows = [...ITEMS].sort((a, b) => a.day - b.day);
  const totalDays = Math.max(...ITEMS.map((x) => x.day));
  const phaseRange = (p) => {
    const d = ITEMS.filter((x) => x.phase === p).map((x) => x.day);
    return { start: Math.min(...d), end: Math.max(...d) };
  };
  const A = phaseRange('A'), B = phaseRange('B'), C = phaseRange('C');
  const vaptRow = ITEMS.find((x) => x.kind === 'vapt');
  const peakParallel = Math.max(...[...new Set(ITEMS.map((x) => x.day))].map((d) => ITEMS.filter((x) => x.day === d).length));

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Aayush Kumar, Triline';
  wb.created = new Date();
  wb.modified = new Date();
  wb.title = 'GharSetu — Project Timeline';

  // ===== Sheet 1: Phase Overview ==============================================
  const ov = wb.addWorksheet('Phase Overview', {
    properties: { tabColor: { argb: COLOR.navy } },
    views: [{ showGridLines: false }],
  });
  ov.columns = [
    { key: 'a', width: 30 }, { key: 'b', width: 20 }, { key: 'c', width: 14 }, { key: 'd', width: 78 },
  ];

  ov.mergeCells('A1:D1'); ov.getRow(1).height = 6;
  ov.mergeCells('A2:D2');
  ov.getCell('A2').value = 'GharSetu — Project Timeline';
  ov.getCell('A2').font = fontTitle; ov.getCell('A2').alignment = left; ov.getRow(2).height = 28;
  ov.mergeCells('A3:D3');
  ov.getCell('A3').value = 'Delivery companion to Solution_Overview.docx. Same order, same reference: Close the Gaps → New Features → Integration, VAPT & Release.';
  ov.getCell('A3').font = fontSubtitle; ov.getCell('A3').alignment = left; ov.getRow(3).height = 16;
  ov.mergeCells('A4:D4');
  ov.getCell('A4').value = `Time is in working days. Day 1 = first working day after the client signs off the Solution Overview + prototype. Built by multiple AI agent teams in parallel — total: ${totalDays} working days.`;
  ov.getCell('A4').font = fontSubtitle; ov.getCell('A4').alignment = left; ov.getRow(4).height = 28;
  ov.getRow(5).height = 6;

  // Phase table
  let rr = 6;
  const oh = ov.getRow(rr);
  oh.values = ['Phase', 'Duration', 'Items', 'What happens'];
  oh.font = fontHeader; oh.fill = fillHeader; oh.alignment = center; oh.height = 22;
  oh.eachCell((c) => { c.border = borderAll; });
  rr++;
  ['A', 'B', 'C'].forEach((p) => {
    const pr = phaseRange(p);
    const count = ITEMS.filter((x) => x.phase === p).length;
    const row = ov.getRow(rr++);
    row.values = [PHASE_LABEL[p], `${fmtDay(pr.start)} – ${fmtDay(pr.end)}`, count, PHASE_THEME[p]];
    row.font = fontBody; row.alignment = left; row.height = 52;
    row.fill = phaseFill(p);
    row.eachCell((c) => { c.border = borderAll; });
    row.getCell(1).font = fontBold;
    row.getCell(2).alignment = center; row.getCell(3).alignment = center;
  });

  rr += 1;
  // Milestones
  ov.mergeCells(`A${rr}:D${rr}`);
  ov.getCell(`A${rr}`).value = 'Key Milestones';
  ov.getCell(`A${rr}`).font = { name: 'Arial', size: 12, bold: true, color: { argb: COLOR.navy } };
  ov.getRow(rr).height = 22; rr++;
  const mh = ov.getRow(rr);
  mh.getCell(1).value = 'Milestone'; mh.getCell(2).value = 'By';
  mh.font = fontHeader; mh.fill = fillHeader; mh.alignment = center; mh.height = 20;
  ov.mergeCells(`B${rr}:D${rr}`);
  mh.getCell(1).border = borderAll; mh.getCell(2).border = borderAll;
  rr++;
  const milestones = [
    ['Project start', fmtDay(1)],
    ['Phase A complete — all gaps closed', fmtDay(A.end)],
    ['Phase B complete — all new features built', fmtDay(B.end)],
    ['Full-platform VAPT complete', fmtDay(vaptRow.day)],
    ['Client sign-off (project complete)', fmtDay(totalDays)],
  ];
  milestones.forEach(([label, day], i) => {
    const row = ov.getRow(rr++);
    row.getCell(1).value = label;
    row.getCell(2).value = day;
    ov.mergeCells(`B${row.number}:D${row.number}`);
    row.font = fontBody; row.height = 20;
    row.getCell(1).alignment = left; row.getCell(2).alignment = center;
    row.getCell(1).border = borderAll; row.getCell(2).border = borderAll;
    if (i % 2 === 1) { row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.stripe } }; row.getCell(2).fill = row.getCell(1).fill; }
    if (label.startsWith('Client sign-off')) row.getCell(1).font = { ...fontBody, bold: true, color: { argb: COLOR.green } };
  });

  rr += 1;
  // Notes / legend
  ov.mergeCells(`A${rr}:D${rr}`);
  ov.getCell(`A${rr}`).value = 'Notes';
  ov.getCell(`A${rr}`).font = { name: 'Arial', size: 12, bold: true, color: { argb: COLOR.navy } };
  ov.getRow(rr).height = 22; rr++;
  const notes = [
    'Time is shown in working days (Day 1 … Day N), not calendar dates. Day 1 is the first working day after the Solution Overview + prototype are signed off; exact dates are fixed once the start date is agreed.',
    'No prototype/design phase is included — design is already done; this schedule starts at build.',
    `Build work is done by multiple autonomous AI agent teams (Backend, Frontend, DBA, QA, Security) working IN PARALLEL — up to ${peakParallel} work items run on the same day. This is why the whole engagement is ~${totalDays} working days, not weeks.`,
    'Every feature is built AND tested (automated + manual) AND VAPT-checked by its agent team within its day; a consolidated full-platform VAPT then runs in Phase C before UAT.',
    'Colour key: blue = Close the Gaps (Phase A) · saffron = New Features (Phase B) · grey = Integration / VAPT / Release (Phase C).',
  ];
  notes.forEach((n) => {
    ov.mergeCells(`A${rr}:D${rr}`);
    const c = ov.getCell(`A${rr}`);
    c.value = `•  ${n}`; c.font = fontBody; c.alignment = left;
    ov.getRow(rr).height = 32; rr++;
  });

  // ===== Sheet 2: Schedule ====================================================
  const sh = wb.addWorksheet('Schedule', {
    properties: { tabColor: { argb: COLOR.saffron } },
    views: [{ showGridLines: false, state: 'frozen', ySplit: 5 }],
  });
  sh.columns = [
    { header: '#',        key: 'n',      width: 5  },
    { header: 'Day',      key: 'day',    width: 9  },
    { header: 'Phase',    key: 'phase',  width: 8  },
    { header: 'Module / Area (per Solution Overview)', key: 'mod', width: 24 },
    { header: 'Work Item', key: 'item',  width: 58 },
    { header: 'Includes (per item)', key: 'inc', width: 30 },
    { header: 'AI Agent Team', key: 'agents', width: 22 },
  ];
  const LAST = 'G';

  sh.mergeCells(`A1:${LAST}1`); sh.getRow(1).height = 6;
  sh.mergeCells(`A2:${LAST}2`);
  sh.getCell('A2').value = 'Schedule — Close the Gaps, then New Features, then Release';
  sh.getCell('A2').font = fontTitle; sh.getCell('A2').alignment = left; sh.getRow(2).height = 28;
  sh.mergeCells(`A3:${LAST}3`);
  sh.getCell('A3').value = 'One row per work item, in Solution-Overview order. Items sharing a Day run in parallel across different AI agent teams. Each feature is built, tested (auto + manual) and VAPT-checked within its day.';
  sh.getCell('A3').font = fontSubtitle; sh.getCell('A3').alignment = left; sh.getRow(3).height = 16;
  sh.mergeCells(`A4:${LAST}4`);
  sh.getCell('A4').value = 'Blue = Close the Gaps · Saffron = New Features · Grey = Integration / VAPT / Release.';
  sh.getCell('A4').font = fontSubtitle; sh.getCell('A4').alignment = left; sh.getRow(4).height = 16;

  const hr = sh.getRow(5);
  hr.values = ['#', 'Day', 'Phase', 'Module / Area (per Solution Overview)', 'Work Item', 'Includes (per item)', 'AI Agent Team'];
  hr.font = fontHeader; hr.fill = fillHeader; hr.alignment = center; hr.height = 30;
  hr.eachCell((c) => { c.border = borderAll; });

  let prevDay = null;
  rows.forEach((r, i) => {
    const row = sh.getRow(6 + i);
    row.values = [
      i + 1, fmtDay(r.day), r.phase, r.module, r.item,
      INCLUDES[r.kind || 'feature'], r.agents,
    ];
    row.font = fontBody; row.alignment = left; row.height = 38;
    row.fill = phaseFill(r.phase);
    row.eachCell((c) => { c.border = borderAll; });
    [1, 2, 3].forEach((col) => { row.getCell(col).alignment = center; });
    row.getCell(2).font = fontBold;  // Day
    row.getCell(3).font = fontBold;  // Phase
    row.getCell(4).font = fontBold;  // Module
    // Thicker top border when the day changes — visually groups parallel items.
    if (r.day !== prevDay) {
      row.eachCell((c) => { c.border = { ...borderAll, top: { style: 'medium', color: { argb: COLOR.navy } } }; });
      prevDay = r.day;
    }
  });

  sh.autoFilter = { from: 'A5', to: `${LAST}5` };

  await wb.xlsx.writeFile(OUTPUT_PATH);
  console.log(`Document written to: ${OUTPUT_PATH}`);
  console.log(`${rows.length} items · ${totalDays} working days · up to ${peakParallel} parallel items/day`);
}

build().catch((e) => { console.error(e); process.exit(1); });
