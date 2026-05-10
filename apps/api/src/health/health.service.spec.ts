import { Test } from "@nestjs/testing";
import { HealthService } from "./health.service";
import { PrismaService } from "../prisma/prisma.service";

describe("HealthService", () => {
  let service: HealthService;

  const prismaMock: Partial<PrismaService> = {
    $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) as unknown as PrismaService["$queryRaw"],
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = moduleRef.get(HealthService);
  });

  it("returns status=ok when DB query succeeds", async () => {
    const res = await service.check();
    expect(res.status).toBe("ok");
    expect(res.db).toBe("ok");
    expect(res.redis).toBe("skipped");
    expect(res.app).toBe("GharSetu");
    expect(typeof res.timestamp).toBe("string");
  });

  it("returns status=degraded when DB query throws", async () => {
    (prismaMock.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error("conn refused"));
    const res = await service.check();
    expect(res.status).toBe("degraded");
    expect(res.db).toBe("down");
  });
});
