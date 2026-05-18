// Operator console API client — Phase 4 read endpoints.
//
// All endpoints are mounted under `/operator/*` on the API and require a
// valid operator JWT (handled transparently by `./client.ts`). Response
// types mirror the shape exported by
// `apps/api/src/operator-resources/operator-resources.service.ts` and the
// admin service. We keep the types here (rather than importing from the
// API package) so the operator console stays decoupled from the NestJS
// build and so we can ship the SPA independently.

import { client } from "./client";

// ─── Shared scalar types ───────────────────────────────────────────────

export type TenantStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";
export type SiteStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "SUSPENDED"
  | "ARCHIVED"
  | "DELETING";
export type DomainStatus =
  | "PENDING_VERIFICATION"
  | "SSL_PROVISIONING"
  | "ACTIVE"
  | "FAILED"
  | "INACTIVE";
export type DeploymentStatus =
  | "PENDING"
  | "BUILDING"
  | "READY"
  | "FAILED"
  | "CANCELED";
export type SubscriptionStatus =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELED"
  | "INACTIVE"
  | "INCOMPLETE"
  | "INCOMPLETE_EXPIRED"
  | "UNPAID";
export type BillingPublicStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "inactive";
export type OperationalAlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type OperationalAlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type PlatformRole = "PLATFORM_OWNER" | "SUPPORT_ADMIN" | "FINANCE_ADMIN";

// ─── Overview ──────────────────────────────────────────────────────────

export interface OperatorOverviewResponse {
  generatedAt: string;
  scorecards: {
    tenants: {
      total: number;
      active: number;
      suspended: number;
      archived: number;
      newLast30Days: number;
    };
    billing: {
      active: number;
      trialing: number;
      pastDue: number;
      canceled: number;
      inactive: number;
    };
    deployments: {
      liveSites: number;
      buildingSites: number;
      failedSites: number;
      pendingSites: number;
      unprovisionedSites: number;
      liveRate: number;
    };
    domains: {
      activeDomains: number;
      pendingDomains: number;
      failedDomains: number;
      sslProvisioningDomains: number;
      sitesMissingPrimaryDomain: number;
    };
    operations: {
      openAlerts: number;
      criticalAlerts: number;
      submissionsLast30Days: number;
      failedDeliveriesLast30Days: number;
    };
  };
  planMix: Array<{
    planKey: string;
    planName: string;
    tenantCount: number;
    activeCount: number;
    trialCount: number;
    attentionCount: number;
  }>;
  tenantHealth: Array<{
    tenantId: string;
    tenantName: string;
    tenantStatus: TenantStatus;
    planName: string;
    billingStatus: BillingPublicStatus;
    healthScore: number;
    siteCount: number;
    liveSites: number;
    failedSites: number;
    sitesMissingPrimaryDomain: number;
    openAlerts: number;
    reasons: string[];
  }>;
  queues: {
    billingAttention: Array<{
      tenantId: string;
      tenantName: string;
      planName: string;
      billingStatus: BillingPublicStatus;
      renewsAt: string | null;
      reason: string;
    }>;
    deploymentFailures: Array<{
      deploymentId: string;
      tenantId: string;
      tenantName: string;
      siteId: string;
      siteName: string;
      status: DeploymentStatus;
      errorMessage: string | null;
      updatedAt: string;
    }>;
    domainIssues: Array<{
      domainId: string;
      tenantId: string;
      tenantName: string;
      siteId: string;
      siteName: string;
      hostname: string;
      status: DomainStatus;
      lastError: string | null;
      lastCheckedAt: string | null;
    }>;
    formAlerts: Array<{
      tenantId: string;
      tenantName: string;
      siteId: string;
      siteName: string;
      critical: boolean;
      alertTypes: string[];
      messages: string[];
      lastTriggeredAt: string | null;
    }>;
    recentAudit: Array<{
      id: string;
      actorId: string;
      actorEmail: string;
      action: string;
      targetType: string | null;
      targetId: string | null;
      meta: Record<string, unknown> | null;
      createdAt: string;
    }>;
  };
}

// ─── Tenants list ──────────────────────────────────────────────────────

export interface TenantListItem {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  planKey: string | null;
  siteCount: number;
  memberCount: number;
  createdAt: string;
}

export interface TenantListResponse {
  data: TenantListItem[];
  total: number;
  page: number;
  limit: number;
  searchTerm?: string;
}

// ─── Tenant detail (360) ───────────────────────────────────────────────

export interface TenantDetailResponse {
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
    createdAt: string;
    updatedAt: string;
    memberCount: number;
    siteCount: number;
    openAlerts: number;
  };
  members: Array<{
    id: string;
    role: string;
    isDefault: boolean;
    joinedAt: string;
    user: { id: string; email: string; name: string | null };
  }>;
  sites: Array<{
    id: string;
    name: string;
    slug: string;
    status: SiteStatus;
    publicSubdomain: string | null;
    primaryLocale: string | null;
    createdAt: string;
    updatedAt: string;
    domainCount: number;
    pageCount: number;
    primaryDomain: string | null;
    latestDeployment: {
      id: string;
      status: DeploymentStatus;
      url: string | null;
      createdAt: string;
      updatedAt: string;
    } | null;
    openAlerts: number;
  }>;
  subscriptions: Array<{
    id: string;
    provider: string;
    planKey: string | null;
    status: SubscriptionStatus;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    pendingPlanKey: string | null;
    pendingPlanEffectiveAt: string | null;
    gracePeriodEndsAt: string | null;
    updatedAt: string;
  }>;
  audit: AuditFeedEntry[];
  generatedAt: string;
}

// ─── Site detail (360) ─────────────────────────────────────────────────

export interface SiteDetailResponse {
  site: {
    id: string;
    name: string;
    slug: string;
    status: SiteStatus;
    publicSubdomain: string | null;
    primaryLocale: string | null;
    enabledLocales: string[];
    siteType: string;
    templateKey: string | null;
    publishedRevision: string | null;
    createdAt: string;
    updatedAt: string;
    archivedAt: string | null;
    counts: {
      pages: number;
      domains: number;
      formDefinitions: number;
      formSubmissions: number;
      redirects: number;
    };
    recentSubmissions30d: number;
    recentDeliveryFailures30d: number;
  };
  tenant: { id: string; slug: string; name: string; status: TenantStatus };
  domains: Array<{
    id: string;
    host: string;
    status: DomainStatus;
    isPrimary: boolean;
    verifiedAt: string | null;
    lastCheckedAt: string | null;
    lastError: string | null;
  }>;
  deployments: Array<{
    id: string;
    status: DeploymentStatus;
    provider: string | null;
    url: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  alerts: Array<{
    id: string;
    type: string;
    severity: OperationalAlertSeverity;
    status: OperationalAlertStatus;
    message: string;
    firstTriggeredAt: string;
    lastTriggeredAt: string;
  }>;
  audit: AuditFeedEntry[];
  generatedAt: string;
}

// ─── Audit feed ────────────────────────────────────────────────────────

export type AuditScope = "all" | "support" | "billing";

export type AuditFeedEntry =
  | {
      kind: "operator";
      id: string;
      requestId: string | null;
      action: string;
      actorId: string | null;
      actorEmail: string;
      actorRole: string | null;
      targetType: string | null;
      targetId: string | null;
      tenantId: string | null;
      siteId: string | null;
      method: string | null;
      path: string | null;
      statusCode: number | null;
      durationMs: number | null;
      sensitive: boolean;
      reason: string | null;
      createdAt: string;
    }
  | {
      kind: "legacy";
      id: string;
      requestId: null;
      action: string;
      actorId: string | null;
      actorEmail: string;
      actorRole: null;
      targetType: string | null;
      targetId: string | null;
      tenantId: string | null;
      siteId: string | null;
      method: null;
      path: null;
      statusCode: null;
      durationMs: null;
      sensitive: false;
      reason: null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
    };

export interface AuditFeedResponse {
  data: AuditFeedEntry[];
  total: number;
  page: number;
  limit: number;
  scope: AuditScope;
  generatedAt: string;
}

// ─── Global search ─────────────────────────────────────────────────────

export interface GlobalSearchResponse {
  query: string;
  tenants: Array<{
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
    siteCount: number;
  }>;
  sites: Array<{
    id: string;
    name: string;
    slug: string;
    status: SiteStatus;
    publicSubdomain: string | null;
    tenant: { id: string; slug: string; name: string };
  }>;
  domains: Array<{
    id: string;
    host: string;
    status: DomainStatus;
    isPrimary: boolean;
    site: {
      id: string;
      name: string;
      slug: string;
      tenant: { id: string; slug: string; name: string };
    };
  }>;
  users: Array<{
    id: string;
    email: string;
    platformRole: PlatformRole | null;
  }>;
  generatedAt: string;
}

// ─── Endpoints ─────────────────────────────────────────────────────────

export interface OverviewVariantOptions {
  /** Optional override of the variant to fetch. Defaults to the broadest the
   *  operator can read; callers normally let the SPA pick automatically. */
  variant?: "all" | "support" | "billing";
}

export async function fetchOverview(
  options: OverviewVariantOptions = {},
): Promise<OperatorOverviewResponse> {
  const path =
    !options.variant || options.variant === "all"
      ? "/operator/overview"
      : `/operator/overview/${options.variant}`;
  const res = await client.get<OperatorOverviewResponse>(path);
  return res.data;
}

export interface FetchTenantsParams {
  status?: TenantStatus;
  q?: string;
  page?: number;
  limit?: number;
}

export async function fetchTenants(
  params: FetchTenantsParams = {},
): Promise<TenantListResponse> {
  const res = await client.get<TenantListResponse>("/operator/tenants", {
    params,
  });
  return res.data;
}

export async function fetchTenantDetail(
  tenantId: string,
  options: { variant?: "all" | "billing" } = {},
): Promise<TenantDetailResponse> {
  const suffix = options.variant === "billing" ? "/billing" : "";
  const res = await client.get<TenantDetailResponse>(
    `/operator/tenants/${encodeURIComponent(tenantId)}${suffix}`,
  );
  return res.data;
}

export async function fetchSiteDetail(
  siteId: string,
): Promise<SiteDetailResponse> {
  const res = await client.get<SiteDetailResponse>(
    `/operator/sites/${encodeURIComponent(siteId)}`,
  );
  return res.data;
}

export interface FetchAuditParams {
  scope?: AuditScope;
  action?: string;
  tenantId?: string;
  siteId?: string;
  actorUserId?: string;
  page?: number;
  limit?: number;
}

export async function fetchAudit(
  params: FetchAuditParams = {},
): Promise<AuditFeedResponse> {
  const res = await client.get<AuditFeedResponse>("/operator/audit", {
    params,
  });
  return res.data;
}

export async function fetchGlobalSearch(
  q: string,
  limit = 10,
): Promise<GlobalSearchResponse> {
  const res = await client.get<GlobalSearchResponse>("/operator/search", {
    params: { q, limit },
  });
  return res.data;
}

// ─── Support cases (Phase 6 UI) ────────────────────────────────────────
//
// Types mirror `apps/api/src/support-cases/support-cases.service.ts` (see
// `formatListRow` / `formatDetail`). Dates are ISO strings.

export type SupportCaseStatus =
  | "OPEN"
  | "PENDING_CUSTOMER"
  | "PENDING_INTERNAL"
  | "RESOLVED"
  | "CLOSED";
export type SupportCaseActiveStatus =
  | "OPEN"
  | "PENDING_CUSTOMER"
  | "PENDING_INTERNAL";
export type SupportCasePriority = "URGENT" | "HIGH" | "NORMAL" | "LOW";
export type SupportCaseCategory =
  | "BILLING"
  | "DEPLOYMENT"
  | "DOMAIN"
  | "FORMS"
  | "SEO"
  | "TRANSLATION"
  | "ACCESS"
  | "CONTENT"
  | "ACCOUNT"
  | "OTHER";
export type SupportCaseChannel =
  | "MANUAL"
  | "EMAIL"
  | "CUSTOMER_WORKSPACE"
  | "SYSTEM_ALERT"
  | "BILLING"
  | "WEBHOOK";
export type SupportCaseScope = "all" | "billing";
export type SupportLinkedResourceType =
  | "TENANT"
  | "SITE"
  | "DEPLOYMENT"
  | "DOMAIN"
  | "FORM_DEFINITION"
  | "FORM_SUBMISSION"
  | "SUBSCRIPTION"
  | "OPERATIONAL_ALERT"
  | "USER";
export type SupportHandoffTarget = "BILLING" | "PLATFORM_OWNER" | "SUPPORT";
export type SupportHandoffStatus = "OPEN" | "ACKNOWLEDGED" | "CLOSED";
export type SupportCaseEventType =
  | "CREATED"
  | "STATUS_CHANGED"
  | "PRIORITY_CHANGED"
  | "CATEGORY_CHANGED"
  | "ASSIGNMENT_CHANGED"
  | "TAGS_UPDATED"
  | "MESSAGE_ADDED"
  | "NOTE_ADDED"
  | "RESOURCE_LINKED"
  | "RESOURCE_UNLINKED"
  | "HANDOFF_OPENED"
  | "HANDOFF_ACKNOWLEDGED"
  | "HANDOFF_CLOSED"
  | "RESOLVED"
  | "REOPENED"
  | "CLOSED"
  | "SLA_BREACHED";

export interface SupportCaseListItem {
  id: string;
  number: number;
  tenantId: string;
  siteId: string | null;
  subject: string;
  status: SupportCaseStatus;
  priority: SupportCasePriority;
  category: SupportCaseCategory;
  channel: SupportCaseChannel;
  tags: string[];
  assignedOperatorId: string | null;
  requesterEmail: string | null;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  slaBreachedFirstResponse: boolean;
  slaBreachedResolution: boolean;
  lastActivityAt: string;
  createdAt: string;
  tenant: { id: string; slug: string; name: string };
  site: { id: string; slug: string; name: string } | null;
  assignedOperator: { id: string; email: string } | null;
}

export interface SupportCasesListResponse {
  data: SupportCaseListItem[];
  total: number;
  page: number;
  limit: number;
  scope: SupportCaseScope;
}

export interface SupportCaseQueueSummary {
  scope: SupportCaseScope;
  total: number;
  assignedToMe: number;
  unassigned: number;
  slaBreachedFirstResponse: number;
  slaBreachedResolution: number;
  byStatus: Record<SupportCaseStatus, number>;
  byPriority: Record<SupportCasePriority, number>;
}

export interface SupportCaseMessage {
  id: string;
  body: string;
  authorIsOperator: boolean;
  authorUserId: string | null;
  createdAt: string;
  author: { id: string; email: string } | null;
}

export interface SupportCaseNote {
  id: string;
  body: string;
  authorUserId: string | null;
  createdAt: string;
  author: { id: string; email: string } | null;
}

export interface SupportCaseEvent {
  id: string;
  type: SupportCaseEventType;
  actorUserId: string | null;
  fromValue: string | null;
  toValue: string | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; email: string } | null;
}

export interface SupportCaseAssignmentEntry {
  id: string;
  fromUserId: string | null;
  toUserId: string | null;
  changedByUserId: string;
  reason: string | null;
  createdAt: string;
}

export interface SupportCaseLinkedResourceEntry {
  id: string;
  resourceType: SupportLinkedResourceType;
  resourceId: string;
  label: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface SupportCaseHandoffEntry {
  id: string;
  target: SupportHandoffTarget;
  status: SupportHandoffStatus;
  reason: string | null;
  openedByUserId: string;
  closedByUserId: string | null;
  acknowledgedAt: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface SupportCaseDetail extends SupportCaseListItem {
  requesterUserId: string | null;
  createdByOperatorId: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  metadata: Record<string, unknown> | null;
  updatedAt: string;
  createdByOperator: { id: string; email: string } | null;
  requesterUser: { id: string; email: string } | null;
  messages: SupportCaseMessage[];
  notes: SupportCaseNote[];
  events: SupportCaseEvent[];
  assignments: SupportCaseAssignmentEntry[];
  linkedResources: SupportCaseLinkedResourceEntry[];
  handoffs: SupportCaseHandoffEntry[];
}

export interface FetchSupportCasesParams {
  status?: SupportCaseStatus[];
  priority?: SupportCasePriority[];
  category?: SupportCaseCategory[];
  assignedOperatorId?: string;
  unassigned?: boolean;
  slaBreached?: boolean;
  tenantId?: string;
  siteId?: string;
  tag?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export async function fetchSupportCases(
  params: FetchSupportCasesParams = {},
): Promise<SupportCasesListResponse> {
  const res = await client.get<SupportCasesListResponse>(
    "/operator/support-cases",
    { params },
  );
  return res.data;
}

export async function fetchSupportQueueSummary(): Promise<SupportCaseQueueSummary> {
  const res = await client.get<SupportCaseQueueSummary>(
    "/operator/support-cases/queues/summary",
  );
  return res.data;
}

export async function fetchSupportCase(
  caseId: string,
): Promise<SupportCaseDetail> {
  const res = await client.get<SupportCaseDetail>(
    `/operator/support-cases/${encodeURIComponent(caseId)}`,
  );
  return res.data;
}

export interface CreateSupportCaseInput {
  tenantId: string;
  siteId?: string;
  requesterUserId?: string;
  requesterEmail?: string;
  subject: string;
  initialMessage?: string;
  channel?: SupportCaseChannel;
  priority?: SupportCasePriority;
  category?: SupportCaseCategory;
  tags?: string[];
  assignedOperatorId?: string;
  reason?: string;
}

export async function createSupportCase(
  input: CreateSupportCaseInput,
): Promise<SupportCaseDetail> {
  const res = await client.post<SupportCaseDetail>(
    "/operator/support-cases",
    input,
  );
  return res.data;
}

export interface UpdateSupportCaseInput {
  priority?: SupportCasePriority;
  category?: SupportCaseCategory;
  tags?: string[];
  reason?: string;
}

export async function updateSupportCase(
  caseId: string,
  input: UpdateSupportCaseInput,
): Promise<SupportCaseDetail> {
  const res = await client.patch<SupportCaseDetail>(
    `/operator/support-cases/${encodeURIComponent(caseId)}`,
    input,
  );
  return res.data;
}

export async function assignSupportCase(
  caseId: string,
  body: { assigneeUserId: string | null; reason: string },
): Promise<SupportCaseDetail> {
  const res = await client.post<SupportCaseDetail>(
    `/operator/support-cases/${encodeURIComponent(caseId)}/assign`,
    body,
  );
  return res.data;
}

export async function setSupportCaseStatus(
  caseId: string,
  body: { status: SupportCaseActiveStatus; reason?: string },
): Promise<SupportCaseDetail> {
  const res = await client.post<SupportCaseDetail>(
    `/operator/support-cases/${encodeURIComponent(caseId)}/status`,
    body,
  );
  return res.data;
}

export async function resolveSupportCase(
  caseId: string,
  body: { reason: string; closingMessage?: string },
): Promise<SupportCaseDetail> {
  const res = await client.post<SupportCaseDetail>(
    `/operator/support-cases/${encodeURIComponent(caseId)}/resolve`,
    body,
  );
  return res.data;
}

export async function reopenSupportCase(
  caseId: string,
  body: { reason: string },
): Promise<SupportCaseDetail> {
  const res = await client.post<SupportCaseDetail>(
    `/operator/support-cases/${encodeURIComponent(caseId)}/reopen`,
    body,
  );
  return res.data;
}

export async function closeSupportCase(
  caseId: string,
  body: { reason: string },
): Promise<SupportCaseDetail> {
  const res = await client.post<SupportCaseDetail>(
    `/operator/support-cases/${encodeURIComponent(caseId)}/close`,
    body,
  );
  return res.data;
}

export async function addSupportCaseMessage(
  caseId: string,
  body: { body: string },
): Promise<SupportCaseDetail> {
  const res = await client.post<SupportCaseDetail>(
    `/operator/support-cases/${encodeURIComponent(caseId)}/messages`,
    body,
  );
  return res.data;
}

export async function addSupportCaseNote(
  caseId: string,
  body: { body: string },
): Promise<SupportCaseDetail> {
  const res = await client.post<SupportCaseDetail>(
    `/operator/support-cases/${encodeURIComponent(caseId)}/notes`,
    body,
  );
  return res.data;
}

export async function linkSupportCaseResource(
  caseId: string,
  body: {
    resourceType: SupportLinkedResourceType;
    resourceId: string;
    label?: string;
  },
): Promise<SupportCaseDetail> {
  const res = await client.post<SupportCaseDetail>(
    `/operator/support-cases/${encodeURIComponent(caseId)}/resources`,
    body,
  );
  return res.data;
}

export async function unlinkSupportCaseResource(
  caseId: string,
  linkId: string,
): Promise<SupportCaseDetail> {
  const res = await client.delete<SupportCaseDetail>(
    `/operator/support-cases/${encodeURIComponent(caseId)}/resources/${encodeURIComponent(linkId)}`,
  );
  return res.data;
}

export async function openSupportCaseHandoff(
  caseId: string,
  body: { target: SupportHandoffTarget; reason: string },
): Promise<{ case: SupportCaseDetail; handoffId: string }> {
  const res = await client.post<{
    case: SupportCaseDetail;
    handoffId: string;
  }>(`/operator/support-cases/${encodeURIComponent(caseId)}/handoffs`, body);
  return res.data;
}

export async function acknowledgeSupportCaseHandoff(
  caseId: string,
  handoffId: string,
): Promise<SupportCaseDetail> {
  const res = await client.post<SupportCaseDetail>(
    `/operator/support-cases/${encodeURIComponent(caseId)}/handoffs/${encodeURIComponent(handoffId)}/acknowledge`,
  );
  return res.data;
}

export async function closeSupportCaseHandoff(
  caseId: string,
  handoffId: string,
  body: { reason: string },
): Promise<SupportCaseDetail> {
  const res = await client.post<SupportCaseDetail>(
    `/operator/support-cases/${encodeURIComponent(caseId)}/handoffs/${encodeURIComponent(handoffId)}/close`,
    body,
  );
  return res.data;
}
