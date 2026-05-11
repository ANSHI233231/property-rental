import { IsOptional, IsString, MaxLength, Matches } from "class-validator";

/**
 * DTO for PATCH /tenants/:id — personal info update only.
 * Name and email changes go through /users/:id (Admin only).
 */
export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  dob?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  id_proof_type?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  id_proof_number?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  emergency_contact_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^[6-9]\d{9}$/, { message: "Valid Indian mobile number required" })
  emergency_contact_phone?: string | null;
}
