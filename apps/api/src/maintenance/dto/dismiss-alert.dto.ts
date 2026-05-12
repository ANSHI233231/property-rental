import { IsInt, IsPositive, IsString, IsOptional, MaxLength } from "class-validator";
import { Type } from "class-transformer";

/**
 * POST /maintenance-requests/dismiss-alert
 * BL-17: Admin or PM dismisses a maintenance frequency alert.
 */
export class DismissAlertDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  alertId!: number;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}
