import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * UserThrottlerGuard — rate-limits by authenticated user ID (from JWT payload)
 * instead of by IP address.
 *
 * Used on POST /users/me/change-password so that one user cannot hammer the
 * endpoint faster than 5/min regardless of IP rotation. Phase 7 — W-03.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    req: Record<string, unknown>,
  ): Promise<string> {
    // The JwtAuthGuard runs before this guard and attaches `req.user` with the
    // JWT payload (containing `sub` = userId). Fall back to IP if not available.
    const user = req["user"] as { sub?: string } | undefined;
    const ip = req["ip"] as string | undefined;
    return user?.sub ?? ip ?? "unknown";
  }
}
