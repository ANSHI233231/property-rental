import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { AdminCreateUserDto } from "./dto/admin-create-user.dto";
import { AdminUpdateUserDto } from "./dto/admin-update-user.dto";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";
import { UserThrottlerGuard } from "../common/guards/user-throttler.guard";
import type { JwtPayload } from "../auth/jwt.service";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ---------------------------------------------------------------------------
  // Self-service endpoints (any authenticated role) — Phase 1, preserved
  // ---------------------------------------------------------------------------

  /**
   * GET /users/me — returns the authenticated user's profile.
   * TC-PROFILE-001, TC-PROFILE-012, TC-PROFILE-013.
   */
  @Get("me")
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.usersService.findById(user.sub);
  }

  /**
   * PATCH /users/me — update name or phone only.
   * Email change is NOT in v1 (SRS §11.3).
   * TC-PROFILE-012.
   */
  @Patch("me")
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  /**
   * POST /users/me/change-password — verifies current password, sets new one,
   * revokes all refresh tokens.
   * TC-PROFILE-004, TC-PROFILE-005.
   * Phase 7: rate-limited 5/min per user ID (not IP — UserThrottlerGuard).
   */
  @Post("me/change-password")
  @UseGuards(UserThrottlerGuard)
  // Limit enforced via ThrottlerModule.forRoot (app.module.ts) — not hardcoded here.
  @Throttle({ "change-pwd": {} })
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.usersService.changePassword(user.sub, dto);
    return { message: "Password changed successfully. Please log in again." };
  }

  // ---------------------------------------------------------------------------
  // Admin CRUD endpoints — Phase 2
  // All require ADMIN role (RolesGuard + @Roles).
  // ---------------------------------------------------------------------------

  /**
   * GET /users — Admin paginated list.
   * Supports ?role= filter and cursor pagination.
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "PROPERTY_MANAGER")
  async listUsers(
    @Query("role") role: string | undefined,
    @Query("cursor") cursor: string | undefined,
    @Query("limit") limit: string | undefined,
    @Query("page") page: string | undefined,
    @Query("pageSize") pageSize: string | undefined,
    @CurrentUser() actor: JwtPayload,
  ) {
    // PMs need to populate the maintenance-staff picker when assigning a
    // request. Force-scope them to MAINTENANCE so they cannot enumerate other
    // PMs, admins, or tenants regardless of what they pass on the wire.
    const PROPERTY_MANAGER_ROLE = 1;
    const effectiveRole = actor.role === PROPERTY_MANAGER_ROLE ? "MAINTENANCE" : role;
    const cursorNum = cursor ? parseInt(cursor, 10) : undefined;
    const pageNum = page !== undefined ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize !== undefined ? parseInt(pageSize, 10) : undefined;
    return this.usersService.listUsers(
      effectiveRole,
      cursorNum,
      limit ? parseInt(limit, 10) : 20,
      pageNum !== undefined && !isNaN(pageNum) ? pageNum : undefined,
      pageSizeNum !== undefined && !isNaN(pageSizeNum) ? pageSizeNum : undefined,
    );
  }

  /**
   * POST /users — Admin creates a user account.
   * If password is omitted, a temporary password is generated and returned ONCE.
   * No public sign-up (SRS §9).
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "PROPERTY_MANAGER")
  @HttpCode(HttpStatus.CREATED)
  async adminCreateUser(
    @Body() dto: AdminCreateUserDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    // Service enforces: PROPERTY_MANAGER may only create MAINTENANCE or TENANT.
    return this.usersService.adminCreateUser(dto, actor.sub, actor.role);
  }

  /**
   * GET /users/:id — Admin fetch by ID.
   * NB: this route must come AFTER /users/me to avoid swallowing the "me" literal.
   */
  @Get(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async adminFindById(@Param("id", ParseIntPipe) id: number) {
    return this.usersService.adminFindById(id);
  }

  /**
   * PATCH /users/:id — Admin update (name, phone, is_active, role).
   * Role changes guarded against last-admin demotion and PM-with-property.
   */
  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  async adminUpdateUser(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.adminUpdateUser(id, dto, actor.sub);
  }

  /**
   * PATCH /users/:id/reset-password — Admin sets a new temporary password.
   *
   * F3.2: admin shares the password out-of-band; no email is sent. All
   * existing refresh tokens for the target user are revoked. Audit log
   * `admin.reset_password` records actor + target.
   */
  @Patch(":id/reset-password")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @HttpCode(HttpStatus.OK)
  async adminResetPassword(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    await this.usersService.adminResetPassword(id, dto.newPassword, actor.sub);
    return { message: "Password reset successfully" };
  }

  /**
   * POST /users/:id/deactivate — toggles is_active=false.
   * Guard: PM with active property → PM_HAS_PROPERTY (409).
   */
  @Post(":id/deactivate")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @HttpCode(HttpStatus.OK)
  async adminDeactivateUser(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.adminDeactivateUser(id, actor.sub);
  }

  /**
   * POST /users/:id/activate — toggles is_active=true.
   */
  @Post(":id/activate")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @HttpCode(HttpStatus.OK)
  async adminActivateUser(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.adminActivateUser(id, actor.sub);
  }

  /**
   * DELETE /users/:id — always 405.
   * Users are deactivated, never deleted.
   */
  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  adminDeleteNotAllowed() {
    return this.usersService.deleteNotAllowed();
  }
}
