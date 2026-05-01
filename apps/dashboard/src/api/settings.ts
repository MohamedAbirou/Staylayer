import client from "./client";

export interface SiteSettings {
  id: string;
  siteName: string;
  supportEmail: string;
  logoUrl: string;
  faviconUrl: string;
  seoTitleTemplate: string;
  seoDefaultDesc: string;
  seoOgImage: string;
  seoIndexingEnabled: boolean;
  googleSiteVerify: string;
  gaTrackingId: string;
  gtmContainerId: string;
  clarityId: string;
  twitterHandle: string;
  linkedinUrl: string;
  facebookUrl: string;
  defaultLocale: string;
  activeLocales: string[];
  updatedAt: string;
  updatedBy: string | null;
}

export type UpdateSettingsPayload = Partial<
  Omit<SiteSettings, "id" | "updatedAt" | "updatedBy">
>;

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
