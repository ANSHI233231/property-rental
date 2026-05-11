import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { json } from "express";
import helmet from "helmet";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require("cookie-parser") as typeof import("cookie-parser");
import { AppModule } from "./app.module";
import { Logger } from "nestjs-pino";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Structured pino logger with PII redaction.
  app.useLogger(app.get(Logger));

  // Global API prefix per SRS §10 / API spec §3.
  app.setGlobalPrefix("api/v1");

  // Security headers via helmet (Phase 7 — W-01).
  // The API serves only JSON so CSP is maximally restrictive.
  // Helmet defaults also add: HSTS, X-DNS-Prefetch-Control, X-Download-Options,
  // X-Permitted-Cross-Domain-Policies, and removes X-Powered-By.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'none'"],
          "frame-ancestors": ["'none'"],
        },
      },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );

  // Cookie parsing required for refresh-token cookie.
  app.use(cookieParser());

  // Phase 7: hard body size cap — 100 KB.
  // Prevents memory-exhaustion via oversized JSON payloads.
  app.use(json({ limit: "100kb" }));

  const config = app.get(ConfigService);
  const port = Number(config.get<string>("API_PORT") ?? 3001);
  const host = config.get<string>("API_HOST") ?? "0.0.0.0";

  // Phase 7: multi-origin CORS allowlist.
  // WEB_ORIGINS takes a comma-separated list; falls back to single WEB_ORIGIN for compat.
  const rawOrigins =
    config.get<string>("WEB_ORIGINS") ?? config.get<string>("WEB_ORIGIN") ?? "http://localhost:3000";
  const allowedOrigins = rawOrigins
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server / curl / health checks)
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not in allowlist`));
      }
    },
    credentials: true,
  });

  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`[gharsetu-api] listening on http://${host}:${port}/api/v1`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[gharsetu-api] failed to bootstrap:", err);
  process.exit(1);
});
