/**
 * Unit tests for RentAccrualProcessor — BL-12 / BL-13 logic.
 *
 * All Prisma calls are mocked. No DB required.
 *
 * Tests:
 *   BL-12: period 5 days past due → status OVERDUE
 *   BL-12: period 4 days past due → NOT flipped to overdue
 *   BL-13 worked example: ₹18,000 rent, 17 days overdue → late_fee = 72,000 paise (₹720)
 *   BL-13 partial week: 13 days overdue → 1 full week → 36,000 paise (₹360)
 *   BL-13 no late fee: 4 days overdue → 0 paise
 *   BL-13 idempotency: second run on same date → skipped
 *   computeLateFeePaise helper: direct unit test
 */

import { computeLateFeePaise } from "@gharsetu/shared";
import { RentAccrualProcessor } from "./rent-accrual.processor";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { RentService } from "../rent/rent.service";

// ---------------------------------------------------------------------------
// computeLateFeePaise — pure helper tests (no mocks needed)
// ---------------------------------------------------------------------------

describe("computeLateFeePaise (shared helper)", () => {
  const EIGHTEEN_K_PAISE = 1_800_000n; // ₹18,000

  it("BL-13 worked example: 17 days overdue → 2 weeks → ₹720 (72,000 paise)", () => {
    const fee = computeLateFeePaise(EIGHTEEN_K_PAISE, 17);
    expect(fee).toBe(72_000n);
  });

  it("BL-13 partial week: 13 days → 1 full week → ₹360 (36,000 paise)", () => {
    const fee = computeLateFeePaise(EIGHTEEN_K_PAISE, 13);
    expect(fee).toBe(36_000n);
  });

  it("BL-13: 4 days overdue → 0 full weeks → 0 paise", () => {
    const fee = computeLateFeePaise(EIGHTEEN_K_PAISE, 4);
    expect(fee).toBe(0n);
  });

  it("BL-13: exactly 7 days overdue → 1 week → ₹360", () => {
    const fee = computeLateFeePaise(EIGHTEEN_K_PAISE, 7);
    expect(fee).toBe(36_000n);
  });

  it("BL-13: 21 days (3 weeks) → ₹1,080 (108,000 paise)", () => {
    const fee = computeLateFeePaise(EIGHTEEN_K_PAISE, 21);
    expect(fee).toBe(108_000n);
  });

  it("BL-13: 0 days → 0 paise", () => {
    expect(computeLateFeePaise(EIGHTEEN_K_PAISE, 0)).toBe(0n);
  });

  it("BL-13: 6 days → 0 paise (less than 1 full week)", () => {
    expect(computeLateFeePaise(EIGHTEEN_K_PAISE, 6)).toBe(0n);
  });
});

// ---------------------------------------------------------------------------
// RentAccrualProcessor — processor logic tests
// ---------------------------------------------------------------------------

describe("RentAccrualProcessor", () => {
  let processor: RentAccrualProcessor;
  let prismaMock: jest.Mocked<Partial<PrismaService>>;
  let auditMock: jest.Mocked<Partial<AuditService>>;
  let rentServiceMock: jest.Mocked<Partial<RentService>>;

  const TODAY_UTC = new Date("2026-05-11T00:00:00Z"); // UTC midnight
  // IST = UTC + 5:30, so 2026-05-11T00:00 UTC = 2026-05-11T05:30 IST → date is 2026-05-11
  const TODAY_IST = "2026-05-11";

  // A period due 17 days ago: DUE_DATE = 2026-04-24 IST
  // 2026-05-11 - 2026-04-24 = 17 days
  const DUE_17_DAYS_AGO = new Date("2026-04-24T00:00:00Z");
  // A period due 5 days ago (exactly at threshold): DUE_DATE = 2026-05-06
  const DUE_5_DAYS_AGO = new Date("2026-05-06T00:00:00Z");

  beforeEach(() => {
    auditMock = {
      writeLog: jest.fn().mockResolvedValue(undefined),
    };

    rentServiceMock = {
      generateNextPeriod: jest.fn().mockResolvedValue(undefined),
    };

    // Build a comprehensive Prisma mock.
    // $transaction passes the mock itself as the tx so inner calls (tx.rentPeriod.update)
    // resolve against the same mock object.
    prismaMock = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      rentAccrualLog: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: "log-1", ...args.data, periods_examined: 0, periods_overdue_flipped: 0, late_fees_added_paise: 0n, next_periods_generated: 0 }),
        ),
        update: jest.fn().mockImplementation((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: "log-1", ...args.data }),
        ),
      } as unknown as PrismaService["rentAccrualLog"],
      rentPeriod: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      } as unknown as PrismaService["rentPeriod"],
      lease: {
        findMany: jest.fn().mockResolvedValue([]),
      } as unknown as PrismaService["lease"],
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      } as unknown as PrismaService["auditLog"],
      // resolveSystemActorId() needs prisma.user.findFirst
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: "system-admin-id" }),
      } as unknown as PrismaService["user"],
    } as unknown as jest.Mocked<Partial<PrismaService>>;

    // $transaction passes the mock itself as the tx client so inner
    // calls (tx.rentPeriod.update, tx.auditLog.create) resolve.
    (prismaMock as Record<string, unknown>)["$transaction"] = jest.fn().mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock),
    );

    processor = new RentAccrualProcessor(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
      rentServiceMock as unknown as RentService,
    );
  });

  // ---------------------------------------------------------------------------
  // BL-13 Idempotency
  // ---------------------------------------------------------------------------

  it("BL-13 idempotency: second run on same IST date is skipped", async () => {
    (prismaMock.rentAccrualLog!.findUnique as jest.Mock).mockResolvedValue({
      id: "log-1",
      run_date: new Date(TODAY_IST),
      finished_at: new Date(), // already finished
      periods_examined: 5,
      periods_overdue_flipped: 3,
      late_fees_added_paise: 72_000n,
      next_periods_generated: 1,
    });

    const result = await processor.runAccrual(TODAY_UTC);

    expect(result.skipped).toBe(true);
    expect(result.periodsExamined).toBe(5);
    // rentPeriod.findMany should NOT be called (skipped early)
    expect(prismaMock.rentPeriod!.findMany).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // BL-12: period exactly 5 days past due → OVERDUE
  // ---------------------------------------------------------------------------

  it("BL-12: period 5 days past due_date is flipped to OVERDUE", async () => {
    const period = {
      id: "period-1",
      lease_id: "lease-1",
      due_date: DUE_5_DAYS_AGO,
      amount_due_paise: 1_800_000n,
      late_fee_paise: 0n,
      paid_paise: 0n,
      outstanding_paise: 1_800_000n,
      status: "DUE",
    };

    (prismaMock.rentPeriod!.findMany as jest.Mock).mockResolvedValue([period]);
    (prismaMock.lease!.findMany as jest.Mock).mockResolvedValue([]);

    const result = await processor.runAccrual(TODAY_UTC);

    expect(result.skipped).toBe(false);
    expect(result.periodsExamined).toBe(1);
    expect(result.periodsOverdueFlipped).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // BL-12: period 4 days past due → NOT overdue yet
  // ---------------------------------------------------------------------------

  it("BL-12: period 4 days past due_date is NOT in the actionable set", async () => {
    // The worker query filters due_date <= today - 5 days, so 4-day-old periods
    // won't appear in findMany results. We simulate that by returning empty.
    (prismaMock.rentPeriod!.findMany as jest.Mock).mockResolvedValue([]);
    (prismaMock.lease!.findMany as jest.Mock).mockResolvedValue([]);

    const result = await processor.runAccrual(TODAY_UTC);

    expect(result.periodsExamined).toBe(0);
    expect(result.periodsOverdueFlipped).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // BL-13 worked example: ₹18,000 rent, 17 days overdue → ₹720 late fee
  // ---------------------------------------------------------------------------

  it("BL-13 worked example: 17 days overdue → late_fee = 72,000 paise (₹720)", async () => {
    const AMOUNT_DUE = 1_800_000n;
    const period = {
      id: "period-2",
      lease_id: "lease-2",
      due_date: DUE_17_DAYS_AGO, // 2026-04-24
      amount_due_paise: AMOUNT_DUE,
      late_fee_paise: 0n,
      paid_paise: 0n,
      outstanding_paise: AMOUNT_DUE,
      status: "DUE",
    };

    (prismaMock.rentPeriod!.findMany as jest.Mock).mockResolvedValue([period]);
    (prismaMock.lease!.findMany as jest.Mock).mockResolvedValue([]);

    // Capture the update call to verify late_fee_paise
    const updateSpy = prismaMock.rentPeriod!.update as jest.Mock;
    updateSpy.mockImplementation((args: { data: Record<string, unknown> }) => Promise.resolve({ id: "period-2", ...args.data }));

    const result = await processor.runAccrual(TODAY_UTC);

    expect(result.periodsExamined).toBe(1);
    expect(result.periodsOverdueFlipped).toBe(1);
    // 17 days → floor(17/7)=2 weeks → 2 × 0.02 × 1,800,000 = 72,000
    expect(result.lateFeesAddedPaise).toBe("72000");

    // Verify the update was called with the correct late_fee_paise
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "OVERDUE",
          late_fee_paise: 72_000n,
          outstanding_paise: 1_872_000n, // 1,800,000 + 72,000
        }),
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // BL-13 partial week: 13 days → 1 full week → ₹360
  // ---------------------------------------------------------------------------

  it("BL-13: 13 days overdue → 1 full week → late_fee = 36,000 paise (₹360)", async () => {
    // due_date = 2026-04-28 (13 days before 2026-05-11)
    const DUE_13_DAYS_AGO = new Date("2026-04-28T00:00:00Z");
    const AMOUNT_DUE = 1_800_000n;
    const period = {
      id: "period-3",
      lease_id: "lease-3",
      due_date: DUE_13_DAYS_AGO,
      amount_due_paise: AMOUNT_DUE,
      late_fee_paise: 0n,
      paid_paise: 0n,
      outstanding_paise: AMOUNT_DUE,
      status: "DUE",
    };

    (prismaMock.rentPeriod!.findMany as jest.Mock).mockResolvedValue([period]);
    (prismaMock.lease!.findMany as jest.Mock).mockResolvedValue([]);

    const updateSpy = prismaMock.rentPeriod!.update as jest.Mock;
    updateSpy.mockImplementation((args: { data: Record<string, unknown> }) => Promise.resolve({ id: "period-3", ...args.data }));

    const result = await processor.runAccrual(TODAY_UTC);

    expect(result.lateFeesAddedPaise).toBe("36000");
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          late_fee_paise: 36_000n,
          outstanding_paise: 1_836_000n,
        }),
      }),
    );
  });
});
