import client from "./client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminTenantStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";
export type AdminDeployStatus = "PENDING" | "BUILDING" | "DEPLOYED" | "FAILED";
export type AdminSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled";
export type AdminDomainVerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "FAILED";
export type AdminDomainStatus =
  | "PENDING"
  | "DNS_REQUIRED"
  | "VERIFYING"
  | "PROVIDER_ATTACH_PENDING"
  | "SSL_PROVISIONING"
  | "ACTIVE"
  | "FAILED";

export interface AdminOverview {
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
    tenantStatus: AdminTenantStatus;
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
      status: SiteDeploymentStatus;
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
      status: AdminDomainStatus;
      lastError: string | null;
      lastCheckedAt: string | null;
    }>;
    formAlerts: Array<{
      tenantId: string;
      tenantName: string;
      siteId: string;
      siteName: string;
      critical: boolean;
      alertTypes: Array<
        "DOMAIN_FAILURE" | "FORM_DELIVERY_FAILURE" | "SUBMISSION_SPIKE"
      >;
      messages: string[];
      lastTriggeredAt: string | null;
    }>;
    recentAudit: AdminAuditEntry[];
  };
}

export interface AdminTenant {
  id: string;
  slug: string;
  name: string;
  status: AdminTenantStatus;
  planKey: string | null;
  siteCount: number;
  memberCount: number;
  createdAt: string;
}

export interface AdminDeployment {
  id: string;
  siteId: string;
  siteName: string;
  tenantName: string;
  status: AdminDeployStatus;
  providerProjectId: string | null;
  errorMessage: string | null;
  deployedAt: string | null;
  createdAt: string;
}

export interface AdminSubscription {
  id: string;
  tenantId: string;
  tenantName: string;
  planKey: string;
  status: AdminSubscriptionStatus;
  renewsAt: string | null;
  webhookSynced: boolean;
}

export interface AdminDomain {
  id: string;
  domain: string;
  siteId: string;
  siteName: string;
  tenantName: string;
  status: AdminDomainStatus;
  isPrimary: boolean;
  verificationStatus: AdminDomainVerificationStatus;
  sslActive: boolean;
  expectedTarget: string | null;
  observedCname: string | null;
  observedAddresses: string[];
  lastError: string | null;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
}

export interface AdminFormSummary {
  siteId: string;
  siteName: string;
  tenantName: string;
  totalSubmissions: number;
  nonSpamSubmissions: number;
  spamCount: number;
  unreadCount: number;
  failedDeliveryCount: number;
  pendingDeliveryCount: number;
  lastDeliveryFailureAt: string | null;
  lastDeliveryError: string | null;
  openDeliveryAlert: boolean;
  deliveryAlertMessage: string | null;
  openSpikeAlert: boolean;
  spikeAlertMessage: string | null;
  lastSubmittedAt: string | null;
}

export interface AdminAuditEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminPaginatedResponse<T> {
  data: T[];
  total: number;
}

type BillingPublicStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "inactive";

type SiteDeploymentStatus =
  | "PENDING"
  | "CREATING_PROJECT"
  | "SYNCING_ENV"
  | "DEPLOYING"
  | "LIVE"
  | "FAILED"
  | "RETRYING";

export async function getAdminOverview(): Promise<AdminOverview> {
  const { data } = await client.get<AdminOverview>("/admin/overview");
  return data;
}

// ─── Tenants ──────────────────────────────────────────────────────────────────
// GET /api/admin/tenants?status=&page=&limit=
export async function getAdminTenants(params?: {
  status?: AdminTenantStatus;
  page?: number;
  limit?: number;
}): Promise<AdminPaginatedResponse<AdminTenant>> {
  const { data } = await client.get<AdminPaginatedResponse<AdminTenant>>(
    "/admin/tenants",
    { params },
  );
  return data;
}

// POST /api/admin/tenants/:tenantId/suspend
export async function suspendTenant(tenantId: string): Promise<void> {
  await client.post(`/admin/tenants/${tenantId}/suspend`);
}

// POST /api/admin/tenants/:tenantId/reactivate
export async function reactivateTenant(tenantId: string): Promise<void> {
  await client.post(`/admin/tenants/${tenantId}/reactivate`);
}

// ─── Deployments ──────────────────────────────────────────────────────────────
// GET /api/admin/deployments?status=&page=&limit=
export async function getAdminDeployments(params?: {
  status?: AdminDeployStatus;
  page?: number;
  limit?: number;
}): Promise<AdminPaginatedResponse<AdminDeployment>> {
  const { data } = await client.get<AdminPaginatedResponse<AdminDeployment>>(
    "/admin/deployments",
    { params },
  );
  return data;
}

// POST /api/admin/deployments/:deploymentId/retry
export async function retryDeployment(deploymentId: string): Promise<void> {
  await client.post(`/admin/deployments/${deploymentId}/retry`);
}

// ─── Subscriptions ────────────────────────────────────────────────────────────
// GET /api/admin/subscriptions?status=&page=&limit=
export async function getAdminSubscriptions(params?: {
  status?: AdminSubscriptionStatus;
  page?: number;
  limit?: number;
}): Promise<AdminPaginatedResponse<AdminSubscription>> {
  const { data } = await client.get<AdminPaginatedResponse<AdminSubscription>>(
    "/admin/subscriptions",
    { params },
  );
  return data;
}

// ─── Domains ──────────────────────────────────────────────────────────────────
// GET /api/admin/domains?verificationStatus=&page=&limit=
export async function getAdminDomains(params?: {
  verificationStatus?: AdminDomainVerificationStatus;
  page?: number;
  limit?: number;
}): Promise<AdminPaginatedResponse<AdminDomain>> {
  const { data } = await client.get<AdminPaginatedResponse<AdminDomain>>(
    "/admin/domains",
    { params },
  );
  return data;
}

// POST /api/admin/domains/:id/retry-verification
export async function retryDomainVerification(
  domainId: string,
): Promise<AdminDomain> {
  const { data } = await client.post<AdminDomain>(
    `/admin/domains/${domainId}/retry-verification`,
  );
  return data;
}

// ─── Forms summary ────────────────────────────────────────────────────────────
// GET /api/admin/forms/summary?page=&limit=
export async function getAdminFormsSummary(params?: {
  page?: number;
  limit?: number;
}): Promise<AdminPaginatedResponse<AdminFormSummary>> {
  const { data } = await client.get<AdminPaginatedResponse<AdminFormSummary>>(
    "/admin/forms/summary",
    { params },
  );
  return data;
}

// ─── Audit log ────────────────────────────────────────────────────────────────
// GET /api/admin/audit?page=&limit=
export async function getAdminAuditLog(params?: {
  page?: number;
  limit?: number;
}): Promise<AdminPaginatedResponse<AdminAuditEntry>> {
  const { data } = await client.get<AdminPaginatedResponse<AdminAuditEntry>>(
    "/admin/audit",
    { params },
  );
  return data;
}
