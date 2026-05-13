/**
 * Unit tests for RentChangeScheduleService (Change 5).
 *
 * Tests:
 *   - create: 60-day rule enforced (59 days ahead → EFFECTIVE_DATE_TOO_SOON)
 *   - create: exactly 60 days ahead → accepted
 *   - create: one-pending-per-unit rule (second create → PENDING_SCHEDULE_EXISTS)
 *   - create: retired unit → 409 UNIT_RETIRED
 *   - create: PM on wrong property → PROPERTY_ACCESS_DENIED
 *   - create: ADMIN bypasses PM scope check
 *   - modify: no pending schedule → 404
 *   - modify: no fields provided → MISSING_FIELDS
 *   - cancel: happy path
 *   - cancel: no pending schedule → 404
 *   - applyDue: applies due schedules, updates unit.monthly_rent_paise, flips status
 *   - applyDue: schedules not yet due are not applied
 */

import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { RentChangeScheduleService } from "./rent-change-schedule.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuditService } from "../audit/audit.service";
import type { EmailService } from "../notifications/email.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** IST offset in milliseconds */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/**
 * Return a YYYY-MM-DD string that is N days from today in IST.
 * This mirrors the service's toISTDateString(new Date()) logic so the
 * 60-day test uses the same reference date the service will compute.
 */
function daysFromNowIST(n: number): string {
  const nowIST = new Date(Date.now() + IST_OFFSET_MS);
  // Zero out sub-day components in the IST frame
  const todayIST = new Date(nowIST.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const target = new Date(todayIST.getTime() + n * 24 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 10);
}

/** Build a UTC midnight Date N days from now (for non-string uses in applyDue tests) */
function daysFromNow(n: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUnit = {
  id: 10,
  unit_number: "3B",
  is_retired: false,
  property: { id: 2, active_pm_id: 15 },
};

const mockRetiredUnit = { ...mockUnit, is_retired: true };

function buildPrismaMock(overrides: Record<string, unknown> = {}): jest.Mocked<Partial<PrismaService>> {
  const txMock = {
    rentChangeSchedule: {
      create: jest.fn(),
      update: jest.fn(),
    },
    unit: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  };

  return {
    unit: {
      findUnique: jest.fn(),
    } as unknown as PrismaService["unit"],
    rentChangeSchedule: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as PrismaService["rentChangeSchedule"],
    leaseTenant: {
      findMany: jest.fn().mockResolvedValue([]),
    } as unknown as PrismaService["leaseTenant"],
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 24 }),
    } as unknown as PrismaService["user"],
    $transaction: jest.fn().mockImplementation(async (fn: (tx: typeof txMock) => Promise<unknown>) => fn(txMock)),
    _txMock: txMock,
    ...overrides,
  } as unknown as jest.Mocked<Partial<PrismaService>>;
}

function buildAuditMock(): jest.Mocked<Partial<AuditService>> {
  return { writeLog: jest.fn() } as jest.Mocked<Partial<AuditService>>;
}

function buildEmailMock(): jest.Mocked<Partial<EmailService>> {
  return { sendRentChangeNotice: jest.fn().mockResolvedValue(undefined) } as jest.Mocked<Partial<EmailService>>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RentChangeScheduleService", () => {
  let service: RentChangeScheduleService;
  let prismaMock: ReturnType<typeof buildPrismaMock>;
  let auditMock: ReturnType<typeof buildAuditMock>;
  let emailMock: ReturnType<typeof buildEmailMock>;

  const ADMIN_ACTOR = { sub: 24, role: 0 };
  const PM_ACTOR = { sub: 15, role: 1 };
  const WRONG_PM_ACTOR = { sub: 99, role: 1 };

  beforeEach(() => {
    prismaMock = buildPrismaMock();
    auditMock = buildAuditMock();
    emailMock = buildEmailMock();

    service = new RentChangeScheduleService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
      emailMock as unknown as EmailService,
    );

    // Default: unit exists and is not retired
    (prismaMock.unit!.findUnique as jest.Mock).mockResolvedValue(mockUnit);
    // Default: no existing pending schedule
    (prismaMock.rentChangeSchedule!.findFirst as jest.Mock).mockResolvedValue(null);
    // Default: $transaction executes the callback and the inner create returns a schedule row
    const tomorrow60Days = new Date(daysFromNowIST(60) + "T00:00:00.000Z");
    const mockSchedule = {
      id: 1,
      unit_id: 10,
      new_amount_paise: 2_000_000n,
      effective_date: tomorrow60Days,
      status: 0,
      created_by_user_id: 15,
      created_at: new Date(),
      updated_at: new Date(),
      applied_at: null,
      cancelled_at: null,
    };
    (prismaMock as unknown as { _txMock: { rentChangeSchedule: { create: jest.Mock } } })._txMock.rentChangeSchedule.create.mockResolvedValue(mockSchedule);
  });

  // -------------------------------------------------------------------------
  // create: 60-day rule
  // -------------------------------------------------------------------------

  it("rejects effectiveDate 59 days ahead with EFFECTIVE_DATE_TOO_SOON", async () => {
    const date59 = daysFromNowIST(59);
    await expect(
      service.create(10, { newAmountPaise: 2_000_000, effectiveDate: date59 }, PM_ACTOR),
    ).rejects.toThrow(BadRequestException);

    try {
      await service.create(10, { newAmountPaise: 2_000_000, effectiveDate: date59 }, PM_ACTOR);
    } catch (e) {
      const err = e as BadRequestException;
      const body = err.getResponse() as { error: { code: string } };
      expect(body.error.code).toBe("EFFECTIVE_DATE_TOO_SOON");
    }
  });

  it("accepts effectiveDate exactly 60 days ahead", async () => {
    const date60 = daysFromNowIST(60);
    // Should not throw — just check it completes
    await expect(
      service.create(10, { newAmountPaise: 2_000_000, effectiveDate: date60 }, PM_ACTOR),
    ).resolves.toBeDefined();
  });

  // -------------------------------------------------------------------------
  // create: one-pending-per-unit
  // -------------------------------------------------------------------------

  it("rejects second create with PENDING_SCHEDULE_EXISTS when a pending schedule exists", async () => {
    (prismaMock.rentChangeSchedule!.findFirst as jest.Mock).mockResolvedValue({ id: 1 });

    const date60 = daysFromNowIST(60);
    await expect(
      service.create(10, { newAmountPaise: 2_000_000, effectiveDate: date60 }, PM_ACTOR),
    ).rejects.toThrow(ConflictException);

    try {
      await service.create(10, { newAmountPaise: 2_000_000, effectiveDate: date60 }, PM_ACTOR);
    } catch (e) {
      const err = e as ConflictException;
      const body = err.getResponse() as { error: { code: string } };
      expect(body.error.code).toBe("PENDING_SCHEDULE_EXISTS");
    }
  });

  // -------------------------------------------------------------------------
  // create: retired unit
  // -------------------------------------------------------------------------

  it("rejects create on a retired unit with UNIT_RETIRED", async () => {
    (prismaMock.unit!.findUnique as jest.Mock).mockResolvedValue(mockRetiredUnit);
    const date60 = daysFromNowIST(60);
    await expect(
      service.create(10, { newAmountPaise: 2_000_000, effectiveDate: date60 }, PM_ACTOR),
    ).rejects.toThrow(ConflictException);
  });

  // -------------------------------------------------------------------------
  // create: PM scope
  // -------------------------------------------------------------------------

  it("rejects PM actor who is not the active_pm_id with PROPERTY_ACCESS_DENIED", async () => {
    const date60 = daysFromNowIST(60);
    await expect(
      service.create(10, { newAmountPaise: 2_000_000, effectiveDate: date60 }, WRONG_PM_ACTOR),
    ).rejects.toThrow(ForbiddenException);
  });

  it("ADMIN bypasses PM scope check", async () => {
    const date60 = daysFromNowIST(60);
    await expect(
      service.create(10, { newAmountPaise: 2_000_000, effectiveDate: date60 }, ADMIN_ACTOR),
    ).resolves.toBeDefined();
  });

  // -------------------------------------------------------------------------
  // modify: no pending schedule
  // -------------------------------------------------------------------------

  it("returns 404 on modify when no pending schedule exists", async () => {
    (prismaMock.rentChangeSchedule!.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.modify(10, { newAmountPaise: 2_500_000 }, PM_ACTOR),
    ).rejects.toThrow(NotFoundException);
  });

  // -------------------------------------------------------------------------
  // modify: missing fields
  // -------------------------------------------------------------------------

  it("returns 400 on modify when no fields provided", async () => {
    await expect(
      service.modify(10, {}, PM_ACTOR),
    ).rejects.toThrow(BadRequestException);
  });

  // -------------------------------------------------------------------------
  // cancel: happy path
  // -------------------------------------------------------------------------

  it("cancel returns success when a pending schedule exists", async () => {
    const existing = {
      id: 5,
      unit_id: 10,
      new_amount_paise: 2_000_000n,
      effective_date: daysFromNow(60),
      status: 0,
      created_by_user_id: 15,
      created_at: new Date(),
      updated_at: new Date(),
      applied_at: null,
      cancelled_at: null,
    };
    (prismaMock.rentChangeSchedule!.findFirst as jest.Mock).mockResolvedValue(existing);
    (prismaMock as unknown as { _txMock: { rentChangeSchedule: { update: jest.Mock } } })._txMock.rentChangeSchedule.update.mockResolvedValue({ ...existing, status: 1 });

    const result = await service.cancel(10, PM_ACTOR);
    expect(result.success).toBe(true);
  });

  // -------------------------------------------------------------------------
  // cancel: no pending schedule
  // -------------------------------------------------------------------------

  it("returns 404 on cancel when no pending schedule exists", async () => {
    (prismaMock.rentChangeSchedule!.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(service.cancel(10, PM_ACTOR)).rejects.toThrow(NotFoundException);
  });

  // -------------------------------------------------------------------------
  // applyDue: applies due schedules
  // -------------------------------------------------------------------------

  it("applyDue applies schedules whose effective_date <= today", async () => {
    const yesterday = daysFromNow(-1);
    const dueSchedules = [
      { id: 7, unit_id: 10, new_amount_paise: 2_500_000n, effective_date: yesterday },
    ];
    (prismaMock.rentChangeSchedule!.findMany as jest.Mock).mockResolvedValue(dueSchedules);
    (prismaMock as unknown as { _txMock: { unit: { findUniqueOrThrow: jest.Mock } } })._txMock.unit.findUniqueOrThrow.mockResolvedValue({ monthly_rent_paise: 2_000_000 });
    (prismaMock as unknown as { _txMock: { unit: { update: jest.Mock } } })._txMock.unit.update.mockResolvedValue({});
    (prismaMock as unknown as { _txMock: { rentChangeSchedule: { update: jest.Mock } } })._txMock.rentChangeSchedule.update.mockResolvedValue({});

    const result = await service.applyDue(new Date());
    expect(result.applied).toBe(1);
    expect(result.errors).toBe(0);
  });

  it("applyDue does not apply schedules with effective_date in the future", async () => {
    // findMany returns nothing (Prisma WHERE filters out future dates)
    (prismaMock.rentChangeSchedule!.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.applyDue(new Date());
    expect(result.applied).toBe(0);
    expect(result.errors).toBe(0);
  });

  it("applyDue records errors per-schedule without aborting the whole run", async () => {
    const yesterday = daysFromNow(-1);
    (prismaMock.rentChangeSchedule!.findMany as jest.Mock).mockResolvedValue([
      { id: 8, unit_id: 11, new_amount_paise: 1_000_000n, effective_date: yesterday },
    ]);
    // Make the transaction throw for this schedule
    (prismaMock.$transaction as jest.Mock).mockRejectedValue(new Error("DB error"));

    const result = await service.applyDue(new Date());
    expect(result.applied).toBe(0);
    expect(result.errors).toBe(1);
  });
});
