import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Headers,
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
import { RoleErrorCode } from "../auth/decorators/role-error-code.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/jwt.service";

/** Role int codes */
const ROLE = { ADMIN: 0, PROPERTY_MANAGER: 1, MAINTENANCE: 2, TENANT: 3 } as const;

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
  // ---------------------------------------------------------------------------

  @Get("rent-periods")
  @Roles("ADMIN", "PROPERTY_MANAGER", "TENANT")
  async listPeriods(
    @Query("leaseId") leaseId?: string,
    @Query("unitId") unitId?: string,
    @Query("propertyId") propertyId?: string,
    @Query("status") status?: string,
    @Query("periodStart_gte") periodStart_gte?: string,
    @Query("periodStart_lte") periodStart_lte?: string,
    @Query("cursor") cursor?: string,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit?: number,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @CurrentUser() actor?: JwtPayload,
  ) {
    return this.rentService.listPeriods({
      leaseId: leaseId ? parseInt(leaseId, 10) : undefined,
      unitId: unitId ? parseInt(unitId, 10) : undefined,
      propertyId: propertyId ? parseInt(propertyId, 10) : undefined,
      status,
      periodStart_gte,
      periodStart_lte,
      cursor: cursor ? parseInt(cursor, 10) : undefined,
      limit,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      actorId: actor!.sub,
      actorRole: actor!.role,
    });
  }

  // ---------------------------------------------------------------------------
  // GET /rent-periods/:id
  // ---------------------------------------------------------------------------

  @Get("rent-periods/:id")
  @Roles("ADMIN", "PROPERTY_MANAGER", "TENANT")
  async findPeriod(@Param("id", ParseIntPipe) id: number, @CurrentUser() actor?: JwtPayload) {
    const period = await this.rentService.findPeriodById(id);

    // H-01: TENANT ownership check (role code 3)
    if (actor?.role === ROLE.TENANT) {
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

    // H-01: PROPERTY_MANAGER scope check (role code 1)
    if (actor?.role === ROLE.PROPERTY_MANAGER) {
      const hasAccess = await this.rentService.pmHasAccessToPeriod(id, actor.sub);
      if (!hasAccess) {
        throw new ForbiddenException({
          error: {
            code: "PROPERTY_ACCESS_DENIED",
            message: "You are not the assigned manager for this property",
          },
        });
      }
    }

    // PII redaction: TENANT callers must not see the bank reference number.
    // Stored value is untouched; we only null it out in the response.
    if (actor?.role === ROLE.TENANT) {
      const payments = (period as { payments?: Array<Record<string, unknown>> }).payments;
      if (Array.isArray(payments)) {
        return {
          ...period,
          payments: payments.map((p) => ({ ...p, reference: null })),
        };
      }
    }

    return period;
  }

  // ---------------------------------------------------------------------------
  // POST /payments
  // BL-10: PROPERTY_MANAGER + ADMIN only.
  // ---------------------------------------------------------------------------

  @Post("payments")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @RoleErrorCode("BL_10_TENANT_CANNOT_RECORD_PAYMENT")
  @HttpCode(HttpStatus.CREATED)
  async recordPayment(
    @Body() dto: RecordPaymentDto,
    @CurrentUser() actor?: JwtPayload,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.rentService.recordPayment(dto, actor!.sub, actor!.role, idempotencyKey);
  }

  // ---------------------------------------------------------------------------
  // POST /payments/:id/void
  // ---------------------------------------------------------------------------

  @Post("payments/:id/void")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @HttpCode(HttpStatus.OK)
  async voidPayment(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VoidPaymentDto,
    @CurrentUser() actor?: JwtPayload,
  ) {
    return this.rentService.voidPayment(id, dto, actor!.sub, actor!.role);
  }
}
