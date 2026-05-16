import client from "./client";

export type PsiStrategy = "MOBILE" | "DESKTOP";
export type PsiAuditStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
export type CruxFormFactor = "PHONE" | "DESKTOP" | "TABLET" | "ALL";

export interface PsiConfig {
  configured: boolean;
  psiCacheMaxAgeHours: number;
  cruxCacheMaxAgeHours: number;
}

export interface PsiQuota {
  limit: number;
  used: number;
  remaining: number;
}

export interface PsiAuditSummary {
  id: string;
  url: string;
  strategy: PsiStrategy;
  status: PsiAuditStatus;
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  largestContentfulPaintMs: number | null;
  firstContentfulPaintMs: number | null;
  cumulativeLayoutShift: number | null;
  totalBlockingTimeMs: number | null;
  interactionToNextPaintMs: number | null;
  speedIndexMs: number | null;
  fetchTime: string | null;
  failureReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface PsiAuditDetail extends PsiAuditSummary {
  pwaScore: number | null;
  timeToInteractiveMs: number | null;
  lighthouseVersion: string | null;
  userAgent: string | null;
  finalUrl: string | null;
  totalByteWeight: number | null;
  numRequests: number | null;
  triggeredBy: string | null;
  lighthouseResult: unknown;
  loadingExperience: unknown;
  originLoadingExperience: unknown;
}

export interface RunPsiAuditResult {
  audit: PsiAuditDetail;
  cached: boolean;
}

export interface CruxRecordRow {
  id: string;
  siteId: string;
  scope: "URL" | "ORIGIN";
  recordKey: string;
  formFactor: CruxFormFactor;
  lcpP75Ms: number | null;
  fcpP75Ms: number | null;
  clsP75: number | null;
  inpP75Ms: number | null;
  ttfbP75Ms: number | null;
  fidP75Ms: number | null;
  record: unknown;
  collectionPeriodStart: string | null;
  collectionPeriodEnd: string | null;
  fetchedAt: string;
}

export interface FetchCruxResult {
  record: CruxRecordRow | null;
  cached: boolean;
  notFound: boolean;
}

const BASE = "/seo/psi";

export async function getPsiConfig(siteId: string): Promise<PsiConfig> {
  const { data } = await client.get<PsiConfig>(`${BASE}/config`, {
    params: { siteId },
  });
  return data;
}

export async function getPsiQuota(siteId: string): Promise<PsiQuota> {
  const { data } = await client.get<PsiQuota>(`${BASE}/quota`, {
    params: { siteId },
  });
  return data;
}

export async function runPsiAudit(
  siteId: string,
  body: { url: string; strategy?: PsiStrategy; forceRefresh?: boolean },
): Promise<RunPsiAuditResult> {
  const { data } = await client.post<RunPsiAuditResult>(
    `${BASE}/audits`,
    body,
    { params: { siteId } },
  );
  return data;
}

export async function listPsiAudits(
  siteId: string,
  params: {
    url?: string;
    strategy?: PsiStrategy;
    status?: PsiAuditStatus;
    limit?: number;
  } = {},
): Promise<PsiAuditSummary[]> {
  const { data } = await client.get<PsiAuditSummary[]>(`${BASE}/audits`, {
    params: { siteId, ...params },
  });
  return data;
}

export async function getLatestPsiAudits(
  siteId: string,
  limit = 25,
): Promise<PsiAuditSummary[]> {
  const { data } = await client.get<PsiAuditSummary[]>(
    `${BASE}/audits/latest`,
    {
      params: { siteId, limit },
    },
  );
  return data;
}

export async function getPsiAudit(
  siteId: string,
  id: string,
): Promise<PsiAuditDetail> {
  const { data } = await client.get<PsiAuditDetail>(`${BASE}/audits/${id}`, {
    params: { siteId },
  });
  return data;
}

export async function fetchCruxRecord(
  siteId: string,
  body: {
    url?: string;
    origin?: string;
    formFactor?: CruxFormFactor;
    forceRefresh?: boolean;
  },
): Promise<FetchCruxResult> {
  const { data } = await client.post<FetchCruxResult>(`${BASE}/crux`, body, {
    params: { siteId },
  });
  return data;
}
