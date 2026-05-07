import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PlatformRole, TenantMembershipRole } from "@prisma/client";
import {
  MEMBERSHIP_ROLES_KEY,
  PLATFORM_ROLES_KEY,
} from "../decorators/roles.decorator";
import { AuthenticatedRequestUser } from "../auth.types";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPlatformRoles = this.reflector.getAllAndOverride<
      PlatformRole[]
    >(PLATFORM_ROLES_KEY, [context.getHandler(), context.getClass()]);
    const requiredMembershipRoles = this.reflector.getAllAndOverride<
      TenantMembershipRole[]
    >(MEMBERSHIP_ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (
      (!requiredPlatformRoles || requiredPlatformRoles.length === 0) &&
      (!requiredMembershipRoles || requiredMembershipRoles.length === 0)
    ) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedRequestUser | undefined;

    if (!user) {
      return false;
    }

    if (
      requiredPlatformRoles &&
      requiredPlatformRoles.length > 0 &&
      (!user.platformRole || !requiredPlatformRoles.includes(user.platformRole))
    ) {
      return false;
    }

    if (
      requiredMembershipRoles &&
      requiredMembershipRoles.length > 0 &&
      (!user.activeMembershipRole ||
        !requiredMembershipRoles.includes(user.activeMembershipRole))
    ) {
      return false;
    }

    return true;
  }
}
