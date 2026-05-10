import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { JwtTokenService } from "../jwt.service";

/**
 * JwtAuthGuard — validates Bearer access token from Authorization header.
 * Sets request.user = JwtPayload on success.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtTokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user: unknown }>();
    const authHeader = request.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or malformed Authorization header");
    }

    const token = authHeader.slice(7);
    // verifyAccessToken throws UnauthorizedException on failure
    const payload = this.jwtService.verifyAccessToken(token);
    request.user = payload;
    return true;
  }
}
