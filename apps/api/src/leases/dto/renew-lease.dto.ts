import {
  IsString,
  IsNumber,
  IsInt,
  IsPositive,
  IsOptional,
  IsArray,
  Matches,
  Min,
} from "class-validator";

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
  monthlyRentPaise?: number;

  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(0)
  securityDepositPaise?: number;

  /** If provided, only these tenant IDs are carried over to the new lease. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tenantIds?: string[];
}
