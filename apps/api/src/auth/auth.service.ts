import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { HashingService } from "./hashing.service";
import { JwtTokenService } from "./jwt.service";
import type { LoginDto } from "./dto/login.dto";
import type { ResetPasswordDto } from "./dto/reset-password.dto";

/** Number of failed login attempts before lockout. */
const MAX_FAILED_ATTEMPTS = 5;
/** Lockout duration in minutes. */
const LOCKOUT_MINUTES = 15;
/** Reset token TTL in minutes (SRS: single-use, 30-min). */
const RESET_TOKEN_TTL_MINUTES = 30;
/** Refresh token TTL in days. */
const REFRESH_TOKEN_TTL_DAYS = 7;
/** Refresh token byte length (opaque). */
const REFRESH_TOKEN_BYTES = 32;

/**
 * sha256 of a raw opaque token — used for safe storage.
 * Never store plaintext tokens in the DB.
 */
function sha256hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Generate a cryptographically random opaque token (hex string).
 */
function generateOpaqueToken(bytes = REFRESH_TOKEN_BYTES): string {
  return randomBytes(bytes).toString("hex");
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly jwtService: JwtTokenService,
    private readonly configService: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // Login
  // ---------------------------------------------------------------------------

  async login(
    dto: LoginDto,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ accessToken: string; refreshToken: string; user: object }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Generic error for any auth failure (anti-enumeration)
    const invalidCreds = new UnauthorizedException("Invalid credentials");

    if (!user || !user.is_active) {
      throw invalidCreds;
    }

    // Check account lockout
    if (user.locked_until && user.locked_until > new Date()) {
      throw new UnauthorizedException("Account temporarily locked. Try again later.");
    }

    const passwordOk = await this.hashing.verifyPassword(dto.password, user.password_hash);

    if (!passwordOk) {
      const newCount = user.failed_login_count + 1;
      const shouldLock = newCount >= MAX_FAILED_ATTEMPTS;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failed_login_count: newCount,
          locked_until: shouldLock
            ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
            : undefined,
        },
      });

      throw invalidCreds;
    }

    // Reset failed count on successful login
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failed_login_count: 0,
        locked_until: null,
      },
    });

    const { accessToken, refreshToken } = await this.issueTokens(user.id, user.role, meta);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Refresh
  // ---------------------------------------------------------------------------

  async refresh(
    rawToken: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenHash = sha256hex(rawToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revoked_at || stored.expires_at < new Date()) {
      throw new UnauthorizedException("Refresh token invalid or expired");
    }

    if (!stored.user.is_active) {
      throw new UnauthorizedException("Account is not active");
    }

    // Revoke the old token (rotation)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked_at: new Date() },
    });

    const { accessToken, refreshToken } = await this.issueTokens(
      stored.user.id,
      stored.user.role,
      meta,
    );

    return { accessToken, refreshToken };
  }

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------

  async logout(rawToken: string): Promise<void> {
    const tokenHash = sha256hex(rawToken);

    await this.prisma.refreshToken.updateMany({
      where: { token_hash: tokenHash, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  // ---------------------------------------------------------------------------
  // Forgot password
  // ---------------------------------------------------------------------------

  /**
   * Always returns success to prevent account enumeration (BL-anti-enum / TC-AUTH-015).
   * Logs the reset URL to console — SMTP wiring is out of scope for Phase 1.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.is_active) {
      // Anti-enumeration: do NOT throw. Just return.
      return;
    }

    // Invalidate any existing unused tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: { user_id: user.id, used_at: null },
      data: { used_at: new Date() }, // mark as used to invalidate
    });

    const rawToken = generateOpaqueToken(32);
    const tokenHash = sha256hex(rawToken);

    await this.prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
      },
    });

    // TODO (Phase 7): wire SMTP. For now, log to console (dev only).
    const resetUrl = `/reset-password/${rawToken}`;
    this.logger.log(`[DEV] Password reset URL for ${email}: ${resetUrl}`);
  }

  // ---------------------------------------------------------------------------
  // Reset password
  // ---------------------------------------------------------------------------

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = sha256hex(dto.token);

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { token_hash: tokenHash },
      include: { user: true },
    });

    if (!record) {
      throw new BadRequestException("Reset link is invalid or has expired");
    }

    if (record.used_at || record.expires_at < new Date()) {
      throw new BadRequestException("Reset link is invalid or has expired");
    }

    const newHash = await this.hashing.hashPassword(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      // Mark token as used
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { used_at: new Date() },
      });

      // Set new password
      await tx.user.update({
        where: { id: record.user_id },
        data: {
          password_hash: newHash,
          failed_login_count: 0,
          locked_until: null,
        },
      });

      // Revoke ALL refresh tokens for this user (force re-login)
      await tx.refreshToken.updateMany({
        where: { user_id: record.user_id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async issueTokens(
    userId: string,
    role: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.jwtService.signAccessToken({ sub: userId, role });

    const rawRefresh = generateOpaqueToken();
    const refreshHash = sha256hex(rawRefresh);

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: refreshHash,
        expires_at: expiresAt,
        user_agent: meta.userAgent ?? null,
        ip: meta.ip ?? null,
      },
    });

    return { accessToken, refreshToken: rawRefresh };
  }

  /**
   * Expose sha256hex for use in controller (cookie extraction).
   */
  static sha256hex(value: string): string {
    return sha256hex(value);
  }
}
