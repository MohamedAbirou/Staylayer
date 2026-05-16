import client from "./client";

export interface BingWebmasterStatus {
  connected: boolean;
  status: "ACTIVE" | "REVOKED" | "ERROR" | null;
  propertyUrl: string | null;
  apiKeyFingerprint: string | null;
  lastSyncedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  config: { encryptionConfigured: boolean };
}

export interface BingPerformanceRow {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface BingOverview {
  totals: BingPerformanceRow;
  daily: Array<{ date: string } & BingPerformanceRow>;
  topPages: Array<{ page: string } & BingPerformanceRow>;
  topQueries: Array<{ query: string } & BingPerformanceRow>;
  rangeStart: string;
  rangeEnd: string;
}

export interface BingSitemapRow {
  sitemapUrl: string;
  status: string | null;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  urlCount: number;
  errors: number;
  warnings: number;
}

export interface BingSyncJob {
  id: string;
  type: "DAILY" | "ON_DEMAND" | "SITEMAP_SUBMIT";
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string | null;
  completedAt: string | null;
  pagesSynced: number;
  queriesSynced: number;
  sitemapsSynced: number;
  crawlIssuesSynced: number;
  failureReason: string | null;
  triggeredBy: string | null;
  createdAt: string;
}

export interface BingCrawlIssue {
  id: string;
  url: string;
  issueCode: string;
  category: string | null;
  severity: "ERROR" | "WARNING" | "INFO";
  httpCode: number | null;
  firstDetectedAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

export interface BingLinkSummary {
  totalLinks: number;
  topDomains: Array<{ domain: string; count: number }>;
  fetchedAt: string | null;
}

export interface BingVerifyResponse {
  properties: Array<{ url: string; isVerified: boolean }>;
}

const BASE = "/seo/bing-webmaster";

export async function getBingStatus(
  siteId: string,
): Promise<BingWebmasterStatus> {
  const { data } = await client.get<BingWebmasterStatus>(`${BASE}/connection`, {
    params: { siteId },
  });
  return data;
}

export async function verifyBingApiKey(
  siteId: string,
  apiKey: string,
): Promise<BingVerifyResponse> {
  const { data } = await client.post<BingVerifyResponse>(
    `${BASE}/verify`,
    { apiKey },
    { params: { siteId } },
  );
  return data;
}

export async function connectBing(
  siteId: string,
  body: { apiKey: string; propertyUrl: string },
): Promise<BingWebmasterStatus> {
  const { data } = await client.post<BingWebmasterStatus>(
    `${BASE}/connection`,
    body,
    { params: { siteId } },
  );
  return data;
}

export async function disconnectBing(siteId: string): Promise<{ ok: true }> {
  const { data } = await client.delete<{ ok: true }>(`${BASE}/connection`, {
    params: { siteId },
  });
  return data;
}

export async function triggerBingSync(
  siteId: string,
): Promise<{ jobId: string }> {
  const { data } = await client.post<{ jobId: string }>(
    `${BASE}/sync`,
    {},
    { params: { siteId } },
  );
  return data;
}

export async function listBingSyncJobs(
  siteId: string,
  limit = 20,
): Promise<BingSyncJob[]> {
  const { data } = await client.get<BingSyncJob[]>(`${BASE}/sync-jobs`, {
    params: { siteId, limit },
  });
  return data;
}

export async function getBingOverview(
  siteId: string,
  days = 28,
): Promise<BingOverview> {
  const { data } = await client.get<BingOverview>(
    `${BASE}/performance/overview`,
    { params: { siteId, days } },
  );
  return data;
}

export async function listBingSitemaps(
  siteId: string,
): Promise<BingSitemapRow[]> {
  const { data } = await client.get<BingSitemapRow[]>(`${BASE}/sitemaps`, {
    params: { siteId },
  });
  return data;
}

export async function submitBingSitemap(
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

export async function deleteBingSitemap(
  siteId: string,
  sitemapUrl: string,
): Promise<{ ok: true }> {
  const { data } = await client.delete<{ ok: true }>(`${BASE}/sitemaps`, {
    params: { siteId, sitemapUrl },
  });
  return data;
}

export async function listBingCrawlIssues(
  siteId: string,
  limit = 100,
): Promise<BingCrawlIssue[]> {
  const { data } = await client.get<BingCrawlIssue[]>(`${BASE}/crawl-issues`, {
    params: { siteId, limit },
  });
  return data;
}

export async function getBingLinkSummary(
  siteId: string,
): Promise<BingLinkSummary> {
  const { data } = await client.get<BingLinkSummary>(`${BASE}/link-summary`, {
    params: { siteId },
  });
  return data;
}
