import { Type } from "class-transformer";
import {
  IsString,
  IsNumber,
  IsInt,
  IsPositive,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  Matches,
} from "class-validator";
import { TenantInputDto } from "./tenant-input.dto";

/**
 * DTO for POST /properties/:propertyId/units/:unitId/leases
 * BL-07: tenants array must have at least one entry.
 */
export class CreateLeaseDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "startDate must be YYYY-MM-DD" })
  startDate!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "endDate must be YYYY-MM-DD" })
  endDate!: string;

  @IsNumber()
  @IsInt()
  @IsPositive()
  monthlyRentPaise!: number;

  @IsNumber()
  @IsInt()
  securityDepositPaise!: number;

  /**
   * BL-07: at least one tenant required.
   * F-02: capped at 20 to prevent CPU-spike / array-bomb vector (VAPT phase-8).
   * 20 co-tenants exceeds any realistic single-unit occupancy scenario.
   */
  @IsArray()
  @ArrayMinSize(1, { message: "At least one tenant is required (BL-07)" })
  @ArrayMaxSize(20, { message: "A maximum of 20 tenants are allowed per lease" })
  @ValidateNested({ each: true })
  @Type(() => TenantInputDto)
  tenants!: TenantInputDto[];
}
