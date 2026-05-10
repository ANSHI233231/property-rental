import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require("cookie-parser") as typeof import("cookie-parser");
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
  });

  // Global API prefix per SRS §10 / API spec §3.
  app.setGlobalPrefix("api/v1");

  // Cookie parsing required for refresh-token cookie.
  app.use(cookieParser());

  const config = app.get(ConfigService);
  const port = Number(config.get<string>("API_PORT") ?? 3001);
  const host = config.get<string>("API_HOST") ?? "0.0.0.0";

  app.enableCors({
    origin: config.get<string>("WEB_ORIGIN") ?? "http://localhost:3000",
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
