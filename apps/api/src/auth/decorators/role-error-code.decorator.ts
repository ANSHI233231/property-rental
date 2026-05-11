import { SetMetadata } from '@nestjs/common';

/**
 * @RoleErrorCode tags an endpoint with the BL/business-rule error code that
 * RolesGuard should emit when the caller's role isn't in the @Roles allowlist.
 *
 * Without this decorator, RolesGuard throws ForbiddenException with the generic
 * status-derived 'FORBIDDEN' code. With it, the wire response includes the
 * specific code the FE error-mapper recognizes.
 *
 * Example:
 *   @Roles('PROPERTY_MANAGER', 'ADMIN')
 *   @RoleErrorCode('BL_10_TENANT_CANNOT_RECORD_PAYMENT')
 *   @Post('payments')
 *   async record(...) { ... }
 */
export const ROLE_ERROR_CODE_KEY = 'role_error_code';
export const RoleErrorCode = (code: string): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLE_ERROR_CODE_KEY, code);
