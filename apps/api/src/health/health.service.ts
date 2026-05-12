import { Injectable, Logger } from "@nestjs/common";
import { APP_NAME, SHARED_PACKAGE_VERSION } from "@gharsetu/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface HealthResponse {
  status: "ok" | "degraded";
  app: string;
  sharedVersion: string;
  db: "ok" | "down";
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthResponse> {
    let db: "ok" | "down" = "ok";

    try {
      // Lightweight round-trip — no table required. Confirms the connection works.
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      db = "down";
      this.logger.error("DB health check failed", err as Error);
    }

    const status = db === "ok" ? "ok" : "degraded";

    return {
      status,
      app: APP_NAME,
      sharedVersion: SHARED_PACKAGE_VERSION,
      db,
      timestamp: new Date().toISOString(),
    };
  }
}
