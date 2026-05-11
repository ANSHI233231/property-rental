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
} from "@nestjs/common";
import { LeasesService } from "./leases.service";
import { CreateLeaseDto } from "./dto/create-lease.dto";
import { RenewLeaseDto } from "./dto/renew-lease.dto";
import { TerminationRequestDto } from "./dto/termination-request.dto";
import { TerminationApprovalDto } from "./dto/termination-approval.dto";
import { TerminationWithdrawDto } from "./dto/termination-withdraw.dto";
import { DepositRefundDto } from "./dto/deposit-refund.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { PropertyScopeGuard } from "../auth/guards/property-scope.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { PropertyScope } from "../auth/decorators/property-scope.decorator";
import { PropertyScopeBody } from "../auth/decorators/property-scope-body.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/jwt.service";

/**
 * Leases controller — Phase 3.
 *
 * Endpoints:
 *   POST   /properties/:propertyId/units/:unitId/leases     — sign lease (F1)
 *   GET    /leases                                           — list (filtered)
 *   GET    /leases/:id                                       — single
 *   POST   /leases/:id/renew                                 — renew (BL-02 safe)
 *   POST   /leases/:id/terminate-request                     — co-tenant termination start (F5)
 *   POST   /leases/:id/terminate-approve                     — co-tenant votes
 *   POST   /leases/:id/terminate-withdraw                    — requester withdraws
 *   POST   /leases/:id/finalize-termination                  — PM finalizes (BL-08/09)
 *   POST   /deposit-refunds                                  — PM processes refund
 */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, PropertyScopeGuard)
export class LeasesController {
  constructor(private readonly leasesService: LeasesService) {}

  // ---------------------------------------------------------------------------
  // POST /properties/:propertyId/units/:unitId/leases
  // ---------------------------------------------------------------------------

  @Post("properties/:propertyId/units/:unitId/leases")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @PropertyScope("property")
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("propertyId") propertyId: string,
    @Param("unitId") unitId: string,
    @Body() dto: CreateLeaseDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.leasesService.create(propertyId, unitId, dto, actor.sub);
  }

  // ---------------------------------------------------------------------------
  // GET /leases
  // ---------------------------------------------------------------------------

  @Get("leases")
  @Roles("ADMIN", "PROPERTY_MANAGER", "TENANT")
  @HttpCode(HttpStatus.OK)
  async list(
    @Query("propertyId") propertyId?: string,
    @Query("unitId") unitId?: string,
    @Query("tenantId") tenantId?: string,
    @Query("status") status?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @CurrentUser() actor?: JwtPayload,
  ) {
    // A TENANT may only list leases scoped to themselves. The service treats
    // the tenantId query as a User.id (see leases.service.ts §FC-2), so we
    // force it to the caller's sub regardless of what they sent.
    const effectiveTenantId =
      actor!.role === "TENANT" ? actor!.sub : tenantId;

    return this.leasesService.list({
      propertyId,
      unitId,
      tenantId: effectiveTenantId,
      status,
      cursor,
      limit: limit ? parseInt(limit, 10) : 20,
      actorId: actor!.sub,
      actorRole: actor!.role,
    });
  }

  // ---------------------------------------------------------------------------
  // GET /leases/:id
  // ---------------------------------------------------------------------------

  @Get("leases/:id")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @PropertyScope("lease")
  @HttpCode(HttpStatus.OK)
  async findOne(@Param("id") id: string) {
    return this.leasesService.findByIdForResponse(id);
  }

  // ---------------------------------------------------------------------------
  // POST /leases/:id/renew
  // ---------------------------------------------------------------------------

  @Post("leases/:id/renew")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @PropertyScope("lease")
  @HttpCode(HttpStatus.CREATED)
  async renew(
    @Param("id") id: string,
    @Body() dto: RenewLeaseDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.leasesService.renew(id, dto, actor.sub);
  }

  // ---------------------------------------------------------------------------
  // POST /leases/:id/terminate-request
  // Accessible by both PROPERTY_MANAGER and TENANT roles.
  // ---------------------------------------------------------------------------

  @Post("leases/:id/terminate-request")
  @Roles("ADMIN", "PROPERTY_MANAGER", "TENANT")
  @PropertyScope("lease")
  @HttpCode(HttpStatus.CREATED)
  async terminateRequest(
    @Param("id") id: string,
    @Body() dto: TerminationRequestDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.leasesService.requestTermination(id, dto, actor.sub, actor.role);
  }

  // ---------------------------------------------------------------------------
  // POST /leases/:id/terminate-approve
  // Co-tenant casts their own vote. PMs cannot approve on behalf of tenants (H-01).
  // ---------------------------------------------------------------------------

  @Post("leases/:id/terminate-approve")
  @Roles("ADMIN", "TENANT")
  @PropertyScope("lease")
  @HttpCode(HttpStatus.OK)
  async terminateApprove(
    @Param("id") id: string,
    @Body() dto: TerminationApprovalDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.leasesService.approveTermination(id, dto, actor.sub, actor.role);
  }

  // ---------------------------------------------------------------------------
  // POST /leases/:id/terminate-withdraw
  // Only the requester can withdraw. Body is a typed DTO (M-04).
  // ---------------------------------------------------------------------------

  @Post("leases/:id/terminate-withdraw")
  @Roles("ADMIN", "PROPERTY_MANAGER", "TENANT")
  @PropertyScope("lease")
  @HttpCode(HttpStatus.OK)
  async terminateWithdraw(
    @Param("id") id: string,
    @Body() dto: TerminationWithdrawDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.leasesService.withdrawTermination(id, dto.requestedByTenantId, actor.sub, actor.role);
  }

  // ---------------------------------------------------------------------------
  // POST /leases/:id/finalize-termination
  // PM-only. All approvals must be APPROVED.
  // ---------------------------------------------------------------------------

  @Post("leases/:id/finalize-termination")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @PropertyScope("lease")
  @HttpCode(HttpStatus.OK)
  async finalizeTermination(
    @Param("id") id: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.leasesService.finalizeTermination(id, actor.sub);
  }

  // ---------------------------------------------------------------------------
  // POST /deposit-refunds
  // PM-only. One refund per lease.
  // H-02: @PropertyScopeBody('leaseId') tells PropertyScopeGuard to derive the
  // property from req.body.leaseId so a PM cannot refund a cross-property lease.
  // ---------------------------------------------------------------------------

  @Post("deposit-refunds")
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @PropertyScopeBody("leaseId")
  @HttpCode(HttpStatus.CREATED)
  async createDepositRefund(
    @Body() dto: DepositRefundDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.leasesService.createDepositRefund(dto, actor.sub, actor.role);
  }
}
