import { Injectable, Logger } from "@nestjs/common";
import {
  Prisma,
  SearchConsoleConnection,
  SearchConsoleSyncJob,
  SearchConsoleSyncJobStatus,
  SearchConsoleSyncJobType,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

import {
  GoogleApiError,
  GscSearchAnalyticsRow,
  GscSitemap,
  SearchConsoleApiService,
} from "./search-console-api.service";

/** Default lookback window for the daily sync. GSC data has a ~2 day lag. */
export const DEFAULT_SYNC_LOOKBACK_DAYS = 28;
const QUERY_ROW_LIMIT = 25_000;
const PAGE_ROW_LIMIT = 25_000;

export interface SyncRangeOptions {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

/** Internal mapper used by tests: turn analytics rows into upsert inputs. */
export function mapPageRows(
  rows: GscSearchAnalyticsRow[] | undefined,
  siteId: string,
): Array<{
  siteId: string;
  date: Date;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}> {
  if (!rows) return [];
  const out: ReturnType<typeof mapPageRows> = [];
  for (const row of rows) {
    const keys = row.keys ?? [];
    if (keys.length < 2) continue;
    const [dateStr, page] = keys;
    if (!dateStr || !page) continue;
    out.push({
      siteId,
      date: new Date(`${dateStr}T00:00:00Z`),
      page,
      clicks: Math.round(row.clicks ?? 0),
      impressions: Math.round(row.impressions ?? 0),
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    });
  }
  return out;
}

export function mapQueryRows(
  rows: GscSearchAnalyticsRow[] | undefined,
  siteId: string,
): Array<{
  siteId: string;
  date: Date;
  query: string;
  page: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}> {
  if (!rows) return [];
  const out: ReturnType<typeof mapQueryRows> = [];
  for (const row of rows) {
    const keys = row.keys ?? [];
    if (keys.length < 2) continue;
    const [dateStr, query, page] = keys;
    if (!dateStr || !query) continue;
    out.push({
      siteId,
      date: new Date(`${dateStr}T00:00:00Z`),
      query,
      page: page ?? null,
      clicks: Math.round(row.clicks ?? 0),
      impressions: Math.round(row.impressions ?? 0),
      ctr: row.ctr ?? 0,
      position: row.position ?? 0,
    });
  }
  return out;
}

export function mapSitemap(
  sitemap: GscSitemap,
): {
  type: string | null;
  isPending: boolean;
  isSitemapsIndex: boolean;
  lastSubmitted: Date | null;
  lastDownloaded: Date | null;
  errors: number;
  warnings: number;
  contents: Prisma.InputJsonValue | null;
} {
  return {
    type: sitemap.type ?? null,
    isPending: sitemap.isPending ?? false,
    isSitemapsIndex: sitemap.isSitemapsIndex ?? false,
    lastSubmitted: sitemap.lastSubmitted ? new Date(sitemap.lastSubmitted) : null,
    lastDownloaded: sitemap.lastDownloaded ? new Date(sitemap.lastDownloaded) : null,
    errors: Number(sitemap.errors ?? 0),
    warnings: Number(sitemap.warnings ?? 0),
    contents: sitemap.contents
      ? (sitemap.contents as unknown as Prisma.InputJsonValue)
      : null,
  };
}

/** Format a Date as YYYY-MM-DD in UTC for Google APIs. */
export function formatGscDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

@Injectable()
export class SearchConsoleSyncService {
  private readonly logger = new Logger(SearchConsoleSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: SearchConsoleApiService,
  ) {}

  /**
   * Run a sync for one connection. Creates a SearchConsoleSyncJob row, fetches
   * page + query analytics + sitemaps, upserts everything, and updates the
   * connection's lastSyncedAt.
   */
  async runSync(
    connection: SearchConsoleConnection,
    options: {
      type?: SearchConsoleSyncJobType;
      triggeredBy?: string | null;
      lookbackDays?: number;
      range?: SyncRangeOptions;
    } = {},
  ): Promise<SearchConsoleSyncJob> {
    const type = options.type ?? SearchConsoleSyncJobType.DAILY;
    const lookback = options.lookbackDays ?? DEFAULT_SYNC_LOOKBACK_DAYS;
    const { startDate, endDate } = this.resolveRange(options.range, lookback);

    const job = await this.prisma.searchConsoleSyncJob.create({
      data: {
        siteId: connection.siteId,
        type,
        status: SearchConsoleSyncJobStatus.RUNNING,
        rangeStart: new Date(`${startDate}T00:00:00Z`),
        rangeEnd: new Date(`${endDate}T00:00:00Z`),
        startedAt: new Date(),
        triggeredBy: options.triggeredBy ?? null,
      },
    });

    try {
      const pagesSynced = await this.syncPagePerformance(
        connection,
        startDate,
        endDate,
      );
      const queriesSynced = await this.syncQueryPerformance(
        connection,
        startDate,
        endDate,
      );
      const sitemapsSynced = await this.syncSitemaps(connection);

      const completed = await this.prisma.searchConsoleSyncJob.update({
        where: { id: job.id },
        data: {
          status: SearchConsoleSyncJobStatus.COMPLETED,
          pagesSynced,
          queriesSynced,
          sitemapsSynced,
          completedAt: new Date(),
        },
      });
      await this.prisma.searchConsoleConnection.update({
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
        err instanceof GoogleApiError
          ? `${err.status} ${err.statusText}: ${err.bodyText.slice(0, 200)}`
          : err instanceof Error
            ? err.message
            : String(err);
      this.logger.error(
        `Search Console sync failed for site=${connection.siteId}: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      await this.prisma.searchConsoleSyncJob.update({
        where: { id: job.id },
        data: {
          status: SearchConsoleSyncJobStatus.FAILED,
          failureReason: message.slice(0, 500),
          completedAt: new Date(),
        },
      });
      await this.prisma.searchConsoleConnection.update({
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

  private resolveRange(
    range: SyncRangeOptions | undefined,
    lookbackDays: number,
  ): { startDate: string; endDate: string } {
    if (range?.startDate && range?.endDate) {
      return { startDate: range.startDate, endDate: range.endDate };
    }
    const end = new Date();
    // Google's data lags ~2 days; nudge end date back.
    end.setUTCDate(end.getUTCDate() - 2);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - lookbackDays);
    return {
      startDate: formatGscDate(start),
      endDate: formatGscDate(end),
    };
  }

  private async syncPagePerformance(
    connection: SearchConsoleConnection,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const resp = await this.api.querySearchAnalytics(connection, {
      startDate,
      endDate,
      dimensions: ["date", "page"],
      rowLimit: PAGE_ROW_LIMIT,
    });
    const rows = mapPageRows(resp.rows, connection.siteId);
    for (const row of rows) {
      await this.prisma.searchConsolePagePerformance.upsert({
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
    return rows.length;
  }

  private async syncQueryPerformance(
    connection: SearchConsoleConnection,
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const resp = await this.api.querySearchAnalytics(connection, {
      startDate,
      endDate,
      dimensions: ["date", "query", "page"],
      rowLimit: QUERY_ROW_LIMIT,
    });
    const rows = mapQueryRows(resp.rows, connection.siteId);
    for (const row of rows) {
      await this.prisma.searchConsoleQueryPerformance.upsert({
        where: {
          siteId_date_query_page: {
            siteId: row.siteId,
            date: row.date,
            query: row.query,
            page: row.page as string,
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
    return rows.length;
  }

  private async syncSitemaps(
    connection: SearchConsoleConnection,
  ): Promise<number> {
    const resp = await this.api.listSitemaps(connection);
    const sitemaps = resp.sitemap ?? [];
    for (const sm of sitemaps) {
      const mapped = mapSitemap(sm);
      const data = {
        type: mapped.type,
        isPending: mapped.isPending,
        isSitemapsIndex: mapped.isSitemapsIndex,
        lastSubmitted: mapped.lastSubmitted,
        lastDownloaded: mapped.lastDownloaded,
        errors: mapped.errors,
        warnings: mapped.warnings,
        contents:
          mapped.contents === null
            ? Prisma.JsonNull
            : mapped.contents,
      };
      await this.prisma.searchConsoleSitemap.upsert({
        where: {
          siteId_sitemapUrl: {
            siteId: connection.siteId,
            sitemapUrl: sm.path,
          },
        },
        update: data,
        create: {
          siteId: connection.siteId,
          sitemapUrl: sm.path,
          ...data,
        },
      });
    }
    return sitemaps.length;
  }
}
