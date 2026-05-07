import client from "./client";

export type BillingPlanKey = "starter_stay" | "boutique_growth" | "portfolio";

export type BillingPlanStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "inactive";

export interface PlanCatalogEntry {
  key: BillingPlanKey;
  name: string;
  tagline: string;
}

/** Frontend mirror of the backend plan catalog — used for the checkout plan picker. */
export const PLAN_CATALOG: readonly PlanCatalogEntry[] = [
  {
    key: "starter_stay",
    name: "Starter Stay",
    tagline: "1 site · 1 language · 2 seats · 150 inquiries/mo",
  },
  {
    key: "boutique_growth",
    name: "Boutique Growth",
    tagline: "1 site · 4 languages · 5 seats · 750 inquiries/mo",
  },
  {
    key: "portfolio",
    name: "Portfolio",
    tagline: "5 sites · 8 languages · 15 seats · 3 000 inquiries/mo",
  },
];

export interface BillingPlanSnapshot {
  planId: string;
  planKey: BillingPlanKey;
  planName: string;
  description: string;
  status: BillingPlanStatus;
  renewsAt: string | null;
  currentPeriodStart: string | null;
  gracePeriodEndsAt: string | null;
  limits: {
    sites: number;
    locales: number;
    seats: number;
    formSubmissions: number;
    pages: number | null;
    domains: number;
  };
  usage: {
    sites: number;
    locales: number;
    seats: number;
    formSubmissions: number;
    pages: number;
  };
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
  source: "stripe" | "default_trial";
  subscriptionId: string | null;
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

export async function getBillingPlan(
  tenantId: string,
): Promise<BillingPlanSnapshot> {
  const { data } = await client.get<BillingPlanSnapshot>(
    `/tenants/${tenantId}/billing/plan`,
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
