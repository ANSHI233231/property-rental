import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  Matches,
  IsIn,
} from "class-validator";

/**
 * DTO for PATCH /properties/:id.
 * Admin-only. Does NOT allow changing active_pm_id — use POST /properties/:id/transfer-pm.
 */
export class UpdatePropertyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Name cannot be blank" })
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "Address cannot be blank" })
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "City cannot be blank" })
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: "State cannot be blank" })
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: "Pincode must be exactly 6 digits" })
  pincode?: string;

  @IsOptional()
  @IsString()
  @IsIn(["Asia/Kolkata"], { message: "Only Asia/Kolkata timezone is supported in v1" })
  timezone?: string;
}
