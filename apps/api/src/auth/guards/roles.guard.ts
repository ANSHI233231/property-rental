import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { ROLE_ERROR_CODE_KEY } from "../decorators/role-error-code.decorator";
import type { JwtPayload } from "../jwt.service";

/**
 * RolesGuard — checks request.user.role against @Roles(...) metadata.
 * Must be applied AFTER JwtAuthGuard (which populates request.user).
 *
 * When the caller's role is not in the allowlist:
 *   - If the handler (or class) is annotated with @RoleErrorCode('BL_XX_...'),
 *     throws ForbiddenException with { error: { code, message } } so that
 *     CodeErrorFilter propagates the specific BL code to the FE error-mapper.
 *   - Otherwise, throws ForbiddenException('Insufficient role') which
 *     CodeErrorFilter converts to the generic FORBIDDEN code.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator — public or already guarded
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: JwtPayload }>();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      // Check for a BL-specific error code on the handler (wins) then the class.
      const blCode = this.reflector.getAllAndOverride<string | undefined>(ROLE_ERROR_CODE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (blCode) {
        throw new ForbiddenException({
          error: {
            code: blCode,
            message: "Your role is not permitted to perform this action.",
          },
        });
      }

      throw new ForbiddenException("Insufficient role");
    }

    return true;
  }
}
