import client from "./client";
import type { WorkspaceMemberRole } from "./workspace";

export type TenantStatusValue = "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export interface ProfileMembershipSummary {
  membershipId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantStatus: TenantStatusValue;
  role: WorkspaceMemberRole;
  isDefault: boolean;
  joinedAt: string;
  isFinalOwner: boolean;
  memberCount: number;
  ownerCount: number;
  activeSiteCount: number;
}

export interface ProfilePendingInvitationSummary {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: WorkspaceMemberRole;
  createdAt: string;
  expiresAt: string;
  invitedByEmail: string | null;
}

export interface ProfileOverview {
  id: string;
  email: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
  memberships: ProfileMembershipSummary[];
  pendingInvitations: ProfilePendingInvitationSummary[];
}

export interface CreateWorkspacePayload {
  name: string;
  slug?: string;
}

export interface CreatedWorkspaceSummary {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  membershipId: string;
  role: WorkspaceMemberRole;
  isDefault: boolean;
  joinedAt: string;
}

export interface DeletionImpactWorkspaceEntry {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: WorkspaceMemberRole;
  isFinalOwner: boolean;
  ownerCount: number;
  memberCount: number;
}

export interface AccountDeletionImpact {
  email: string;
  blocked: boolean;
  blockingReasons: string[];
  workspaces: DeletionImpactWorkspaceEntry[];
  finalOwnerWorkspaces: DeletionImpactWorkspaceEntry[];
  pendingSentInvitations: number;
  assignedSeoAuditTasks: number;
}

export async function getProfileOverview(): Promise<ProfileOverview> {
  const { data } = await client.get<ProfileOverview>("/me");
  return data;
}

export async function createWorkspace(
  payload: CreateWorkspacePayload,
): Promise<CreatedWorkspaceSummary> {
  const { data } = await client.post<CreatedWorkspaceSummary>(
    "/me/workspaces",
    payload,
  );
  return data;
}

export async function changeProfilePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ changedAt: string }> {
  const { data } = await client.post<{ changedAt: string }>(
    "/me/password",
    payload,
  );
  return data;
}

export async function setDefaultMembership(
  tenantId: string,
): Promise<ProfileMembershipSummary> {
  const { data } = await client.put<ProfileMembershipSummary>(
    `/me/memberships/${tenantId}/default`,
  );
  return data;
}

export async function leaveWorkspace(payload: {
  tenantId: string;
  confirmTenantSlug: string;
}): Promise<{ tenantId: string; tenantName: string }> {
  const { data } = await client.post<{ tenantId: string; tenantName: string }>(
    `/me/memberships/${payload.tenantId}/leave`,
    { confirmTenantSlug: payload.confirmTenantSlug },
  );
  return data;
}

export async function getAccountDeletionImpact(): Promise<AccountDeletionImpact> {
  const { data } = await client.get<AccountDeletionImpact>(
    "/me/account-deletion-impact",
  );
  return data;
}

export async function deleteOwnAccount(payload: {
  confirmEmail: string;
  currentPassword: string;
}): Promise<{ deletedUserId: string; email: string }> {
  const { data } = await client.delete<{
    deletedUserId: string;
    email: string;
  }>("/me", { data: payload });
  return data;
}
