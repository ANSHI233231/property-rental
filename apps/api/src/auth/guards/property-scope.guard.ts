import { Injectable, CanActivate } from "@nestjs/common";

/**
 * PropertyScopeGuard — STUB for Phase 1.
 *
 * Phase 3 will implement real scope checks: PROPERTY_MANAGER requests
 * are limited to resources belonging to their assigned property.
 * TENANT requests are limited to their own lease/unit.
 *
 * TODO (Phase 3): inject PrismaService, read the user from request.user,
 * extract the resource ID from request.params, and assert ownership.
 */
@Injectable()
export class PropertyScopeGuard implements CanActivate {
  canActivate(): boolean {
    // Stub: always passes. Real logic lands in Phase 3.
    return true;
  }
}
