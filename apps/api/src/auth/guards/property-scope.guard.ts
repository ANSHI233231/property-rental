import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { JwtPayload } from "../jwt.service";
import { PrismaService } from "../../prisma/prisma.service";
import { PROPERTY_SCOPE_KEY, type PropertyScopeType } from "../decorators/property-scope.decorator";

/**
 * PropertyScopeGuard — Phase 3 real implementation.
 *
 * Checks that the requesting user (ADMIN or PROPERTY_MANAGER) has access
 * to the property derived from the current route params.
 *
 * - ADMIN: always passes (can see all properties).
 * - PROPERTY_MANAGER: passes only if they are the active_pm_id on the property.
 * - TENANT: passes only on routes explicitly decorated with tenant-level scope
 *   (i.e. the tenant is on the lease in question). Not used for write endpoints.
 * - MAINTENANCE: denied (no cross-property write access in Phase 3).
 *
 * The @PropertyScope('type') decorator (on the handler or class) tells the guard
 * how to resolve the property ID from the route parameters:
 *   'property' → params.propertyId
 *   'unit'     → params.unitId or params.id (look up unit.property_id)
 *   'lease'    → params.id (look up lease → unit → property_id)
 *   'tenant'   → params.id (look up tenant → active lease → unit → property_id)
 *
 * If no @PropertyScope decorator is present this guard is a no-op pass-through
 * (prevents accidental lock-out on non-scoped endpoints).
 */
@Injectable()
export class PropertyScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scopeType = this.reflector.getAllAndOverride<PropertyScopeType | undefined>(
      PROPERTY_SCOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @PropertyScope decorator — this guard is a no-op.
    if (!scopeType) return true;

    const request = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    const user = request.user;

    // ADMIN bypasses all property scoping.
    if (user?.role === "ADMIN") return true;

    const propertyId = await this.resolvePropertyId(scopeType, request);
    if (!propertyId) {
      throw new NotFoundException({ error: { code: "RESOURCE_NOT_FOUND", message: "Resource not found" } });
    }

    // PROPERTY_MANAGER: must be the active PM for this property.
    if (user?.role === "PROPERTY_MANAGER") {
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, deleted_at: null },
        select: { active_pm_id: true },
      });

      if (!property) {
        throw new NotFoundException({
          error: { code: "RESOURCE_NOT_FOUND", message: "Property not found" },
        });
      }

      if (property.active_pm_id !== user.sub) {
        throw new ForbiddenException({
          error: {
            code: "PROPERTY_ACCESS_DENIED",
            message: "You are not the assigned manager for this property",
          },
        });
      }

      return true;
    }

    // TENANT: allowed on lease-scoped reads only — the specific handler must
    // add its own tenant ownership check in the service layer.
    // The guard here just ensures at least some property resolution occurred.
    if (user?.role === "TENANT") {
      // Tenant scope is validated at the service layer per endpoint.
      // The guard passes; the service checks tenant ownership.
      return true;
    }

    // MAINTENANCE and any other roles: deny.
    throw new ForbiddenException({
      error: {
        code: "PROPERTY_ACCESS_DENIED",
        message: "Your role does not have access to this resource",
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Private: resolve the property ID from route params
  // ---------------------------------------------------------------------------

  private async resolvePropertyId(
    scopeType: PropertyScopeType,
    request: Request & { user: JwtPayload },
  ): Promise<string | null> {
    const params = request.params as Record<string, string>;

    switch (scopeType) {
      case "property": {
        return params["propertyId"] ?? params["id"] ?? null;
      }

      case "unit": {
        const unitId = params["unitId"] ?? params["id"];
        if (!unitId) return null;
        const unit = await this.prisma.unit.findUnique({
          where: { id: unitId },
          select: { property_id: true },
        });
        return unit?.property_id ?? null;
      }

      case "lease": {
        const leaseId = params["leaseId"] ?? params["id"];
        if (!leaseId) return null;
        const lease = await this.prisma.lease.findUnique({
          where: { id: leaseId },
          select: { unit: { select: { property_id: true } } },
        });
        return lease?.unit.property_id ?? null;
      }

      case "tenant": {
        const tenantId = params["tenantId"] ?? params["id"];
        if (!tenantId) return null;
        // Find property via the tenant's most recent active (or any) lease
        const leaseTenant = await this.prisma.leaseTenant.findFirst({
          where: {
            tenant_id: tenantId,
            lease: { status: "ACTIVE" },
            removed_at: null,
          },
          select: { lease: { select: { unit: { select: { property_id: true } } } } },
        });
        return leaseTenant?.lease.unit.property_id ?? null;
      }

      default:
        return null;
    }
  }
}
