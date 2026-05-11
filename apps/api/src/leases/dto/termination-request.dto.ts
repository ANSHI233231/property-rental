import { IsString, IsOptional, Matches } from "class-validator";

/**
 * DTO for POST /leases/:id/terminate-request
 * BL-08 / BL-09: creates approval rows for all co-tenants.
 */
export class TerminationRequestDto {
  @IsString()
  requestedByTenantId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "effectiveDate must be YYYY-MM-DD" })
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
