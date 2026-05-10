import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService as NestJwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

export interface JwtPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AccessTokenResult {
  accessToken: string;
}

/**
 * JwtService — thin wrapper around @nestjs/jwt for access-token operations.
 * Refresh tokens are opaque (not JWT); only access tokens are JWTs.
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
  signAccessToken(payload: { sub: string; role: string }): string {
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
