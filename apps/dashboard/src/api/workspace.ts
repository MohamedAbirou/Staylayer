import client from "./client";

export type WorkspaceSiteStatus = "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export type WorkspaceSiteType =
  | "VACATION_RENTAL"
  | "BOUTIQUE_HOTEL"
  | "BNB"
  | "GLAMPING"
  | "GUEST_HOUSE";

export type WorkspaceMemberRole = "OWNER" | "ADMIN" | "EDITOR" | "BILLING";

export interface WorkspaceSiteRecord {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  publicSubdomain: string | null;
  status: WorkspaceSiteStatus;
  primaryLocale: string;
  enabledLocales: string[];
  siteType: WorkspaceSiteType;
  createdAt: string;
}

export interface WorkspaceMemberRecord {
  id: string;
  tenantId: string;
  userId: string;
  email: string;
  role: WorkspaceMemberRole;
  isDefault: boolean;
  createdAt: string;
}

export interface WorkspaceInvitationRecord {
  id: string;
  email: string;
  role: WorkspaceMemberRole;
  status: "pending";
  createdAt: string;
  expiresAt: string;
  invitedByUserId: string | null;
  invitedByEmail: string | null;
}

export interface CreateWorkspaceSitePayload {
  name: string;
  slug?: string;
  publicSubdomain?: string;
  templateKey?: string;
  primaryLocale?: string;
  enabledLocales?: string[];
  siteType?: WorkspaceSiteType;
}

export interface InviteWorkspaceMemberPayload {
  email: string;
  role: WorkspaceMemberRole;
}

export type CreateWorkspaceMemberPayload = InviteWorkspaceMemberPayload;

export async function getWorkspaceSites(
  tenantId: string,
): Promise<WorkspaceSiteRecord[]> {
  const { data } = await client.get<WorkspaceSiteRecord[]>(
    `/tenants/${tenantId}/sites`,
  );
  return data;
}

export async function createWorkspaceSite(
  tenantId: string,
  payload: CreateWorkspaceSitePayload,
): Promise<WorkspaceSiteRecord> {
  const { data } = await client.post<WorkspaceSiteRecord>(
    `/tenants/${tenantId}/sites`,
    payload,
  );
  return data;
}

export async function deleteWorkspaceSite(
  tenantId: string,
  siteId: string,
): Promise<WorkspaceSiteRecord> {
  const { data } = await client.delete<WorkspaceSiteRecord>(
    `/tenants/${tenantId}/sites/${siteId}`,
  );
  return data;
}

export async function getWorkspaceMembers(
  tenantId: string,
): Promise<WorkspaceMemberRecord[]> {
  const { data } = await client.get<WorkspaceMemberRecord[]>(
    `/tenants/${tenantId}/members`,
  );
  return data;
}

export async function inviteWorkspaceMember(
  tenantId: string,
  payload: InviteWorkspaceMemberPayload,
): Promise<WorkspaceInvitationRecord> {
  const { data } = await client.post<WorkspaceInvitationRecord>(
    `/tenants/${tenantId}/members/invite`,
    payload,
  );
  return data;
}

export async function getPendingWorkspaceInvitations(
  tenantId: string,
): Promise<WorkspaceInvitationRecord[]> {
  const { data } = await client.get<WorkspaceInvitationRecord[]>(
    `/tenants/${tenantId}/members/invitations`,
  );
  return data;
}

export async function resendWorkspaceInvitation(
  tenantId: string,
  invitationId: string,
): Promise<WorkspaceInvitationRecord> {
  const { data } = await client.post<WorkspaceInvitationRecord>(
    `/tenants/${tenantId}/members/invitations/${invitationId}/resend`,
  );
  return data;
}

export async function revokeWorkspaceInvitation(
  tenantId: string,
  invitationId: string,
): Promise<WorkspaceInvitationRecord> {
  const { data } = await client.delete<WorkspaceInvitationRecord>(
    `/tenants/${tenantId}/members/invitations/${invitationId}`,
  );
  return data;
}

export async function createWorkspaceMember(
  tenantId: string,
  payload: CreateWorkspaceMemberPayload,
): Promise<WorkspaceMemberRecord> {
  const { data } = await client.post<WorkspaceMemberRecord>(
    `/tenants/${tenantId}/members/create`,
    payload,
  );
  return data;
}

export async function removeWorkspaceMember(
  tenantId: string,
  membershipId: string,
): Promise<WorkspaceMemberRecord> {
  const { data } = await client.delete<WorkspaceMemberRecord>(
    `/tenants/${tenantId}/members/${membershipId}`,
  );
  return data;
}

export async function updateWorkspaceMemberRole(
  tenantId: string,
  membershipId: string,
  role: WorkspaceMemberRole,
): Promise<WorkspaceMemberRecord> {
  const { data } = await client.patch<WorkspaceMemberRecord>(
    `/tenants/${tenantId}/members/${membershipId}/role`,
    { role },
  );
  return data;
}
