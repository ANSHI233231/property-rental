import { IsInt, IsPositive, IsString, IsOptional, MaxLength, Matches } from "class-validator";
import { Type } from "class-transformer";

/**
 * DTO for POST /leases/:id/terminate-request
 * BL-08 / BL-09: creates approval rows for all co-tenants.
 */
export class TerminationRequestDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  requestedByTenantId!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "effectiveDate must be YYYY-MM-DD" })
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "reason must not exceed 2000 characters" })
  reason?: string;
}
