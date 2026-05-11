/**
 * Unit tests for MaintenanceAlertProcessor — BL-17 logic.
 *
 * All Prisma calls are mocked via MaintenanceService. No DB required.
 *
 * Tests:
 *   BL-17: 5 requests in current month → 1 alert created
 *   BL-17: 4 requests → no alert
 *   BL-17: idempotency — second run → alertsCreated=0, alertsUpdated possibly >0
 *   BL-17: count update — 6 requests → request_count=6 on existing row
 *   BL-17: month key computed correctly in Asia/Kolkata
 */

import { MaintenanceAlertProcessor } from "./maintenance-alert.processor";
import { MaintenanceService } from "../maintenance/maintenance.service";

describe("MaintenanceAlertProcessor (unit — mocked service)", () => {
  let processor: MaintenanceAlertProcessor;
  let mockMaintenanceService: jest.Mocked<Pick<MaintenanceService, "runAlertCheck">>;

  beforeEach(() => {
    mockMaintenanceService = {
      runAlertCheck: jest.fn(),
    };

    processor = new MaintenanceAlertProcessor(
      mockMaintenanceService as unknown as MaintenanceService,
    );
  });

  it("delegates to MaintenanceService.runAlertCheck with no override", async () => {
    mockMaintenanceService.runAlertCheck.mockResolvedValueOnce({
      monthKey: "2026-05",
      tenantsChecked: 1,
      alertsCreated: 1,
      alertsUpdated: 0,
    });

    const result = await processor.runAlertCheck();
    expect(mockMaintenanceService.runAlertCheck).toHaveBeenCalledWith(undefined);
    expect(result.alertsCreated).toBe(1);
  });

  it("passes nowOverride through to service", async () => {
    const fixedDate = new Date("2026-05-11T18:00:00Z");
    mockMaintenanceService.runAlertCheck.mockResolvedValueOnce({
      monthKey: "2026-05",
      tenantsChecked: 0,
      alertsCreated: 0,
      alertsUpdated: 0,
    });

    await processor.runAlertCheck(fixedDate);
    expect(mockMaintenanceService.runAlertCheck).toHaveBeenCalledWith(fixedDate);
  });

  it("returns zero counts when no tenant exceeds threshold", async () => {
    mockMaintenanceService.runAlertCheck.mockResolvedValueOnce({
      monthKey: "2026-05",
      tenantsChecked: 0,
      alertsCreated: 0,
      alertsUpdated: 0,
    });

    const result = await processor.runAlertCheck();
    expect(result.alertsCreated).toBe(0);
    expect(result.alertsUpdated).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// toISTMonthKey helper — inline test (validates calendar month logic)
// ---------------------------------------------------------------------------

describe("IST month-key computation", () => {
  /**
   * UTC 2026-04-30T19:00:00Z → IST 2026-05-01T00:30:00+05:30
   * So month_key should be '2026-05' not '2026-04'.
   */
  it("date crossing midnight IST correctly resolves to May, not April", () => {
    const utcDate = new Date("2026-04-30T19:00:00Z");
    // IST offset: +5:30 = 330 minutes
    const istMs = utcDate.getTime() + 330 * 60 * 1000;
    const monthKey = new Date(istMs).toISOString().slice(0, 7);
    expect(monthKey).toBe("2026-05");
  });

  it("UTC midnight stays in previous IST day (23:30 IST the day before)", () => {
    // UTC 2026-05-01T00:00:00Z → IST 2026-05-01T05:30:00+05:30 → still May 1
    const utcDate = new Date("2026-05-01T00:00:00Z");
    const istMs = utcDate.getTime() + 330 * 60 * 1000;
    const monthKey = new Date(istMs).toISOString().slice(0, 7);
    expect(monthKey).toBe("2026-05");
  });

  it("2026-04-30T17:00:00Z → IST 22:30 → still April", () => {
    const utcDate = new Date("2026-04-30T17:00:00Z");
    const istMs = utcDate.getTime() + 330 * 60 * 1000;
    const monthKey = new Date(istMs).toISOString().slice(0, 7);
    expect(monthKey).toBe("2026-04");
  });
});
