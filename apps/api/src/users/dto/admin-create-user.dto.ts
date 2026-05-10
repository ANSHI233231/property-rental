import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  Matches,
  IsEnum,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";

export enum UserRoleEnum {
  ADMIN = "ADMIN",
  PROPERTY_MANAGER = "PROPERTY_MANAGER",
  MAINTENANCE = "MAINTENANCE",
  TENANT = "TENANT",
}

/**
 * DTO for POST /users (Admin-only user creation).
 * If password is omitted, a temporary password is auto-generated and returned
 * ONCE in the response (Admin hands it to the user).
 * Hashed with Argon2id (SRS §11.1).
 */
export class AdminCreateUserDto {
  @IsEmail({}, { message: "Must be a valid email address" })
  @Transform(({ value }) => (typeof value === "string" ? value.toLowerCase() : value))
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: "Must be a valid 10-digit Indian mobile number" })
  phone?: string;

  @IsString()
  @IsNotEmpty({ message: "Name is required" })
  @MaxLength(200)
  name!: string;

  @IsEnum(UserRoleEnum, { message: "role must be one of: ADMIN, PROPERTY_MANAGER, MAINTENANCE, TENANT" })
  role!: UserRoleEnum;

  /**
   * Optional. If omitted, a temporary 16-character password is generated.
   * Generated password is returned ONCE in the response (plaintext) — hash stored in DB.
   */
  @IsOptional()
  @IsString()
  @MinLength(10, { message: "Password must be at least 10 characters" })
  @Matches(/[a-zA-Z]/, { message: "Password must contain at least one letter" })
  @Matches(/[0-9]/, { message: "Password must contain at least one digit" })
  password?: string;
}
