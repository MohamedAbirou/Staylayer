import {
  BillingEnforcementPolicy,
  BillingPlanDefinition,
  BillingPlanKey,
  BillingProvider,
} from "./billing.types";
import { SUPPORTED_LOCALES } from "../common/supported-locales";

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
      "Self-serve workspace for validating one hospitality brand before moving into live inquiry operations.",
    provider: BILLING_PROVIDER,
    stripePriceIdEnvVar: null,
    isFree: true,
    catalog: {
      audience: "Solo operators validating a first direct web presence",
      promise:
        "Launch one draft hospitality site, confirm the workflow, and keep setup intentionally lightweight.",
      upgradeTrigger:
        "Upgrade when you need branded domains, multilingual publishing, analytics, or more than pilot-level inquiry volume.",
      ctaLabel: "Start free",
      salesMotion: "self_serve",
      featured: false,
    },
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
      seoCrawlerMaxUrlsPerCrawl: 100,
      psiAuditsPerMonth: 20,
    },
  },
  starter_stay: {
    key: "starter_stay",
    name: "Starter Stay",
    description:
      "Single-property plan for live inquiry capture, branded domains, and day-to-day hospitality publishing.",
    provider: BILLING_PROVIDER,
    stripePriceIdEnvVar: "STRIPE_PRICE_STARTER_STAY",
    isFree: false,
    catalog: {
      audience:
        "Independent villas, guest houses, and smaller boutique stays going live with direct inquiries",
      promise:
        "Run one live hospitality site with custom domains, analytics, and the core publishing controls needed for day-to-day operations.",
      upgradeTrigger:
        "Upgrade when more languages, more teammates, or a heavier inquiry flow start stressing a single-site setup.",
      ctaLabel: "Choose Starter Stay",
      salesMotion: "workspace_checkout",
      featured: true,
    },
    limits: {
      sites: 1,
      locales: 2,
      seats: 2,
      formSubmissions: 250,
      pages: 25,
      domains: 1,
      allowedLanguages: [...SUPPORTED_LOCALES],
      translationCharactersPerMonth: 50_000,
      deploymentRetention: 10,
      rollbackEnabled: true,
      analyticsEnabled: true,
      exportEnabled: true,
      scheduledExports: false,
      supportTier: "email",
      seoCrawlerMaxUrlsPerCrawl: 500,
      psiAuditsPerMonth: 200,
    },
  },
  boutique_growth: {
    key: "boutique_growth",
    name: "Boutique Growth",
    description:
      "Growth plan for multi-language hospitality brands with higher inquiry volume and team collaboration.",
    provider: BILLING_PROVIDER,
    stripePriceIdEnvVar: "STRIPE_PRICE_BOUTIQUE_GROWTH",
    isFree: false,
    catalog: {
      audience:
        "Boutique hotels and higher-touch hospitality brands scaling direct demand",
      promise:
        "Operate a richer multi-language site, support a larger team, and keep direct inquiry operations moving without adding platform sprawl.",
      upgradeTrigger:
        "Upgrade when several domains, larger translation workloads, or multiple properties need to be coordinated together.",
      ctaLabel: "Choose Boutique Growth",
      salesMotion: "workspace_checkout",
      featured: false,
    },
    limits: {
      sites: 1,
      locales: 4,
      seats: 5,
      formSubmissions: 1500,
      pages: 100,
      domains: 3,
      allowedLanguages: [...SUPPORTED_LOCALES],
      translationCharactersPerMonth: 250_000,
      deploymentRetention: 30,
      rollbackEnabled: true,
      analyticsEnabled: true,
      exportEnabled: true,
      scheduledExports: true,
      supportTier: "priority",
      seoCrawlerMaxUrlsPerCrawl: 2000,
      psiAuditsPerMonth: 1000,
    },
  },
  portfolio: {
    key: "portfolio",
    name: "Portfolio",
    description:
      "Multi-site plan for operators or agencies managing several hospitality brands from one platform.",
    provider: BILLING_PROVIDER,
    stripePriceIdEnvVar: "STRIPE_PRICE_PORTFOLIO",
    isFree: false,
    catalog: {
      audience:
        "Multi-property groups and agencies managing several hospitality brands",
      promise:
        "Coordinate multiple live sites, larger teams, and portfolio-wide publishing operations with white-glove support.",
      upgradeTrigger:
        "Best fit once central teams need multi-brand oversight from day one instead of growing into it later.",
      ctaLabel: "Choose Portfolio",
      salesMotion: "workspace_checkout",
      featured: false,
    },
    limits: {
      sites: 5,
      locales: 8,
      seats: 15,
      formSubmissions: 10_000,
      pages: 500,
      domains: 15,
      allowedLanguages: [...SUPPORTED_LOCALES],
      translationCharactersPerMonth: 1_000_000,
      deploymentRetention: 90,
      rollbackEnabled: true,
      analyticsEnabled: true,
      exportEnabled: true,
      scheduledExports: true,
      supportTier: "white_glove",
      seoCrawlerMaxUrlsPerCrawl: 5000,
      psiAuditsPerMonth: 5000,
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
