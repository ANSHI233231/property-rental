import { IsInt, IsPositive } from "class-validator";
import { Type } from "class-transformer";

/**
 * POST /maintenance-requests/:id/assign
 * Transitions OPEN → ASSIGNED.
 * @Roles: PROPERTY_MANAGER, ADMIN.
 */
export class AssignMaintenanceDto {
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  assigneeUserId!: number;
}
