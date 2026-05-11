import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HealthService } from "./health.service";
import { PrismaService } from "../prisma/prisma.service";

describe("HealthService", () => {
  let service: HealthService;

  const prismaMock: Partial<PrismaService> = {
    $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) as unknown as PrismaService["$queryRaw"],
  };

  // ConfigService mock: Redis on a port that is closed → health returns redis: 'down'
  // in unit tests (no real Redis). We accept either 'ok' or 'down' for redis in unit tests.
  const configMock: Partial<ConfigService> = {
    get: jest.fn((key: string) => {
      if (key === "REDIS_HOST") return "localhost";
      if (key === "REDIS_PORT") return "6380";
      return undefined;
    }) as ConfigService["get"],
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();
    service = moduleRef.get(HealthService);
  });

  it("returns db=ok when DB query succeeds", async () => {
    const res = await service.check();
    expect(res.db).toBe("ok");
    expect(res.app).toBe("GharSetu");
    expect(typeof res.timestamp).toBe("string");
    // redis may be 'ok' or 'down' in unit tests depending on local Redis availability
    expect(["ok", "down"]).toContain(res.redis);
  });

  it("returns status=degraded and db=down when DB query throws", async () => {
    (prismaMock.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error("conn refused"));
    const res = await service.check();
    expect(res.status).toBe("degraded");
    expect(res.db).toBe("down");
  });
});
