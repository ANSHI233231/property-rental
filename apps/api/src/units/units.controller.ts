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
  ParseIntPipe,
} from "@nestjs/common";
import { UnitsService } from "./units.service";
import { CreateUnitDto } from "./dto/create-unit.dto";
import { UpdateUnitDto } from "./dto/update-unit.dto";
import { UnitStateChangeDto } from "./dto/unit-state-change.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/jwt.service";

/**
 * Units controller — Phase 2 (Admin-only).
 * Phase 3 will add PROPERTY_MANAGER scope via PropertyScopeGuard.
 *
 * Note on route layout:
 *   - POST/GET list: /properties/:propertyId/units  (nested under properties)
 *   - GET/PATCH/etc: /units/:id                     (flat, by ID)
 *   The nested route is in PropertiesController via a separate nested controller
 *   import, but for simplicity in Phase 2 we handle both in one controller
 *   mounted at different prefixes via two controllers:
 *     - UnitsController: /units/*
 *     - PropertyUnitsController: /properties/:propertyId/units
 */

/**
 * Handles /units/:id CRUD and sub-routes.
 * Admin-only in Phase 2.
 */
@Controller("units")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  /**
   * GET /units — flat list, Admin-only. Used by the admin dashboard.
   * Supports cursor + limit + status (UnitState) query params.
   */
  @Get()
  async listAll(
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("status") status?: string,
  ) {
    return this.unitsService.listAll({
      cursor: cursor ? parseInt(cursor, 10) : undefined,
      limit: limit ? Math.min(parseInt(limit, 10), 200) : 20,
      status,
    });
  }

  /** GET /units/:id */
  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.unitsService.findById(id);
  }

  /**
   * PATCH /units/:id — update metadata.
   * BL-03: monthly_rent_paise rejected if state = OCCUPIED or MAINTENANCE.
   */
  @Patch(":id")
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateUnitDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.unitsService.update(id, dto, actor.sub);
  }

  /**
   * PATCH /units/:id/state — explicit state transition.
   * BL-04: illegal transitions rejected with UNIT_STATUS_BLOCKED.
   */
  @Patch(":id/state")
  async changeState(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UnitStateChangeDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.unitsService.changeState(id, dto, actor.sub);
  }

  /**
   * POST /units/:id/retire — BL-05: one-way retirement.
   * Sets is_retired=true, retired_at, retired_by_user_id, state=MAINTENANCE.
   * DB trigger prevents un-retiring at the Postgres level.
   */
  @Post(":id/retire")
  @HttpCode(HttpStatus.OK)
  async retire(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.unitsService.retire(id, actor.sub);
  }

  /**
   * DELETE /units/:id — always 405.
   * Units are retired, never hard-deleted (BL-05).
   */
  @Delete(":id")
  deleteNotAllowed() {
    return this.unitsService.deleteNotAllowed();
  }
}

/**
 * Handles /properties/:propertyId/units — list and create.
 * Admin-only in Phase 2.
 */
@Controller("properties/:propertyId/units")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class PropertyUnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  /** GET /properties/:propertyId/units?cursor=&limit=20 */
  @Get()
  async list(
    @Param("propertyId", ParseIntPipe) propertyId: number,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    return this.unitsService.list(propertyId, cursor ? parseInt(cursor, 10) : undefined, limit ? parseInt(limit, 10) : 20);
  }

  /** POST /properties/:propertyId/units */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("propertyId", ParseIntPipe) propertyId: number,
    @Body() dto: CreateUnitDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.unitsService.create(propertyId, dto, actor.sub);
  }
}
