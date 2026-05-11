import {
  IsString,
  IsNotEmpty,
  IsEnum,
  MinLength,
  MaxLength,
} from "class-validator";

export enum MaintenancePriorityDto {
  LOW = "LOW",
  NORMAL = "NORMAL",
  HIGH = "HIGH",
  EMERGENCY = "EMERGENCY",
}

/**
 * POST /maintenance-requests
 * BL-14: description >= 30 chars (enforced here + DB CHECK).
 * BL-16: MAINTENANCE role blocked via @Roles + @RoleErrorCode at controller.
 */
export class CreateMaintenanceRequestDto {
  @IsString()
  @IsNotEmpty()
  unitId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120, { message: "title must not exceed 120 characters" })
  title!: string;

  /** BL-14: minimum 30 characters. */
  @IsString()
  @IsNotEmpty()
  @MinLength(30, { message: "description must be at least 30 characters (BL-14)" })
  @MaxLength(10_000, { message: "description must not exceed 10,000 characters" })
  description!: string;

  @IsEnum(MaintenancePriorityDto, { message: "priority must be LOW, NORMAL, HIGH, or EMERGENCY" })
  priority!: MaintenancePriorityDto;
}
