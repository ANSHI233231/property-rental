import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";

/**
 * @Roles('ADMIN', 'PROPERTY_MANAGER') — declare which roles may access an endpoint.
 * Consumed by RolesGuard.
 */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
