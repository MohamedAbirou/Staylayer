export const MEMBERSHIP_ROLES = [
  "OWNER",
  "ADMIN",
  "EDITOR",
  "BILLING",
] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export type TenantStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";
export type SiteStatus = "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export interface AuthUser {
  id: string;
  email: string;
}

export interface WorkspaceSite {
  id: string;
  slug: string;
  name: string;
  status: SiteStatus;
}

export interface WorkspaceMembership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantStatus: TenantStatus;
  role: MembershipRole;
  isDefault: boolean;
  sites: WorkspaceSite[];
}

export interface ActiveTenant {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
}

export interface ActiveSite {
  id: string;
  slug: string;
  name: string;
  status: SiteStatus;
}

export interface AuthSession {
  user: AuthUser;
  memberships: WorkspaceMembership[];
  activeTenant: ActiveTenant | null;
  activeSite: ActiveSite | null;
  activeMembershipRole: MembershipRole | null;
}

export interface AuthApiResponse extends AuthSession {
  accessToken: string;
}

export interface AuthContextRequest {
  tenantId?: string;
  siteId?: string;
}
