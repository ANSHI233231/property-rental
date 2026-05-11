import { Injectable, Logger } from "@nestjs/common";
import { APP_NAME, SHARED_PACKAGE_VERSION } from "@gharsetu/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import * as net from "net";

export interface HealthResponse {
  status: "ok" | "degraded";
  app: string;
  sharedVersion: string;
  db: "ok" | "down";
  redis: "ok" | "down";
  timestamp: string;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** TCP-level ping: resolves if port is reachable within timeoutMs, rejects otherwise. */
  private tcpPing(host: string, port: number, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port }, () => {
        socket.destroy();
        resolve();
      });
      socket.setTimeout(timeoutMs);
      socket.on("timeout", () => { socket.destroy(); reject(new Error(`Redis TCP timeout on ${host}:${port}`)); });
      socket.on("error", (err) => { socket.destroy(); reject(err); });
    });
  }

  async check(): Promise<HealthResponse> {
    let db: "ok" | "down" = "ok";
    let redis: "ok" | "down" = "down";

    try {
      // Lightweight round-trip — no table required. Confirms the connection works.
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      db = "down";
      this.logger.error("DB health check failed", err as Error);
    }

    try {
      const host = this.config.get<string>("REDIS_HOST", "localhost");
      const port = this.config.get<number>("REDIS_PORT", 6380);
      await this.tcpPing(host, port, 2000);
      redis = "ok";
    } catch (err) {
      redis = "down";
      this.logger.warn("Redis health check failed", err as Error);
    }

    const status = db === "ok" && redis === "ok" ? "ok" : "degraded";

    return {
      status,
      app: APP_NAME,
      sharedVersion: SHARED_PACKAGE_VERSION,
      db,
      redis,
      timestamp: new Date().toISOString(),
    };
  }
}
