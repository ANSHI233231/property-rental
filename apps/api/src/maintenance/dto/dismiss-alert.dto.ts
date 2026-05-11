import { IsString, IsNotEmpty, IsOptional, MaxLength } from "class-validator";

/**
 * POST /maintenance-requests/dismiss-alert
 * BL-17: Admin or PM dismisses a maintenance frequency alert.
 */
export class DismissAlertDto {
  @IsString()
  @IsNotEmpty()
  alertId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}
