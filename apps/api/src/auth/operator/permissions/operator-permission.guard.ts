import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { REQUIRE_OPERATOR_PERMISSIONS_KEY } from "./require-operator-permissions.decorator";
import {
  getPermissionsForRole,
  hasAllPermissions,
  type OperatorPermissionKey,
} from "./operator-permissions.registry";
import {
  OPERATOR_JWT_AUDIENCE,
  type OperatorAuthenticatedRequestUser,
} from "../operator-auth.types";

/**
 * Guard that enforces granular operator permissions declared via
 * `@RequireOperatorPermissions(...)`.
 *
 * MUST be chained AFTER `OperatorJwtAuthGuard` so that `req.user` is
 * populated with an `OperatorAuthenticatedRequestUser`. The guard:
 *
 *  1. Reads the required permission keys from method-level metadata, falling
 *     back to class-level metadata if the method does not declare any.
 *  2. Verifies the request is authenticated as an operator (defence-in-depth
 *     — the JWT guard already enforces this).
 *  3. Resolves the operator's permission bundle from the registry and checks
 *     that every required key is satisfied.
 *
 * If no permission metadata is present the guard is a no-op so it can safely
 * be applied globally to operator controllers. Auth endpoints that should
 * remain public (login/refresh/logout) simply omit the decorator.
 */
@Injectable()
export class OperatorPermissionGuard implements CanActivate {
  private readonly logger = new Logger(OperatorPermissionGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      OperatorPermissionKey[] | undefined
    >(REQUIRE_OPERATOR_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as OperatorAuthenticatedRequestUser | undefined;

    if (!user || user.aud !== OPERATOR_JWT_AUDIENCE) {
      throw new UnauthorizedException({
        code: "OPERATOR_UNAUTHENTICATED",
        message: "Operator authentication is required",
      });
    }

    const held = getPermissionsForRole(user.platformRole);

    if (!hasAllPermissions(held, required)) {
      this.logger.warn(
        JSON.stringify({
          event: "operator_permission_denied",
          actorUserId: user.id,
          platformRole: user.platformRole,
          required,
          method: request.method,
          path: request.originalUrl ?? request.url,
        }),
      );
      throw new ForbiddenException({
        code: "OPERATOR_PERMISSION_DENIED",
        message: "Operator permission denied",
        required,
      });
    }

    return true;
  }
}
