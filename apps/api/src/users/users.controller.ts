import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import type { JwtPayload } from "../auth/jwt.service";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
   */
  @Post("me/change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.usersService.changePassword(user.sub, dto);
    return { message: "Password changed successfully. Please log in again." };
  }
}
