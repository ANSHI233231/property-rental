import { IsString } from "class-validator";

/**
 * DTO for POST /leases/:id/terminate-withdraw
 * M-04: typed class so ValidationPipe can strip/forbid extra fields.
 */
export class TerminationWithdrawDto {
  @IsString()
  requestedByTenantId!: string;
}
