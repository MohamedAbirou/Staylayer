import type { AuthSession, MembershipRole, PlatformRole } from "./types";
import { PLATFORM_ROLES } from "./types";

export const CONTENT_MEMBERSHIP_ROLES = ["OWNER", "ADMIN", "EDITOR"] as const;
export const SITE_ADMIN_MEMBERSHIP_ROLES = ["OWNER", "ADMIN"] as const;
export const BILLING_MEMBERSHIP_ROLES = ["OWNER", "BILLING"] as const;

export function hasPlatformRole(
  session: AuthSession | null,
  roles: readonly PlatformRole[] = PLATFORM_ROLES,
): boolean {
  return (
    !!session?.user.platformRole && roles.includes(session.user.platformRole)
  );
}

export function hasMembershipRole(
  session: AuthSession | null,
  roles: readonly MembershipRole[],
): boolean {
  return (
    !!session?.activeMembershipRole &&
    roles.includes(session.activeMembershipRole)
  );
}

export function hasActiveSite(session: AuthSession | null): boolean {
  return !!session?.activeSite?.id;
}

export function canPublishContent(session: AuthSession | null): boolean {
  return hasMembershipRole(session, SITE_ADMIN_MEMBERSHIP_ROLES);
}

export function canPermanentlyDeleteContent(
  session: AuthSession | null,
): boolean {
  return hasMembershipRole(session, ["OWNER"]);
}

export function getDefaultAuthenticatedPath(
  session: AuthSession | null,
): string {
  if (hasMembershipRole(session, CONTENT_MEMBERSHIP_ROLES)) {
    if (
      !hasActiveSite(session) &&
      hasMembershipRole(session, SITE_ADMIN_MEMBERSHIP_ROLES)
    ) {
      return "/workspace";
    }

    return hasActiveSite(session) ? "/pages" : "/";
  }

  if (hasMembershipRole(session, BILLING_MEMBERSHIP_ROLES)) {
    return "/billing";
  }

  if (hasPlatformRole(session, PLATFORM_ROLES)) {
    return "/admin";
  }

  return "/login";
}

export function describePlatformRole(role: PlatformRole): string {
  const labels: Record<PlatformRole, string> = {
    PLATFORM_OWNER: "Platform owner",
    SUPPORT_ADMIN: "Support admin",
    FINANCE_ADMIN: "Finance admin",
  };

  return labels[role];
}

export function describeMembershipRole(role: MembershipRole): string {
  const labels: Record<MembershipRole, string> = {
    OWNER: "Owner",
    ADMIN: "Admin",
    EDITOR: "Editor",
    BILLING: "Billing",
  };

  return labels[role];
}
