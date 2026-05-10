import { IsString, MinLength, Matches } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @MinLength(1, { message: "Token is required" })
  token!: string;

  @IsString()
  @MinLength(10, { message: "Password must be at least 10 characters" })
  @Matches(/[a-zA-Z]/, { message: "Password must contain at least one letter" })
  @Matches(/[0-9]/, { message: "Password must contain at least one number" })
  newPassword!: string;
}
