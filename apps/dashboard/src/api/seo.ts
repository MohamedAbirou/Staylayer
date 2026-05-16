import client from "./client";

export interface RedirectDto {
  id: string;
  siteId: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  locale: string | null;
  reason: string | null;
  permanent: boolean;
  enabled: boolean;
  createdAt: string;
}

export interface SeoValidationResult {
  score: number;
  issues: {
    field: string;
    severity: string;
    message: string;
    suggestion?: string;
  }[];
  pass: boolean;
}

export interface StructuredDataDto {
  id: string;
  siteId: string;
  businessType: string;
  businessName: string | null;
  description: string | null;
  streetAddress: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  telephone: string | null;
  email: string | null;
  starRating: number | null;
  priceRange: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  amenities: string[] | null;
  roomCount: number | null;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  enabledSchemas: string[] | null;
  roomTypes: StructuredRoomType[] | null;
  offers: StructuredOffer[] | null;
}

export interface StructuredRoomType {
  name: string;
  description?: string;
  occupancy?: number | null;
  bedType?: string;
  imageUrl?: string;
}

export interface StructuredOffer {
  name: string;
  description?: string;
  price?: string;
  priceCurrency?: string;
  url?: string;
  availability?: string;
}

export async function getRedirects(siteId: string): Promise<RedirectDto[]> {
  const { data } = await client.get<RedirectDto[]>("/seo/redirects", {
    params: { siteId },
  });
  return data;
}

export async function createRedirect(
  siteId: string,
  body: {
    fromPath: string;
    toPath: string;
    statusCode?: number;
    locale?: string;
    reason?: string;
    permanent?: boolean;
  },
): Promise<RedirectDto> {
  const { data } = await client.post<RedirectDto>("/seo/redirects", body, {
    params: { siteId },
  });
  return data;
}

export async function toggleRedirect(
  siteId: string,
  redirectId: string,
  enabled: boolean,
): Promise<RedirectDto> {
  const { data } = await client.patch<RedirectDto>(
    `/seo/redirects/${redirectId}/toggle`,
    { enabled },
    { params: { siteId } },
  );
  return data;
}

export async function deleteRedirect(
  siteId: string,
  redirectId: string,
): Promise<void> {
  await client.delete(`/seo/redirects/${redirectId}`, {
    params: { siteId },
  });
}

// ── Redirect Migration Suite (Phase E.1) ───────────────────────────────────

export type RedirectIssueSeverity = "error" | "warning" | "info";
export type RedirectIssueCode =
  | "LOOP"
  | "CHAIN"
  | "CONFLICT"
  | "SELF"
  | "DISABLED_DEST";

export interface RedirectIssue {
  code: RedirectIssueCode;
  severity: RedirectIssueSeverity;
  redirectIds: string[];
  fromPath: string;
  toPath: string;
  locale: string | null;
  message: string;
  chain?: string[];
}

export interface RedirectAnalysisResult {
  totalRules: number;
  enabledRules: number;
  issues: RedirectIssue[];
  groupsByLocale: Record<string, Record<string, unknown[]>>;
}

export type RedirectImportMode = "skip" | "overwrite" | "strict";

export interface RedirectImportSummary {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  totalRows: number;
  errors: Array<{ line: number; column?: string; message: string }>;
  rejected: Array<{ line: number; reason: string }>;
}

export async function getRedirectAnalysis(
  siteId: string,
): Promise<RedirectAnalysisResult> {
  const { data } = await client.get<RedirectAnalysisResult>(
    "/seo/redirects/analysis",
    { params: { siteId } },
  );
  return data;
}

export async function exportRedirectsCsv(siteId: string): Promise<string> {
  const { data } = await client.get<string>("/seo/redirects/export", {
    params: { siteId },
    responseType: "text",
    transformResponse: (raw) => raw, // axios tries to JSON.parse otherwise
  });
  return data;
}

export async function importRedirectsCsv(
  siteId: string,
  csv: string,
  mode: RedirectImportMode = "skip",
): Promise<RedirectImportSummary> {
  const { data } = await client.post<RedirectImportSummary>(
    "/seo/redirects/import",
    { csv, mode },
    { params: { siteId } },
  );
  return data;
}

export async function renamePage(
  siteId: string,
  slug: string,
  locale: string,
  newSlug: string,
): Promise<{ slug: string; locale: string; previousSlug: string }> {
  const { data } = await client.post<{
    slug: string;
    locale: string;
    previousSlug: string;
  }>(
    `/pages/${encodeURIComponent(slug)}/rename`,
    { newSlug },
    {
      params: { siteId, locale },
    },
  );
  return data;
}

export async function validatePageSeo(
  siteId: string,
  slug: string,
  locale: string,
): Promise<SeoValidationResult> {
  const { data } = await client.get<SeoValidationResult>("/seo/validate", {
    params: { siteId, slug, locale },
  });
  return data;
}

export async function getStructuredData(
  siteId: string,
): Promise<StructuredDataDto | null> {
  const { data } = await client.get<StructuredDataDto | null>(
    "/seo/structured-data",
    { params: { siteId } },
  );
  return data;
}

export async function upsertStructuredData(
  siteId: string,
  body: Partial<StructuredDataDto>,
): Promise<StructuredDataDto> {
  const { data } = await client.post<StructuredDataDto>(
    "/seo/structured-data",
    body,
    { params: { siteId } },
  );
  return data;
}

// ── Robots ──────────────────────────────────────────────────────────────────

export type RobotsPolicy = "allow" | "disallow";

export interface RobotsCatalogEntry {
  userAgent: string;
  label: string;
  category: "search_engine" | "ai_training" | "ai_assistant" | "ai_search";
  defaultPolicy: RobotsPolicy;
  description: string;
  vendor: string;
}

export interface RobotsSettingsResponse {
  siteId: string;
  indexingEnabled: boolean;
  robotsCustomRules: string;
  robotsAiCrawlerPolicy: Record<string, RobotsPolicy>;
  effectiveAiCrawlerPolicy: Record<string, RobotsPolicy>;
  sitemapExcludedPaths: string[];
  sitemapIncludeImages: boolean;
  catalog: RobotsCatalogEntry[];
}

export interface RobotsValidationIssue {
  line: number;
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface RobotsTestResult {
  url: string;
  pathname: string;
  userAgent: string;
  decision: RobotsPolicy;
  matchedRule: string | null;
  groupUserAgent: string;
}

export async function getRobotsSettings(
  siteId: string,
): Promise<RobotsSettingsResponse> {
  const { data } = await client.get<RobotsSettingsResponse>("/seo/robots", {
    params: { siteId },
  });
  return data;
}

export async function updateRobotsSettings(
  siteId: string,
  body: Partial<{
    robotsCustomRules: string;
    robotsAiCrawlerPolicy: Record<string, RobotsPolicy>;
    sitemapExcludedPaths: string[];
    sitemapIncludeImages: boolean;
  }>,
): Promise<RobotsSettingsResponse> {
  const { data } = await client.put<RobotsSettingsResponse>(
    "/seo/robots",
    body,
    { params: { siteId } },
  );
  return data;
}

export async function previewRobots(siteId: string): Promise<{
  canonicalHost: string;
  indexingEnabled: boolean;
  content: string;
}> {
  const { data } = await client.get("/seo/robots/preview", {
    params: { siteId },
  });
  return data;
}

export async function validateRobots(siteId: string): Promise<{
  issues: RobotsValidationIssue[];
  indexingEnabled: boolean;
  customRulesLength: number;
}> {
  const { data } = await client.get("/seo/robots/validate", {
    params: { siteId },
  });
  return data;
}

export async function testRobots(
  siteId: string,
  body: { url: string; userAgent?: string },
): Promise<RobotsTestResult> {
  const { data } = await client.post<RobotsTestResult>(
    "/seo/robots/test",
    body,
    { params: { siteId } },
  );
  return data;
}

// ── Sitemap ─────────────────────────────────────────────────────────────────

export interface SitemapPreviewRoute {
  path: string;
  url: string;
  locales: string[];
  lastModified: string;
  images: string[];
  excluded: boolean;
  excludedReason: string | null;
}

export interface SitemapPreviewResponse {
  siteId: string;
  canonicalHost: string;
  indexingEnabled: boolean;
  sitemapEnabled: boolean;
  includeImages: boolean;
  excludedPaths: string[];
  totalPages: number;
  includedRoutes: number;
  excludedRoutes: number;
  totalImages: number;
  routes: SitemapPreviewRoute[];
}

export async function previewSitemap(
  siteId: string,
): Promise<SitemapPreviewResponse> {
  const { data } = await client.get<SitemapPreviewResponse>(
    "/seo/sitemap/preview",
    { params: { siteId } },
  );
  return data;
}

// ── IndexNow ────────────────────────────────────────────────────────────────

export type SearchEngineSubmissionStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "SKIPPED";

export type SearchEngineSubmissionTarget =
  | "INDEXNOW_AUTO_PUBLISH"
  | "INDEXNOW_AUTO_UNPUBLISH"
  | "INDEXNOW_AUTO_DELETE"
  | "INDEXNOW_AUTO_REDIRECT_CREATE"
  | "INDEXNOW_AUTO_REDIRECT_REMOVE"
  | "INDEXNOW_MANUAL";

export interface IndexNowSubmissionEntry {
  id: string;
  target: SearchEngineSubmissionTarget;
  status: SearchEngineSubmissionStatus;
  urlCount: number;
  urls: string[];
  responseStatus: number | null;
  responseBody: string | null;
  reason: string | null;
  attempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface IndexNowOverview {
  siteId: string;
  enabled: boolean;
  key: string;
  keyFileUrl: string | null;
  canonicalHost: string;
  indexingEnabled: boolean;
  recentSubmissions: IndexNowSubmissionEntry[];
}

export async function getIndexNowOverview(
  siteId: string,
): Promise<IndexNowOverview> {
  const { data } = await client.get<IndexNowOverview>("/seo/indexnow", {
    params: { siteId },
  });
  return data;
}

export async function toggleIndexNow(
  siteId: string,
  enabled: boolean,
): Promise<{ enabled: boolean }> {
  const { data } = await client.patch<{ enabled: boolean }>(
    "/seo/indexnow",
    { enabled },
    { params: { siteId } },
  );
  return data;
}

export async function rotateIndexNowKey(
  siteId: string,
): Promise<{ key: string }> {
  const { data } = await client.post<{ key: string }>(
    "/seo/indexnow/rotate-key",
    {},
    { params: { siteId } },
  );
  return data;
}

export async function submitIndexNowUrls(
  siteId: string,
  urls: string[],
): Promise<{
  logId: string;
  status: SearchEngineSubmissionStatus;
  submitted: number;
  skipped: number;
  response: { status: number; body: string } | null;
}> {
  const { data } = await client.post(
    "/seo/indexnow/submit",
    { urls },
    { params: { siteId } },
  );
  return data;
}

export async function listIndexNowSubmissions(
  siteId: string,
  filters: {
    target?: SearchEngineSubmissionTarget;
    status?: SearchEngineSubmissionStatus;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<{
  items: IndexNowSubmissionEntry[];
  nextCursor: string | null;
}> {
  const { data } = await client.get("/seo/indexnow/submissions", {
    params: {
      siteId,
      target: filters.target,
      status: filters.status,
      cursor: filters.cursor,
      limit: filters.limit,
    },
  });
  return data;
}

export async function retryIndexNowSubmission(
  siteId: string,
  logId: string,
): Promise<{
  logId: string;
  status: SearchEngineSubmissionStatus;
  attempts: number;
  response: { status: number; body: string } | null;
}> {
  const { data } = await client.post(
    `/seo/indexnow/submissions/${encodeURIComponent(logId)}/retry`,
    {},
    { params: { siteId } },
  );
  return data;
}

// ── SEO Crawler ─────────────────────────────────────────────────────────────

export type SeoCrawlJobStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED";

export type SeoCrawlIssueSeverity = "ERROR" | "WARNING" | "INFO";

export type SeoCrawlIssueCategory =
  | "META"
  | "CONTENT"
  | "LINKS"
  | "IMAGES"
  | "PERFORMANCE"
  | "INDEXABILITY"
  | "STRUCTURED_DATA"
  | "ACCESSIBILITY";

export interface SeoCrawlJob {
  id: string;
  siteId: string;
  status: SeoCrawlJobStatus;
  startUrl: string;
  canonicalHost: string;
  urlLimit: number;
  maxDepth: number;
  totalUrls: number;
  completedUrls: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  brokenLinkCount: number;
  durationMs: number | null;
  failureReason: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SeoCrawlUrlResult {
  id: string;
  crawlJobId: string;
  url: string;
  pathname: string;
  depth: number;
  statusCode: number;
  contentType: string | null;
  contentLength: number | null;
  responseTimeMs: number | null;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1Count: number;
  h1First: string | null;
  h2Count: number;
  h3Count: number;
  wordCount: number;
  imageCount: number;
  imagesMissingAlt: number;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: number;
  redirectChain: { url: string; status: number }[];
  finalUrl: string | null;
  robotsHeader: string | null;
  indexable: boolean;
  noindexReason: string | null;
  errorCount: number;
  warningCount: number;
  fetchError: string | null;
  createdAt: string;
}

export interface SeoCrawlIssue {
  id: string;
  crawlJobId: string;
  urlResultId: string;
  code: string;
  severity: SeoCrawlIssueSeverity;
  category: SeoCrawlIssueCategory;
  message: string;
  recommendation: string | null;
  context: unknown;
  createdAt: string;
  result?: { url: string; statusCode: number };
}

export interface PaginatedSeoCrawlResults {
  items: SeoCrawlUrlResult[];
  nextCursor: string | null;
}

export interface PaginatedSeoCrawlIssues {
  items: SeoCrawlIssue[];
  nextCursor: string | null;
}

export async function startSeoCrawl(
  siteId: string,
  body: { urlLimit: number; maxDepth?: number },
): Promise<SeoCrawlJob> {
  const { data } = await client.post<SeoCrawlJob>("/seo/crawler/jobs", body, {
    params: { siteId },
  });
  return data;
}

export async function listSeoCrawlJobs(
  siteId: string,
  limit = 20,
): Promise<SeoCrawlJob[]> {
  const { data } = await client.get<SeoCrawlJob[]>("/seo/crawler/jobs", {
    params: { siteId, limit },
  });
  return data;
}

export async function getSeoCrawlJob(
  siteId: string,
  jobId: string,
): Promise<SeoCrawlJob> {
  const { data } = await client.get<SeoCrawlJob>(`/seo/crawler/jobs/${jobId}`, {
    params: { siteId },
  });
  return data;
}

export async function listSeoCrawlResults(
  siteId: string,
  jobId: string,
  params: {
    cursor?: string;
    limit?: number;
    statusCode?: number;
    hasIssues?: boolean;
  } = {},
): Promise<PaginatedSeoCrawlResults> {
  const { data } = await client.get<PaginatedSeoCrawlResults>(
    `/seo/crawler/jobs/${jobId}/results`,
    {
      params: {
        siteId,
        cursor: params.cursor,
        limit: params.limit,
        statusCode: params.statusCode,
        hasIssues: params.hasIssues,
      },
    },
  );
  return data;
}

export async function listSeoCrawlIssues(
  siteId: string,
  jobId: string,
  params: {
    cursor?: string;
    limit?: number;
    severity?: SeoCrawlIssueSeverity;
    code?: string;
  } = {},
): Promise<PaginatedSeoCrawlIssues> {
  const { data } = await client.get<PaginatedSeoCrawlIssues>(
    `/seo/crawler/jobs/${jobId}/issues`,
    {
      params: {
        siteId,
        cursor: params.cursor,
        limit: params.limit,
        severity: params.severity,
        code: params.code,
      },
    },
  );
  return data;
}

export async function cancelSeoCrawl(
  siteId: string,
  jobId: string,
): Promise<SeoCrawlJob> {
  const { data } = await client.post<SeoCrawlJob>(
    `/seo/crawler/jobs/${jobId}/cancel`,
    {},
    { params: { siteId } },
  );
  return data;
}

export function seoCrawlExportUrl(siteId: string, jobId: string): string {
  const params = new URLSearchParams({ siteId });
  return `/seo/crawler/jobs/${jobId}/export.csv?${params.toString()}`;
}

// ── Phase A.3: link graph ────────────────────────────────────────────────

export interface SeoLinkGraphPageRanking {
  resultId: string;
  url: string;
  pathname: string;
  statusCode: number;
  depth: number;
  indexable: boolean;
  count: number;
}

export interface SeoLinkGraphDepthRow {
  resultId: string;
  url: string;
  pathname: string;
  statusCode: number;
  depth: number;
  indexable: boolean;
}

export interface SeoLinkGraphBrokenLink {
  linkId: string;
  sourceResultId: string;
  sourceUrl: string;
  sourcePathname: string;
  targetResultId: string | null;
  targetUrl: string;
  targetStatusCode: number | null;
  anchorText: string | null;
}

export interface SeoCrawlLinkGraph {
  jobId: string;
  jobStatus: string;
  totals: {
    totalUrls: number;
    indexablePages: number;
    totalLinks: number;
    internalLinks: number;
    externalLinks: number;
    uniqueExternalDomains: number;
  };
  topInbound: SeoLinkGraphPageRanking[];
  topOutbound: SeoLinkGraphPageRanking[];
  deepestPages: SeoLinkGraphDepthRow[];
  orphanPages: SeoLinkGraphDepthRow[];
  brokenInternalLinks: SeoLinkGraphBrokenLink[];
}

export interface SeoPageInboundLink {
  id: string;
  anchorText: string | null;
  rel: string | null;
  nofollow: boolean;
  sourceResultId: string;
  sourceUrl: string;
  sourcePathname: string;
  sourceStatusCode: number;
  sourceDepth: number;
}

export interface SeoPageOutboundLink {
  id: string;
  targetUrl: string;
  targetPathname: string | null;
  anchorText: string | null;
  rel: string | null;
  nofollow: boolean;
  isInternal: boolean;
  targetResultId: string | null;
  targetStatusCode: number | null;
  targetDepth: number | null;
  targetIndexable: boolean | null;
}

export interface SeoPageLinks {
  result: {
    id: string;
    url: string;
    pathname: string;
    statusCode: number;
    depth: number;
  };
  inbound: SeoPageInboundLink[];
  outbound: SeoPageOutboundLink[];
  inboundCount: number;
  outboundCount: number;
  truncated: { inbound: boolean; outbound: boolean };
}

export async function getSeoCrawlLinkGraph(
  siteId: string,
  jobId: string,
  topN = 25,
): Promise<SeoCrawlLinkGraph> {
  const { data } = await client.get<SeoCrawlLinkGraph>(
    `/seo/crawler/jobs/${jobId}/link-graph`,
    { params: { siteId, topN } },
  );
  return data;
}

export async function getSeoCrawlPageLinks(
  siteId: string,
  jobId: string,
  resultId: string,
  limit = 100,
): Promise<SeoPageLinks> {
  const { data } = await client.get<SeoPageLinks>(
    `/seo/crawler/jobs/${jobId}/results/${resultId}/links`,
    { params: { siteId, limit } },
  );
  return data;
}

// ── Phase D.1: image SEO audit ───────────────────────────────────────────

export type ImageAltQuality =
  | "MISSING"
  | "EMPTY"
  | "FILENAME_LIKE"
  | "TOO_SHORT"
  | "TOO_LONG"
  | "GOOD";

export interface SeoImageJobSummary {
  jobId: string;
  status: SeoCrawlJobStatus;
  imageTotal: number;
  imageMissingAlt: number;
  imageFilenameAlt: number;
  imageOversizedOg: number;
  imageUndersizedOg: number;
  imageMissingDims: number;
  imageNotLazy: number;
  imageMissingSitemap: number;
}

export interface SeoImagePageRow {
  resultId: string;
  url: string;
  pathname: string;
  statusCode: number;
  imageFindingsTotal: number;
  imageFindingsMissing: number;
  imageFindingsIssues: number;
  ogImage: string | null;
}

export interface PaginatedSeoImagePages {
  items: SeoImagePageRow[];
  nextCursor: string | null;
}

export interface SeoImageFinding {
  id: string;
  src: string;
  filename: string | null;
  alt: string | null;
  hasAlt: boolean;
  altQuality: ImageAltQuality;
  widthAttr: number | null;
  heightAttr: number | null;
  loadingAttr: string | null;
  isOgImage: boolean;
  inSitemap: boolean;
  aboveFold: boolean;
  flags: string[];
}

export interface SeoImagePageFindings {
  resultId: string;
  url: string;
  pathname: string;
  ogImage: string | null;
  findings: SeoImageFinding[];
}

export async function getSeoImageJobSummary(
  siteId: string,
  jobId: string,
): Promise<SeoImageJobSummary> {
  const { data } = await client.get<SeoImageJobSummary>(
    `/seo/images/jobs/${jobId}/summary`,
    { params: { siteId } },
  );
  return data;
}

export async function listSeoImagePages(
  siteId: string,
  jobId: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<PaginatedSeoImagePages> {
  const { data } = await client.get<PaginatedSeoImagePages>(
    `/seo/images/jobs/${jobId}/pages`,
    {
      params: { siteId, cursor: params.cursor, limit: params.limit },
    },
  );
  return data;
}

export async function getSeoImagePageFindings(
  siteId: string,
  jobId: string,
  resultId: string,
  limit = 100,
): Promise<SeoImagePageFindings> {
  const { data } = await client.get<SeoImagePageFindings>(
    `/seo/images/jobs/${jobId}/results/${resultId}/findings`,
    { params: { siteId, limit } },
  );
  return data;
}

// ── Phase E.2: AI citation readiness ────────────────────────────────────

export type AiCitationGrade = "A" | "B" | "C" | "D" | "F";
export type AiCitationSeverity = "error" | "warning" | "info" | "success";

export interface AiCitationFinding {
  code: string;
  severity: AiCitationSeverity;
  message: string;
  snippet?: string;
  locator?: string;
  delta: number;
}

export interface AiCitationSignals {
  entityFacts: { count: number; samples: string[] };
  answerReady: { count: number; samples: string[] };
  freshness: {
    daysSinceUpdate: number | null;
    verdict: "fresh" | "ok" | "stale" | "unknown";
  };
  robots: { allowsCitation: boolean; flags: string[] };
  structuredData: { types: string[]; hasQaSchema: boolean };
  headings: { total: number; questionLike: number };
  wordCount: number;
}

export interface AiCitationReport {
  siteId: string;
  slug: string;
  locale: string;
  score: number;
  grade: AiCitationGrade;
  findings: AiCitationFinding[];
  signals: AiCitationSignals;
  analyzedAt: string;
}

export interface AiCitationOverviewRow {
  slug: string;
  locale: string;
  score: number;
  grade: AiCitationGrade;
  entityFactCount: number;
  answerReadyCount: number;
  freshnessDays: number | null;
  analyzedAt: string;
  topIssue: string | null;
}

export interface AiCitationOverview {
  siteId: string;
  pageCount: number;
  averageScore: number | null;
  rows: AiCitationOverviewRow[];
}

export async function getAiCitationOverview(
  siteId: string,
): Promise<AiCitationOverview> {
  const { data } = await client.get<AiCitationOverview>(
    "/seo/ai-citation/overview",
    { params: { siteId } },
  );
  return data;
}

export async function getAiCitationReport(
  siteId: string,
  slug: string,
  locale: string,
): Promise<AiCitationReport> {
  const { data } = await client.get<AiCitationReport>(
    "/seo/ai-citation/report",
    { params: { siteId, slug, locale } },
  );
  return data;
}

export async function analyzeAiCitation(
  siteId: string,
  slug: string,
  locale: string,
): Promise<AiCitationReport> {
  const { data } = await client.post<AiCitationReport>(
    "/seo/ai-citation/analyze",
    null,
    { params: { siteId, slug, locale } },
  );
  return data;
}

// ─── Phase E.3: Scheduled audits + history + alerts ────────────────────

export type SeoAuditCadence = "OFF" | "DAILY" | "WEEKLY";

export interface SeoAuditScheduleDto {
  id: string;
  siteId: string;
  cadence: SeoAuditCadence;
  enabled: boolean;
  hourUtc: number;
  dayOfWeek: number | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SeoAuditRunKind = "SCHEDULED" | "MANUAL";
export type SeoAuditRunStatus = "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";

export interface SeoAuditRunDto {
  id: string;
  siteId: string;
  kind: SeoAuditRunKind;
  status: SeoAuditRunStatus;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  pagesAudited: number;
  alertsCreated: number;
  averageScore: number | null;
  error: string | null;
  triggeredBy: string | null;
}

export interface SeoAuditSnapshotDto {
  id: string;
  runId: string;
  siteId: string;
  slug: string;
  locale: string;
  score: number;
  grade: string;
  entityFactCount: number;
  answerReadyCount: number;
  findingsCount: number;
  allowsCitation: boolean;
  recordedAt: string;
}

export interface SeoAuditRunDetailsDto extends SeoAuditRunDto {
  snapshots: SeoAuditSnapshotDto[];
}

export type SeoAuditAlertSeverity = "WARNING" | "CRITICAL";
export type SeoAuditAlertStatus = "OPEN" | "RESOLVED";

export interface SeoAuditAlertDto {
  id: string;
  siteId: string;
  type: "SEO_AUDIT_REGRESSION" | "SEO_AUDIT_CRITICAL";
  severity: SeoAuditAlertSeverity;
  status: SeoAuditAlertStatus;
  fingerprint: string;
  message: string;
  metadata: {
    runId?: string;
    slug?: string;
    locale?: string;
    reason?: string;
    currentScore?: number;
    previousScore?: number | null;
  } | null;
  firstTriggeredAt: string;
  lastTriggeredAt: string;
  resolvedAt: string | null;
}

export async function getSeoAuditSchedule(
  siteId: string,
): Promise<SeoAuditScheduleDto> {
  const { data } = await client.get<SeoAuditScheduleDto>(
    "/seo/audit/schedule",
    {
      params: { siteId },
    },
  );
  return data;
}

export async function updateSeoAuditSchedule(
  siteId: string,
  payload: Partial<
    Pick<SeoAuditScheduleDto, "cadence" | "enabled" | "hourUtc" | "dayOfWeek">
  >,
): Promise<SeoAuditScheduleDto> {
  const { data } = await client.put<SeoAuditScheduleDto>(
    "/seo/audit/schedule",
    payload,
    { params: { siteId } },
  );
  return data;
}

export async function listSeoAuditRuns(
  siteId: string,
  limit = 20,
): Promise<SeoAuditRunDto[]> {
  const { data } = await client.get<SeoAuditRunDto[]>("/seo/audit/runs", {
    params: { siteId, limit },
  });
  return data;
}

export async function triggerSeoAuditRun(
  siteId: string,
): Promise<SeoAuditRunDto> {
  const { data } = await client.post<SeoAuditRunDto>("/seo/audit/runs", null, {
    params: { siteId },
  });
  return data;
}

export async function getSeoAuditRun(
  siteId: string,
  runId: string,
): Promise<SeoAuditRunDetailsDto> {
  const { data } = await client.get<SeoAuditRunDetailsDto>(
    `/seo/audit/runs/${runId}`,
    { params: { siteId } },
  );
  return data;
}

export async function getSeoAuditHistory(
  siteId: string,
  slug: string,
  locale: string,
  limit = 30,
): Promise<SeoAuditSnapshotDto[]> {
  const { data } = await client.get<SeoAuditSnapshotDto[]>(
    "/seo/audit/history",
    { params: { siteId, slug, locale, limit } },
  );
  return data;
}

export async function listSeoAuditAlerts(
  siteId: string,
  status: "OPEN" | "RESOLVED" | "ALL" = "OPEN",
): Promise<SeoAuditAlertDto[]> {
  const { data } = await client.get<SeoAuditAlertDto[]>("/seo/audit/alerts", {
    params: { siteId, status },
  });
  return data;
}

export async function dismissSeoAuditAlert(
  siteId: string,
  alertId: string,
): Promise<SeoAuditAlertDto> {
  const { data } = await client.patch<SeoAuditAlertDto>(
    `/seo/audit/alerts/${alertId}/dismiss`,
    null,
    { params: { siteId } },
  );
  return data;
}

// ── Phase E.4: Audit Tasks ─────────────────────────────────────────────

export type SeoAuditTaskStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "DISMISSED";
export type SeoAuditTaskPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SeoAuditTaskSource = "ALERT" | "MANUAL";

export interface SeoAuditTaskRefUser {
  id: string;
  email: string;
}

export interface SeoAuditTaskRefAlert {
  id: string;
  severity: SeoAuditAlertSeverity;
  type: string;
  status: SeoAuditAlertStatus;
}

export interface SeoAuditTaskDto {
  id: string;
  siteId: string;
  sourceAlertId: string | null;
  source: SeoAuditTaskSource;
  slug: string;
  locale: string;
  title: string;
  description: string | null;
  status: SeoAuditTaskStatus;
  priority: SeoAuditTaskPriority;
  assigneeUserId: string | null;
  createdByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: SeoAuditTaskRefUser | null;
  createdBy: SeoAuditTaskRefUser | null;
  sourceAlert: SeoAuditTaskRefAlert | null;
}

export interface SeoAuditTaskAssigneeDto {
  userId: string;
  email: string;
  role: string;
}

export interface SeoAuditTaskSummaryDto {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  dismissed: number;
  unassigned: number;
  criticalOpen: number;
}

export interface ListAuditTasksFilters {
  status?: SeoAuditTaskStatus | "ALL";
  priority?: SeoAuditTaskPriority;
  assigneeUserId?: string;
  unassigned?: boolean;
  slug?: string;
  locale?: string;
  limit?: number;
}

export type BulkAuditTaskAction =
  | { kind: "ASSIGN"; assigneeUserId: string | null }
  | { kind: "STATUS"; status: SeoAuditTaskStatus }
  | { kind: "PRIORITY"; priority: SeoAuditTaskPriority }
  | { kind: "DELETE" };

export async function listAuditTasks(
  siteId: string,
  filters: ListAuditTasksFilters = {},
): Promise<SeoAuditTaskDto[]> {
  const { data } = await client.get<SeoAuditTaskDto[]>("/seo/audit/tasks", {
    params: { siteId, ...filters },
  });
  return data;
}

export async function getAuditTaskSummary(
  siteId: string,
): Promise<SeoAuditTaskSummaryDto> {
  const { data } = await client.get<SeoAuditTaskSummaryDto>(
    "/seo/audit/tasks/summary",
    { params: { siteId } },
  );
  return data;
}

export async function listAuditTaskAssignees(
  siteId: string,
): Promise<SeoAuditTaskAssigneeDto[]> {
  const { data } = await client.get<SeoAuditTaskAssigneeDto[]>(
    "/seo/audit/tasks/assignees",
    { params: { siteId } },
  );
  return data;
}

export async function createAuditTask(
  siteId: string,
  payload: {
    slug: string;
    locale: string;
    title: string;
    description?: string | null;
    priority?: SeoAuditTaskPriority;
    status?: SeoAuditTaskStatus;
    assigneeUserId?: string | null;
  },
): Promise<SeoAuditTaskDto> {
  const { data } = await client.post<SeoAuditTaskDto>(
    "/seo/audit/tasks",
    payload,
    { params: { siteId } },
  );
  return data;
}

export async function updateAuditTask(
  siteId: string,
  taskId: string,
  payload: {
    title?: string;
    description?: string | null;
    status?: SeoAuditTaskStatus;
    priority?: SeoAuditTaskPriority;
    assigneeUserId?: string | null;
  },
): Promise<SeoAuditTaskDto> {
  const { data } = await client.patch<SeoAuditTaskDto>(
    `/seo/audit/tasks/${taskId}`,
    payload,
    { params: { siteId } },
  );
  return data;
}

export async function deleteAuditTask(
  siteId: string,
  taskId: string,
): Promise<void> {
  await client.delete(`/seo/audit/tasks/${taskId}`, {
    params: { siteId },
  });
}

export async function bulkUpdateAuditTasks(
  siteId: string,
  taskIds: string[],
  action: BulkAuditTaskAction,
): Promise<{ matched: number; affected: number }> {
  const { data } = await client.post<{ matched: number; affected: number }>(
    "/seo/audit/tasks/bulk",
    { taskIds, action },
    { params: { siteId } },
  );
  return data;
}
