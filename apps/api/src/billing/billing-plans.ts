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
  free: {
    key: "free",
    name: "Free",
    description:
      "Trial-quality self-serve plan for solo operators validating the product.",
    provider: BILLING_PROVIDER,
    stripePriceIdEnvVar: null,
    isFree: true,
    limits: {
      sites: 1,
      locales: 1,
      seats: 1,
      formSubmissions: 50,
      pages: 5,
      domains: 0,
      allowedLanguages: ["en"],
      translationCharactersPerMonth: 0,
      deploymentRetention: 1,
      rollbackEnabled: false,
      analyticsEnabled: false,
      exportEnabled: false,
      scheduledExports: false,
      supportTier: "docs",
    },
  },
  starter_stay: {
    key: "starter_stay",
    name: "Starter Stay",
    description:
      "Single-property plan for one site, up to two languages, and core inquiry handling.",
    provider: BILLING_PROVIDER,
    stripePriceIdEnvVar: "STRIPE_PRICE_STARTER_STAY",
    isFree: false,
    limits: {
      sites: 1,
      locales: 2,
      seats: 2,
      formSubmissions: 250,
      pages: 25,
      domains: 1,
      allowedLanguages: ["en", "es", "fr", "de"],
      translationCharactersPerMonth: 50_000,
      deploymentRetention: 10,
      rollbackEnabled: true,
      analyticsEnabled: true,
      exportEnabled: true,
      scheduledExports: false,
      supportTier: "email",
    },
  },
  boutique_growth: {
    key: "boutique_growth",
    name: "Boutique Growth",
    description:
      "Multi-language plan for independent hotels and boutique hospitality brands.",
    provider: BILLING_PROVIDER,
    stripePriceIdEnvVar: "STRIPE_PRICE_BOUTIQUE_GROWTH",
    isFree: false,
    limits: {
      sites: 1,
      locales: 4,
      seats: 5,
      formSubmissions: 1500,
      pages: 100,
      domains: 3,
      allowedLanguages: ["en", "es", "fr", "de"],
      translationCharactersPerMonth: 250_000,
      deploymentRetention: 30,
      rollbackEnabled: true,
      analyticsEnabled: true,
      exportEnabled: true,
      scheduledExports: true,
      supportTier: "priority",
    },
  },
  portfolio: {
    key: "portfolio",
    name: "Portfolio",
    description:
      "Multi-site plan for operators or agencies managing several hospitality brands.",
    provider: BILLING_PROVIDER,
    stripePriceIdEnvVar: "STRIPE_PRICE_PORTFOLIO",
    isFree: false,
    limits: {
      sites: 5,
      locales: 4,
      seats: 15,
      formSubmissions: 10_000,
      pages: 500,
      domains: 15,
      allowedLanguages: ["en", "es", "fr", "de"],
      translationCharactersPerMonth: 1_000_000,
      deploymentRetention: 90,
      rollbackEnabled: true,
      analyticsEnabled: true,
      exportEnabled: true,
      scheduledExports: true,
      supportTier: "white_glove",
    },
  },
};

export const BILLING_DEFAULT_PLAN_KEY: BillingPlanKey = "free";

export function getBillingPlan(planKey: BillingPlanKey): BillingPlanDefinition {
  return BILLING_PLANS[planKey];
}

export function isBillingPlanKey(value: string): value is BillingPlanKey {
  return value in BILLING_PLANS;
}

export function isPaidPlanKey(
  planKey: BillingPlanKey,
): planKey is Exclude<BillingPlanKey, "free"> {
  return !BILLING_PLANS[planKey].isFree;
}
