import {
  BillingEnforcementPolicy,
  BillingPlanDefinition,
  BillingPlanKey,
  BillingProvider,
} from "./billing.types";

export const BILLING_PROVIDER: BillingProvider = "stripe";
export const BILLING_DEFAULT_TRIAL_DAYS = 14;

export const BILLING_ENFORCEMENT_POLICY: BillingEnforcementPolicy = {
  gracePeriodDays: 7,
  editingAllowedDuringGracePeriod: true,
  publishingBlockedAfterGracePeriod: true,
  publicSitesRemainLiveDuringPastDue: true,
  operatorOverrideAvailable: true,
};

export const BILLING_PLANS: Record<BillingPlanKey, BillingPlanDefinition> = {
  starter_stay: {
    key: "starter_stay",
    name: "Starter Stay",
    description:
      "Single-property plan for one site, one language, and core inquiry handling.",
    provider: BILLING_PROVIDER,
    stripePriceIdEnvVar: "STRIPE_PRICE_STARTER_STAY",
    limits: {
      sites: 1,
      locales: 1,
      seats: 2,
      formSubmissions: 150,
      pages: 20,
      domains: 1,
    },
  },
  boutique_growth: {
    key: "boutique_growth",
    name: "Boutique Growth",
    description:
      "Multi-language plan for independent hotels, B&Bs, and small hospitality brands.",
    provider: BILLING_PROVIDER,
    stripePriceIdEnvVar: "STRIPE_PRICE_BOUTIQUE_GROWTH",
    limits: {
      sites: 1,
      locales: 4,
      seats: 5,
      formSubmissions: 750,
      pages: 75,
      domains: 2,
    },
  },
  portfolio: {
    key: "portfolio",
    name: "Portfolio",
    description:
      "Multi-site plan for operators with larger inquiry volume and more editorial seats.",
    provider: BILLING_PROVIDER,
    stripePriceIdEnvVar: "STRIPE_PRICE_PORTFOLIO",
    limits: {
      sites: 5,
      locales: 8,
      seats: 15,
      formSubmissions: 3000,
      pages: 250,
      domains: 10,
    },
  },
};

export function getBillingPlan(planKey: BillingPlanKey): BillingPlanDefinition {
  return BILLING_PLANS[planKey];
}

export function isBillingPlanKey(value: string): value is BillingPlanKey {
  return value in BILLING_PLANS;
}
