const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, AlignmentType,
        LevelFormat, BorderStyle, Table, TableRow, TableCell, WidthType,
        ShadingType, PageBreak, ImageRun } = require('docx');

// Output path is resolved relative to this script so the generator
// works in any environment (sandbox, local, CI).
const OUTPUT_PATH = path.resolve(__dirname, '..', '..', 'docs', 'product', 'Solution_Overview.docx');

// ─────────────────────────────────────────────────────────────────────────────
// GharSetu brand palette — design tokens shared with prototype/assets/styles.css
// (the website's design contract). Keep these in sync.
// ─────────────────────────────────────────────────────────────────────────────
const COLOR = {
  navy:      '1A237E', // primary brand — H1, cover title, table headers
  royalBlue: '1565C0', // secondary headings (H2), info accents
  saffron:   'FF6F00', // CTAs, H1 underline, dividers, Next-Steps callout
  charcoal:  '212121', // body text
  slate:     '546E7A', // subtitle / metadata / secondary text
  offWhite:  'F8F9FA', // alternating-row fill, soft surface
  lightGray: 'ECEFF1', // table borders, soft dividers
  midGray:   'CFD8DC', // stronger borders
  white:     'FFFFFF',

  // Status colours (Worked Examples — keep aligned with the platform)
  paid:      '2E7D32',
  partial:   'F57F17',
  overdue:   'C62828',
  prepaid:   '0277BD',
};

// ─────────────────────────────────────────────────────────────────────────────
// Cell + paragraph helpers
// ─────────────────────────────────────────────────────────────────────────────
const border = { style: BorderStyle.SINGLE, size: 4, color: COLOR.lightGray };
const cellBorders = { top: border, bottom: border, left: border, right: border };

const headerCell = (text, width) => new TableCell({
  borders: cellBorders,
  width: { size: width, type: WidthType.DXA },
  shading: { fill: COLOR.navy, type: ShadingType.CLEAR },
  margins: { top: 120, bottom: 120, left: 160, right: 160 },
  children: [new Paragraph({
    children: [new TextRun({ text, bold: true, color: COLOR.white, size: 22 })]
  })]
});

const bodyCell = (text, width, bold = false) => new TableCell({
  borders: cellBorders,
  width: { size: width, type: WidthType.DXA },
  margins: { top: 100, bottom: 100, left: 160, right: 160 },
  children: [new Paragraph({
    children: [new TextRun({ text, bold, size: 22 })]
  })]
});

// Same as bodyCell, but with a tinted fill — use for stripe / alternating rows
const tintedBodyCell = (text, width, bold = false) => new TableCell({
  borders: cellBorders,
  width: { size: width, type: WidthType.DXA },
  shading: { fill: COLOR.offWhite, type: ShadingType.CLEAR },
  margins: { top: 100, bottom: 100, left: 160, right: 160 },
  children: [new Paragraph({
    children: [new TextRun({ text, bold, size: 22 })]
  })]
});

// Cell that holds multiple paragraphs (for multi-bullet table cells)
const multiCell = (paragraphs, width) => new TableCell({
  borders: cellBorders,
  width: { size: width, type: WidthType.DXA },
  margins: { top: 100, bottom: 100, left: 160, right: 160 },
  children: paragraphs
});

const bullet = (text, boldPrefix = null) => {
  const runs = [];
  if (boldPrefix) runs.push(new TextRun({ text: boldPrefix, bold: true }));
  runs.push(new TextRun(text));
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    children: runs
  });
};

const cellBullet = (text) => new Paragraph({
  numbering: { reference: 'bullets', level: 0 },
  children: [new TextRun({ text, size: 22 })]
});

const para = (text, opts = {}) => new Paragraph({
  spacing: { after: opts.after !== undefined ? opts.after : 120 },
  children: [new TextRun({ text, bold: opts.bold || false })]
});

// Visual placeholder block — renders an obvious "[TODO: …]" marker so the
// generated doc clearly shows where content still needs to land. Delete
// these as real content is written.
const todo = (label) => new Paragraph({
  spacing: { before: 60, after: 120 },
  shading: { fill: 'FFF8E1', type: ShadingType.CLEAR },
  children: [
    new TextRun({ text: '[TODO] ', bold: true, color: COLOR.saffron, size: 22 }),
    new TextRun({ text: label, italics: true, color: COLOR.slate, size: 22 }),
  ]
});

// Saffron horizontal rule — separates major sections.
const divider = (opts = {}) => new Paragraph({
  border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR.saffron, space: 1 } },
  spacing: { before: opts.before ?? 480, after: opts.after ?? 240 }
});

// ─────────────────────────────────────────────────────────────────────────────
// Document
// ─────────────────────────────────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Arial', size: 22 } }
    },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 56, bold: true, font: 'Arial', color: COLOR.navy },
        paragraph: { spacing: { before: 0, after: 120 } } },
      { id: 'Subtitle', name: 'Subtitle', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, italics: true, font: 'Arial', color: COLOR.slate },
        paragraph: { spacing: { before: 0, after: 480 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Arial', color: COLOR.navy },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0,
          // Saffron underline on every H1 — the GharSetu signature accent.
          border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR.saffron, space: 4 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Arial', color: COLOR.royalBlue },
        paragraph: { spacing: { before: 220, after: 110 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 23, bold: true, font: 'Arial', color: COLOR.charcoal },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } }
    ]
  },
  numbering: {
    config: [
      { reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 }, // US Letter
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } // 1"
      }
    },
    children: [
      // ═════════════════════════════════════════════════════════════════════
      // COVER PAGE
      // ═════════════════════════════════════════════════════════════════════
      new Paragraph({ spacing: { before: 2400, after: 0 }, children: [new TextRun('')] }),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 200 },
        children: [new TextRun({
          text: 'Solution Overview',
          bold: true, size: 72, color: COLOR.navy, font: 'Arial'
        })]
      }),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 600 },
        children: [new TextRun({
          text: 'GharSetu — Property Rental Management Platform',
          italics: true, size: 32, color: COLOR.slate, font: 'Arial'
        })]
      }),

      // Saffron divider on the cover — GharSetu signature
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR.saffron, space: 1 } },
        spacing: { before: 0, after: 600 }
      }),

      // Cover one-liner — TODO placeholder
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 1600 },
        children: [new TextRun({
          text: '[TODO] One-line context line that frames why we wrote this document.',
          italics: true, size: 24, color: COLOR.slate, font: 'Arial'
        })]
      }),

      // Document metadata block
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 160 },
        children: [
          new TextRun({ text: 'Prepared for: ', bold: true, size: 24, color: COLOR.charcoal, font: 'Arial' }),
          new TextRun({ text: '[TODO] Client name', size: 24, color: COLOR.charcoal, font: 'Arial' })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 160 },
        children: [
          new TextRun({ text: 'Prepared by: ', bold: true, size: 24, color: COLOR.charcoal, font: 'Arial' }),
          new TextRun({ text: 'Aayush Kumar', size: 24, color: COLOR.charcoal, font: 'Arial' })
        ]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new TextRun({ text: 'Date: ', bold: true, size: 24, color: COLOR.charcoal, font: 'Arial' }),
          new TextRun({ text: '[TODO] Month YYYY', size: 24, color: COLOR.charcoal, font: 'Arial' })
        ]
      }),

      new Paragraph({ children: [new PageBreak()] }),

      // ═════════════════════════════════════════════════════════════════════
      // WHAT WE HEARD
      // ═════════════════════════════════════════════════════════════════════
      new Paragraph({ style: 'Heading1', children: [new TextRun('What We Heard')] }),
      todo('Summary of the client\'s current process and pain points — registers / Excel / WhatsApp, lease overlaps, prepaid mishandling, mid-month PM handover. Plain business language, no jargon.'),

      // ═════════════════════════════════════════════════════════════════════
      // WHAT YOU WILL GET
      // ═════════════════════════════════════════════════════════════════════
      new Paragraph({ style: 'Heading1', children: [new TextRun('What You Will Get')] }),
      todo('Lead sentence — one line on what the platform delivers end-to-end.'),
      todo('Benefit bullet 1 — "Bold Lead — description."'),
      todo('Benefit bullet 2'),
      todo('Benefit bullet 3'),
      todo('Benefit bullet 4'),
      todo('Benefit bullet 5'),

      // ═════════════════════════════════════════════════════════════════════
      // WHO USES THE PLATFORM
      // ═════════════════════════════════════════════════════════════════════
      new Paragraph({ style: 'Heading1', children: [new TextRun('Who Uses the Platform')] }),

      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2080, 7280],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              headerCell('Role', 2080),
              headerCell('Responsibilities on the Platform', 7280)
            ]
          }),
          new TableRow({
            children: [
              bodyCell('Admin', 2080, true),
              multiCell([
                cellBullet('[TODO] Admin responsibility 1'),
                cellBullet('[TODO] Admin responsibility 2'),
              ], 7280)
            ]
          }),
          new TableRow({
            children: [
              tintedBodyCell('Property Manager', 2080, true),
              multiCell([
                cellBullet('[TODO] PM responsibility 1'),
                cellBullet('[TODO] PM responsibility 2'),
              ], 7280)
            ]
          }),
          new TableRow({
            children: [
              bodyCell('Maintenance Team', 2080, true),
              multiCell([
                cellBullet('[TODO] Maintenance responsibility 1'),
                cellBullet('[TODO] Maintenance responsibility 2'),
              ], 7280)
            ]
          }),
          new TableRow({
            children: [
              tintedBodyCell('Tenant', 2080, true),
              multiCell([
                cellBullet('[TODO] Tenant responsibility 1'),
                cellBullet('[TODO] Tenant responsibility 2'),
              ], 7280)
            ]
          })
        ]
      }),
      new Paragraph({ spacing: { after: 240 }, children: [new TextRun('')] }),

      // ═════════════════════════════════════════════════════════════════════
      // FEATURE MODULES (1-6) — each is a section heading + TODO body
      // ═════════════════════════════════════════════════════════════════════
      new Paragraph({ style: 'Heading1', children: [new TextRun('1. Users Management')] }),
      todo('3 bullets — Admin manages users; one role per user; access removal preserves history.'),

      new Paragraph({ style: 'Heading1', children: [new TextRun('2. Properties and Units')] }),
      todo('4 bullets — add buildings/units; one PM per property; mid-month reassignment with view-only fallback; retire units.'),

      new Paragraph({ style: 'Heading1', children: [new TextRun('3. Leases and Tenants')] }),
      todo('6 bullets — create leases; tenant search/reuse; co-tenants jointly liable; deposit refunds; renewal as new record; early closure with reason.'),

      new Paragraph({ style: 'Heading1', children: [new TextRun('4. Maintenance Requests')] }),
      todo('6 bullets — tenant + PM can raise; PM assigns; priority/emergency flags; tenant closes; reopen on recurrence; 5+/30-day alert.'),

      new Paragraph({ style: 'Heading2', children: [new TextRun('Maintenance Request Lifecycle')] }),
      todo('Embed lifecycle.png — Open → Assigned → In Progress → Resolved → Closed, with a saffron dashed reopen arrow. Drop image into doc-assets/templates/lifecycle.png and uncomment the ImageRun block below.'),
      // new Paragraph({
      //   alignment: AlignmentType.CENTER,
      //   children: [
      //     new ImageRun({
      //       data: fs.readFileSync(path.resolve(__dirname, 'lifecycle.png')),
      //       transformation: { width: 650, height: 202 },
      //       type: 'png'
      //     })
      //   ]
      // }),

      new Paragraph({ style: 'Heading1', children: [new TextRun('5. Rent Collection')] }),
      todo('3 bullets — PM records full/partial/advance payments; rent status viewable at tenant/unit/building/portfolio level; monthly status (paid / partial / outstanding / overdue / prepaid).'),

      new Paragraph({ style: 'Heading1', children: [new TextRun('6. Dashboard')] }),
      todo('4 bullets — first page on login; key summary numbers; items needing attention; role-specific information.'),

      // Saffron divider before the closing matter
      divider(),

      // ═════════════════════════════════════════════════════════════════════
      // ASSUMPTIONS
      // ═════════════════════════════════════════════════════════════════════
      new Paragraph({ style: 'Heading1', children: [new TextRun('Assumptions')] }),
      todo('5–6 bullets — one Admin sufficient; existing 120 leases onboarded; users have internet access; tenants onboarded by PMs; maintenance not charged separately; deposit collected at lease creation.'),

      // ═════════════════════════════════════════════════════════════════════
      // BUSINESS RULES
      // ═════════════════════════════════════════════════════════════════════
      new Paragraph({ style: 'Heading2', children: [new TextRun('Business Rules')] }),
      todo('Opening sentence asking the client to confirm.'),
      todo('11 bullets — no two active leases on same unit; new lease after previous closes; mid-term closure needs all co-tenants; rent change 60 days in advance with effective-date split; occupied unit can\'t re-list; resolution notes ≥ 20 chars; only Maintenance moves to In Progress; monthly billing; 31st edge case; overdue at 5 days; late fee 2% per full week non-compounding.'),

      // ═════════════════════════════════════════════════════════════════════
      // WORKED EXAMPLES
      // ═════════════════════════════════════════════════════════════════════
      new Paragraph({ style: 'Heading1', children: [new TextRun('Worked Examples')] }),

      // Example 1 shell
      new Paragraph({ style: 'Heading2', children: [new TextRun('Example 1: Late Fee Calculation')] }),
      todo('Intro line — restate the rule (2% / current month outstanding / per full week / non-compounding).'),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 6240],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [headerCell('Scenario', 3120), headerCell('Outcome', 6240)]
          }),
          new TableRow({ children: [bodyCell('[TODO] Monthly rent', 3120, true), bodyCell('[TODO] ₹—', 6240)] }),
          new TableRow({ children: [tintedBodyCell('[TODO] Due date', 3120, true), tintedBodyCell('[TODO] —', 6240)] }),
          new TableRow({ children: [bodyCell('[TODO] Paid on due date', 3120, true), bodyCell('[TODO] ₹—', 6240)] }),
          new TableRow({ children: [tintedBodyCell('[TODO] Outstanding for the month', 3120, true), tintedBodyCell('[TODO] ₹—', 6240)] }),
          new TableRow({ children: [bodyCell('[TODO] Day 5 past due', 3120, true), bodyCell('[TODO] Shown as overdue', 6240)] }),
          new TableRow({ children: [tintedBodyCell('[TODO] Day 7 (1 full week)', 3120, true), tintedBodyCell('[TODO] Late fee: 2% of ₹— = ₹—', 6240)] }),
          new TableRow({ children: [bodyCell('[TODO] Day 14 (2 full weeks)', 3120, true), bodyCell('[TODO] Late fee: 2% of ₹— = ₹— (still on original)', 6240)] }),
          new TableRow({ children: [tintedBodyCell('[TODO] Total late fee after 2 weeks', 3120, true), tintedBodyCell('[TODO] ₹—', 6240)] }),
          new TableRow({ children: [bodyCell('[TODO] Total due', 3120, true), bodyCell('[TODO] ₹—', 6240)] })
        ]
      }),
      new Paragraph({ spacing: { after: 240 }, children: [new TextRun('')] }),

      // Example 2 shell
      new Paragraph({ style: 'Heading2', children: [new TextRun('Example 2: When Rent Shows as Overdue')] }),
      todo('Intro line — overdue triggers at 5 days past due.'),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 3120, 3120],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [headerCell('Due Date', 3120), headerCell('Today\'s Date', 3120), headerCell('Status Shown', 3120)]
          }),
          new TableRow({ children: [bodyCell('[TODO]', 3120), bodyCell('[TODO]', 3120), bodyCell('[TODO]', 3120)] }),
          new TableRow({ children: [tintedBodyCell('[TODO]', 3120), tintedBodyCell('[TODO]', 3120), tintedBodyCell('[TODO]', 3120)] }),
          new TableRow({ children: [bodyCell('[TODO]', 3120), bodyCell('[TODO]', 3120), bodyCell('[TODO]', 3120, true)] })
        ]
      }),
      new Paragraph({ spacing: { after: 240 }, children: [new TextRun('')] }),

      // Example 3 shell
      new Paragraph({ style: 'Heading2', children: [new TextRun('Example 3: Advance (Prepaid) Payment')] }),
      todo('Intro line — prepaid shows when payments exceed cumulative amount due to date.'),
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 6240],
        rows: [
          new TableRow({
            tableHeader: true,
            children: [headerCell('Scenario', 3120), headerCell('Outcome', 6240)]
          }),
          new TableRow({ children: [bodyCell('[TODO]', 3120, true), bodyCell('[TODO]', 6240)] }),
          new TableRow({ children: [tintedBodyCell('[TODO]', 3120, true), tintedBodyCell('[TODO]', 6240)] }),
        ]
      }),
      new Paragraph({ spacing: { after: 240 }, children: [new TextRun('')] }),

      // ═════════════════════════════════════════════════════════════════════
      // NOT INCLUDED IN THIS PHASE
      // ═════════════════════════════════════════════════════════════════════
      new Paragraph({ style: 'Heading1', children: [new TextRun('Not Included in This Phase')] }),
      todo('Intro line — these can be considered for a future phase.'),
      todo('Bullet — "Bold Lead: explanation." (Mobile app)'),
      todo('Bullet — "Bold Lead: explanation." (Online payment collection)'),

      // ═════════════════════════════════════════════════════════════════════
      // NEXT STEPS — saffron-accented closing
      // ═════════════════════════════════════════════════════════════════════
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR.saffron, space: 8 } },
        children: [new TextRun({
          text: 'Next Steps',
          bold: true, size: 44, color: COLOR.navy, font: 'Arial'
        })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({
          text: '[TODO] Short paragraph asking the client to review and share feedback.',
          size: 24, color: COLOR.charcoal, font: 'Arial', italics: true
        })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [new TextRun({
          text: '[TODO] One-line warm closing.',
          size: 24, color: COLOR.slate, font: 'Arial', italics: true
        })]
      })
    ]
  }]
});

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(OUTPUT_PATH, buffer);
  console.log(`Document written to: ${OUTPUT_PATH}`);
  console.log(`Size: ${buffer.length} bytes`);
});
