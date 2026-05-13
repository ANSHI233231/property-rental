import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from "@nestjs/common";
import { RentChangeScheduleService } from "./rent-change-schedule.service";
import { CreateRentScheduleDto } from "./dto/create-rent-schedule.dto";
import { UpdateRentScheduleDto } from "./dto/update-rent-schedule.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PropertyScopeGuard } from "../auth/guards/property-scope.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { PropertyScope } from "../auth/decorators/property-scope.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/jwt.service";

/**
 * RentChangeScheduleController
 *
 * Endpoints:
 *   POST   units/:unitId/rent-schedule   — schedule a rent change (PM only)
 *   PATCH  units/:unitId/rent-schedule   — modify pending schedule (PM only)
 *   DELETE units/:unitId/rent-schedule   — cancel pending schedule (PM only)
 *   GET    units/:unitId/rent-schedule   — get current pending schedule (PM + Admin)
 */
@Controller("units/:unitId/rent-schedule")
@UseGuards(JwtAuthGuard, RolesGuard, PropertyScopeGuard)
export class RentChangeScheduleController {
  constructor(private readonly service: RentChangeScheduleService) {}

  // ---------------------------------------------------------------------------
  // POST units/:unitId/rent-schedule
  // ---------------------------------------------------------------------------

  @Post()
  @Roles("PROPERTY_MANAGER")
  @PropertyScope("unit")
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("unitId", ParseIntPipe) unitId: number,
    @Body() dto: CreateRentScheduleDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.create(unitId, dto, actor);
  }

  // ---------------------------------------------------------------------------
  // PATCH units/:unitId/rent-schedule
  // ---------------------------------------------------------------------------

  @Patch()
  @Roles("PROPERTY_MANAGER")
  @PropertyScope("unit")
  @HttpCode(HttpStatus.OK)
  async modify(
    @Param("unitId", ParseIntPipe) unitId: number,
    @Body() dto: UpdateRentScheduleDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.modify(unitId, dto, actor);
  }

  // ---------------------------------------------------------------------------
  // DELETE units/:unitId/rent-schedule
  // ---------------------------------------------------------------------------

  @Delete()
  @Roles("PROPERTY_MANAGER")
  @PropertyScope("unit")
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param("unitId", ParseIntPipe) unitId: number,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.service.cancel(unitId, actor);
  }

  // ---------------------------------------------------------------------------
  // GET units/:unitId/rent-schedule
  // ---------------------------------------------------------------------------

  @Get()
  @Roles("PROPERTY_MANAGER", "ADMIN")
  @PropertyScope("unit")
  @HttpCode(HttpStatus.OK)
  async getCurrent(
    @Param("unitId", ParseIntPipe) unitId: number,
  ) {
    return this.service.getCurrent(unitId);
  }
}
