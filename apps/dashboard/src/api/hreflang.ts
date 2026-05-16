import client from "./client";

export type HreflangScanStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export type HreflangIssueType =
  | "MISSING_LOCALE"
  | "ORPHAN_ALTERNATE"
  | "MISSING_X_DEFAULT"
  | "UNPUBLISHED_SIBLING"
  | "INVALID_LOCALE_CODE";

export type HreflangIssueSeverity = "ERROR" | "WARNING" | "INFO";

export interface HreflangScan {
  id: string;
  siteId: string;
  status: HreflangScanStatus;
  totalSlugs: number;
  totalPages: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  defaultLocale: string;
  activeLocales: string[];
  failureReason: string | null;
  triggeredBy: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface HreflangIssue {
  id: string;
  scanId: string;
  siteId: string;
  type: HreflangIssueType;
  severity: HreflangIssueSeverity;
  slug: string;
  locale: string | null;
  pageId: string | null;
  details: Record<string, unknown>;
  dismissedAt: string | null;
  dismissedBy: string | null;
  createdAt: string;
}

export interface ListIssuesResult {
  scanId: string | null;
  data: HreflangIssue[];
  nextCursor: string | null;
}

export interface BulkCreateStubsResult {
  created: Array<{ slug: string; locale: string; pageId: string }>;
  skipped: Array<{ slug: string; locale: string; reason: string }>;
}

const BASE = "/seo/hreflang";

export async function runHreflangScan(siteId: string): Promise<HreflangScan> {
  const { data } = await client.post<HreflangScan>(
    `${BASE}/scans`,
    {},
    { params: { siteId } },
  );
  return data;
}

export async function listHreflangScans(
  siteId: string,
  params: { limit?: number } = {},
): Promise<HreflangScan[]> {
  const { data } = await client.get<HreflangScan[]>(`${BASE}/scans`, {
    params: { siteId, ...params },
  });
  return data;
}

export async function getLatestHreflangScan(
  siteId: string,
): Promise<HreflangScan | null> {
  const { data } = await client.get<HreflangScan | null>(
    `${BASE}/scans/latest`,
    { params: { siteId } },
  );
  return data;
}

export async function getHreflangScan(
  siteId: string,
  scanId: string,
): Promise<HreflangScan> {
  const { data } = await client.get<HreflangScan>(
    `${BASE}/scans/${scanId}`,
    { params: { siteId } },
  );
  return data;
}

export async function listHreflangIssues(
  siteId: string,
  params: {
    scanId?: string;
    type?: HreflangIssueType;
    severity?: HreflangIssueSeverity;
    slug?: string;
    includeDismissed?: boolean;
    limit?: number;
    cursor?: string;
  } = {},
): Promise<ListIssuesResult> {
  const { data } = await client.get<ListIssuesResult>(`${BASE}/issues`, {
    params: { siteId, ...params },
  });
  return data;
}

export async function dismissHreflangIssue(
  siteId: string,
  issueId: string,
): Promise<HreflangIssue> {
  const { data } = await client.post<HreflangIssue>(
    `${BASE}/issues/${issueId}/dismiss`,
    {},
    { params: { siteId } },
  );
  return data;
}

export async function undismissHreflangIssue(
  siteId: string,
  issueId: string,
): Promise<HreflangIssue> {
  const { data } = await client.post<HreflangIssue>(
    `${BASE}/issues/${issueId}/undismiss`,
    {},
    { params: { siteId } },
  );
  return data;
}

export async function bulkCreateHreflangStubs(
  siteId: string,
  pairs: Array<{ slug: string; locale: string }>,
): Promise<BulkCreateStubsResult> {
  const { data } = await client.post<BulkCreateStubsResult>(
    `${BASE}/bulk/create-stubs`,
    { pairs },
    { params: { siteId } },
  );
  return data;
}
