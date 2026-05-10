import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsInt,
  IsOptional,
  Min,
} from "class-validator";

/**
 * DTO for PATCH /units/:id — metadata update (not state, not retirement).
 *
 * If monthly_rent_paise is included, the service enforces BL-03:
 * rent can only be changed when unit state ∈ {AVAILABLE, LISTED}.
 * It is rejected (409 UNIT_RENT_LOCKED) if state = OCCUPIED or MAINTENANCE.
 */
export class UpdateUnitDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit_number?: string;

  @IsOptional()
  @IsInt()
  floor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bedrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bathrooms?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  area_sqft?: number;

  /**
   * BL-03: change is rejected if unit state ∈ {OCCUPIED, MAINTENANCE}.
   * Stored in paise.
   */
  @IsOptional()
  @IsInt({ message: "monthly_rent_paise must be an integer (paise)" })
  @Min(1)
  monthly_rent_paise?: number;
}
