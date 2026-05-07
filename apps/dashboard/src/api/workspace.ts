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

export interface CreateWorkspaceSitePayload {
  name: string;
  slug?: string;
  templateKey?: string;
  primaryLocale?: string;
  enabledLocales?: string[];
  siteType?: WorkspaceSiteType;
}

export interface InviteWorkspaceMemberPayload {
  email: string;
  role: WorkspaceMemberRole;
}

export interface CreateWorkspaceMemberPayload extends InviteWorkspaceMemberPayload {
  password: string;
}

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
): Promise<WorkspaceMemberRecord> {
  const { data } = await client.post<WorkspaceMemberRecord>(
    `/tenants/${tenantId}/members/invite`,
    payload,
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
