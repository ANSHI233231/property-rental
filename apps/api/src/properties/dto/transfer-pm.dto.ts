import { IsInt, IsString, IsOptional, MaxLength, Allow } from "class-validator";
import { Transform, Type } from "class-transformer";

/**
 * DTO for POST /properties/:id/transfer-pm.
 * Admin-only. Moves the property from one PROPERTY_MANAGER to another (or unassigns).
 * BL-19: the service validates toPmId is not already assigned elsewhere.
 * BL-20: logs the transfer in PropertyTransferLog + AuditLog.
 */
export class TransferPmDto {
  /**
   * New PM user ID (integer). Pass null to unassign the property (leave unmanaged).
   * The service validates: toPmId must be a PROPERTY_MANAGER role + is_active.
   * @Allow() permits any value (including null) — service enforces business logic.
   */
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) return null;
    const n = Number(value);
    return isNaN(n) ? null : n;
  })
  @Allow()
  toPmId!: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
