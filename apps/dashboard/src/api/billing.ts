import client from "./client";

export type BillingPlanKey =
  | "free"
  | "starter_stay"
  | "boutique_growth"
  | "portfolio";

export type BillingPlanStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "inactive";

export type BillingSupportTier = "docs" | "email" | "priority" | "white_glove";

export interface BillingPlanLimits {
  sites: number;
  locales: number;
  seats: number;
  formSubmissions: number;
  pages: number | null;
  domains: number;
  allowedLanguages: string[];
  translationCharactersPerMonth: number;
  deploymentRetention: number;
  rollbackEnabled: boolean;
  analyticsEnabled: boolean;
  exportEnabled: boolean;
  scheduledExports: boolean;
  supportTier: BillingSupportTier;
  seoCrawlerMaxUrlsPerCrawl: number;
  psiAuditsPerMonth: number;
}

export interface BillingUsageTotals {
  sites: number;
  locales: number;
  seats: number;
  formSubmissions: number;
  pages: number;
  domains: number;
  translationCharactersThisMonth: number;
}

export interface PlanCatalogEntry {
  key: BillingPlanKey;
  name: string;
  description: string;
  isFree: boolean;
  limits: BillingPlanLimits;
}

const BILLING_PLAN_KEYS = [
  "free",
  "starter_stay",
  "boutique_growth",
  "portfolio",
] as const satisfies readonly BillingPlanKey[];

export function isBillingPlanKey(
  value: string | null,
): value is BillingPlanKey {
  return Boolean(value && BILLING_PLAN_KEYS.includes(value as BillingPlanKey));
}

export interface BillingPlanSnapshot {
  planId: string;
  planKey: BillingPlanKey;
  planName: string;
  description: string;
  status: BillingPlanStatus;
  renewsAt: string | null;
  currentPeriodStart: string | null;
  gracePeriodEndsAt: string | null;
  limits: BillingPlanLimits;
  usage: BillingUsageTotals;
  provider: "stripe";
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
  source: "stripe" | "default_trial" | "free";
  subscriptionId: string | null;
  isFreePlan: boolean;
}

export interface BillingCheckoutSession {
  provider: "stripe";
  sessionId: string;
  checkoutUrl: string;
  customerId: string;
  planKey: string;
}

export interface BillingPortalSession {
  provider: "stripe";
  customerId: string;
  portalUrl: string;
}

export interface BillingPlanCatalogEntry {
  key: BillingPlanKey;
  name: string;
  description: string;
  isFree: boolean;
  limits: BillingPlanLimits;
}

export async function getBillingPlan(
  tenantId: string,
): Promise<BillingPlanSnapshot> {
  const { data } = await client.get<BillingPlanSnapshot>(
    `/tenants/${tenantId}/billing/plan`,
  );
  return data;
}

export async function listBillingPlans(
  tenantId: string,
): Promise<BillingPlanCatalogEntry[]> {
  const { data } = await client.get<BillingPlanCatalogEntry[]>(
    `/tenants/${tenantId}/billing/plans`,
  );
  return data;
}

export async function createCheckoutSession(
  tenantId: string,
  payload: {
    planKey: string;
    successUrl: string;
    cancelUrl: string;
  },
): Promise<BillingCheckoutSession> {
  const { data } = await client.post<BillingCheckoutSession>(
    `/tenants/${tenantId}/billing/checkout-session`,
    payload,
  );
  return data;
}

export async function updateBillingPlan(
  tenantId: string,
  payload: { planKey: BillingPlanKey },
): Promise<BillingPlanSnapshot> {
  const { data } = await client.post<BillingPlanSnapshot>(
    `/tenants/${tenantId}/billing/subscription-plan`,
    payload,
  );
  return data;
}

export async function createPortalSession(
  tenantId: string,
  payload: { returnUrl: string },
): Promise<BillingPortalSession> {
  const { data } = await client.post<BillingPortalSession>(
    `/tenants/${tenantId}/billing/portal-session`,
    payload,
  );
  return data;
}
