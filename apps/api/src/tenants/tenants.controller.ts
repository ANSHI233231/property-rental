import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from "@nestjs/common";
import { TenantsService } from "./tenants.service";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PropertyScopeGuard } from "../auth/guards/property-scope.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { PropertyScope } from "../auth/decorators/property-scope.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/jwt.service";
import { RoleEnum } from "@gharsetu/shared";

/**
 * Tenants controller.
 *
 * Endpoints:
 *   GET    /properties/:propertyId/tenants?cursor=&limit=20 — list tenants on active leases
 *   GET    /tenants/:id                                      — single tenant
 *   PATCH  /tenants/:id                                      — update personal info
 *
 * PII redaction: when the caller is PROPERTY_MANAGER, the nested `user.email`
 * and `user.phone` fields are stripped from the response. ADMIN sees the full
 * record; tenants reading their own data go through /users/me (not these routes).
 */

/** Strip user.email + user.phone for PM callers; leave other roles untouched. */
function redactTenantPiiForPm<T extends { user?: unknown } | null | undefined>(
  tenant: T,
  actor: JwtPayload,
): T {
  if (actor.role !== RoleEnum.PROPERTY_MANAGER) return tenant;
  if (!tenant || typeof tenant !== "object" || !("user" in tenant) || !tenant.user) return tenant;
  const user = tenant.user as Record<string, unknown>;
  const { email: _e, phone: _p, ...rest } = user;
  void _e;
  void _p;
  return { ...tenant, user: rest };
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, PropertyScopeGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // ---------------------------------------------------------------------------
  // GET /properties/:propertyId/tenants
  // ---------------------------------------------------------------------------

  @Get("properties/:propertyId/tenants")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @PropertyScope("property")
  @HttpCode(HttpStatus.OK)
  async listByProperty(
    @CurrentUser() actor: JwtPayload,
    @Param("propertyId", ParseIntPipe) propertyId: number,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const res = await this.tenantsService.listByProperty(
      propertyId,
      cursor ? parseInt(cursor, 10) : undefined,
      limit ? parseInt(limit, 10) : 20,
      page ? parseInt(page, 10) : undefined,
      pageSize ? parseInt(pageSize, 10) : undefined,
    );
    return { ...res, data: res.data.map((t) => redactTenantPiiForPm(t, actor)) };
  }

  // ---------------------------------------------------------------------------
  // GET /tenants/:id
  // ---------------------------------------------------------------------------

  @Get("tenants/:id")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @PropertyScope("tenant")
  @HttpCode(HttpStatus.OK)
  async findOne(
    @CurrentUser() actor: JwtPayload,
    @Param("id", ParseIntPipe) id: number,
  ) {
    const tenant = await this.tenantsService.findById(id);
    return redactTenantPiiForPm(tenant, actor);
  }

  // ---------------------------------------------------------------------------
  // PATCH /tenants/:id
  // ---------------------------------------------------------------------------

  @Patch("tenants/:id")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @PropertyScope("tenant")
  @HttpCode(HttpStatus.OK)
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateTenantDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    const updated = await this.tenantsService.update(id, dto, actor.sub);
    return redactTenantPiiForPm(updated, actor);
  }
}
