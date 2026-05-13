import { IsString, MinLength, Matches } from "class-validator";

/**
 * DTO for PATCH /users/:id/reset-password (Admin-only).
 *
 * The admin manually sets a new temporary password for the user. The user can
 * then log in with this password and (recommended) change it themselves via
 * POST /users/me/change-password.
 *
 * Per spec: no email is sent to the user — the admin shares the password
 * out-of-band. An audit log entry (`admin.reset_password`) is written.
 */
export class AdminResetPasswordDto {
  @IsString()
  @MinLength(10, { message: "Password must be at least 10 characters" })
  @Matches(/[a-zA-Z]/, { message: "Password must contain at least one letter" })
  @Matches(/[0-9]/, { message: "Password must contain at least one digit" })
  newPassword!: string;
}
