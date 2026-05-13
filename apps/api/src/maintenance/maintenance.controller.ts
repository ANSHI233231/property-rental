import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from "@nestjs/common";
import { MaintenanceService } from "./maintenance.service";
import { CreateMaintenanceRequestDto } from "./dto/create-maintenance-request.dto";
import { AssignMaintenanceDto } from "./dto/assign-maintenance.dto";
import { ResolveMaintenanceDto } from "./dto/resolve-maintenance.dto";
import { DismissAlertDto } from "./dto/dismiss-alert.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RoleErrorCode } from "../auth/decorators/role-error-code.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/jwt.service";

/**
 * MaintenanceController — Phase 5 endpoints.
 *
 * BL-14: description >= 30 chars; resolution_notes >= 20 chars (DTO + DB CHECK).
 * BL-15: closed requests immutable (DB trigger; service returns 409 on stale read).
 * BL-16: MAINTENANCE role blocked from POST /maintenance-requests.
 * BL-17: 5+ requests/month alert via @nestjs/schedule cron; dismiss-alert endpoint here.
 * BL-21: /close is TENANT-only.
 */
@Controller("maintenance-requests")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  // ---------------------------------------------------------------------------
  // GET /maintenance-requests
  // All authenticated roles; scope enforced per-role in service.
  // ---------------------------------------------------------------------------

  @Get()
  @Roles("ADMIN", "PROPERTY_MANAGER", "MAINTENANCE", "TENANT")
  async list(
    @CurrentUser() actor: JwtPayload,
    @Query("unitId") unitId?: string,
    @Query("propertyId") propertyId?: string,
    @Query("status") status?: string,
    @Query("assignedToUserId") assignedToUserId?: string,
    @Query("scope") scope?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const pageNum = page !== undefined ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize !== undefined ? parseInt(pageSize, 10) : undefined;
    return this.maintenanceService.list(actor, {
      unitId: unitId ? parseInt(unitId, 10) : undefined,
      propertyId: propertyId ? parseInt(propertyId, 10) : undefined,
      status,
      assignedToUserId: assignedToUserId ? parseInt(assignedToUserId, 10) : undefined,
      scope,
      cursor: cursor ? parseInt(cursor, 10) : undefined,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
      page: pageNum !== undefined && !isNaN(pageNum) ? pageNum : undefined,
      pageSize: pageSizeNum !== undefined && !isNaN(pageSizeNum) ? pageSizeNum : undefined,
    });
  }

  // ---------------------------------------------------------------------------
  // GET /maintenance-requests/alerts
  // MUST be declared BEFORE /:id to avoid Nest treating 'alerts' as an id.
  // BL-17: Admin and PM only. Admin sees all; PM scoped to their property.
  // ---------------------------------------------------------------------------

  @Get("alerts")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  async listAlerts(
    @CurrentUser() actor: JwtPayload,
    @Query("dismissed") dismissed?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    const pageNum = page !== undefined ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize !== undefined ? parseInt(pageSize, 10) : undefined;
    return this.maintenanceService.listAlerts(actor, {
      dismissed,
      cursor: cursor ? parseInt(cursor, 10) : undefined,
      limit: limit ? Math.min(parseInt(limit, 10), 100) : 20,
      page: pageNum !== undefined && !isNaN(pageNum) ? pageNum : undefined,
      pageSize: pageSizeNum !== undefined && !isNaN(pageSizeNum) ? pageSizeNum : undefined,
    });
  }

  // ---------------------------------------------------------------------------
  // POST /maintenance-requests/dismiss-alert
  // MUST be declared BEFORE /:id to avoid Nest treating 'dismiss-alert' as an id.
  // BL-17: Admin or PM only.
  // ---------------------------------------------------------------------------

  @Post("dismiss-alert")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @HttpCode(HttpStatus.OK)
  async dismissAlert(
    @Body() dto: DismissAlertDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.maintenanceService.dismissAlert(dto, actor);
  }

  // ---------------------------------------------------------------------------
  // GET /maintenance-requests/:id
  // ---------------------------------------------------------------------------

  @Get(":id")
  @Roles("ADMIN", "PROPERTY_MANAGER", "MAINTENANCE", "TENANT")
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.maintenanceService.findOne(id, actor);
  }

  // ---------------------------------------------------------------------------
  // POST /maintenance-requests
  // BL-16 deviation (user-approved 2026-05-13): TENANT, ADMIN, and PM may
  // raise. MAINTENANCE is still blocked.
  // PMs are additionally scoped to their assigned property by service-layer
  // checks; cross-property raises return 403.
  // @RoleErrorCode: surfaces BL code in 403 response.
  // ---------------------------------------------------------------------------

  @Post()
  @Roles("TENANT", "ADMIN", "PROPERTY_MANAGER")
  @RoleErrorCode("BL_16_ONLY_TENANT_CAN_RAISE_MAINTENANCE")
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateMaintenanceRequestDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.maintenanceService.create(dto, actor);
  }

  // ---------------------------------------------------------------------------
  // POST /maintenance-requests/:id/assign
  // PM / Admin only. Transitions OPEN → ASSIGNED.
  // ---------------------------------------------------------------------------

  @Post(":id/assign")
  @Roles("PROPERTY_MANAGER", "ADMIN")
  @HttpCode(HttpStatus.OK)
  async assign(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AssignMaintenanceDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.maintenanceService.assign(id, dto, actor);
  }

  // ---------------------------------------------------------------------------
  // POST /maintenance-requests/:id/in-progress
  // MAINTENANCE / PM / Admin. Transitions ASSIGNED → IN_PROGRESS.
  // ---------------------------------------------------------------------------

  @Post(":id/in-progress")
  @Roles("MAINTENANCE", "PROPERTY_MANAGER", "ADMIN")
  @HttpCode(HttpStatus.OK)
  async inProgress(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.maintenanceService.inProgress(id, actor);
  }

  // ---------------------------------------------------------------------------
  // POST /maintenance-requests/:id/resolve
  // MAINTENANCE / PM / Admin. Transitions IN_PROGRESS → RESOLVED.
  // BL-14: resolutionNotes >= 20 chars.
  // ---------------------------------------------------------------------------

  @Post(":id/resolve")
  @Roles("MAINTENANCE", "PROPERTY_MANAGER", "ADMIN")
  @HttpCode(HttpStatus.OK)
  async resolve(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ResolveMaintenanceDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.maintenanceService.resolve(id, dto, actor);
  }

  // ---------------------------------------------------------------------------
  // POST /maintenance-requests/:id/close
  // BL-21: TENANT only. Transitions RESOLVED → CLOSED.
  // @RoleErrorCode: surfaces BL code in 403 response.
  // ---------------------------------------------------------------------------

  @Post(":id/close")
  @Roles("TENANT")
  @RoleErrorCode("BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE")
  @HttpCode(HttpStatus.OK)
  async close(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.maintenanceService.close(id, actor);
  }
}
