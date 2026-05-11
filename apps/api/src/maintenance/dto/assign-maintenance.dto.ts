import { IsString, IsNotEmpty } from "class-validator";

/**
 * POST /maintenance-requests/:id/assign
 * Transitions OPEN → ASSIGNED.
 * @Roles: PROPERTY_MANAGER, ADMIN.
 */
export class AssignMaintenanceDto {
  @IsString()
  @IsNotEmpty()
  assigneeUserId!: string;
}
