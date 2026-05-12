import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService as NestJwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

export interface JwtPayload {
  sub: number;
  role: number;
  iat?: number;
  exp?: number;
}

export interface AccessTokenResult {
  accessToken: string;
}

/**
 * JwtService — thin wrapper around @nestjs/jwt for access-token operations.
 * Refresh tokens are opaque (not JWT); only access tokens are JWTs.
 *
 * After the int-ID + smallint-enum refactor:
 *   sub = user.id (Int, e.g. 24)
 *   role = user.role code (Int, e.g. 0=ADMIN 1=PROPERTY_MANAGER 2=MAINTENANCE 3=TENANT)
 */
@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Sign a short-lived access token (15 min by default).
   */
  signAccessToken(payload: { sub: number; role: number }): string {
    return this.jwtService.sign(payload);
  }

  /**
   * Verify an access token and return the payload, or throw UnauthorizedException.
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException("Invalid or expired access token");
    }
  }
}
