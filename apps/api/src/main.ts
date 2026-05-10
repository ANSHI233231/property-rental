import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
  });

  // Global API prefix per SRS §10 / API spec §3.
  app.setGlobalPrefix("api/v1");

  const config = app.get(ConfigService);
  const port = Number(config.get<string>("API_PORT") ?? 3001);
  const host = config.get<string>("API_HOST") ?? "0.0.0.0";

  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`[gharsetu-api] listening on http://${host}:${port}/api/v1`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[gharsetu-api] failed to bootstrap:", err);
  process.exit(1);
});
