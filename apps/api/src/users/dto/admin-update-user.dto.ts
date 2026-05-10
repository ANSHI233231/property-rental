import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  Matches,
  IsEnum,
  IsBoolean,
} from "class-validator";

export enum UserRoleEnum {
  ADMIN = "ADMIN",
  PROPERTY_MANAGER = "PROPERTY_MANAGER",
  MAINTENANCE = "MAINTENANCE",
  TENANT = "TENANT",
}

/**
 * DTO for PATCH /users/:id (Admin-only).
 * Role changes are guarded in the service:
 * - Cannot demote the last Admin (LAST_ADMIN_PROTECTED).
 * - Cannot change role of a PM currently assigned to a property (PM_HAS_PROPERTY).
 */
export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Name cannot be blank" })
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: "Must be a valid 10-digit Indian mobile number" })
  phone?: string | null;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsEnum(UserRoleEnum, { message: "role must be one of: ADMIN, PROPERTY_MANAGER, MAINTENANCE, TENANT" })
  role?: UserRoleEnum;
}
