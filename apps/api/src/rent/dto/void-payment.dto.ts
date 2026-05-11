import { IsString, MinLength, MaxLength } from "class-validator";

/**
 * POST /payments/:id/void
 * Requires a non-trivial reason so voids are auditable.
 */
export class VoidPaymentDto {
  @IsString()
  @MinLength(5, { message: "reason must be at least 5 characters" })
  @MaxLength(1000)
  reason!: string;
}
