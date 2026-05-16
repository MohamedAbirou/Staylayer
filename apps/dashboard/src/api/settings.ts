import client from "./client";

export interface SiteSettings {
  id: string;
  siteName: string;
  supportEmail: string;
  defaultInquiryRoutingEmail: string;
  inquiryIntegrationProvider: string;
  inquiryIntegrationConfig: Record<string, unknown>;
  inquiryIntegrationSecretConfigured: boolean;
  inquiryWebhookUrl: string;
  inquiryWebhookSecretConfigured: boolean;
  logoUrl: string;
  faviconUrl: string;
  seoTitleTemplate: string;
  seoDefaultDesc: string;
  seoOgImage: string;
  seoIndexingEnabled: boolean;
  seoLocaleDefaults: Record<
    string,
    { titleTemplate?: string; description?: string; ogImage?: string }
  >;
  googleSiteVerify: string;
  bingSiteVerify: string;
  yandexSiteVerify: string;
  pinterestSiteVerify: string;
  gaTrackingId: string;
  gtmContainerId: string;
  clarityId: string;
  twitterHandle: string;
  linkedinUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  pinterestUrl: string;
  defaultLocale: string;
  activeLocales: string[];
  updatedAt: string;
  updatedBy: string | null;
}

export interface UpdateSettingsPayload {
  siteName?: string;
  supportEmail?: string;
  defaultInquiryRoutingEmail?: string;
  inquiryIntegrationProvider?: string;
  inquiryIntegrationConfig?: Record<string, unknown>;
  inquiryIntegrationSecret?: string;
  inquiryWebhookUrl?: string;
  inquiryWebhookSecret?: string;
  logoUrl?: string;
  faviconUrl?: string;
  seoTitleTemplate?: string;
  seoDefaultDesc?: string;
  seoOgImage?: string;
  seoIndexingEnabled?: boolean;
  seoLocaleDefaults?: Record<
    string,
    { titleTemplate?: string; description?: string; ogImage?: string }
  >;
  googleSiteVerify?: string;
  bingSiteVerify?: string;
  yandexSiteVerify?: string;
  pinterestSiteVerify?: string;
  gaTrackingId?: string;
  gtmContainerId?: string;
  clarityId?: string;
  twitterHandle?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  pinterestUrl?: string;
  defaultLocale?: string;
  activeLocales?: string[];
}

export type ReadinessSeverity = "ready" | "warning" | "blocking";

export interface GoLiveReadinessCheck {
  key: string;
  label: string;
  severity: ReadinessSeverity;
  summary: string;
  action: string | null;
}

export interface GoLiveReadiness {
  siteId: string;
  siteSlug: string;
  checkedAt: string;
  severity: ReadinessSeverity;
  isReady: boolean;
  liveUrl: string | null;
  primaryDomain: {
    hostname: string;
    status: string;
  } | null;
  checks: GoLiveReadinessCheck[];
}

export async function getSettings(): Promise<SiteSettings> {
  const { data } = await client.get<SiteSettings>("/settings");
  return data;
}

export async function updateSettings(
  payload: UpdateSettingsPayload,
): Promise<SiteSettings> {
  const { data } = await client.patch<SiteSettings>("/settings", payload);
  return data;
}

export async function getReadiness(): Promise<GoLiveReadiness> {
  const { data } = await client.get<GoLiveReadiness>("/settings/readiness");
  return data;
}

export interface HealthInfo {
  status: string;
  uptime: number;
  dbConnected: boolean;
  timestamp: string;
}

export async function getHealth(): Promise<HealthInfo> {
  const { data } = await client.get<HealthInfo>("/health");
  return data;
}
