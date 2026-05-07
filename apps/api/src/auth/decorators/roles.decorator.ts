import { SetMetadata } from "@nestjs/common";
import { PlatformRole, TenantMembershipRole } from "@prisma/client";

export const PLATFORM_ROLES_KEY = "platformRoles";
export const MEMBERSHIP_ROLES_KEY = "membershipRoles";

export const PlatformRoles = (
  ...roles: PlatformRole[]
): ReturnType<typeof SetMetadata> => SetMetadata(PLATFORM_ROLES_KEY, roles);

export const MembershipRoles = (
  ...roles: TenantMembershipRole[]
): ReturnType<typeof SetMetadata> => SetMetadata(MEMBERSHIP_ROLES_KEY, roles);
