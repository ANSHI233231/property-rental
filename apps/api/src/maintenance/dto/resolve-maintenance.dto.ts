import { IsString, IsNotEmpty, MinLength, MaxLength } from "class-validator";

/**
 * POST /maintenance-requests/:id/resolve
 * BL-14: resolutionNotes >= 20 chars (enforced here + DB CHECK).
 * Transitions IN_PROGRESS → RESOLVED.
 */
export class ResolveMaintenanceDto {
  /** BL-14: minimum 20 characters. */
  @IsString()
  @IsNotEmpty()
  @MinLength(20, { message: "resolutionNotes must be at least 20 characters (BL-14)" })
  @MaxLength(5_000, { message: "resolutionNotes must not exceed 5,000 characters" })
  resolutionNotes!: string;
}
