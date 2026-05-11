import { IsString, IsEmail, IsOptional, IsBoolean, MaxLength, Matches } from "class-validator";

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
}
