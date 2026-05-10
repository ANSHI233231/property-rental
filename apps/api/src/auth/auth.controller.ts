import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

/** Refresh token cookie name. */
const REFRESH_COOKIE = "refreshToken";

/** Cookie options — HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth */
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/api/v1/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ---------------------------------------------------------------------------
  // POST /auth/login
  // Rate-limited: 100/min per IP (global throttler — see AuthModule)
  // ---------------------------------------------------------------------------

  @Post("login")
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: object }> {
    const meta = {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    };

    const { accessToken, refreshToken, user } = await this.authService.login(dto, meta);

    res.cookie(REFRESH_COOKIE, refreshToken, COOKIE_OPTIONS);

    return { accessToken, user };
  }

  // ---------------------------------------------------------------------------
  // POST /auth/refresh
  // ---------------------------------------------------------------------------

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const rawToken = (req.cookies as Record<string, string>)[REFRESH_COOKIE];

    if (!rawToken) {
      res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
      throw new (await import("@nestjs/common")).UnauthorizedException("No refresh token");
    }

    const meta = {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    };

    const { accessToken, refreshToken: newRefresh } = await this.authService.refresh(
      rawToken,
      meta,
    );

    res.cookie(REFRESH_COOKIE, newRefresh, COOKIE_OPTIONS);

    return { accessToken };
  }

  // ---------------------------------------------------------------------------
  // POST /auth/logout
  // ---------------------------------------------------------------------------

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const rawToken = (req.cookies as Record<string, string>)[REFRESH_COOKIE];

    if (rawToken) {
      await this.authService.logout(rawToken);
    }

    res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });

    return { message: "Logged out successfully" };
  }

  // ---------------------------------------------------------------------------
  // POST /auth/forgot-password
  // Rate-limited: 100/min per IP
  // ---------------------------------------------------------------------------

  @Post("forgot-password")
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    // Always returns the same message regardless of whether account exists (TC-AUTH-015)
    await this.authService.forgotPassword(dto.email);

    return { message: "If an account exists, a reset link has been sent." };
  }

  // ---------------------------------------------------------------------------
  // POST /auth/reset-password
  // ---------------------------------------------------------------------------

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    await this.authService.resetPassword(dto);
    return { message: "Password reset successfully. Please log in with your new password." };
  }
}
