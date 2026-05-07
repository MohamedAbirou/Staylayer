import {
  PlatformRole,
  SiteStatus,
  TenantMembershipRole,
  TenantStatus,
} from "@prisma/client";

export interface AuthSiteSummary {
  id: string;
  slug: string;
  name: string;
  status: SiteStatus;
}

export interface AuthMembershipSummary {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantStatus: TenantStatus;
  role: TenantMembershipRole;
  isDefault: boolean;
  sites: AuthSiteSummary[];
}

export interface AuthenticatedUserProfile {
  id: string;
  email: string;
  platformRole: PlatformRole | null;
}

export interface ActiveTenantContext {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
}

export interface ActiveSiteContext {
  id: string;
  slug: string;
  name: string;
  status: SiteStatus;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthenticatedUserProfile;
  memberships: AuthMembershipSummary[];
  activeTenant: ActiveTenantContext | null;
  activeSite: ActiveSiteContext | null;
  activeMembershipRole: TenantMembershipRole | null;
}

export interface AuthContextRequest {
  tenantId?: string;
  siteId?: string;
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  platformRole: PlatformRole | null;
  activeTenantId: string | null;
  activeMembershipRole: TenantMembershipRole | null;
  activeSiteId: string | null;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
}

export interface AuthenticatedRequestUser extends JwtAccessPayload {}
