export type BillingProvider = "stripe";

export type BillingPlanKey =
  | "free"
  | "starter_stay"
  | "boutique_growth"
  | "portfolio";

export type BillingPublicStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "inactive";

export type BillingSupportTier = "docs" | "email" | "priority" | "white_glove";

export type BillingSalesMotion =
  | "self_serve"
  | "workspace_checkout"
  | "contact_sales";

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
  /**
   * Maximum URLs the SEO crawler is allowed to fetch per audit job.
   * 0 disables the crawler entirely (no plan currently uses that, but
   * the field is kept open so a future read-only or trial plan can).
   */
  seoCrawlerMaxUrlsPerCrawl: number;
  /**
   * Maximum PageSpeed Insights audits the tenant can run per calendar
   * month (each strategy counts as one). 0 disables the feature.
   */
  psiAuditsPerMonth: number;
}

export interface BillingPlanPublicCatalog {
  audience: string;
  promise: string;
  upgradeTrigger: string;
  ctaLabel: string;
  salesMotion: BillingSalesMotion;
  featured: boolean;
}

export interface BillingEnforcementPolicy {
  gracePeriodDays: number;
  editingAllowedDuringGracePeriod: boolean;
  publishingBlockedAfterGracePeriod: boolean;
  publicSitesRemainLiveDuringPastDue: boolean;
  operatorOverrideAvailable: boolean;
}

export interface BillingUsageTotals {
  sites: number;
  locales: number;
  seats: number;
  formSubmissions: number;
  pages: number;
  domains: number;
  translationCharactersThisMonth: number;
  psiAuditsThisMonth: number;
}

export interface BillingActionState {
  editingAllowed: boolean;
  publishingBlocked: boolean;
  publicSitesRemainLive: boolean;
  operatorOverrideAvailable: boolean;
  gracePeriodActive: boolean;
}

export interface BillingPlanDefinition {
  key: BillingPlanKey;
  name: string;
  description: string;
  provider: BillingProvider;
  stripePriceIdEnvVar: string | null;
  isFree: boolean;
  catalog: BillingPlanPublicCatalog;
  limits: BillingPlanLimits;
}

export interface TenantBillingSnapshot {
  tenantId: string;
  planKey: BillingPlanKey;
  planName: string;
  description: string;
  provider: BillingProvider;
  status: BillingPublicStatus;
  renewsAt: Date | null;
  currentPeriodStart: Date | null;
  gracePeriodEndsAt: Date | null;
  limits: BillingPlanLimits;
  usage: BillingUsageTotals;
  source: "stripe" | "default_trial" | "free";
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  actions: BillingActionState;
  lastWebhookAt: Date | null;
  subscriptionId: string | null;
  isFreePlan: boolean;
}

export interface CreateCheckoutSessionResult {
  provider: BillingProvider;
  sessionId: string;
  checkoutUrl: string;
  customerId: string;
  planKey: BillingPlanKey;
}

export interface CreateBillingPortalSessionResult {
  provider: BillingProvider;
  customerId: string;
  portalUrl: string;
}

export interface AdminSubscriptionListItem {
  id: string;
  tenantId: string;
  tenantName: string;
  planKey: BillingPlanKey;
  status: Exclude<BillingPublicStatus, "inactive">;
  renewsAt: string | null;
  webhookSynced: boolean;
}
