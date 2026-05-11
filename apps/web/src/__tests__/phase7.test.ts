/**
 * Phase 7 — Vitest tests
 *
 * Tests:
 *   1. formatDateIST — produces DD/MM/YYYY HH:mm in Asia/Kolkata
 *   2. formatDateOnlyIST — produces DD/MM/YYYY in Asia/Kolkata
 *   3. todayIST — non-empty string matching DD/MM/YYYY pattern
 *   4. Currency snapshot — no "Rs " or "INR " leaks in admin/rent page source
 *   5. Audit log viewer — source has all required columns and export button
 *   6. Audit log JSON diff — source renders "before"/"after" panels
 *   7. Admin dashboard — live KPI structure (uses new hooks from Phase 7)
 *   8. Idempotency key — rent-collection page sends Idempotency-Key header
 *   9. Locale helpers — imported by all critical date-formatting pages
 *  10. Admin tab bar still has ≤ 5 items after Audit Log sidebar addition
 *  11. Audit Log is in sidebar NAV_ITEMS but NOT in TAB_ITEMS
 *  12. Skeleton states on audit log page
 *  13. Skip-to-main in admin audit log layout (inherited from admin layout)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { formatDateIST, formatDateOnlyIST, todayIST } from "../lib/locale";

const SRC_ROOT = join(__dirname, "..");

function readSrc(relPath: string): string {
  return readFileSync(join(SRC_ROOT, relPath), "utf-8");
}

// ---------------------------------------------------------------------------
// 1. formatDateIST — IST timezone conversion
// ---------------------------------------------------------------------------

describe("formatDateIST (BL-22)", () => {
  it("converts UTC to IST and formats as DD/MM/YYYY HH:mm", () => {
    // 2026-05-11T07:30:00Z = 2026-05-11T13:00+05:30
    const result = formatDateIST("2026-05-11T07:30:00.000Z");
    expect(result).toBe("11/05/2026 13:00");
  });

  it("handles midnight UTC — shifts to IST date", () => {
    // 2026-05-11T00:00:00Z = 2026-05-11T05:30+05:30
    const result = formatDateIST("2026-05-11T00:00:00.000Z");
    expect(result).toBe("11/05/2026 05:30");
  });

  it("returns — for null input", () => {
    expect(formatDateIST(null)).toBe("—");
  });

  it("returns — for undefined input", () => {
    expect(formatDateIST(undefined)).toBe("—");
  });

  it("returns — for invalid date string", () => {
    expect(formatDateIST("not-a-date")).toBe("—");
  });

  it("output matches DD/MM/YYYY HH:mm pattern", () => {
    const result = formatDateIST("2026-01-15T10:00:00.000Z");
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });

  it("year stays at 2026 (no off-by-one month crossing)", () => {
    // Jan 1 2026 UTC is Jan 1 2026 at 05:30 IST — year should be 2026
    const result = formatDateIST("2026-01-01T00:00:00.000Z");
    expect(result).toContain("2026");
  });
});

// ---------------------------------------------------------------------------
// 2. formatDateOnlyIST — date-only variant
// ---------------------------------------------------------------------------

describe("formatDateOnlyIST (BL-23)", () => {
  it("formats date-only ISO string as DD/MM/YYYY", () => {
    // "2026-05-11" at midnight IST = 11/05/2026
    const result = formatDateOnlyIST("2026-05-11");
    expect(result).toBe("11/05/2026");
  });

  it("shifts UTC datetime to IST date correctly", () => {
    // 2026-05-10T20:00:00Z = 2026-05-11T01:30+05:30 → date is 11/05/2026
    const result = formatDateOnlyIST("2026-05-10T20:00:00.000Z");
    expect(result).toBe("11/05/2026");
  });

  it("returns — for null", () => {
    expect(formatDateOnlyIST(null)).toBe("—");
  });

  it("output matches DD/MM/YYYY pattern", () => {
    const result = formatDateOnlyIST("2026-03-08");
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

// ---------------------------------------------------------------------------
// 3. todayIST — convenience today helper
// ---------------------------------------------------------------------------

describe("todayIST", () => {
  it("returns a non-empty string matching DD/MM/YYYY", () => {
    const result = todayIST();
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("contains current year", () => {
    const year = new Date().getFullYear().toString();
    expect(todayIST()).toContain(year);
  });
});

// ---------------------------------------------------------------------------
// 4. Currency snapshot — no Rs/INR leaks in page sources
// ---------------------------------------------------------------------------

describe("Currency format — no Rs/INR leaks", () => {
  const pagesToCheck = [
    "app/(app)/admin/rent/page.tsx",
    "app/(app)/admin/dashboard/page.tsx",
    "app/(app)/pm/rent-collection/page.tsx",
    "app/(app)/tenant/rent/page.tsx",
    "app/(app)/tenant/dashboard/page.tsx",
  ];

  pagesToCheck.forEach((page) => {
    it(`${page} does not contain "Rs " or "INR " literal`, () => {
      const src = readSrc(page);
      // These would be raw currency string leaks, not code comments
      expect(src).not.toMatch(/["'`]Rs\s/);
      expect(src).not.toMatch(/["'`]INR\s/);
    });

    it(`${page} uses formatINR or paiseStringToINR for money rendering`, () => {
      const src = readSrc(page);
      const hasFormatINR = src.includes("formatINR") || src.includes("paiseStringToINR");
      expect(hasFormatINR).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Audit log page — source structure
// ---------------------------------------------------------------------------

describe("Admin Audit Log Viewer", () => {
  const SRC = "app/(app)/admin/audit-log/page.tsx";

  it("has When (IST) column header", () => {
    expect(readSrc(SRC)).toContain("When (IST)");
  });

  it("has Actor column", () => {
    expect(readSrc(SRC)).toContain("Actor");
  });

  it("has Action column", () => {
    expect(readSrc(SRC)).toContain("Action");
  });

  it("has Entity column", () => {
    expect(readSrc(SRC)).toContain("Entity");
  });

  it("has Diff column for before/after", () => {
    expect(readSrc(SRC)).toContain("Diff");
  });

  it("has Export CSV button", () => {
    expect(readSrc(SRC)).toContain("Export CSV");
  });

  it("uses formatDateIST for timestamp rendering", () => {
    expect(readSrc(SRC)).toContain("formatDateIST");
  });

  it("has filter inputs with associated labels (htmlFor)", () => {
    const src = readSrc(SRC);
    expect(src).toContain("htmlFor");
  });

  it("table has caption for screen readers", () => {
    expect(readSrc(SRC)).toContain("caption");
  });

  it("has scope=\"col\" on all column headers", () => {
    const src = readSrc(SRC);
    expect(src).toContain('scope="col"');
  });

  it("marks the backend endpoint as pending with TODO comment", () => {
    expect(readSrc(SRC)).toContain("TODO");
    expect(readSrc(SRC)).toContain("GET /audit-log");
  });
});

// ---------------------------------------------------------------------------
// 6. JSON diff panel — renders Before/After
// ---------------------------------------------------------------------------

describe("Audit Log JSON diff", () => {
  it("source contains Before and After panel labels", () => {
    const src = readSrc("app/(app)/admin/audit-log/page.tsx");
    expect(src).toContain('"Before"');
    expect(src).toContain('"After"');
  });

  it("identifies changed keys by comparing before/after", () => {
    const src = readSrc("app/(app)/admin/audit-log/page.tsx");
    expect(src).toContain("changedKeys");
  });

  it("highlights changed keys with badges", () => {
    const src = readSrc("app/(app)/admin/audit-log/page.tsx");
    // Changed keys rendered as badge elements
    expect(src).toContain("badge");
    expect(src).toContain("changedKeys.map");
  });
});

// ---------------------------------------------------------------------------
// 7. Admin dashboard — Phase 7 KPI structure
// ---------------------------------------------------------------------------

describe("Admin Dashboard Phase 7 KPIs", () => {
  it("fetches units for occupancy", () => {
    const src = readSrc("app/(app)/admin/dashboard/page.tsx");
    expect(src).toContain("/units");
  });

  it("fetches maintenance-requests/alerts for BL-17", () => {
    const src = readSrc("app/(app)/admin/dashboard/page.tsx");
    expect(src).toContain("/maintenance-requests/alerts");
  });

  it("fetches OVERDUE rent periods", () => {
    const src = readSrc("app/(app)/admin/dashboard/page.tsx");
    expect(src).toContain("OVERDUE");
  });

  it("computes occupancyPct as percentage", () => {
    const src = readSrc("app/(app)/admin/dashboard/page.tsx");
    expect(src).toContain("occupancyPct");
    expect(src).toContain("occupiedUnits / kpis.totalUnits");
  });

  it("uses formatINR for outstanding display", () => {
    const src = readSrc("app/(app)/admin/dashboard/page.tsx");
    expect(src).toContain("formatINR");
  });

  it("uses todayIST for date in topbar", () => {
    const src = readSrc("app/(app)/admin/dashboard/page.tsx");
    expect(src).toContain("todayIST");
  });

  it("has TODO comment for Phase 8 aggregate endpoint", () => {
    const src = readSrc("app/(app)/admin/dashboard/page.tsx");
    expect(src).toContain("TODO");
    expect(src).toContain("Phase 8");
  });

  it("has per-property occupancy breakdown table", () => {
    const src = readSrc("app/(app)/admin/dashboard/page.tsx");
    expect(src).toContain("propertyOccupancy");
    expect(src).toContain("Property Snapshot");
  });

  it("skeleton during load — SkeletonKpi and SkeletonTableRows", () => {
    const src = readSrc("app/(app)/admin/dashboard/page.tsx");
    expect(src).toContain("SkeletonKpi");
    expect(src).toContain("SkeletonTableRows");
  });
});

// ---------------------------------------------------------------------------
// 8. Idempotency-Key on payment submission
// ---------------------------------------------------------------------------

describe("Idempotency-Key on Record Payment (Phase 7)", () => {
  it("rent-collection page sends Idempotency-Key header", () => {
    const src = readSrc("app/(app)/pm/rent-collection/page.tsx");
    expect(src).toContain("Idempotency-Key");
  });

  it("uses crypto.randomUUID() for the key", () => {
    const src = readSrc("app/(app)/pm/rent-collection/page.tsx");
    expect(src).toContain("crypto.randomUUID()");
  });

  it("generates a fresh key per submit attempt (not module-level)", () => {
    const src = readSrc("app/(app)/pm/rent-collection/page.tsx");
    // The UUID must be inside the onSubmit function body (runtime call, not top-level)
    const submitIdx = src.indexOf("async function onSubmit");
    const uuidIdx = src.indexOf("crypto.randomUUID()");
    expect(submitIdx).toBeGreaterThan(-1);
    expect(uuidIdx).toBeGreaterThan(submitIdx);
  });
});

// ---------------------------------------------------------------------------
// 9. Locale helpers imported across critical pages
// ---------------------------------------------------------------------------

describe("Locale helpers usage", () => {
  const PAGES_WITH_DATE_ONLY = [
    "app/(app)/admin/users/page.tsx",
    "app/(app)/admin/properties/[id]/page.tsx",
    "app/(app)/pm/tenants/page.tsx",
    "app/(app)/pm/tenants/[id]/page.tsx",
    "app/(app)/pm/leases/[id]/page.tsx",
    "app/(app)/maintenance/dashboard/page.tsx",
    "app/(app)/maintenance/profile/page.tsx",
    "app/(app)/tenant/maintenance/page.tsx",
    "app/(app)/tenant/dashboard/page.tsx",
  ];

  PAGES_WITH_DATE_ONLY.forEach((page) => {
    it(`${page} imports from @/lib/locale`, () => {
      const src = readSrc(page);
      expect(src).toContain("@/lib/locale");
    });
  });

  it("pm/dashboard imports todayIST from locale", () => {
    const src = readSrc("app/(app)/pm/dashboard/page.tsx");
    expect(src).toContain("todayIST");
    expect(src).toContain("@/lib/locale");
  });

  it("admin maintenance uses formatDateIST from locale", () => {
    const src = readSrc("app/(app)/admin/maintenance/page.tsx");
    expect(src).toContain("formatDateIST");
  });

  it("maintenance/all-open uses formatDateIST from locale", () => {
    const src = readSrc("app/(app)/maintenance/all-open/AllOpenClient.tsx");
    expect(src).toContain("formatDateIST");
  });
});

// ---------------------------------------------------------------------------
// 10. Admin tab bar still has ≤ 5 items after Audit Log sidebar addition
// ---------------------------------------------------------------------------

describe("Admin tab bar cap after Audit Log addition", () => {
  function extractTabItemsBlock(src: string): string {
    const lines = src.split("\n");
    const startIdx = lines.findIndex((l) => l !== undefined && l.includes("const TAB_ITEMS"));
    if (startIdx === -1) return "";
    const block: string[] = [];
    let depth = 0;
    let started = false;
    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i] ?? "";
      block.push(line);
      for (const ch of line) {
        if (ch === "[") { depth++; started = true; }
        else if (ch === "]" && started) { depth--; }
      }
      if (started && depth === 0) break;
    }
    return block.join("\n");
  }

  it("Admin TAB_ITEMS has ≤ 5 items", () => {
    const src = readSrc("components/admin/AdminSidebar.tsx");
    const block = extractTabItemsBlock(src);
    const count = (block.match(/\bhref:/g) ?? []).length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// 11. Audit Log in sidebar NAV_ITEMS but NOT in TAB_ITEMS
// ---------------------------------------------------------------------------

describe("Audit Log navigation placement", () => {
  it("Audit Log href is in the sidebar NAV_ITEMS", () => {
    const src = readSrc("components/admin/AdminSidebar.tsx");
    // Find NAV_ITEMS block
    const navStart = src.indexOf("const NAV_ITEMS");
    const navEnd = src.indexOf("];", navStart);
    const navBlock = src.slice(navStart, navEnd);
    expect(navBlock).toContain("/admin/audit-log");
  });

  it("Audit Log href is NOT in TAB_ITEMS (mobile tabs capped at 5)", () => {
    const src = readSrc("components/admin/AdminSidebar.tsx");
    const tabStart = src.indexOf("const TAB_ITEMS");
    const tabEnd = src.indexOf("];", tabStart);
    const tabBlock = src.slice(tabStart, tabEnd);
    expect(tabBlock).not.toContain("/admin/audit-log");
  });
});

// ---------------------------------------------------------------------------
// 12. Audit log skeleton states
// ---------------------------------------------------------------------------

describe("Audit log skeleton states", () => {
  it("uses SkeletonTableRows during loading", () => {
    const src = readSrc("app/(app)/admin/audit-log/page.tsx");
    expect(src).toContain("SkeletonTableRows");
  });

  it("shows empty state message when no results", () => {
    const src = readSrc("app/(app)/admin/audit-log/page.tsx");
    expect(src).toContain("No audit entries match");
  });
});

// ---------------------------------------------------------------------------
// 13. Admin rent page — filter chips present
// ---------------------------------------------------------------------------

describe("Admin Rent page filter chips", () => {
  it("has OVERDUE chip", () => {
    const src = readSrc("app/(app)/admin/rent/page.tsx");
    expect(src).toContain("OVERDUE");
  });

  it("has PARTIAL chip", () => {
    const src = readSrc("app/(app)/admin/rent/page.tsx");
    expect(src).toContain("PARTIAL");
  });

  it("has ALL chip", () => {
    const src = readSrc("app/(app)/admin/rent/page.tsx");
    expect(src).toContain('"ALL"');
  });

  it("uses StatusBadge for period status in table", () => {
    const src = readSrc("app/(app)/admin/rent/page.tsx");
    expect(src).toContain("StatusBadge");
  });

  it("table has scope=\"col\" on headers", () => {
    const src = readSrc("app/(app)/admin/rent/page.tsx");
    expect(src).toContain('scope="col"');
  });

  it("uses formatDateOnlyIST for due date column", () => {
    const src = readSrc("app/(app)/admin/rent/page.tsx");
    expect(src).toContain("formatDateOnlyIST");
  });
});

// ---------------------------------------------------------------------------
// 14. 429 error mapping — already in error mapper (confirm)
// ---------------------------------------------------------------------------

describe("429 rate-limit error mapping", () => {
  it("lib/api/errors maps HTTP_429 to friendly message", () => {
    const errSrc = readSrc("lib/api/errors.ts");
    expect(errSrc).toContain("HTTP_429");
    expect(errSrc).toContain("Too many attempts");
  });

  it("lib/api/errors maps RATE_LIMIT_EXCEEDED code", () => {
    const errSrc = readSrc("lib/api/errors.ts");
    expect(errSrc).toContain("RATE_LIMIT_EXCEEDED");
  });
});
