import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  BingSyncJobType,
  BingWebmasterConnection,
  BingWebmasterConnectionStatus,
  Prisma,
  SiteStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

import { SeoTokenEncryptionService } from "../search-console/search-console-encryption.service";
import {
  BingApiError,
  BingWebmasterApiService,
  buildApiKeyFingerprint,
} from "./bing-webmaster-api.service";
import {
  BingWebmasterSyncService,
  formatBingDate,
} from "./bing-webmaster-sync.service";

export interface BingConnectionStatusDto {
  connected: boolean;
  status: BingWebmasterConnectionStatus | null;
  propertyUrl: string | null;
  apiKeyFingerprint: string | null;
  lastSyncedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  config: { encryptionConfigured: boolean };
}

@Injectable()
export class BingWebmasterService {
  private readonly logger = new Logger(BingWebmasterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: SeoTokenEncryptionService,
    private readonly api: BingWebmasterApiService,
    private readonly sync: BingWebmasterSyncService,
  ) {}

  async getStatus(siteId: string): Promise<BingConnectionStatusDto> {
    const conn = await this.prisma.bingWebmasterConnection.findUnique({
      where: { siteId },
    });
    const config = { encryptionConfigured: this.encryption.isConfigured() };
    if (!conn) {
      return {
        connected: false,
        status: null,
        propertyUrl: null,
        apiKeyFingerprint: null,
        lastSyncedAt: null,
        lastSuccessfulSyncAt: null,
        lastError: null,
        consecutiveFailures: 0,
        config,
      };
    }
    return {
      connected: conn.status === BingWebmasterConnectionStatus.ACTIVE,
      status: conn.status,
      propertyUrl: conn.propertyUrl,
      apiKeyFingerprint: conn.apiKeyFingerprint,
      lastSyncedAt: conn.lastSyncedAt?.toISOString() ?? null,
      lastSuccessfulSyncAt: conn.lastSuccessfulSyncAt?.toISOString() ?? null,
      lastError: conn.lastError,
      consecutiveFailures: conn.consecutiveFailures,
      config,
    };
  }

  /**
   * Validate that an API key is usable by calling `GetUserSites` and return
   * the verified properties so the UI can pick the right `siteUrl`.
   */
  async verifyApiKey(
    apiKey: string,
  ): Promise<{ properties: Array<{ url: string; isVerified: boolean }> }> {
    this.ensureConfigured();
    const ephemeral = {
      id: "verify",
      encryptedApiKey: this.encryption.encrypt(apiKey.trim()),
      propertyUrl: "https://placeholder.invalid/",
      status: BingWebmasterConnectionStatus.ACTIVE,
      consecutiveFailures: 0,
    } as unknown as BingWebmasterConnection;
    try {
      const sites = await this.api.listUserSites(ephemeral);
      return {
        properties: sites.map((s) => ({
          url: s.Url,
          isVerified: s.IsVerified !== false,
        })),
      };
    } catch (err) {
      if (err instanceof BingApiError) {
        if (err.status === 401 || err.status === 403) {
          throw new BadRequestException({
            code: "BING_API_KEY_INVALID",
            message:
              "Bing rejected the API key. Generate a new one in Bing Webmaster Tools › Settings › API Access.",
          });
        }
        throw new BadRequestException({
          code: "BING_API_ERROR",
          message: err.message,
        });
      }
      throw err;
    }
  }

  /** Save or update the Bing connection for a site. Triggers an initial sync. */
  async connect(
    siteId: string,
    userId: string | null,
    payload: { apiKey: string; propertyUrl: string },
  ): Promise<BingConnectionStatusDto> {
    this.ensureConfigured();
    const propertyUrl = this.normalizePropertyUrl(payload.propertyUrl);
    const apiKey = payload.apiKey.trim();
    if (!apiKey) {
      throw new BadRequestException({
        code: "BING_API_KEY_REQUIRED",
        message: "apiKey is required",
      });
    }

    // Validate the key + that the property is verified before persisting.
    const { properties } = await this.verifyApiKey(apiKey);
    const match = properties.find(
      (p) => normalizeForCompare(p.url) === normalizeForCompare(propertyUrl),
    );
    if (!match) {
      throw new BadRequestException({
        code: "BING_PROPERTY_NOT_FOUND",
        message: `The API key does not have access to ${propertyUrl}. Verified properties: ${
          properties.map((p) => p.url).join(", ") || "(none)"
        }`,
      });
    }
    if (!match.isVerified) {
      throw new BadRequestException({
        code: "BING_PROPERTY_NOT_VERIFIED",
        message: `Property ${propertyUrl} exists in Bing Webmaster but is not verified yet.`,
      });
    }

    const upserted = await this.prisma.bingWebmasterConnection.upsert({
      where: { siteId },
      update: {
        status: BingWebmasterConnectionStatus.ACTIVE,
        propertyUrl,
        encryptedApiKey: this.encryption.encrypt(apiKey),
        apiKeyFingerprint: buildApiKeyFingerprint(apiKey),
        connectedByUserId: userId ?? null,
        lastError: null,
        consecutiveFailures: 0,
      },
      create: {
        siteId,
        status: BingWebmasterConnectionStatus.ACTIVE,
        propertyUrl,
        encryptedApiKey: this.encryption.encrypt(apiKey),
        apiKeyFingerprint: buildApiKeyFingerprint(apiKey),
        connectedByUserId: userId ?? null,
      },
    });

    // Kick off an initial sync in the background.
    void this.sync
      .runSync(upserted, {
        type: BingSyncJobType.ON_DEMAND,
        triggeredBy: userId ?? "connect:initial",
      })
      .catch((err) =>
        this.logger.error(
          `Initial Bing sync failed for site=${siteId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );

    return this.getStatus(siteId);
  }

  async disconnect(siteId: string): Promise<{ ok: true }> {
    const conn = await this.prisma.bingWebmasterConnection.findUnique({
      where: { siteId },
    });
    if (!conn) {
      throw new NotFoundException({
        code: "BING_WEBMASTER_NOT_CONNECTED",
        message: "No Bing Webmaster connection exists for this site",
      });
    }
    await this.prisma.bingWebmasterConnection.delete({ where: { siteId } });
    return { ok: true };
  }

  async triggerSync(
    siteId: string,
    triggeredBy: string | null,
  ): Promise<{ jobId: string }> {
    const conn = await this.requireConnection(siteId);
    const running = await this.prisma.bingSyncJob.findFirst({
      where: { siteId, status: "RUNNING" },
      select: { id: true },
    });
    if (running) {
      throw new ConflictException({
        code: "BING_SYNC_RUNNING",
        message: "A Bing Webmaster sync is already in progress for this site.",
        jobId: running.id,
      });
    }
    const job = await this.sync.runSync(conn, {
      type: BingSyncJobType.ON_DEMAND,
      triggeredBy,
    });
    return { jobId: job.id };
  }

  async getPerformanceOverview(
    siteId: string,
    daysBack: number,
  ): Promise<{
    totals: {
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    };
    daily: Array<{
      date: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
    topPages: Array<{
      page: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
    topQueries: Array<{
      query: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>;
    rangeStart: string;
    rangeEnd: string;
  }> {
    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - daysBack);

    const [pages, queries] = await Promise.all([
      this.prisma.bingPagePerformance.findMany({
        where: { siteId, date: { gte: start, lte: end } },
      }),
      this.prisma.bingQueryPerformance.findMany({
        where: { siteId, date: { gte: start, lte: end } },
      }),
    ]);

    let totalClicks = 0;
    let totalImpressions = 0;
    let weightedPosition = 0;
    const dailyMap = new Map<
      string,
      { clicks: number; impressions: number; position: number; weight: number }
    >();
    const pageAgg = new Map<
      string,
      { clicks: number; impressions: number; position: number; weight: number }
    >();
    for (const row of pages) {
      totalClicks += row.clicks;
      totalImpressions += row.impressions;
      weightedPosition += row.position * row.impressions;
      const dateKey = formatBingDate(row.date);
      const d = dailyMap.get(dateKey) ?? {
        clicks: 0,
        impressions: 0,
        position: 0,
        weight: 0,
      };
      d.clicks += row.clicks;
      d.impressions += row.impressions;
      d.position += row.position * row.impressions;
      d.weight += row.impressions;
      dailyMap.set(dateKey, d);

      const p = pageAgg.get(row.page) ?? {
        clicks: 0,
        impressions: 0,
        position: 0,
        weight: 0,
      };
      p.clicks += row.clicks;
      p.impressions += row.impressions;
      p.position += row.position * row.impressions;
      p.weight += row.impressions;
      pageAgg.set(row.page, p);
    }

    const queryAgg = new Map<
      string,
      { clicks: number; impressions: number; position: number; weight: number }
    >();
    for (const row of queries) {
      const q = queryAgg.get(row.query) ?? {
        clicks: 0,
        impressions: 0,
        position: 0,
        weight: 0,
      };
      q.clicks += row.clicks;
      q.impressions += row.impressions;
      q.position += row.position * row.impressions;
      q.weight += row.impressions;
      queryAgg.set(row.query, q);
    }

    const daily = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        clicks: v.clicks,
        impressions: v.impressions,
        ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
        position: v.weight > 0 ? v.position / v.weight : 0,
      }));

    const topPages = Array.from(pageAgg.entries())
      .map(([page, v]) => ({
        page,
        clicks: v.clicks,
        impressions: v.impressions,
        ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
        position: v.weight > 0 ? v.position / v.weight : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50);

    const topQueries = Array.from(queryAgg.entries())
      .map(([query, v]) => ({
        query,
        clicks: v.clicks,
        impressions: v.impressions,
        ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
        position: v.weight > 0 ? v.position / v.weight : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50);

    return {
      totals: {
        clicks: totalClicks,
        impressions: totalImpressions,
        ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
        position:
          totalImpressions > 0 ? weightedPosition / totalImpressions : 0,
      },
      daily,
      topPages,
      topQueries,
      rangeStart: formatBingDate(start),
      rangeEnd: formatBingDate(end),
    };
  }

  async getPagePerformance(
    siteId: string,
    daysBack: number,
  ): Promise<
    Array<{
      page: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>
  > {
    const end = new Date();
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - daysBack);
    const rows = await this.prisma.bingPagePerformance.findMany({
      where: { siteId, date: { gte: start, lte: end } },
    });
    const agg = new Map<
      string,
      { clicks: number; impressions: number; weighted: number; weight: number }
    >();
    for (const row of rows) {
      const v = agg.get(row.page) ?? {
        clicks: 0,
        impressions: 0,
        weighted: 0,
        weight: 0,
      };
      v.clicks += row.clicks;
      v.impressions += row.impressions;
      v.weighted += row.position * row.impressions;
      v.weight += row.impressions;
      agg.set(row.page, v);
    }
    return Array.from(agg.entries())
      .map(([page, v]) => ({
        page,
        clicks: v.clicks,
        impressions: v.impressions,
        ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
        position: v.weight > 0 ? v.weighted / v.weight : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks);
  }

  async listSitemaps(siteId: string): Promise<
    Array<{
      sitemapUrl: string;
      status: string | null;
      lastSubmitted: string | null;
      lastDownloaded: string | null;
      urlCount: number;
      errors: number;
      warnings: number;
    }>
  > {
    const rows = await this.prisma.bingSitemap.findMany({
      where: { siteId },
      orderBy: { sitemapUrl: "asc" },
    });
    return rows.map((r) => ({
      sitemapUrl: r.sitemapUrl,
      status: r.status,
      lastSubmitted: r.lastSubmitted?.toISOString() ?? null,
      lastDownloaded: r.lastDownloaded?.toISOString() ?? null,
      urlCount: r.urlCount,
      errors: r.errors,
      warnings: r.warnings,
    }));
  }

  async submitSitemap(
    siteId: string,
    sitemapUrl: string,
    triggeredBy: string | null,
  ): Promise<void> {
    const conn = await this.requireConnection(siteId);
    const job = await this.prisma.bingSyncJob.create({
      data: {
        siteId,
        type: BingSyncJobType.SITEMAP_SUBMIT,
        status: "RUNNING",
        startedAt: new Date(),
        triggeredBy,
      },
    });
    try {
      await this.api.submitSitemap(conn, sitemapUrl);
      await this.prisma.bingSitemap.upsert({
        where: { siteId_sitemapUrl: { siteId, sitemapUrl } },
        update: { lastSubmitted: new Date(), status: "Submitted" },
        create: {
          siteId,
          sitemapUrl,
          lastSubmitted: new Date(),
          status: "Submitted",
        },
      });
      await this.prisma.bingSyncJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          sitemapsSynced: 1,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.bingSyncJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          failureReason: message.slice(0, 500),
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }

  async deleteSitemap(siteId: string, sitemapUrl: string): Promise<void> {
    const conn = await this.requireConnection(siteId);
    await this.api.removeSitemap(conn, sitemapUrl);
    await this.prisma.bingSitemap.deleteMany({
      where: { siteId, sitemapUrl },
    });
  }

  async listCrawlIssues(
    siteId: string,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      url: string;
      issueCode: string;
      category: string | null;
      severity: string;
      httpCode: number | null;
      firstDetectedAt: string;
      lastSeenAt: string;
      resolvedAt: string | null;
    }>
  > {
    const rows = await this.prisma.bingCrawlIssue.findMany({
      where: { siteId, resolvedAt: null },
      orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }],
      take: Math.min(Math.max(limit, 1), 500),
    });
    return rows.map((r) => ({
      id: r.id,
      url: r.url,
      issueCode: r.issueCode,
      category: r.category,
      severity: r.severity,
      httpCode: r.httpCode,
      firstDetectedAt: r.firstDetectedAt.toISOString(),
      lastSeenAt: r.lastSeenAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
    }));
  }

  async getLinkSummary(siteId: string): Promise<{
    totalLinks: number;
    topDomains: Array<{ domain: string; count: number }>;
    fetchedAt: string | null;
  }> {
    const row = await this.prisma.bingLinkSummary.findUnique({
      where: { siteId },
    });
    if (!row) {
      return { totalLinks: 0, topDomains: [], fetchedAt: null };
    }
    const top = parseTopDomains(row.topDomains);
    return {
      totalLinks: row.totalLinks,
      topDomains: top,
      fetchedAt: row.fetchedAt.toISOString(),
    };
  }

  async listSyncJobs(
    siteId: string,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      type: string;
      status: string;
      startedAt: string | null;
      completedAt: string | null;
      pagesSynced: number;
      queriesSynced: number;
      sitemapsSynced: number;
      crawlIssuesSynced: number;
      failureReason: string | null;
      triggeredBy: string | null;
      createdAt: string;
    }>
  > {
    const rows = await this.prisma.bingSyncJob.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 200),
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      startedAt: r.startedAt?.toISOString() ?? null,
      completedAt: r.completedAt?.toISOString() ?? null,
      pagesSynced: r.pagesSynced,
      queriesSynced: r.queriesSynced,
      sitemapsSynced: r.sitemapsSynced,
      crawlIssuesSynced: r.crawlIssuesSynced,
      failureReason: r.failureReason,
      triggeredBy: r.triggeredBy,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Used by the daily cron. Returns connections eligible for refresh. */
  async listConnectionsDueForSync(
    now: Date = new Date(),
  ): Promise<BingWebmasterConnection[]> {
    const cutoff = new Date(now.getTime() - 23 * 60 * 60 * 1000);
    return this.prisma.bingWebmasterConnection.findMany({
      where: {
        status: BingWebmasterConnectionStatus.ACTIVE,
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
        // Skip connections whose underlying site is no longer active —
        // archived sites must not pull Bing Webmaster data.
        site: { is: { status: SiteStatus.ACTIVE } },
      },
      orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
      take: 50,
    });
  }

  private async requireConnection(
    siteId: string,
  ): Promise<BingWebmasterConnection> {
    const conn = await this.prisma.bingWebmasterConnection.findUnique({
      where: { siteId },
    });
    if (!conn) {
      throw new NotFoundException({
        code: "BING_WEBMASTER_NOT_CONNECTED",
        message: "Connect Bing Webmaster Tools for this site first.",
      });
    }
    if (conn.status !== BingWebmasterConnectionStatus.ACTIVE) {
      throw new ConflictException({
        code: "BING_WEBMASTER_INACTIVE",
        message: `Bing Webmaster connection is in status ${conn.status}.`,
        lastError: conn.lastError,
      });
    }
    return conn;
  }

  private ensureConfigured(): void {
    if (!this.encryption.isConfigured()) {
      throw new InternalServerErrorException({
        code: "SEO_TOKEN_ENCRYPTION_KEY_MISSING",
        message: "SEO_TOKEN_ENCRYPTION_KEY is not configured.",
      });
    }
  }

  private normalizePropertyUrl(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new BadRequestException({
        code: "PROPERTY_URL_REQUIRED",
        message: "propertyUrl is required",
      });
    }
    if (!/^https?:\/\//.test(trimmed)) {
      throw new BadRequestException({
        code: "PROPERTY_URL_INVALID",
        message: "propertyUrl must be an absolute http(s) URL",
      });
    }
    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  }
}

/** Strip protocol, www., and trailing slash for fuzzy-equality of property URLs. */
function normalizeForCompare(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function parseTopDomains(
  raw: Prisma.JsonValue | null,
): Array<{ domain: string; count: number }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ domain: string; count: number }> = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { domain?: unknown; count?: unknown };
    const domain = typeof e.domain === "string" ? e.domain : null;
    const count = typeof e.count === "number" ? e.count : null;
    if (domain && count != null) out.push({ domain, count });
  }
  return out;
}
