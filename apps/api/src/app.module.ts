import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_PIPE } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";

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
    AuthModule,
    UsersModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,        // strip unknown fields
        forbidNonWhitelisted: false,
        transform: true,        // auto-transform (e.g., @Transform on DTOs)
        transformOptions: { enableImplicitConversion: false },
      }),
    },
  ],
})
export class AppModule {}
