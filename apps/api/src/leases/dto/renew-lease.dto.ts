import {
  IsString,
  IsNumber,
  IsInt,
  IsPositive,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  Matches,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * DTO for POST /leases/:id/renew
 * Creates a new lease; marks old lease status=RENEWED.
 * BL-02: rent fields on the OLD lease are immutable — the new values apply to the NEW lease.
 */
export class RenewLeaseDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "newEndDate must be YYYY-MM-DD" })
  newEndDate!: string;

  @IsOptional()
  @IsNumber()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  monthlyRentPaise?: number;

  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  securityDepositPaise?: number;

  /**
   * If provided, only these tenant IDs (Tenant.id numbers) are carried over to the new lease.
   * F-02: capped at 20 to prevent CPU-spike / array-bomb vector (VAPT phase-8).
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: "A maximum of 20 tenant IDs are allowed per renewal" })
  @IsInt({ each: true })
  @Type(() => Number)
  tenantIds?: number[];
}
