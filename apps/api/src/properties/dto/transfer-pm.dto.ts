import { IsString, IsOptional, MaxLength, Allow } from "class-validator";
import { Transform } from "class-transformer";

/**
 * DTO for POST /properties/:id/transfer-pm.
 * Admin-only. Moves the property from one PROPERTY_MANAGER to another (or unassigns).
 * BL-19: the service validates toPmId is not already assigned elsewhere.
 * BL-20: logs the transfer in PropertyTransferLog + AuditLog.
 */
export class TransferPmDto {
  /**
   * New PM user ID. Pass null to unassign the property (leave unmanaged).
   * The service validates: toPmId must be a PROPERTY_MANAGER role + is_active.
   * @Allow() permits any value (including null) — service enforces business logic.
   */
  @Transform(({ value }: { value: unknown }) => value === undefined ? null : value)
  @Allow()
  toPmId!: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
