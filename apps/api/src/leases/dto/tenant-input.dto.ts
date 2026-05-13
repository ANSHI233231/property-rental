import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  MaxLength,
  MinLength,
  Matches,
} from "class-validator";

/**
 * Embedded tenant input within lease creation.
 * An existing TENANT user is looked up by email; if not found a new user
 * is created with a generated temp password.
 */
export class TenantInputDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: "Valid Indian mobile number required" })
  phone?: string;

  @IsBoolean()
  is_primary!: boolean;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  id_proof_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  id_proof_number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emergency_contact_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: "Valid Indian mobile number required" })
  emergency_contact_phone?: string;

  /**
   * Initial password set by the PM. Only used when this email isn't already
   * a user — existing accounts are left untouched. If omitted entirely, the
   * service falls back to a generated temp password.
   */
  @IsOptional()
  @IsString()
  @MinLength(10, { message: "Password must be at least 10 characters" })
  @Matches(/[a-zA-Z]/, { message: "Password must contain at least one letter" })
  @Matches(/[0-9]/, { message: "Password must contain at least one digit" })
  password?: string;
}
