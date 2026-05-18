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

export interface ArchivedDomainAvailability {
  host: string;
  available: boolean;
}

export interface ArchivedWorkspaceSiteRecord extends WorkspaceSiteRecord {
  archivedAt: string | null;
  archivedSlug: string | null;
  archivedPublicSubdomain: string | null;
  archivedDomains: string[];
  archivedSlugAvailable: boolean;
  archivedPublicSubdomainAvailable: boolean | null;
  archivedDomainAvailability: ArchivedDomainAvailability[];
}

export interface RestoreWorkspaceSitePayload {
  slug?: string;
  publicSubdomain?: string | null;
  restoreDomains?: boolean;
}

export async function getArchivedWorkspaceSites(
  tenantId: string,
): Promise<ArchivedWorkspaceSiteRecord[]> {
  const { data } = await client.get<ArchivedWorkspaceSiteRecord[]>(
    `/tenants/${tenantId}/sites/archived`,
  );
  return data;
}

export async function restoreWorkspaceSite(
  tenantId: string,
  siteId: string,
  payload: RestoreWorkspaceSitePayload = {},
): Promise<WorkspaceSiteRecord> {
  const { data } = await client.post<WorkspaceSiteRecord>(
    `/tenants/${tenantId}/sites/${siteId}/restore`,
    payload,
  );
  return data;
}

export type SiteDeletionRiskFlag =
  | "HAS_SUBMISSIONS"
  | "HAS_PROVIDER_RESOURCES"
  | "HAS_ACTIVE_INTEGRATIONS"
  | "HAS_PUBLISHED_PAGES"
  | "HAS_CONNECTED_DOMAINS";

export interface SiteDeletionProviderResource {
  deploymentId: string;
  provider: string | null;
  providerProjectId: string | null;
  providerDeployId: string | null;
}

export interface SiteDeletionImpact {
  siteId: string;
  tenantId: string;
  name: string;
  archivedSlug: string | null;
  archivedPublicSubdomain: string | null;
  archivedDomains: string[];
  archivedAt: string | null;
  status: WorkspaceSiteStatus;
  counts: {
    pages: number;
    publishedPages: number;
    formDefinitions: number;
    formSubmissions: number;
    formDeliveries: number;
    connectedDomains: number;
    deployments: number;
    publishedRevisions: number;
    searchConsolePerformanceRows: number;
    bingPerformanceRows: number;
    psiAudits: number;
    cruxRecords: number;
    hreflangIssues: number;
    seoCrawlJobs: number;
    seoAuditRuns: number;
    seoAuditTasks: number;
    aiCitationAudits: number;
    translationJobs: number;
    translationUsageRows: number;
    redirects: number;
    notifications: number;
    auditLogs: number;
  };
  integrations: {
    searchConsoleConnected: boolean;
    bingConnected: boolean;
    scheduledAuditsEnabled: boolean;
  };
  providerResources: SiteDeletionProviderResource[];
  riskFlags: SiteDeletionRiskFlag[];
  blockingReasons: string[];
}

export interface PermanentDeleteSitePayload {
  confirmSiteName: string;
  acknowledgeSubmissions?: boolean;
  acknowledgeProviderResources?: boolean;
  acknowledgeIntegrations?: boolean;
  acknowledgePublishedPages?: boolean;
  acknowledgeConnectedDomains?: boolean;
}

export type SiteDeletionJobStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export interface SiteDeletionJobRecord {
  id: string;
  tenantId: string;
  siteId: string;
  siteName: string;
  archivedSlug: string | null;
  status: SiteDeletionJobStatus;
  progress: number;
  totalSteps: number;
  currentStep: string | null;
  requestedByUserId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getSiteDeletionImpact(
  tenantId: string,
  siteId: string,
): Promise<SiteDeletionImpact> {
  const { data } = await client.get<SiteDeletionImpact>(
    `/tenants/${tenantId}/sites/${siteId}/deletion-impact`,
  );
  return data;
}

export async function permanentlyDeleteWorkspaceSite(
  tenantId: string,
  siteId: string,
  payload: PermanentDeleteSitePayload,
): Promise<SiteDeletionJobRecord> {
  const { data } = await client.post<SiteDeletionJobRecord>(
    `/tenants/${tenantId}/sites/${siteId}/permanent-delete`,
    payload,
  );
  return data;
}

export async function getSiteDeletionJob(
  tenantId: string,
  jobId: string,
): Promise<SiteDeletionJobRecord> {
  const { data } = await client.get<SiteDeletionJobRecord>(
    `/tenants/${tenantId}/site-deletion-jobs/${jobId}`,
  );
  return data;
}

export async function listSiteDeletionJobs(
  tenantId: string,
): Promise<SiteDeletionJobRecord[]> {
  const { data } = await client.get<SiteDeletionJobRecord[]>(
    `/tenants/${tenantId}/site-deletion-jobs`,
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

export type DemotableWorkspaceRole = Exclude<WorkspaceMemberRole, "OWNER">;

export interface TransferWorkspaceOwnershipPayload {
  demoteSelfTo: DemotableWorkspaceRole;
  confirm: true;
}

export interface TransferWorkspaceOwnershipResult {
  promoted: WorkspaceMemberRecord;
  demoted: WorkspaceMemberRecord;
}

export async function transferWorkspaceOwnership(
  tenantId: string,
  membershipId: string,
  payload: TransferWorkspaceOwnershipPayload,
): Promise<TransferWorkspaceOwnershipResult> {
  const { data } = await client.post<TransferWorkspaceOwnershipResult>(
    `/tenants/${tenantId}/members/${membershipId}/transfer-ownership`,
    payload,
  );
  return data;
}
