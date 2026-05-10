import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  Matches,
  IsIn,
} from "class-validator";

/**
 * DTO for POST /properties.
 * Admin-only. Validates the property creation payload.
 * BL-19: active_pm_id (if provided) is validated in the service layer.
 */
export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty({ message: "Property name is required" })
  @MaxLength(200)
  name!: string;

  @IsString()
  @IsNotEmpty({ message: "Address is required" })
  @MaxLength(500)
  address!: string;

  @IsString()
  @IsNotEmpty({ message: "City is required" })
  @MaxLength(100)
  city!: string;

  @IsString()
  @IsNotEmpty({ message: "State is required" })
  @MaxLength(100)
  state!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: "Pincode must be exactly 6 digits" })
  pincode!: string;

  @IsOptional()
  @IsString()
  @IsIn(["Asia/Kolkata"], { message: "Only Asia/Kolkata timezone is supported in v1" })
  timezone?: string;

  /** Optional: assign a PROPERTY_MANAGER at creation time. Validated in service. */
  @IsOptional()
  @IsString()
  active_pm_id?: string;
}
