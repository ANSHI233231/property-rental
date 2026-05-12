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

/**
 * Tenants controller.
 *
 * Endpoints:
 *   GET    /properties/:propertyId/tenants?cursor=&limit=20 — list tenants on active leases
 *   GET    /tenants/:id                                      — single tenant
 *   PATCH  /tenants/:id                                      — update personal info
 */
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
    @Param("propertyId", ParseIntPipe) propertyId: number,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.tenantsService.listByProperty(
      propertyId,
      cursor ? parseInt(cursor, 10) : undefined,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  // ---------------------------------------------------------------------------
  // GET /tenants/:id
  // ---------------------------------------------------------------------------

  @Get("tenants/:id")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @PropertyScope("tenant")
  @HttpCode(HttpStatus.OK)
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.tenantsService.findById(id);
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
    return this.tenantsService.update(id, dto, actor.sub);
  }
}
