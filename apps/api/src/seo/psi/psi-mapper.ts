import type { Prisma } from "@prisma/client";

/**
 * Pure mappers from PSI / CrUX raw payloads into Prisma row shapes.
 * Kept side-effect free so they can be unit-tested without network or DB.
 */

type Json = Prisma.JsonValue;

export interface ParsedLighthouseAudit {
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  pwaScore: number | null;
  largestContentfulPaintMs: number | null;
  firstContentfulPaintMs: number | null;
  cumulativeLayoutShift: number | null;
  totalBlockingTimeMs: number | null;
  interactionToNextPaintMs: number | null;
  speedIndexMs: number | null;
  timeToInteractiveMs: number | null;
  lighthouseVersion: string | null;
  userAgent: string | null;
  fetchTime: Date | null;
  finalUrl: string | null;
  totalByteWeight: number | null;
  numRequests: number | null;
}

const numericFromAudit = (
  audits: Record<string, unknown> | undefined,
  id: string,
): number | null => {
  if (!audits) return null;
  const audit = audits[id] as { numericValue?: unknown } | undefined;
  if (!audit) return null;
  const value = audit.numericValue;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const categoryScore = (
  categories: Record<string, unknown> | undefined,
  id: string,
): number | null => {
  if (!categories) return null;
  const category = categories[id] as { score?: unknown } | undefined;
  if (!category) return null;
  const value = category.score;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export function parseLighthouseResult(
  lighthouseResult: Record<string, unknown> | null | undefined,
): ParsedLighthouseAudit {
  if (!lighthouseResult) {
    return {
      performanceScore: null,
      accessibilityScore: null,
      bestPracticesScore: null,
      seoScore: null,
      pwaScore: null,
      largestContentfulPaintMs: null,
      firstContentfulPaintMs: null,
      cumulativeLayoutShift: null,
      totalBlockingTimeMs: null,
      interactionToNextPaintMs: null,
      speedIndexMs: null,
      timeToInteractiveMs: null,
      lighthouseVersion: null,
      userAgent: null,
      fetchTime: null,
      finalUrl: null,
      totalByteWeight: null,
      numRequests: null,
    };
  }

  const categories = lighthouseResult.categories as
    | Record<string, unknown>
    | undefined;
  const audits = lighthouseResult.audits as
    | Record<string, unknown>
    | undefined;
  const environment = lighthouseResult.environment as
    | { hostUserAgent?: string }
    | undefined;
  const fetchTimeRaw = lighthouseResult.fetchTime;
  const fetchTime =
    typeof fetchTimeRaw === "string" ? new Date(fetchTimeRaw) : null;

  // Network resource summary (count + transfer size).
  const networkSummary = audits?.["network-requests"] as
    | { details?: { items?: unknown[] } }
    | undefined;
  const numRequests = Array.isArray(networkSummary?.details?.items)
    ? networkSummary!.details!.items!.length
    : null;
  const totalByteWeight = numericFromAudit(audits, "total-byte-weight");

  return {
    performanceScore: categoryScore(categories, "performance"),
    accessibilityScore: categoryScore(categories, "accessibility"),
    bestPracticesScore: categoryScore(categories, "best-practices"),
    seoScore: categoryScore(categories, "seo"),
    pwaScore: categoryScore(categories, "pwa"),
    largestContentfulPaintMs: numericFromAudit(
      audits,
      "largest-contentful-paint",
    ),
    firstContentfulPaintMs: numericFromAudit(audits, "first-contentful-paint"),
    cumulativeLayoutShift: numericFromAudit(audits, "cumulative-layout-shift"),
    totalBlockingTimeMs: numericFromAudit(audits, "total-blocking-time"),
    interactionToNextPaintMs:
      numericFromAudit(audits, "interaction-to-next-paint") ??
      numericFromAudit(audits, "experimental-interaction-to-next-paint"),
    speedIndexMs: numericFromAudit(audits, "speed-index"),
    timeToInteractiveMs:
      numericFromAudit(audits, "interactive") ??
      numericFromAudit(audits, "time-to-interactive"),
    lighthouseVersion:
      typeof lighthouseResult.lighthouseVersion === "string"
        ? (lighthouseResult.lighthouseVersion as string)
        : null,
    userAgent: environment?.hostUserAgent ?? null,
    fetchTime: fetchTime && !Number.isNaN(fetchTime.getTime()) ? fetchTime : null,
    finalUrl:
      typeof lighthouseResult.finalUrl === "string"
        ? (lighthouseResult.finalUrl as string)
        : typeof lighthouseResult.finalDisplayedUrl === "string"
          ? (lighthouseResult.finalDisplayedUrl as string)
          : null,
    totalByteWeight:
      totalByteWeight !== null ? Math.round(totalByteWeight) : null,
    numRequests,
  };
}

export interface ParsedCruxRecord {
  lcpP75Ms: number | null;
  fcpP75Ms: number | null;
  clsP75: number | null;
  inpP75Ms: number | null;
  ttfbP75Ms: number | null;
  fidP75Ms: number | null;
  collectionPeriodStart: Date | null;
  collectionPeriodEnd: Date | null;
}

const cruxNumeric = (metrics: Record<string, unknown> | undefined, id: string): number | null => {
  if (!metrics) return null;
  const metric = metrics[id] as { percentiles?: { p75?: unknown } } | undefined;
  const value = metric?.percentiles?.p75;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const cruxDate = (
  period: { year?: unknown; month?: unknown; day?: unknown } | undefined,
): Date | null => {
  if (!period) return null;
  const { year, month, day } = period;
  if (
    typeof year !== "number" ||
    typeof month !== "number" ||
    typeof day !== "number"
  ) {
    return null;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(d.getTime()) ? null : d;
};

export function parseCruxRecord(
  record: Record<string, unknown> | null | undefined,
): ParsedCruxRecord {
  if (!record) {
    return {
      lcpP75Ms: null,
      fcpP75Ms: null,
      clsP75: null,
      inpP75Ms: null,
      ttfbP75Ms: null,
      fidP75Ms: null,
      collectionPeriodStart: null,
      collectionPeriodEnd: null,
    };
  }

  const metrics = record.metrics as Record<string, unknown> | undefined;
  const collectionPeriod = record.collectionPeriod as
    | { firstDate?: unknown; lastDate?: unknown }
    | undefined;

  const lcp = cruxNumeric(metrics, "largest_contentful_paint");
  const fcp = cruxNumeric(metrics, "first_contentful_paint");
  const cls = cruxNumeric(metrics, "cumulative_layout_shift");
  const inp = cruxNumeric(metrics, "interaction_to_next_paint");
  const ttfb = cruxNumeric(metrics, "experimental_time_to_first_byte");
  const fid = cruxNumeric(metrics, "first_input_delay");

  return {
    lcpP75Ms: lcp !== null ? Math.round(lcp) : null,
    fcpP75Ms: fcp !== null ? Math.round(fcp) : null,
    clsP75: cls,
    inpP75Ms: inp !== null ? Math.round(inp) : null,
    ttfbP75Ms: ttfb !== null ? Math.round(ttfb) : null,
    fidP75Ms: fid !== null ? Math.round(fid) : null,
    collectionPeriodStart: cruxDate(
      collectionPeriod?.firstDate as
        | { year?: unknown; month?: unknown; day?: unknown }
        | undefined,
    ),
    collectionPeriodEnd: cruxDate(
      collectionPeriod?.lastDate as
        | { year?: unknown; month?: unknown; day?: unknown }
        | undefined,
    ),
  };
}

export function asJsonInput(value: unknown): Json {
  if (value === null || value === undefined) {
    return null as unknown as Json;
  }
  return value as Json;
}
