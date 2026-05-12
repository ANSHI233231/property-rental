import { IsInt, IsPositive } from "class-validator";
import { Type } from "class-transformer";

/**
 * DTO for POST /leases/:id/terminate-withdraw
 * M-04: typed class so ValidationPipe can strip/forbid extra fields.
 */
export class TerminationWithdrawDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  requestedByTenantId!: number;
}
