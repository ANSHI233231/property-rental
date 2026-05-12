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
  @Roles("ADMIN")
  async listUsers(
    @Query("role") role?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ) {
    const cursorNum = cursor ? parseInt(cursor, 10) : undefined;
    return this.usersService.listUsers(role, cursorNum, limit ? parseInt(limit, 10) : 20);
  }

  /**
   * POST /users — Admin creates a user account.
   * If password is omitted, a temporary password is generated and returned ONCE.
   * No public sign-up (SRS §9).
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  @HttpCode(HttpStatus.CREATED)
  async adminCreateUser(
    @Body() dto: AdminCreateUserDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.adminCreateUser(dto, actor.sub);
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
