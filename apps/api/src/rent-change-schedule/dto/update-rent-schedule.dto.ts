import { IsInt, Min, IsISO8601, IsOptional, ValidateIf } from "class-validator";
import { Transform } from "class-transformer";

/**
 * DTO for PATCH units/:unitId/rent-schedule (modify a PENDING schedule).
 *
 * Both fields are optional, but at least one must be present.
 * The "at least one" check is performed in the service (after DTO validation).
 */
export class UpdateRentScheduleDto {
  @IsOptional()
  @IsInt({ message: "newAmountPaise must be an integer (paise)" })
  @Min(1, { message: "newAmountPaise must be at least 1 paise" })
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return value;
    if (typeof value === "string") return parseInt(value, 10);
    return value;
  })
  newAmountPaise?: number;

  @IsOptional()
  @IsISO8601({}, { message: "effectiveDate must be a valid ISO 8601 date (YYYY-MM-DD)" })
  effectiveDate?: string;

  /**
   * Guard: at least one field must be provided.
   * This is a no-op validator that always returns true — the service checks the
   * semantic constraint after DTO passes. We keep it here as documentation.
   */
  @ValidateIf((o: UpdateRentScheduleDto) => o.newAmountPaise === undefined && o.effectiveDate === undefined)
  @IsInt({ message: "At least one of newAmountPaise or effectiveDate must be provided" })
  _atLeastOne?: never;
}
