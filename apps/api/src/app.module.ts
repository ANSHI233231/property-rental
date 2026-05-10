import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Read .env from the apps/api directory; the monorepo root .env.example
      // is the documentation source. Each app maintains its own runtime .env.
      envFilePath: [".env"],
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
