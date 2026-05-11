import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { PropertiesService } from "./properties.service";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";
import { TransferPmDto } from "./dto/transfer-pm.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/jwt.service";

/**
 * Properties controller — Admin-only CRUD + PM transfer.
 * All endpoints require ADMIN role (BL-19, BL-20).
 *
 * Endpoints:
 *   GET    /properties               — paginated list
 *   POST   /properties               — create
 *   GET    /properties/:id           — single
 *   PATCH  /properties/:id           — update metadata
 *   DELETE /properties/:id           — soft-delete (sets deleted_at)
 *   POST   /properties/:id/transfer-pm — BL-19 / BL-20 PM transfer
 */
@Controller("properties")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  /**
   * GET /properties?cursor=&limit=20
   * ADMIN: sees all properties.
   * PROPERTY_MANAGER: sees only the property they are assigned to (BL-19/BL-20).
   */
  @Get()
  @Roles("ADMIN", "PROPERTY_MANAGER")
  async list(
    @CurrentUser() actor: JwtPayload,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.propertiesService.list(cursor, limit ? parseInt(limit, 10) : 20, actor);
  }

  /** POST /properties */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreatePropertyDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.propertiesService.create(dto, actor.sub);
  }

  /** GET /properties/:id */
  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.propertiesService.findById(id);
  }

  /** PATCH /properties/:id — update name/address/etc. NOT active_pm_id. */
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdatePropertyDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.propertiesService.update(id, dto, actor.sub);
  }

  /**
   * DELETE /properties/:id — soft-delete (sets deleted_at).
   * Properties with an active PM assignment cannot be deleted.
   */
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async softDelete(
    @Param("id") id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.propertiesService.softDelete(id, actor.sub);
  }

  /**
   * POST /properties/:id/transfer-pm
   * BL-19: validates toPmId is not assigned elsewhere.
   * BL-20: logs transfer; previous PM gets read_only_audit flag (enforced at scope-guard layer).
   */
  @Post(":id/transfer-pm")
  @HttpCode(HttpStatus.OK)
  async transferPm(
    @Param("id") id: string,
    @Body() dto: TransferPmDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.propertiesService.transferPm(id, dto, actor.sub);
  }
}
