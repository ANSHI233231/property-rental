import { IsEnum } from "class-validator";

/**
 * DTO for PATCH /units/:id/state — explicit state transition endpoint.
 * BL-04 (lease-linked transitions) is partially enforced here in Phase 2;
 * full enforcement (checking for active leases) is completed in Phase 3.
 */
export enum UnitStateEnum {
  AVAILABLE = "AVAILABLE",
  LISTED = "LISTED",
  OCCUPIED = "OCCUPIED",
  MAINTENANCE = "MAINTENANCE",
}

export class UnitStateChangeDto {
  @IsEnum(UnitStateEnum, {
    message: "state must be one of: AVAILABLE, LISTED, OCCUPIED, MAINTENANCE",
  })
  state!: UnitStateEnum;
}
