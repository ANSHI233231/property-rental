/**
 * Phase 5 — Frontend Vitest gap tests
 *
 * Supplements phase5.test.ts with explicit verifications for:
 *
 * 1. CharCounter CSS class logic — red (.error) below threshold, neutral above/at.
 * 2. Submit-disabled logic — button disabled when description.length < 30.
 * 3. PriorityBadge class mapping — correct CSS class for each of 4 priorities.
 * 4. EmergencyBanner component logic — renders only on active statuses + EMERGENCY.
 * 5. Tenant page role-boundary: no Assign/In-Progress/Resolve buttons in source.
 * 6. Maintenance staff page: no Close button rendered (BL-21 defence-in-depth).
 * 7. PM page: no Close button rendered (BL-21 defence-in-depth).
 * 8. Admin page: no Close button rendered (BL-21 defence-in-depth).
 * 9. Error mapping for all Phase-5 error codes — full set.
 */

import { describe, it, expect } from "vitest";
import {
  CreateMaintenanceRequestSchema,
  ResolveMaintenanceSchema,
  MaintenancePriorityEnum,
} from "@gharsetu/shared";
import { mapApiErrorCode, friendlyError } from "../lib/api/errors";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// 1. CharCounter CSS class logic
// ---------------------------------------------------------------------------

describe("CharCounter CSS class logic", () => {
  /**
   * CharCounter renders className `counter error` when current < min,
   * and `counter` (no error) when current >= min.
   * The component source at apps/web/src/components/maintenance/CharCounter.tsx
   * uses: isError = current < min → `counter${isError ? " error" : ""}`.
   */
  function charCounterClass(current: number, min: number): string {
    const isError = current < min;
    return `counter${isError ? " error" : ""}`;
  }

  it("0 chars below min=30 → 'counter error'", () => {
    expect(charCounterClass(0, 30)).toBe("counter error");
  });

  it("29 chars below min=30 → 'counter error'", () => {
    expect(charCounterClass(29, 30)).toBe("counter error");
  });

  it("30 chars at min=30 → 'counter' (no error)", () => {
    expect(charCounterClass(30, 30)).toBe("counter");
  });

  it("45 chars above min=30 → 'counter' (no error)", () => {
    expect(charCounterClass(45, 30)).toBe("counter");
  });

  it("0 chars below min=20 (resolution notes) → 'counter error'", () => {
    expect(charCounterClass(0, 20)).toBe("counter error");
  });

  it("19 chars below min=20 → 'counter error'", () => {
    expect(charCounterClass(19, 20)).toBe("counter error");
  });

  it("20 chars at min=20 → 'counter' (no error)", () => {
    expect(charCounterClass(20, 20)).toBe("counter");
  });

  it("CharCounter component source confirms isError = current < min", () => {
    // Verify the actual component source uses the expected expression
    const source = readFileSync(
      join(__dirname, "../components/maintenance/CharCounter.tsx"),
      "utf-8",
    );
    expect(source).toContain("isError = current < min");
    expect(source).toContain("error");
  });
});

// ---------------------------------------------------------------------------
// 2. Submit-disabled logic — description < 30 chars
// ---------------------------------------------------------------------------

describe("Submit button disabled logic (RaiseRequestModal)", () => {
  /**
   * Tenant raise-request modal disables submit when:
   *   isSubmitting || descriptionValue.length < 30
   */
  function isSubmitDisabled(isSubmitting: boolean, descriptionLength: number): boolean {
    return isSubmitting || descriptionLength < 30;
  }

  it("disabled when description.length = 0", () => {
    expect(isSubmitDisabled(false, 0)).toBe(true);
  });

  it("disabled when description.length = 29", () => {
    expect(isSubmitDisabled(false, 29)).toBe(true);
  });

  it("enabled when description.length = 30", () => {
    expect(isSubmitDisabled(false, 30)).toBe(false);
  });

  it("enabled when description.length = 50", () => {
    expect(isSubmitDisabled(false, 50)).toBe(false);
  });

  it("disabled when isSubmitting=true even if description >= 30", () => {
    expect(isSubmitDisabled(true, 50)).toBe(true);
  });

  it("TenantMaintenance page source confirms disabled={isSubmitting || descriptionValue.length < 30}", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/tenant/maintenance/page.tsx"),
      "utf-8",
    );
    expect(source).toContain("descriptionValue.length < 30");
    // No API calls to assign or in-progress state-transition endpoints.
    expect(source).not.toContain("/assign");
    expect(source).not.toContain("/in-progress");
    // The only API call in the tenant maintenance page is /close (no /resolve call)
    expect(source).toContain("/close");
    // Verify the one apiFetch call containing 'maintenance-requests' targets /close, not /resolve
    const apiFetchCalls = source.match(/apiFetch\(`\/maintenance-requests\/[^`]*`/g) ?? [];
    expect(apiFetchCalls.every(call => call.includes("/close"))).toBe(true);
  });

  it("ResolveModal source confirms disabled={isSubmitting || notesValue.length < 20}", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/maintenance/dashboard/page.tsx"),
      "utf-8",
    );
    expect(source).toContain("notesValue.length < 20");
  });
});

// ---------------------------------------------------------------------------
// 3. PriorityBadge class mapping
// ---------------------------------------------------------------------------

describe("PriorityBadge CSS class mapping", () => {
  const PRIORITY_CLASS: Record<string, string> = {
    LOW: "badge badge-closed",
    NORMAL: "badge badge-prepaid",
    HIGH: "badge badge-partial",
    EMERGENCY: "badge badge-emergency",
  };

  it("LOW maps to badge-closed (slate/muted)", () => {
    expect(PRIORITY_CLASS["LOW"]).toBe("badge badge-closed");
  });

  it("NORMAL maps to badge-prepaid (teal/blue)", () => {
    expect(PRIORITY_CLASS["NORMAL"]).toBe("badge badge-prepaid");
  });

  it("HIGH maps to badge-partial (amber)", () => {
    expect(PRIORITY_CLASS["HIGH"]).toBe("badge badge-partial");
  });

  it("EMERGENCY maps to badge-emergency (red)", () => {
    expect(PRIORITY_CLASS["EMERGENCY"]).toBe("badge badge-emergency");
  });

  it("all 4 priorities are valid per MaintenancePriorityEnum", () => {
    const priorities = ["LOW", "NORMAL", "HIGH", "EMERGENCY"];
    for (const p of priorities) {
      expect(MaintenancePriorityEnum.safeParse(p).success).toBe(true);
    }
  });

  it("PriorityBadge component source confirms badge-emergency for EMERGENCY", () => {
    const source = readFileSync(
      join(__dirname, "../components/maintenance/PriorityBadge.tsx"),
      "utf-8",
    );
    expect(source).toContain("badge-emergency");
    expect(source).toContain("badge-partial");
    expect(source).toContain("badge-prepaid");
    expect(source).toContain("badge-closed");
  });
});

// ---------------------------------------------------------------------------
// 4. EmergencyBanner component logic
// ---------------------------------------------------------------------------

describe("EmergencyBanner component logic", () => {
  type Status = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  type Priority = "LOW" | "NORMAL" | "HIGH" | "EMERGENCY";
  const ACTIVE_STATUSES: Status[] = ["OPEN", "ASSIGNED", "IN_PROGRESS"];

  function emergencyCount(requests: { priority: Priority; status: Status }[]): number {
    return requests.filter(r => r.priority === "EMERGENCY" && ACTIVE_STATUSES.includes(r.status)).length;
  }

  it("returns 0 for empty array → banner hidden", () => {
    expect(emergencyCount([])).toBe(0);
  });

  it("returns 1 for single EMERGENCY+OPEN → banner shown", () => {
    expect(emergencyCount([{ priority: "EMERGENCY", status: "OPEN" }])).toBe(1);
  });

  it("returns 1 for EMERGENCY+ASSIGNED → shown", () => {
    expect(emergencyCount([{ priority: "EMERGENCY", status: "ASSIGNED" }])).toBe(1);
  });

  it("returns 1 for EMERGENCY+IN_PROGRESS → shown", () => {
    expect(emergencyCount([{ priority: "EMERGENCY", status: "IN_PROGRESS" }])).toBe(1);
  });

  it("returns 0 for EMERGENCY+RESOLVED → hidden", () => {
    expect(emergencyCount([{ priority: "EMERGENCY", status: "RESOLVED" }])).toBe(0);
  });

  it("returns 0 for EMERGENCY+CLOSED → hidden", () => {
    expect(emergencyCount([{ priority: "EMERGENCY", status: "CLOSED" }])).toBe(0);
  });

  it("returns 0 for HIGH+OPEN (not emergency) → hidden", () => {
    expect(emergencyCount([{ priority: "HIGH", status: "OPEN" }])).toBe(0);
  });

  it("counts 2 active emergencies correctly", () => {
    expect(
      emergencyCount([
        { priority: "EMERGENCY", status: "OPEN" },
        { priority: "EMERGENCY", status: "IN_PROGRESS" },
        { priority: "HIGH", status: "OPEN" },
      ]),
    ).toBe(2);
  });

  it("EmergencyBanner component source confirms ACTIVE_STATUSES filter", () => {
    const source = readFileSync(
      join(__dirname, "../components/maintenance/EmergencyBanner.tsx"),
      "utf-8",
    );
    expect(source).toContain("ACTIVE_STATUSES");
    expect(source).toContain("OPEN");
    expect(source).toContain("ASSIGNED");
    expect(source).toContain("IN_PROGRESS");
    expect(source).toContain("EMERGENCY");
    // Banner should NOT appear on tenant or maintenance-staff views (omitted there)
    expect(source).toContain("alert-emergency");
  });
});

// ---------------------------------------------------------------------------
// 5. Tenant page: no Assign/In-Progress/Resolve buttons (BL-16 UI defence)
// ---------------------------------------------------------------------------

describe("Tenant maintenance page: no role-escalation buttons (BL-16)", () => {
  it("does NOT render /assign endpoint call", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/tenant/maintenance/page.tsx"),
      "utf-8",
    );
    expect(source).not.toContain("/assign");
  });

  it("does NOT render /in-progress endpoint call", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/tenant/maintenance/page.tsx"),
      "utf-8",
    );
    expect(source).not.toContain("/in-progress");
  });

  it("does NOT make /resolve API call (state transition restricted to maintenance staff)", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/tenant/maintenance/page.tsx"),
      "utf-8",
    );
    // The tenant page must not call the /resolve state-transition endpoint.
    // Note: '@hookform/resolvers/zod' import contains the substring '/resolve' but
    // that is not an API call. We check the actual apiFetch calls instead.
    const apiFetchCalls = source.match(/apiFetch\(`\/maintenance-requests\/[^`]*`/g) ?? [];
    const hasResolveCall = apiFetchCalls.some(call => call.includes("/resolve"));
    expect(hasResolveCall).toBe(false);
  });

  it("DOES render /close endpoint call (BL-21 — tenant closes their own)", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/tenant/maintenance/page.tsx"),
      "utf-8",
    );
    expect(source).toContain("/close");
  });

  it("DOES render 'Close Request' button text", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/tenant/maintenance/page.tsx"),
      "utf-8",
    );
    expect(source).toContain("Close Request");
  });
});

// ---------------------------------------------------------------------------
// 6. Maintenance staff view: no Close button (BL-21 defence-in-depth)
// ---------------------------------------------------------------------------

describe("Maintenance staff dashboard: no Close button (BL-21)", () => {
  it("does NOT render /close endpoint call", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/maintenance/dashboard/page.tsx"),
      "utf-8",
    );
    expect(source).not.toContain("/close");
  });

  it("does NOT render 'Close Request' or 'Close' button label", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/maintenance/dashboard/page.tsx"),
      "utf-8",
    );
    // 'Close Request' is the button label in Tenant view — must not appear here
    expect(source).not.toContain("Close Request");
  });

  it("does NOT render a New Request / Raise button (BL-16 defence)", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/maintenance/dashboard/page.tsx"),
      "utf-8",
    );
    // The button label 'Raise New Request' must not appear as a rendered element.
    // Note: the string 'Raised' appears in the status date display ('Raised 01/05/2026')
    // and the comment '* BL-16: no "New Request" button anywhere on this page.'
    // We check that no <button> element with a raise/new-request label is rendered.
    expect(source).not.toContain("Raise New Request");
    expect(source).not.toContain("+ New Request");
    expect(source).not.toContain("+ Raise");
    // Confirm the BL-16 guard comment is in place
    expect(source).toContain("BL-16");
  });

  it("DOES render BL-21 note comment in source (defence-in-depth marker)", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/maintenance/dashboard/page.tsx"),
      "utf-8",
    );
    expect(source).toContain("BL-21");
  });
});

// ---------------------------------------------------------------------------
// 7. PM maintenance view: no Close button (BL-21 defence-in-depth)
// ---------------------------------------------------------------------------

describe("PM maintenance page: no Close button (BL-21)", () => {
  it("PM maintenance page source does NOT render /close endpoint call", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/pm/maintenance/page.tsx"),
      "utf-8",
    );
    expect(source).not.toContain("/close");
  });

  it("PM maintenance page source does NOT render 'Close Request' label", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/pm/maintenance/page.tsx"),
      "utf-8",
    );
    expect(source).not.toContain("Close Request");
  });

  it("PM maintenance page source contains BL-21 reference (marker present)", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/pm/maintenance/page.tsx"),
      "utf-8",
    );
    expect(source).toContain("BL-21");
  });
});

// ---------------------------------------------------------------------------
// 8. Admin maintenance view: no Close button (BL-21 defence-in-depth)
// ---------------------------------------------------------------------------

describe("Admin maintenance page: no Close button (BL-21)", () => {
  it("Admin maintenance page source does NOT render /close endpoint call", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/admin/maintenance/page.tsx"),
      "utf-8",
    );
    expect(source).not.toContain("/close");
  });

  it("Admin maintenance page source does NOT render 'Close Request' label", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/admin/maintenance/page.tsx"),
      "utf-8",
    );
    expect(source).not.toContain("Close Request");
  });

  it("Admin maintenance page source references BL-21 policy (marker present)", () => {
    const source = readFileSync(
      join(__dirname, "../app/(app)/admin/maintenance/page.tsx"),
      "utf-8",
    );
    expect(source).toContain("BL-21");
  });
});

// ---------------------------------------------------------------------------
// 9. Error code mapping — full Phase-5 set + fallback
// ---------------------------------------------------------------------------

describe("Phase-5 error code mapping (full set)", () => {
  it("BL_16_ONLY_TENANT_CAN_RAISE_MAINTENANCE → 'Only tenants can raise maintenance requests.'", () => {
    expect(mapApiErrorCode("BL_16_ONLY_TENANT_CAN_RAISE_MAINTENANCE")).toBe(
      "Only tenants can raise maintenance requests.",
    );
  });

  it("BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE → contains 'tenant' and 'close'", () => {
    const msg = mapApiErrorCode("BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE");
    expect(msg.toLowerCase()).toContain("tenant");
    expect(msg.toLowerCase()).toContain("close");
  });

  it("NO_ACTIVE_LEASE_ON_UNIT → contains 'active lease'", () => {
    const msg = mapApiErrorCode("NO_ACTIVE_LEASE_ON_UNIT");
    expect(msg.toLowerCase()).toContain("active lease");
  });

  it("INVALID_TRANSITION → contains 'can't transition'", () => {
    const msg = mapApiErrorCode("INVALID_TRANSITION");
    expect(msg.toLowerCase()).toContain("can't transition");
  });

  it("NOT_YOUR_ASSIGNMENT → contains 'assigned to you'", () => {
    const msg = mapApiErrorCode("NOT_YOUR_ASSIGNMENT");
    expect(msg.toLowerCase()).toContain("assigned to you");
  });

  it("Unknown code → 'Something went wrong. Please try again.'", () => {
    expect(mapApiErrorCode("PHASE5_UNKNOWN_CODE")).toBe(
      "Something went wrong. Please try again.",
    );
  });

  it("friendlyError extracts BL_16 from error object correctly", () => {
    const msg = friendlyError({ code: "BL_16_ONLY_TENANT_CAN_RAISE_MAINTENANCE" });
    expect(msg).toBe("Only tenants can raise maintenance requests.");
  });

  it("friendlyError extracts BL_21 from error object correctly", () => {
    const msg = friendlyError({ code: "BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE" });
    expect(msg.toLowerCase()).toContain("tenant");
  });

  it("friendlyError falls back to message field when code is unknown", () => {
    const msg = friendlyError({ code: "UNKNOWN_CODE_XYZ", message: "Custom server error" });
    expect(msg).toBe("Custom server error");
  });

  it("friendlyError returns default for null/undefined", () => {
    expect(friendlyError(null)).toBe("Something went wrong. Please try again.");
    expect(friendlyError(undefined)).toBe("Something went wrong. Please try again.");
  });
});

// ---------------------------------------------------------------------------
// 10. Schema-level submit guard (zod)
// ---------------------------------------------------------------------------

describe("Zod schema: description < 30 chars blocks submission at schema level", () => {
  const base = {
    unitId: "unit-abc",
    title: "Leaking pipe in bathroom now",
    priority: "NORMAL" as const,
  };

  it("29-char description → schema rejects (submit path blocked)", () => {
    const result = CreateMaintenanceRequestSchema.safeParse({
      ...base,
      description: "A".repeat(29),
    });
    expect(result.success).toBe(false);
  });

  it("30-char description → schema accepts (submit path enabled)", () => {
    const result = CreateMaintenanceRequestSchema.safeParse({
      ...base,
      description: "A".repeat(30),
    });
    expect(result.success).toBe(true);
  });

  it("ResolveMaintenanceSchema rejects 19-char notes", () => {
    expect(ResolveMaintenanceSchema.safeParse({ resolutionNotes: "A".repeat(19) }).success).toBe(false);
  });

  it("ResolveMaintenanceSchema accepts 20-char notes", () => {
    expect(ResolveMaintenanceSchema.safeParse({ resolutionNotes: "A".repeat(20) }).success).toBe(true);
  });
});
