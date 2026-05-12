import { IsInt, IsPositive, IsNumber, Min, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";

/**
 * DTO for POST /deposit-refunds
 * One refund per lease (unique constraint in DB enforces idempotency).
 * Lease must be TERMINATED.
 */
export class DepositRefundDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  leaseId!: number;

  @IsNumber()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  amountPaise!: number;

  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  deductionsPaise?: number;

  @IsOptional()
  @IsString()
  deductionReason?: string;

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  paidToTenantId!: number;
}
