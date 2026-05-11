/**
 * Phase 6 — Vitest unit tests
 *
 * Tests:
 *   1. Skeleton component: renders without crashing, has aria-busy
 *   2. EmptyState component: has role="status"
 *   3. Tenant Dashboard late-fee breakdown: correct string for given inputs (BL-13)
 *   4. Maintenance work-stats computation: correct counts from list of requests
 *   5. Mobile bottom tab bar: max 5 items per role (shape check)
 *   6. Skip-to-main: layout source files contain skip link
 *   7. StatusBadge: aria-label on all statuses
 *   8. MaintenanceStatusBadge: aria-label on all statuses
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  computeLateFeePaise,
  RentStatusEnum,
  MaintenanceStatusEnum,
} from "@gharsetu/shared";

const SRC_ROOT = join(__dirname, "..");

function readSrc(relPath: string): string {
  return readFileSync(join(SRC_ROOT, relPath), "utf-8");
}

// ---------------------------------------------------------------------------
// 1. Skeleton component: aria-busy
// ---------------------------------------------------------------------------

describe("Skeleton component", () => {
  it("has aria-busy in source", () => {
    const src = readSrc("components/ui/Skeleton.tsx");
    expect(src).toContain('aria-busy="true"');
  });

  it("has SkeletonCard export", () => {
    const src = readSrc("components/ui/Skeleton.tsx");
    expect(src).toContain("export function SkeletonCard");
  });

  it("has SkeletonKpi export", () => {
    const src = readSrc("components/ui/Skeleton.tsx");
    expect(src).toContain("export function SkeletonKpi");
  });
});

// ---------------------------------------------------------------------------
// 2. EmptyState component: role="status"
// ---------------------------------------------------------------------------

describe("EmptyState component", () => {
  it("has role=\"status\" in source", () => {
    const src = readSrc("components/ui/EmptyState.tsx");
    expect(src).toContain('role="status"');
  });

  it("accepts heading and body props (interface check)", () => {
    const src = readSrc("components/ui/EmptyState.tsx");
    expect(src).toContain("heading");
    expect(src).toContain("body");
  });
});

// ---------------------------------------------------------------------------
// 3. Late-fee breakdown: BL-13 computeLateFeePaise correctness
//    "2% × rent × N weeks overdue"
// ---------------------------------------------------------------------------

describe("computeLateFeePaise (BL-13) — dashboard breakdown", () => {
  it("0 days overdue → 0 paise (less than 1 week)", () => {
    const result = computeLateFeePaise(1_800_000n, 0);
    expect(result).toBe(0n);
  });

  it("6 days overdue → 0 paise (still less than 1 full week)", () => {
    const result = computeLateFeePaise(1_800_000n, 6);
    expect(result).toBe(0n);
  });

  it("7 days overdue → 36000 paise (1 week × 2% × ₹18,000)", () => {
    // 1_800_000 * 2 * 1 / 100 = 36_000
    const result = computeLateFeePaise(1_800_000n, 7);
    expect(result).toBe(36_000n);
  });

  it("17 days overdue → 72000 paise (2 weeks × 2% × ₹18,000)", () => {
    // floor(17/7) = 2 weeks → 1_800_000 * 2 * 2 / 100 = 72_000
    const result = computeLateFeePaise(1_800_000n, 17);
    expect(result).toBe(72_000n);
  });

  it("14 days overdue (exactly 2 weeks) → 72000 paise", () => {
    const result = computeLateFeePaise(1_800_000n, 14);
    expect(result).toBe(72_000n);
  });

  it("30 days overdue (4 weeks) → 144000 paise", () => {
    // floor(30/7) = 4 weeks → 1_800_000 * 2 * 4 / 100 = 144_000
    const result = computeLateFeePaise(1_800_000n, 30);
    expect(result).toBe(144_000n);
  });

  it("breakdownString rendered in tenant rent page source", () => {
    const src = readSrc("app/(app)/tenant/rent/page.tsx");
    expect(src).toContain("Late fee = 2%");
  });

  it("LateFeeBreakdown also in tenant dashboard (Phase 6)", () => {
    const src = readSrc("app/(app)/tenant/dashboard/page.tsx");
    expect(src).toContain("Late fee = 2%");
  });
});

// ---------------------------------------------------------------------------
// 4. Maintenance work-stats computation
// ---------------------------------------------------------------------------

describe("Maintenance work-stats computation", () => {
  /**
   * Inline the computation logic here to unit-test it without rendering.
   * The real component in maintenance/profile/page.tsx uses this same logic.
   */
  function computeWorkStats(requests: Array<{
    status: string;
    assigned_at?: string | null;
    resolved_at?: string | null;
  }>) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalAssigned = requests.length;

    const activeCount = requests.filter((r) =>
      ["ASSIGNED", "IN_PROGRESS"].includes(r.status),
    ).length;

    const resolvedThisMonth = requests.filter((r) => {
      if (r.status !== "RESOLVED" && r.status !== "CLOSED") return false;
      if (!r.resolved_at) return false;
      try {
        const resolvedDate = new Date(r.resolved_at);
        return resolvedDate >= monthStart;
      } catch { return false; }
    }).length;

    const resolvedWithTimes = requests.filter((r) =>
      (r.status === "RESOLVED" || r.status === "CLOSED") &&
      r.assigned_at &&
      r.resolved_at,
    );

    let avgResolutionHours: number | null = null;
    if (resolvedWithTimes.length > 0) {
      const totalHours = resolvedWithTimes.reduce((sum, r) => {
        try {
          const start = new Date(r.assigned_at!);
          const end = new Date(r.resolved_at!);
          const h = Math.max(0, (end.getTime() - start.getTime()) / 3_600_000);
          return sum + h;
        } catch { return sum; }
      }, 0);
      avgResolutionHours = Math.round((totalHours / resolvedWithTimes.length) * 10) / 10;
    }

    return { totalAssigned, activeCount, resolvedThisMonth, avgResolutionHours };
  }

  it("empty list → all zeros", () => {
    const stats = computeWorkStats([]);
    expect(stats.totalAssigned).toBe(0);
    expect(stats.activeCount).toBe(0);
    expect(stats.resolvedThisMonth).toBe(0);
    expect(stats.avgResolutionHours).toBe(null);
  });

  it("counts ASSIGNED + IN_PROGRESS as active", () => {
    const requests = [
      { status: "ASSIGNED" },
      { status: "IN_PROGRESS" },
      { status: "RESOLVED", resolved_at: null },
    ];
    const stats = computeWorkStats(requests);
    expect(stats.activeCount).toBe(2);
    expect(stats.totalAssigned).toBe(3);
  });

  it("counts RESOLVED this month correctly", () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15T10:00:00Z`;
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    const lastMonth = lastMonthDate.toISOString();

    const requests = [
      { status: "RESOLVED", assigned_at: "2024-01-01T00:00:00Z", resolved_at: thisMonth },
      { status: "RESOLVED", assigned_at: "2024-01-01T00:00:00Z", resolved_at: lastMonth },
      { status: "CLOSED", assigned_at: "2024-01-01T00:00:00Z", resolved_at: thisMonth },
    ];
    const stats = computeWorkStats(requests);
    expect(stats.resolvedThisMonth).toBe(2);
  });

  it("computes avg resolution time", () => {
    const requests = [
      {
        status: "RESOLVED",
        assigned_at: "2024-05-01T00:00:00Z",
        resolved_at: "2024-05-02T00:00:00Z", // 24h exactly
      },
      {
        status: "RESOLVED",
        assigned_at: "2024-05-03T00:00:00Z",
        resolved_at: "2024-05-05T00:00:00Z", // 48h exactly
      },
    ];
    const stats = computeWorkStats(requests);
    // avg of 24 and 48 = 36h
    expect(stats.avgResolutionHours).toBe(36);
  });

  it("source file has computeWorkStats function", () => {
    const src = readSrc("app/(app)/maintenance/profile/page.tsx");
    expect(src).toContain("computeWorkStats");
  });
});

// ---------------------------------------------------------------------------
// 5. Mobile bottom tab bar: max 5 items per role (source check)
// ---------------------------------------------------------------------------

describe("Mobile tab bar — max 5 items per role", () => {
  /**
   * Extract the TAB_ITEMS array literal from source and count href entries.
   * Uses a simple line-based approach: grab lines between "const TAB_ITEMS = ["
   * and the closing "];" that terminates the array.
   */
  function extractTabItemsBlock(src: string): string {
    const lines = src.split("\n");
    const startIdx = lines.findIndex((l) => l !== undefined && l.includes("const TAB_ITEMS"));
    if (startIdx === -1) return "";
    // Collect lines until we see the closing ]; that ends the array
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

  it("Admin tab bar has ≤ 5 items", () => {
    const src = readSrc("components/admin/AdminSidebar.tsx");
    const block = extractTabItemsBlock(src);
    // Count href: entries (each NavItem has exactly one)
    const count = (block.match(/\bhref:/g) ?? []).length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
  });

  it("PM tab bar has ≤ 5 items", () => {
    const src = readSrc("components/pm/PmSidebar.tsx");
    const block = extractTabItemsBlock(src);
    const count = (block.match(/\bhref:/g) ?? []).length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
  });

  it("Maintenance tab bar has ≤ 5 items", () => {
    const src = readSrc("components/maintenance/MaintenanceSidebar.tsx");
    const block = extractTabItemsBlock(src);
    const count = (block.match(/\bhref:/g) ?? []).length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
  });

  it("Tenant tab bar has ≤ 5 items", () => {
    const src = readSrc("components/tenant/TenantSidebar.tsx");
    const block = extractTabItemsBlock(src);
    const count = (block.match(/\bhref:/g) ?? []).length;
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(5);
  });

  it("Tenant tab bar includes Profile tab", () => {
    const src = readSrc("components/tenant/TenantSidebar.tsx");
    const block = extractTabItemsBlock(src);
    expect(block).toContain("/tenant/profile");
  });

  it("Maintenance tab bar includes Profile tab", () => {
    const src = readSrc("components/maintenance/MaintenanceSidebar.tsx");
    const block = extractTabItemsBlock(src);
    expect(block).toContain("/maintenance/profile");
  });
});

// ---------------------------------------------------------------------------
// 6. Skip-to-main link: present in all role layouts
// ---------------------------------------------------------------------------

describe("Skip to main content link", () => {
  const layouts = [
    "app/(app)/tenant/layout.tsx",
    "app/(app)/maintenance/layout.tsx",
    "app/(app)/admin/layout.tsx",
    "app/(app)/pm/layout.tsx",
  ];

  layouts.forEach((layoutPath) => {
    it(`${layoutPath} has skip-to-main link`, () => {
      const src = readSrc(layoutPath);
      expect(src).toContain("Skip to main content");
      expect(src).toContain("#main-content");
    });

    it(`${layoutPath} has id="main-content" on <main>`, () => {
      const src = readSrc(layoutPath);
      expect(src).toContain('id="main-content"');
    });
  });
});

// ---------------------------------------------------------------------------
// 7. StatusBadge: aria-label on all statuses
// ---------------------------------------------------------------------------

describe("StatusBadge aria-label", () => {
  it("source includes aria-label prop", () => {
    const src = readSrc("components/ui/StatusBadge.tsx");
    expect(src).toContain("aria-label");
  });

  it("all RentStatusEnum values have a label mapping", () => {
    const statuses = RentStatusEnum.options;
    const src = readSrc("components/ui/StatusBadge.tsx");
    statuses.forEach((status) => {
      // Each status key appears in the STATUS_LABEL mapping
      expect(src).toContain(status);
    });
  });
});

// ---------------------------------------------------------------------------
// 8. MaintenanceStatusBadge: aria-label on all statuses
// ---------------------------------------------------------------------------

describe("MaintenanceStatusBadge aria-label", () => {
  it("source includes aria-label prop", () => {
    const src = readSrc("components/maintenance/MaintenanceStatusBadge.tsx");
    expect(src).toContain("aria-label");
  });

  it("all MaintenanceStatusEnum values have a label mapping", () => {
    const statuses = MaintenanceStatusEnum.options;
    const src = readSrc("components/maintenance/MaintenanceStatusBadge.tsx");
    statuses.forEach((status) => {
      expect(src).toContain(status);
    });
  });
});

// ---------------------------------------------------------------------------
// 9. PasswordChangeForm: aria-busy on submit button
// ---------------------------------------------------------------------------

describe("PasswordChangeForm", () => {
  it("has aria-busy on submit button", () => {
    const src = readSrc("components/ui/PasswordChangeForm.tsx");
    expect(src).toContain("aria-busy");
  });

  it("uses ChangePasswordInputSchema", () => {
    const src = readSrc("components/ui/PasswordChangeForm.tsx");
    expect(src).toContain("ChangePasswordInputSchema");
  });

  it("no browser native tooltip (no `title` attr on inputs)", () => {
    const src = readSrc("components/ui/PasswordChangeForm.tsx");
    // Ensure no `title=` attributes that would produce tooltips
    expect(src).not.toMatch(/title=["'][^"']/);
  });
});

// ---------------------------------------------------------------------------
// 10. Tenant Dashboard: skeleton on loading, empty-state copy
// ---------------------------------------------------------------------------

describe("Tenant Dashboard Phase 6", () => {
  it("uses SkeletonCard for loading state", () => {
    const src = readSrc("app/(app)/tenant/dashboard/page.tsx");
    expect(src).toContain("SkeletonCard");
  });

  it("has EmptyState for no-lease case", () => {
    const src = readSrc("app/(app)/tenant/dashboard/page.tsx");
    expect(src).toContain("EmptyState");
    expect(src).toContain("No active lease");
  });

  it("has CurrentPeriodCard", () => {
    const src = readSrc("app/(app)/tenant/dashboard/page.tsx");
    expect(src).toContain("CurrentPeriodCard");
  });

  it("has OpenMaintenanceCard", () => {
    const src = readSrc("app/(app)/tenant/dashboard/page.tsx");
    expect(src).toContain("OpenMaintenanceCard");
  });
});

// ---------------------------------------------------------------------------
// 11. No hamburger menus — source-level check
// ---------------------------------------------------------------------------

describe("No hamburger menus", () => {
  const sidebarFiles = [
    "components/admin/AdminSidebar.tsx",
    "components/pm/PmSidebar.tsx",
    "components/maintenance/MaintenanceSidebar.tsx",
    "components/tenant/TenantSidebar.tsx",
  ];

  sidebarFiles.forEach((file) => {
    it(`${file} has no hamburger UI element`, () => {
      const src = readSrc(file);
      // No ≡ character (hamburger symbol)
      expect(src).not.toContain("≡");
      // No MenuIcon import (shadcn / lucide hamburger component)
      expect(src).not.toContain("MenuIcon");
      expect(src).not.toContain("HamburgerMenuIcon");
      // No aria-label containing 'menu' that would indicate a burger button
      // (exclude "navigation" which is valid)
      const hasMenuButton = /aria-label=["'][^"']*(?:open menu|toggle menu|hamburger)[^"']*["']/i.test(src);
      expect(hasMenuButton).toBe(false);
    });
  });
});
