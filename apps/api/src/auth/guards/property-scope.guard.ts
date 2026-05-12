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
import { PROPERTY_SCOPE_BODY_KEY, type PropertyScopeBodyField } from "../decorators/property-scope-body.decorator";

/** Role int codes matching the DB smallint values */
const ROLE = { ADMIN: 0, PROPERTY_MANAGER: 1, MAINTENANCE: 2, TENANT: 3 } as const;

/** Lease status int code for ACTIVE */
const LEASE_ACTIVE = 0;

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

    const bodyScopeField = this.reflector.getAllAndOverride<PropertyScopeBodyField | undefined>(
      PROPERTY_SCOPE_BODY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No scope decorator of any kind — this guard is a no-op.
    if (!scopeType && !bodyScopeField) return true;

    const request = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    const user = request.user;

    // ADMIN bypasses all property scoping (role code 0).
    if (user?.role === ROLE.ADMIN) return true;

    // Resolve property ID from params or body depending on which decorator was used.
    const propertyId = bodyScopeField
      ? await this.resolvePropertyIdFromBody(bodyScopeField, request)
      : await this.resolvePropertyId(scopeType!, request);

    if (propertyId === null) {
      throw new NotFoundException({ error: { code: "RESOURCE_NOT_FOUND", message: "Resource not found" } });
    }

    // PROPERTY_MANAGER: must be the active PM for this property (role code 1).
    if (user?.role === ROLE.PROPERTY_MANAGER) {
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

    // TENANT: ownership is enforced at the service layer (H-01 fix).
    // The guard passes so the service can perform the check with full context.
    if (user?.role === ROLE.TENANT) {
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
  // Private: resolve the property ID from route params (returns number | null)
  // ---------------------------------------------------------------------------

  private async resolvePropertyId(
    scopeType: PropertyScopeType,
    request: Request & { user: JwtPayload },
  ): Promise<number | null> {
    const params = request.params as Record<string, string>;

    switch (scopeType) {
      case "property": {
        const raw = params["propertyId"] ?? params["id"];
        return raw ? parseInt(raw, 10) : null;
      }

      case "unit": {
        const raw = params["unitId"] ?? params["id"];
        if (!raw) return null;
        const unitId = parseInt(raw, 10);
        const unit = await this.prisma.unit.findUnique({
          where: { id: unitId },
          select: { property_id: true },
        });
        return unit?.property_id ?? null;
      }

      case "lease": {
        const raw = params["leaseId"] ?? params["id"];
        if (!raw) return null;
        const leaseId = parseInt(raw, 10);
        const lease = await this.prisma.lease.findUnique({
          where: { id: leaseId },
          select: { unit_id: true },
        });
        if (!lease) return null;
        const unit = await this.prisma.unit.findUnique({
          where: { id: lease.unit_id },
          select: { property_id: true },
        });
        return unit?.property_id ?? null;
      }

      case "tenant": {
        const raw = params["tenantId"] ?? params["id"];
        if (!raw) return null;
        const tenantId = parseInt(raw, 10);
        // Find property via the tenant's most recent active (or any) lease
        const leaseTenant = await this.prisma.leaseTenant.findFirst({
          where: {
            tenant_id: tenantId,
            lease: { status: LEASE_ACTIVE },
            removed_at: null,
          },
          select: { lease_id: true },
        });
        if (!leaseTenant) return null;
        const lease = await this.prisma.lease.findUnique({
          where: { id: leaseTenant.lease_id },
          select: { unit_id: true },
        });
        if (!lease) return null;
        const unit = await this.prisma.unit.findUnique({
          where: { id: lease.unit_id },
          select: { property_id: true },
        });
        return unit?.property_id ?? null;
      }

      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: resolve property ID from request body (H-02 — deposit-refunds)
  // ---------------------------------------------------------------------------

  private async resolvePropertyIdFromBody(
    bodyField: PropertyScopeBodyField,
    request: Request & { user: JwtPayload },
  ): Promise<number | null> {
    const body = request.body as Record<string, unknown>;

    if (bodyField === "leaseId") {
      const rawLeaseId = body["leaseId"];
      if (!rawLeaseId) return null;
      const leaseId = typeof rawLeaseId === "number" ? rawLeaseId : parseInt(String(rawLeaseId), 10);
      if (isNaN(leaseId)) return null;
      const lease = await this.prisma.lease.findUnique({
        where: { id: leaseId },
        select: { unit_id: true },
      });
      if (!lease) return null;
      const unit = await this.prisma.unit.findUnique({
        where: { id: lease.unit_id },
        select: { property_id: true },
      });
      return unit?.property_id ?? null;
    }

    return null;
  }
}
