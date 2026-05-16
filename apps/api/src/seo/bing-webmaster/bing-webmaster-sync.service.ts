import { Injectable, Logger } from "@nestjs/common";
import {
  BingCrawlIssueSeverity,
  BingSyncJob,
  BingSyncJobStatus,
  BingSyncJobType,
  BingWebmasterConnection,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

import {
  BingApiError,
  BingCrawlIssueDto,
  BingPageStatsRow,
  BingPageQueryStatsRow,
  BingQueryStatsRow,
  BingSitemapDto,
  BingWebmasterApiService,
  parseBingDate,
} from "./bing-webmaster-api.service";

/** Format a date as `YYYY-MM-DD` in UTC. */
export function formatBingDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Compute CTR safely: 0 when impressions is 0 or missing. */
export function computeCtr(clicks: number, impressions: number): number {
  if (!impressions || impressions <= 0) return 0;
  return clicks / impressions;
}

/**
 * Bing returns a position-like value as `AvgClickPosition` or
 * `AvgImpressionPosition`. We prefer impression-position when present
 * (matches what GSC calls `position`), falling back to click-position.
 */
export function pickBingPosition(row: {
  AvgImpressionPosition?: number;
  AvgClickPosition?: number;
}): number {
  if (typeof row.AvgImpressionPosition === "number")
    return row.AvgImpressionPosition;
  if (typeof row.AvgClickPosition === "number") return row.AvgClickPosition;
  return 0;
}

/**
 * Truncate a Date to the start of its UTC day so daily roll-ups land on the
 * same row regardless of timestamp time-of-day.
 */
function toUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export interface BingPagePerfInput {
  siteId: string;
  date: Date;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface BingQueryPerfInput {
  siteId: string;
  date: Date;
  query: string;
  /** Empty string `""` means "no page dimension" (Postgres NULL-not-distinct workaround). */
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/** Map Bing GetPageStats rows to upsert inputs. */
export function mapPageRows(
  rows: BingPageStatsRow[] | undefined,
  siteId: string,
): BingPagePerfInput[] {
  if (!rows) return [];
  const out: BingPagePerfInput[] = [];
  for (const row of rows) {
    if (!row?.Page) continue;
    const parsed = parseBingDate(row.Date);
    if (!parsed) continue;
    const clicks = Math.round(Number(row.Clicks ?? 0));
    const impressions = Math.round(Number(row.Impressions ?? 0));
    out.push({
      siteId,
      date: toUtcDay(parsed),
      page: row.Page,
      clicks,
      impressions,
      ctr: computeCtr(clicks, impressions),
      position: pickBingPosition(row),
    });
  }
  return out;
}

/** Map Bing GetQueryStats rows (query without page). */
export function mapQueryRows(
  rows: BingQueryStatsRow[] | undefined,
  siteId: string,
): BingQueryPerfInput[] {
  if (!rows) return [];
  const out: BingQueryPerfInput[] = [];
  for (const row of rows) {
    if (!row?.Query) continue;
    const parsed = parseBingDate(row.Date);
    if (!parsed) continue;
    const clicks = Math.round(Number(row.Clicks ?? 0));
    const impressions = Math.round(Number(row.Impressions ?? 0));
    out.push({
      siteId,
      date: toUtcDay(parsed),
      query: row.Query,
      page: "",
      clicks,
      impressions,
      ctr: computeCtr(clicks, impressions),
      position: pickBingPosition(row),
    });
  }
  return out;
}

/** Map Bing GetPageQueryStats rows (query + page). */
export function mapPageQueryRows(
  rows: BingPageQueryStatsRow[] | undefined,
  siteId: string,
): BingQueryPerfInput[] {
  if (!rows) return [];
  const out: BingQueryPerfInput[] = [];
  for (const row of rows) {
    if (!row?.Query) continue;
    const parsed = parseBingDate(row.Date);
    if (!parsed) continue;
    const clicks = Math.round(Number(row.Clicks ?? 0));
    const impressions = Math.round(Number(row.Impressions ?? 0));
    out.push({
      siteId,
      date: toUtcDay(parsed),
      query: row.Query,
      page: row.Page ?? "",
      clicks,
      impressions,
      ctr: computeCtr(clicks, impressions),
      position: pickBingPosition(row),
    });
  }
  return out;
}

export interface BingSitemapInput {
  status: string | null;
  lastSubmitted: Date | null;
  lastDownloaded: Date | null;
  urlCount: number;
  errors: number;
  warnings: number;
}

export function mapSitemap(sitemap: BingSitemapDto): BingSitemapInput {
  return {
    status: sitemap.Status ?? null,
    lastSubmitted: parseBingDate(sitemap.LastSubmitted ?? null),
    lastDownloaded: parseBingDate(sitemap.LastDownloaded ?? null),
    urlCount: Math.max(0, Number(sitemap.UrlCount ?? 0)),
    errors: Math.max(0, Number(sitemap.Errors ?? 0)),
    warnings: Math.max(0, Number(sitemap.Warnings ?? 0)),
  };
}

export function mapCrawlIssueSeverity(
  raw: unknown,
  httpCode: number | null,
): BingCrawlIssueSeverity {
  if (typeof raw === "string") {
    const v = raw.toLowerCase();
    if (v.includes("error") || v.includes("severe"))
      return BingCrawlIssueSeverity.ERROR;
    if (v.includes("warn")) return BingCrawlIssueSeverity.WARNING;
    if (v.includes("info") || v.includes("notice"))
      return BingCrawlIssueSeverity.INFO;
  }
  if (httpCode && httpCode >= 500) return BingCrawlIssueSeverity.ERROR;
  if (httpCode && httpCode >= 400) return BingCrawlIssueSeverity.WARNING;
  return BingCrawlIssueSeverity.WARNING;
}

export interface BingCrawlIssueInput {
  url: string;
  issueCode: string;
  category: string | null;
  severity: BingCrawlIssueSeverity;
  httpCode: number | null;
  firstDetectedAt: Date;
  lastSeenAt: Date;
  details: Prisma.InputJsonValue;
}

export function mapCrawlIssue(
  issue: BingCrawlIssueDto,
  now: Date,
): BingCrawlIssueInput | null {
  if (!issue?.Url) return null;
  const code =
    issue.IssueCode == null || issue.IssueCode === ""
      ? "UNKNOWN"
      : String(issue.IssueCode);
  const httpCode = typeof issue.HttpCode === "number" ? issue.HttpCode : null;
  const firstDetectedAt = parseBingDate(issue.FirstDetectedAt ?? null) ?? now;
  const lastSeenAt = parseBingDate(issue.LastSeenAt ?? null) ?? now;
  return {
    url: issue.Url,
    issueCode: code,
    category: issue.Category ?? null,
    severity: mapCrawlIssueSeverity(issue.Severity, httpCode),
    httpCode,
    firstDetectedAt,
    lastSeenAt,
    details: issue as unknown as Prisma.InputJsonValue,
  };
}

@Injectable()
export class BingWebmasterSyncService {
  private readonly logger = new Logger(BingWebmasterSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: BingWebmasterApiService,
  ) {}

  /**
   * Run a full sync for one connection: page perf + query perf + sitemaps +
   * crawl issues + link counts. Creates a BingSyncJob row to record progress.
   */
  async runSync(
    connection: BingWebmasterConnection,
    options: {
      type?: BingSyncJobType;
      triggeredBy?: string | null;
    } = {},
  ): Promise<BingSyncJob> {
    const type = options.type ?? BingSyncJobType.DAILY;
    const now = new Date();
    const job = await this.prisma.bingSyncJob.create({
      data: {
        siteId: connection.siteId,
        type,
        status: BingSyncJobStatus.RUNNING,
        startedAt: now,
        triggeredBy: options.triggeredBy ?? null,
      },
    });
    try {
      const pagesSynced = await this.syncPagePerformance(connection);
      const queriesSynced = await this.syncQueryPerformance(connection);
      const sitemapsSynced = await this.syncSitemaps(connection);
      const crawlIssuesSynced = await this.syncCrawlIssues(connection);
      await this.syncLinkCounts(connection).catch((err) => {
        // Link counts failure shouldn't fail the whole sync.
        this.logger.warn(
          `Bing link counts failed for site=${connection.siteId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });

      const completed = await this.prisma.bingSyncJob.update({
        where: { id: job.id },
        data: {
          status: BingSyncJobStatus.COMPLETED,
          pagesSynced,
          queriesSynced,
          sitemapsSynced,
          crawlIssuesSynced,
          completedAt: new Date(),
        },
      });
      await this.prisma.bingWebmasterConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncedAt: new Date(),
          lastSuccessfulSyncAt: new Date(),
          lastError: null,
          consecutiveFailures: 0,
        },
      });
      return completed;
    } catch (err) {
      const message =
        err instanceof BingApiError
          ? `${err.status} ${err.statusText}: ${err.bodyText.slice(0, 200)}`
          : err instanceof Error
            ? err.message
            : String(err);
      this.logger.error(
        `Bing sync failed for site=${connection.siteId}: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      await this.prisma.bingSyncJob.update({
        where: { id: job.id },
        data: {
          status: BingSyncJobStatus.FAILED,
          failureReason: message.slice(0, 500),
          completedAt: new Date(),
        },
      });
      await this.prisma.bingWebmasterConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncedAt: new Date(),
          lastError: message.slice(0, 500),
          consecutiveFailures: { increment: 1 },
        },
      });
      throw err;
    }
  }

  private async syncPagePerformance(
    connection: BingWebmasterConnection,
  ): Promise<number> {
    const rows = await this.api.getPageStats(connection);
    const mapped = mapPageRows(rows, connection.siteId);
    for (const row of mapped) {
      await this.prisma.bingPagePerformance.upsert({
        where: {
          siteId_date_page: {
            siteId: row.siteId,
            date: row.date,
            page: row.page,
          },
        },
        update: {
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        },
        create: row,
      });
    }
    return mapped.length;
  }

  private async syncQueryPerformance(
    connection: BingWebmasterConnection,
  ): Promise<number> {
    // Prefer page-query stats when available (gives both dimensions).
    let mapped: BingQueryPerfInput[] = [];
    try {
      const pageQueryRows = await this.api.getPageQueryStats(connection);
      mapped = mapPageQueryRows(pageQueryRows, connection.siteId);
    } catch (err) {
      // Some keys don't expose the page-query endpoint; fall back to plain.
      this.logger.warn(
        `GetPageQueryStats failed (falling back to GetQueryStats): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    if (mapped.length === 0) {
      const queryRows = await this.api.getQueryStats(connection);
      mapped = mapQueryRows(queryRows, connection.siteId);
    }
    for (const row of mapped) {
      await this.prisma.bingQueryPerformance.upsert({
        where: {
          siteId_date_query_page: {
            siteId: row.siteId,
            date: row.date,
            query: row.query,
            page: row.page,
          },
        },
        update: {
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        },
        create: row,
      });
    }
    return mapped.length;
  }

  private async syncSitemaps(
    connection: BingWebmasterConnection,
  ): Promise<number> {
    const sitemaps = await this.api.listSitemaps(connection);
    for (const sm of sitemaps) {
      if (!sm?.Url) continue;
      const data = mapSitemap(sm);
      await this.prisma.bingSitemap.upsert({
        where: {
          siteId_sitemapUrl: {
            siteId: connection.siteId,
            sitemapUrl: sm.Url,
          },
        },
        update: data,
        create: {
          siteId: connection.siteId,
          sitemapUrl: sm.Url,
          ...data,
        },
      });
    }
    return sitemaps.length;
  }

  private async syncCrawlIssues(
    connection: BingWebmasterConnection,
  ): Promise<number> {
    const now = new Date();
    const issues = await this.api.listCrawlIssues(connection);
    let count = 0;
    const seenKeys = new Set<string>();
    for (const issue of issues) {
      const mapped = mapCrawlIssue(issue, now);
      if (!mapped) continue;
      seenKeys.add(`${mapped.url}::${mapped.issueCode}`);
      await this.prisma.bingCrawlIssue.upsert({
        where: {
          siteId_url_issueCode: {
            siteId: connection.siteId,
            url: mapped.url,
            issueCode: mapped.issueCode,
          },
        },
        update: {
          category: mapped.category,
          severity: mapped.severity,
          httpCode: mapped.httpCode,
          lastSeenAt: mapped.lastSeenAt,
          resolvedAt: null,
          details: mapped.details,
        },
        create: {
          siteId: connection.siteId,
          url: mapped.url,
          issueCode: mapped.issueCode,
          category: mapped.category,
          severity: mapped.severity,
          httpCode: mapped.httpCode,
          firstDetectedAt: mapped.firstDetectedAt,
          lastSeenAt: mapped.lastSeenAt,
          details: mapped.details,
        },
      });
      count++;
    }
    // Mark any previously-open issues that no longer appear as resolved.
    const stale = await this.prisma.bingCrawlIssue.findMany({
      where: { siteId: connection.siteId, resolvedAt: null },
      select: { id: true, url: true, issueCode: true },
    });
    const toResolve = stale
      .filter((row) => !seenKeys.has(`${row.url}::${row.issueCode}`))
      .map((row) => row.id);
    if (toResolve.length > 0) {
      await this.prisma.bingCrawlIssue.updateMany({
        where: { id: { in: toResolve } },
        data: { resolvedAt: now },
      });
    }
    return count;
  }

  private async syncLinkCounts(
    connection: BingWebmasterConnection,
  ): Promise<void> {
    const res = await this.api.getLinkCounts(connection);
    const total = Math.max(0, Number(res.TotalLinks ?? 0));
    const links = Array.isArray(res.Links) ? res.Links : [];
    const top = links
      .map((l) => ({
        domain: typeof l.Domain === "string" ? l.Domain : "",
        count: Number(l.Count ?? 0),
      }))
      .filter((l) => l.domain && l.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 50);
    const now = new Date();
    await this.prisma.bingLinkSummary.upsert({
      where: { siteId: connection.siteId },
      update: {
        totalLinks: total,
        fetchedAt: now,
        topDomains:
          top.length > 0
            ? (top as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
      create: {
        siteId: connection.siteId,
        totalLinks: total,
        fetchedAt: now,
        topDomains:
          top.length > 0
            ? (top as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });
  }
}
