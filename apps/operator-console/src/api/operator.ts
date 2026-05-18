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

// ─── Billing (Phase 8 UI) ──────────────────────────────────────────────
//
// Types mirror `apps/api/src/operator-billing/operator-billing.service.ts`
// and the Prisma models added in the Phase 7 migration. Every mutation
// expects a `reason` of >= 8 chars and is permission-gated server-side.

export type BillingActionType =
  | "CHANGE_PLAN"
  | "CANCEL_PENDING_PLAN_CHANGE"
  | "CANCEL_AT_PERIOD_END"
  | "REACTIVATE_SUBSCRIPTION"
  | "EXTEND_GRACE_PERIOD"
  | "STRIPE_SYNC"
  | "STRIPE_WEBHOOK_REPLAY"
  | "REFUND_INVOICE"
  | "ISSUE_CREDIT"
  | "ENTITLEMENT_OVERRIDE_CREATE"
  | "ENTITLEMENT_OVERRIDE_REVOKE";

export type BillingActionStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "EXECUTED"
  | "FAILED"
  | "CANCELED";

export interface BillingActionRequest {
  id: string;
  tenantId: string;
  actorUserId: string;
  approverUserId: string | null;
  type: BillingActionType;
  status: BillingActionStatus;
  requiresApproval: boolean;
  reason: string;
  approverReason: string | null;
  idempotencyKey: string | null;
  payload: Record<string, unknown> | null;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  providerObjectIds: Record<string, unknown> | null;
  failureCode: string | null;
  failureMessage: string | null;
  executionError: string | null;
  createdAt: string;
  approvedAt: string | null;
  executedAt: string | null;
}

export interface BillingOverviewResponse {
  counts: {
    active: number;
    trialing: number;
    pastDue: number;
    canceled: number;
    mismatched: number;
  };
  pendingApprovals: number;
  unprocessedWebhooks: number;
  failedWebhooks: number;
  recentActions: BillingActionRequest[];
}

export interface BillingPlanCatalogEntry {
  key: string;
  name: string;
  isFree: boolean;
  limits: Record<string, unknown>;
}

export interface BillingAccountListItem {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  createdAt: string;
  subscriptions: Array<{
    id: string;
    planKey: string | null;
    status: SubscriptionStatus;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    gracePeriodEndsAt: string | null;
    providerCustomerId: string | null;
    providerSubscriptionId: string | null;
    lastWebhookAt: string | null;
  }>;
}

export interface BillingAccountsListResponse {
  data: BillingAccountListItem[];
  page: number;
  limit: number;
  total: number;
}

export interface BillingInvoiceSnapshotRow {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  providerInvoiceId: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  number: string | null;
  status: string;
  currency: string;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  providerCreatedAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  raw: Record<string, unknown> | null;
  lastSyncedAt: string;
}

export interface BillingPaymentEventRow {
  id: string;
  tenantId: string;
  providerPaymentIntentId: string | null;
  providerChargeId: string | null;
  providerInvoiceId: string | null;
  providerCustomerId: string | null;
  kind: string;
  amount: number;
  currency: string;
  status: string;
  failureCode: string | null;
  failureMessage: string | null;
  occurredAt: string;
  raw: Record<string, unknown> | null;
}

export interface BillingOperatorNoteRow {
  id: string;
  tenantId: string;
  authorUserId: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    email: string;
    platformRole: PlatformRole | null;
  } | null;
}

export interface BillingEntitlementOverrideRow {
  id: string;
  tenantId: string;
  limitKey: string;
  intValue: number | null;
  jsonValue: Record<string, unknown> | null;
  reason: string;
  createdByUserId: string;
  revokedByUserId: string | null;
  revokeReason: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface BillingTenantSnapshot {
  tenantId: string;
  planKey: string;
  planName: string;
  description: string;
  provider: string;
  status: BillingPublicStatus;
  renewsAt: string | null;
  currentPeriodStart: string | null;
  gracePeriodEndsAt: string | null;
  limits: Record<string, unknown>;
  usage: Record<string, unknown>;
  source: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  actions: {
    editingAllowed: boolean;
    publishingBlocked: boolean;
    publicSitesRemainLive: boolean;
    operatorOverrideAvailable: boolean;
    gracePeriodActive: boolean;
  };
  lastWebhookAt: string | null;
  subscriptionId: string | null;
  isFreePlan: boolean;
  pendingPlanChange: {
    planKey: string;
    effectiveAt: string | null;
  } | null;
}

export interface BillingAccountDetailResponse {
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
  };
  snapshot: BillingTenantSnapshot;
  invoices: BillingInvoiceSnapshotRow[];
  payments: BillingPaymentEventRow[];
  notes: BillingOperatorNoteRow[];
  overrides: BillingEntitlementOverrideRow[];
  pendingActions: BillingActionRequest[];
  recentActions: BillingActionRequest[];
  supportCases: Array<{
    id: string;
    status: string;
    priority: string;
    category: string;
    subject: string;
    updatedAt: string;
    createdAt: string;
  }>;
}

export interface BillingWebhookEventRow {
  id: string;
  tenantId: string | null;
  providerEventId: string;
  eventType: string;
  rawPayload: Record<string, unknown> | null;
  processedAt: string | null;
  errorMessage: string | null;
  signatureVerifiedAt: string | null;
  createdAt: string;
}

export interface BillingWebhookEventsResponse {
  data: BillingWebhookEventRow[];
  page: number;
  limit: number;
  total: number;
}

export interface BillingActionRequestsResponse {
  data: BillingActionRequest[];
  page: number;
  limit: number;
  total: number;
}

export interface FetchBillingAccountsParams {
  q?: string;
  status?:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "inactive";
  planKey?: string;
  mismatch?: boolean;
  page?: number;
  limit?: number;
}

export interface FetchBillingActionRequestsParams {
  tenantId?: string;
  status?: BillingActionStatus;
  page?: number;
  limit?: number;
}

export interface FetchBillingWebhooksParams {
  tenantId?: string;
  eventType?: string;
  failed?: boolean;
  unprocessed?: boolean;
  page?: number;
  limit?: number;
}

// ─── Endpoints ────────────────────────────────────────────────────────

export async function fetchBillingOverview(): Promise<BillingOverviewResponse> {
  const res = await client.get<BillingOverviewResponse>(
    "/operator/billing/overview",
  );
  return res.data;
}

export async function fetchBillingPlans(): Promise<BillingPlanCatalogEntry[]> {
  const res = await client.get<BillingPlanCatalogEntry[]>(
    "/operator/billing/plans",
  );
  return res.data;
}

export async function fetchBillingAccounts(
  params: FetchBillingAccountsParams = {},
): Promise<BillingAccountsListResponse> {
  const res = await client.get<BillingAccountsListResponse>(
    "/operator/billing/accounts",
    { params },
  );
  return res.data;
}

export async function fetchBillingAccount(
  tenantId: string,
): Promise<BillingAccountDetailResponse> {
  const res = await client.get<BillingAccountDetailResponse>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}`,
  );
  return res.data;
}

export async function fetchBillingInvoices(
  tenantId: string,
): Promise<BillingInvoiceSnapshotRow[]> {
  const res = await client.get<BillingInvoiceSnapshotRow[]>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/invoices`,
  );
  return res.data;
}

export async function fetchBillingPayments(
  tenantId: string,
): Promise<BillingPaymentEventRow[]> {
  const res = await client.get<BillingPaymentEventRow[]>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/payments`,
  );
  return res.data;
}

export async function fetchBillingNotes(
  tenantId: string,
): Promise<BillingOperatorNoteRow[]> {
  const res = await client.get<BillingOperatorNoteRow[]>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/notes`,
  );
  return res.data;
}

export async function fetchBillingOverrides(
  tenantId: string,
): Promise<BillingEntitlementOverrideRow[]> {
  const res = await client.get<BillingEntitlementOverrideRow[]>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/overrides`,
  );
  return res.data;
}

export async function fetchBillingActionRequests(
  params: FetchBillingActionRequestsParams = {},
): Promise<BillingActionRequestsResponse> {
  const res = await client.get<BillingActionRequestsResponse>(
    "/operator/billing/action-requests",
    { params },
  );
  return res.data;
}

export async function fetchBillingWebhooks(
  params: FetchBillingWebhooksParams = {},
): Promise<BillingWebhookEventsResponse> {
  const res = await client.get<BillingWebhookEventsResponse>(
    "/operator/billing/webhooks",
    { params },
  );
  return res.data;
}

// ─── Mutations ────────────────────────────────────────────────────────
//
// Every mutation expects { reason: string } with min 8 chars; high-risk
// mutations (refund / credit / override) return a `BillingActionRequest`
// row in `PENDING_APPROVAL` status. The remaining mutations return the
// executed `BillingActionRequest` along with the new tenant snapshot.

export interface BillingMutationResponse {
  action: BillingActionRequest;
  snapshot: BillingTenantSnapshot;
}

export async function changeBillingPlan(
  tenantId: string,
  body: { targetPlanKey: string; reason: string },
): Promise<BillingMutationResponse> {
  const res = await client.post<BillingMutationResponse>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/plan`,
    body,
  );
  return res.data;
}

export async function cancelPendingBillingPlanChange(
  tenantId: string,
  body: { reason: string },
): Promise<BillingMutationResponse> {
  const res = await client.delete<BillingMutationResponse>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/pending-plan`,
    { data: body },
  );
  return res.data;
}

export async function cancelBillingAtPeriodEnd(
  tenantId: string,
  body: { reason: string },
): Promise<BillingMutationResponse> {
  const res = await client.post<BillingMutationResponse>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/cancel`,
    body,
  );
  return res.data;
}

export async function reactivateBillingSubscription(
  tenantId: string,
  body: { reason: string },
): Promise<BillingMutationResponse> {
  const res = await client.post<BillingMutationResponse>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/reactivate`,
    body,
  );
  return res.data;
}

export async function extendBillingGracePeriod(
  tenantId: string,
  body: { until: string; reason: string },
): Promise<BillingMutationResponse> {
  const res = await client.post<BillingMutationResponse>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/grace-period`,
    body,
  );
  return res.data;
}

export async function syncBillingFromStripe(
  tenantId: string,
  body: { reason: string },
): Promise<BillingMutationResponse> {
  const res = await client.post<BillingMutationResponse>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/sync`,
    body,
  );
  return res.data;
}

export async function requestBillingRefund(
  tenantId: string,
  invoiceProviderId: string,
  body: { amount?: number | null; reason: string },
): Promise<BillingActionRequest> {
  const res = await client.post<BillingActionRequest>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/invoices/${encodeURIComponent(invoiceProviderId)}/refund`,
    body,
  );
  return res.data;
}

export async function requestBillingCredit(
  tenantId: string,
  body: { amount: number; currency: string; reason: string },
): Promise<BillingActionRequest> {
  const res = await client.post<BillingActionRequest>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/credits`,
    body,
  );
  return res.data;
}

export async function createBillingNote(
  tenantId: string,
  body: { body: string; pinned?: boolean },
): Promise<BillingOperatorNoteRow> {
  const res = await client.post<BillingOperatorNoteRow>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/notes`,
    body,
  );
  return res.data;
}

export async function updateBillingNote(
  tenantId: string,
  noteId: string,
  body: { body?: string; pinned?: boolean },
): Promise<BillingOperatorNoteRow> {
  const res = await client.patch<BillingOperatorNoteRow>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/notes/${encodeURIComponent(noteId)}`,
    body,
  );
  return res.data;
}

export async function deleteBillingNote(
  tenantId: string,
  noteId: string,
): Promise<{ deleted: true }> {
  const res = await client.delete<{ deleted: true }>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/notes/${encodeURIComponent(noteId)}`,
  );
  return res.data;
}

export async function requestBillingOverride(
  tenantId: string,
  body: {
    limitKey: string;
    intValue?: number | null;
    jsonValue?: Record<string, unknown> | null;
    expiresAt?: string;
    reason: string;
  },
): Promise<BillingActionRequest> {
  const res = await client.post<BillingActionRequest>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/overrides`,
    body,
  );
  return res.data;
}

export async function requestBillingOverrideRevoke(
  tenantId: string,
  overrideId: string,
  body: { reason: string },
): Promise<BillingActionRequest> {
  const res = await client.delete<BillingActionRequest>(
    `/operator/billing/accounts/${encodeURIComponent(tenantId)}/overrides/${encodeURIComponent(overrideId)}`,
    { data: body },
  );
  return res.data;
}

export async function replayBillingWebhook(
  eventRowId: string,
  body: { reason: string },
): Promise<{ action: BillingActionRequest; result: unknown }> {
  const res = await client.post<{
    action: BillingActionRequest;
    result: unknown;
  }>(
    `/operator/billing/webhooks/${encodeURIComponent(eventRowId)}/replay`,
    body,
  );
  return res.data;
}

export async function approveBillingAction(
  requestId: string,
  body: { reason: string },
): Promise<BillingActionRequest> {
  const res = await client.post<BillingActionRequest>(
    `/operator/billing/action-requests/${encodeURIComponent(requestId)}/approve`,
    body,
  );
  return res.data;
}

export async function rejectBillingAction(
  requestId: string,
  body: { reason: string },
): Promise<BillingActionRequest> {
  const res = await client.post<BillingActionRequest>(
    `/operator/billing/action-requests/${encodeURIComponent(requestId)}/reject`,
    body,
  );
  return res.data;
}
