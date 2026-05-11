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
  DefaultValuePipe,
  ForbiddenException,
} from "@nestjs/common";
import { RentService } from "./rent.service";
import { RecordPaymentDto } from "./dto/record-payment.dto";
import { VoidPaymentDto } from "./dto/void-payment.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/jwt.service";

/**
 * RentController — Phase 4.
 *
 * Endpoints:
 *   GET  /rent-periods          — list (PM/Admin/Tenant scoped)
 *   GET  /rent-periods/:id      — single period with payments + credits
 *   POST /payments              — record payment (BL-10: PM/Admin only)
 *   POST /payments/:id/void     — void payment (PM/Admin only)
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class RentController {
  constructor(private readonly rentService: RentService) {}

  // ---------------------------------------------------------------------------
  // GET /rent-periods
  // PM/Admin: full access (scoped to their property at service layer).
  // Tenant: only their own lease's periods.
  // MAINTENANCE: 403.
  // ---------------------------------------------------------------------------

  @Get("rent-periods")
  @Roles("ADMIN", "PROPERTY_MANAGER", "TENANT")
  async listPeriods(
    @Query("leaseId") leaseId?: string,
    @Query("unitId") unitId?: string,
    @Query("status") status?: string,
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @CurrentUser() actor?: JwtPayload,
  ) {
    return this.rentService.listPeriods({
      leaseId,
      unitId,
      status,
      cursor,
      limit,
      actorId: actor!.sub,
      actorRole: actor!.role,
    });
  }

  // ---------------------------------------------------------------------------
  // GET /rent-periods/:id
  // PM/Admin/Tenant with access to the lease.
  // ---------------------------------------------------------------------------

  @Get("rent-periods/:id")
  @Roles("ADMIN", "PROPERTY_MANAGER", "TENANT")
  async findPeriod(@Param("id") id: string, @CurrentUser() actor?: JwtPayload) {
    const period = await this.rentService.findPeriodById(id);

    // Tenant can only view periods for their own leases
    if (actor?.role === "TENANT") {
      // Service will return data — we validate ownership here
      const hasAccess = await this.rentService.tenantHasAccessToPeriod(id, actor.sub);
      if (!hasAccess) {
        throw new ForbiddenException({
          error: {
            code: "PERIOD_ACCESS_DENIED",
            message: "You do not have access to this rent period",
          },
        });
      }
    }

    return period;
  }

  // ---------------------------------------------------------------------------
  // POST /payments
  // BL-10: PROPERTY_MANAGER + ADMIN only.
  // Returns 403 BL_10_TENANT_CANNOT_RECORD_PAYMENT for any other role.
  // ---------------------------------------------------------------------------

  @Post("payments")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @HttpCode(HttpStatus.CREATED)
  async recordPayment(
    @Body() dto: RecordPaymentDto,
    @CurrentUser() actor?: JwtPayload,
  ) {
    return this.rentService.recordPayment(dto, actor!.sub, actor!.role);
  }

  // ---------------------------------------------------------------------------
  // POST /payments/:id/void
  // PROPERTY_MANAGER + ADMIN only.
  // ---------------------------------------------------------------------------

  @Post("payments/:id/void")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @HttpCode(HttpStatus.OK)
  async voidPayment(
    @Param("id") id: string,
    @Body() dto: VoidPaymentDto,
    @CurrentUser() actor?: JwtPayload,
  ) {
    return this.rentService.voidPayment(id, dto, actor!.sub, actor!.role);
  }
}
