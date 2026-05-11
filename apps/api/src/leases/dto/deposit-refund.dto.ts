import { IsString, IsNumber, IsInt, Min, IsOptional } from "class-validator";

/**
 * DTO for POST /deposit-refunds
 * One refund per lease (unique constraint in DB enforces idempotency).
 * Lease must be TERMINATED.
 */
export class DepositRefundDto {
  @IsString()
  leaseId!: string;

  @IsNumber()
  @IsInt()
  @Min(0)
  amountPaise!: number;

  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(0)
  deductionsPaise?: number;

  @IsOptional()
  @IsString()
  deductionReason?: string;

  @IsString()
  paidToTenantId!: string;
}
