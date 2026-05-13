import { IsInt, Min, IsISO8601 } from "class-validator";
import { Transform } from "class-transformer";

/**
 * DTO for POST units/:unitId/rent-schedule
 *
 * newAmountPaise: positive integer (paise). BigInt-safe — accept as number from JSON.
 * effectiveDate:  ISO 8601 date string (YYYY-MM-DD). Must be >= today + 60 days (validated in service).
 */
export class CreateRentScheduleDto {
  @IsInt({ message: "newAmountPaise must be an integer (paise)" })
  @Min(1, { message: "newAmountPaise must be at least 1 paise" })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === "string") return parseInt(value, 10);
    return value;
  })
  newAmountPaise!: number;

  @IsISO8601({}, { message: "effectiveDate must be a valid ISO 8601 date (YYYY-MM-DD)" })
  effectiveDate!: string;
}
