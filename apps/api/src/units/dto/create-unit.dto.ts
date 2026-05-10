import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsInt,
  IsOptional,
  Min,
} from "class-validator";

/**
 * DTO for POST /properties/:propertyId/units.
 * Admin-only in Phase 2. New units start in AVAILABLE state.
 * Rent stored in paise (integer). BL-03 applies from this point on.
 */
export class CreateUnitDto {
  @IsString()
  @IsNotEmpty({ message: "Unit number is required" })
  @MaxLength(20)
  unit_number!: string;

  @IsOptional()
  @IsInt()
  floor?: number;

  @IsInt()
  @Min(0, { message: "Bedrooms cannot be negative (0 = studio)" })
  bedrooms!: number;

  @IsInt()
  @Min(0)
  bathrooms!: number;

  @IsOptional()
  @IsInt()
  @Min(1, { message: "Area must be a positive integer" })
  area_sqft?: number;

  /**
   * Monthly rent stored in paise (1 INR = 100 paise).
   * ₹18,000 = 1_800_000 paise.
   */
  @IsInt({ message: "monthly_rent_paise must be an integer (paise)" })
  @Min(1, { message: "Monthly rent must be positive" })
  monthly_rent_paise!: number;
}
