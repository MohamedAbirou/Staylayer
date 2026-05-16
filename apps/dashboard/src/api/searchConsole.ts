import client from "./client";

export interface SearchConsoleConfig {
  oauthConfigured: boolean;
  encryptionConfigured: boolean;
  redirectUri: string | null;
  scope: string;
}

export interface SearchConsoleStatus {
  connected: boolean;
  status:
    | "ACTIVE"
    | "REVOKED"
    | "ERROR"
    | "PENDING"
    | null;
  propertyUrl: string | null;
  googleAccountEmail: string | null;
  scope: string | null;
  lastSyncedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  config: SearchConsoleConfig;
}

export interface SearchConsoleAuthUrlResponse {
  authUrl: string;
  state: string;
}

export interface SearchConsolePerformanceRow {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleOverview {
  totals: SearchConsolePerformanceRow;
  daily: Array<{ date: string } & SearchConsolePerformanceRow>;
  topPages: Array<{ page: string } & SearchConsolePerformanceRow>;
  topQueries: Array<{ query: string } & SearchConsolePerformanceRow>;
  rangeStart: string;
  rangeEnd: string;
}

export interface SearchConsoleSitemapRow {
  sitemapUrl: string;
  type: string | null;
  isPending: boolean;
  isSitemapsIndex: boolean;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  errors: number;
  warnings: number;
}

export interface SearchConsoleSyncJob {
  id: string;
  type: "DAILY" | "ON_DEMAND" | "BACKFILL" | "URL_INSPECTION" | "SITEMAP_SUBMIT";
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string | null;
  completedAt: string | null;
  pagesSynced: number;
  queriesSynced: number;
  sitemapsSynced: number;
  inspectionsRun: number;
  failureReason: string | null;
  triggeredBy: string | null;
  createdAt: string;
}

const BASE = "/seo/search-console";

export async function getSearchConsoleStatus(
  siteId: string,
): Promise<SearchConsoleStatus> {
  const { data } = await client.get<SearchConsoleStatus>(`${BASE}/connection`, {
    params: { siteId },
  });
  return data;
}

export async function startSearchConsoleOAuth(
  siteId: string,
  returnTo?: string,
): Promise<SearchConsoleAuthUrlResponse> {
  const { data } = await client.post<SearchConsoleAuthUrlResponse>(
    `${BASE}/oauth/url`,
    { returnTo },
    { params: { siteId } },
  );
  return data;
}

export async function completeSearchConsoleOAuth(
  siteId: string,
  body: { code: string; state: string; propertyUrl: string },
): Promise<SearchConsoleStatus> {
  const { data } = await client.post<SearchConsoleStatus>(
    `${BASE}/oauth/exchange`,
    body,
    { params: { siteId } },
  );
  return data;
}

export async function disconnectSearchConsole(
  siteId: string,
): Promise<{ ok: true }> {
  const { data } = await client.delete<{ ok: true }>(`${BASE}/connection`, {
    params: { siteId },
  });
  return data;
}

export async function triggerSearchConsoleSync(
  siteId: string,
  range?: { startDate?: string; endDate?: string },
): Promise<{ jobId: string }> {
  const { data } = await client.post<{ jobId: string }>(
    `${BASE}/sync`,
    range ?? {},
    { params: { siteId } },
  );
  return data;
}

export async function listSearchConsoleSyncJobs(
  siteId: string,
  limit = 20,
): Promise<SearchConsoleSyncJob[]> {
  const { data } = await client.get<SearchConsoleSyncJob[]>(
    `${BASE}/sync-jobs`,
    { params: { siteId, limit } },
  );
  return data;
}

export async function getSearchConsoleOverview(
  siteId: string,
  days = 28,
): Promise<SearchConsoleOverview> {
  const { data } = await client.get<SearchConsoleOverview>(
    `${BASE}/performance/overview`,
    { params: { siteId, days } },
  );
  return data;
}

export async function listSearchConsoleSitemaps(
  siteId: string,
): Promise<SearchConsoleSitemapRow[]> {
  const { data } = await client.get<SearchConsoleSitemapRow[]>(
    `${BASE}/sitemaps`,
    { params: { siteId } },
  );
  return data;
}

export async function submitSearchConsoleSitemap(
  siteId: string,
  sitemapUrl: string,
): Promise<{ ok: true }> {
  const { data } = await client.post<{ ok: true }>(
    `${BASE}/sitemaps/submit`,
    { sitemapUrl },
    { params: { siteId } },
  );
  return data;
}

export async function deleteSearchConsoleSitemap(
  siteId: string,
  sitemapUrl: string,
): Promise<{ ok: true }> {
  const { data } = await client.delete<{ ok: true }>(`${BASE}/sitemaps`, {
    params: { siteId, sitemapUrl },
  });
  return data;
}

export async function inspectSearchConsoleUrl(
  siteId: string,
  url: string,
  languageCode?: string,
): Promise<unknown> {
  const { data } = await client.post<unknown>(
    `${BASE}/url-inspection`,
    { url, languageCode },
    { params: { siteId } },
  );
  return data;
}
