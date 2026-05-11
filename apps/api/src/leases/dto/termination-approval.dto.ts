import { IsString, IsEnum, IsOptional } from "class-validator";

/**
 * DTO for POST /leases/:id/terminate-approve
 * BL-08 / BL-09: a co-tenant casts their APPROVED or REJECTED vote.
 */
export class TerminationApprovalDto {
  @IsString()
  tenantId!: string;

  @IsEnum(["APPROVED", "REJECTED"])
  decision!: "APPROVED" | "REJECTED";

  @IsOptional()
  @IsString()
  note?: string;
}
