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
  tagline: string;
  isFree: boolean;
}

export const PLAN_CATALOG: readonly PlanCatalogEntry[] = [
  {
    key: "free",
    name: "Free",
    tagline: "1 site · English only · 1 seat · 50 inquiries/mo",
    isFree: true,
  },
  {
    key: "starter_stay",
    name: "Starter Stay",
    tagline: "1 site · 2 languages · 2 seats · 250 inquiries/mo · 1 domain",
    isFree: false,
  },
  {
    key: "boutique_growth",
    name: "Boutique Growth",
    tagline: "1 site · 4 languages · 5 seats · 1 500 inquiries/mo · 3 domains",
    isFree: false,
  },
  {
    key: "portfolio",
    name: "Portfolio",
    tagline:
      "5 sites · 4 languages/site · 15 seats · 10 000 inquiries/mo · 15 domains",
    isFree: false,
  },
];

export function isBillingPlanKey(
  value: string | null,
): value is BillingPlanKey {
  return Boolean(value && PLAN_CATALOG.some((plan) => plan.key === value));
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
