import { IsInt, IsPositive, IsIn, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";

/**
 * DTO for POST /leases/:id/terminate-approve
 * BL-08 / BL-09: a co-tenant casts their APPROVED (1) or REJECTED (2) vote.
 * decision: 1 = APPROVED, 2 = REJECTED
 */
export class TerminationApprovalDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  tenantId!: number;

  /** 1=APPROVED, 2=REJECTED */
  @IsInt()
  @IsIn([1, 2])
  @Type(() => Number)
  decision!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
