import {
  IsEmail,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  Matches,
  IsEnum,
  MinLength,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";

export enum UserRoleEnum {
  ADMIN = "ADMIN",
  PROPERTY_MANAGER = "PROPERTY_MANAGER",
  MAINTENANCE = "MAINTENANCE",
  TENANT = "TENANT",
}

/**
 * DTO for POST /users.
 *
 * ADMIN may create any role. PROPERTY_MANAGER may create MAINTENANCE or TENANT
 * only — role authorization is enforced server-side in UsersService.
 *
 * `name` is derived from firstName + lastName by the service; callers pass
 * firstName + lastName separately.
 *
 * `specialization` is required when role === MAINTENANCE; rejected for any
 * other role (enforced in the service).
 *
 * Hashed with Argon2id (SRS §11.1 — never bcrypt).
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
  @IsNotEmpty({ message: "First name is required" })
  @MaxLength(100)
  firstName!: string;

  @IsString()
  @IsNotEmpty({ message: "Last name is required" })
  @MaxLength(100)
  lastName!: string;

  @IsEnum(UserRoleEnum, { message: "role must be one of: ADMIN, PROPERTY_MANAGER, MAINTENANCE, TENANT" })
  role!: UserRoleEnum;

  /** Initial password set by the creating admin / PM. */
  @IsString()
  @MinLength(10, { message: "Password must be at least 10 characters" })
  @Matches(/[a-zA-Z]/, { message: "Password must contain at least one letter" })
  @Matches(/[0-9]/, { message: "Password must contain at least one digit" })
  password!: string;

  /**
   * Specialization for MAINTENANCE users only. The service rejects this field
   * for non-MAINTENANCE roles and requires it for MAINTENANCE.
   */
  @ValidateIf((o: { specialization?: string }) => o.specialization !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  specialization?: string;
}
