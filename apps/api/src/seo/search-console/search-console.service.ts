import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  SearchConsoleConnection,
  SearchConsoleConnectionStatus,
  SearchConsoleSyncJobType,
  SiteStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

import { SearchConsoleApiService } from "./search-console-api.service";
import { SeoTokenEncryptionService } from "./search-console-encryption.service";
import {
  SearchConsoleOAuthService,
  SearchConsoleOAuthStateError,
  SEARCH_CONSOLE_OAUTH_SCOPE,
} from "./search-console-oauth.service";
import {
  SearchConsoleSyncService,
  formatGscDate,
} from "./search-console-sync.service";

export interface ConnectionStatusDto {
  connected: boolean;
  status: SearchConsoleConnectionStatus | null;
  propertyUrl: string | null;
  googleAccountEmail: string | null;
  scope: string | null;
  lastSyncedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  config: ReturnType<SearchConsoleOAuthService["describeConfig"]>;
}

@Injectable()
export class SearchConsoleService {
  private readonly logger = new Logger(SearchConsoleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: SearchConsoleOAuthService,
    private readonly encryption: SeoTokenEncryptionService,
    private readonly api: SearchConsoleApiService,
    private readonly sync: SearchConsoleSyncService,
  ) {}

  /** Get the connection or null. Public-safe (no secrets). */
  async getStatus(siteId: string): Promise<ConnectionStatusDto> {
    const conn = await this.prisma.searchConsoleConnection.findUnique({
      where: { siteId },
    });
    const config = this.oauth.describeConfig();
    if (!conn) {
      return {
        connected: false,
        status: null,
        propertyUrl: null,
        googleAccountEmail: null,
        scope: null,
        lastSyncedAt: null,
        lastSuccessfulSyncAt: null,
        lastError: null,
        consecutiveFailures: 0,
        config,
      };
    }
    return {
      connected: conn.status === SearchConsoleConnectionStatus.ACTIVE,
      status: conn.status,
      propertyUrl: conn.propertyUrl,
      googleAccountEmail: conn.googleAccountEmail,
      scope: conn.scope,
      lastSyncedAt: conn.lastSyncedAt?.toISOString() ?? null,
      lastSuccessfulSyncAt: conn.lastSuccessfulSyncAt?.toISOString() ?? null,
      lastError: conn.lastError,
      consecutiveFailures: conn.consecutiveFailures,
      config,
    };
  }

  /** Step 1 — build the Google authorize URL for the site. */
  startOAuth(
    siteId: string,
    userId: string | null,
    returnTo?: string,
  ): { authUrl: string; state: string } {
    this.ensureConfigured();
    return this.oauth.buildAuthorizeUrl({ siteId, userId, returnTo });
  }

  /** Step 2 — exchange code, fetch userinfo, store connection. */
  async completeOAuth(
    requestSiteId: string,
    userId: string | null,
    payload: { code: string; state: string; propertyUrl: string },
  ): Promise<ConnectionStatusDto> {
    this.ensureConfigured();
    let verified;
    try {
      verified = this.oauth.verifyState(payload.state);
    } catch (err) {
      if (err instanceof SearchConsoleOAuthStateError) {
        throw new BadRequestException({
          code: "OAUTH_STATE_INVALID",
          message: err.message,
        });
      }
      throw err;
    }
    if (verified.siteId !== requestSiteId) {
      throw new BadRequestException({
        code: "OAUTH_STATE_SITE_MISMATCH",
        message: "OAuth state was issued for a different site",
      });
    }

    const propertyUrl = this.normalizePropertyUrl(payload.propertyUrl);

    const tokens = await this.oauth.exchangeCode(payload.code);
    if (!tokens.refresh_token) {
      throw new BadRequestException({
        code: "OAUTH_NO_REFRESH_TOKEN",
        message:
          "Google did not return a refresh token. Revoke the prior grant in the Google Account permissions page and try again.",
      });
    }

    let accountEmail: string | undefined;
    let accountSubject: string | undefined;
    try {
      const info = await this.oauth.fetchUserInfo(tokens.access_token);
      accountEmail = info.email;
      accountSubject = info.sub;
    } catch (err) {
      this.logger.warn(
        `Failed to fetch Google userinfo (continuing): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // Verify the chosen property is accessible to this account.
    const fakeConn = {
      id: "verify",
      siteId: requestSiteId,
      propertyUrl,
      encryptedRefreshToken: this.encryption.encrypt(tokens.refresh_token),
      accessTokenCache: this.encryption.encrypt(tokens.access_token),
      accessTokenExpiresAt: new Date(
        Date.now() + (tokens.expires_in - 30) * 1000,
      ),
      status: SearchConsoleConnectionStatus.ACTIVE,
      consecutiveFailures: 0,
    } as unknown as SearchConsoleConnection;
    try {
      const sites = await this.api.listSites(fakeConn);
      const allowed = sites.siteEntry?.some((s) => s.siteUrl === propertyUrl);
      if (!allowed) {
        throw new BadRequestException({
          code: "OAUTH_PROPERTY_NOT_ACCESSIBLE",
          message: `The Google account does not have access to the property ${propertyUrl}.`,
        });
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException({
        code: "GSC_LIST_SITES_FAILED",
        message: `Failed to verify property access: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    }

    const encryptedRefresh = this.encryption.encrypt(tokens.refresh_token);
    const accessTokenExpiresAt = new Date(
      Date.now() + (tokens.expires_in - 30) * 1000,
    );

    const upserted = await this.prisma.searchConsoleConnection.upsert({
      where: { siteId: requestSiteId },
      update: {
        status: SearchConsoleConnectionStatus.ACTIVE,
        propertyUrl,
        scope: tokens.scope ?? SEARCH_CONSOLE_OAUTH_SCOPE,
        encryptedRefreshToken: encryptedRefresh,
        accessTokenCache: this.encryption.encrypt(tokens.access_token),
        accessTokenExpiresAt,
        googleAccountEmail: accountEmail ?? null,
        googleAccountSubject: accountSubject ?? null,
        connectedByUserId: userId ?? null,
        lastError: null,
        consecutiveFailures: 0,
      },
      create: {
        siteId: requestSiteId,
        status: SearchConsoleConnectionStatus.ACTIVE,
        propertyUrl,
        scope: tokens.scope ?? SEARCH_CONSOLE_OAUTH_SCOPE,
        encryptedRefreshToken: encryptedRefresh,
        accessTokenCache: this.encryption.encrypt(tokens.access_token),
        accessTokenExpiresAt,
        googleAccountEmail: accountEmail ?? null,
        googleAccountSubject: accountSubject ?? null,
        connectedByUserId: userId ?? null,
      },
    });

    // Fire an initial sync in the background — don't block the OAuth response.
    void this.sync
      .runSync(upserted, {
        type: SearchConsoleSyncJobType.ON_DEMAND,
        triggeredBy: userId ?? "oauth:initial",
      })
      .catch((err) =>
        this.logger.error(
          `Initial sync failed for site=${requestSiteId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );

    return this.getStatus(requestSiteId);
  }

  async disconnect(siteId: string): Promise<{ ok: true }> {
    const conn = await this.prisma.searchConsoleConnection.findUnique({
      where: { siteId },
    });
    if (!conn) {
      throw new NotFoundException({
        code: "SEARCH_CONSOLE_NOT_CONNECTED",
        message: "No Search Console connection exists for this site",
      });
    }
    try {
      const refreshToken = this.encryption.decrypt(conn.encryptedRefreshToken);
      await this.oauth.revokeRefreshToken(refreshToken);
    } catch (err) {
      this.logger.warn(
        `Could not revoke Google token for site=${siteId} (continuing): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    await this.prisma.searchConsoleConnection.delete({ where: { siteId } });
    return { ok: true };
  }

  async listAvailableProperties(
    siteId: string,
    code: string,
    state: string,
  ): Promise<Array<{ siteUrl: string; permissionLevel: string }>> {
    this.ensureConfigured();
    const verified = this.oauth.verifyState(state);
    if (verified.siteId !== siteId) {
      throw new BadRequestException({
        code: "OAUTH_STATE_SITE_MISMATCH",
        message: "OAuth state was issued for a different site",
      });
    }
    const tokens = await this.oauth.exchangeCode(code);
    const fakeConn = {
      id: "list",
      siteId,
      propertyUrl: "https://placeholder.invalid/",
      encryptedRefreshToken: this.encryption.encrypt(
        tokens.refresh_token ?? "",
      ),
      accessTokenCache: this.encryption.encrypt(tokens.access_token),
      accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      status: SearchConsoleConnectionStatus.ACTIVE,
      consecutiveFailures: 0,
    } as unknown as SearchConsoleConnection;
    const sites = await this.api.listSites(fakeConn);
    // We need to re-sign the state with the same code so the next call can
    // reuse it, but Google authorization codes are single-use. So this flow
    // is a no-op convenience and the caller must always pass propertyUrl
    // directly in completeOAuth. Returning the list here is purely informational.
    return sites.siteEntry ?? [];
  }

  /** Trigger a sync now. Throws 409 if a sync for this site is already running. */
  async triggerSync(
    siteId: string,
    triggeredBy: string | null,
    range?: { startDate?: string; endDate?: string },
  ): Promise<{ jobId: string }> {
    const conn = await this.requireConnection(siteId);
    const running = await this.prisma.searchConsoleSyncJob.findFirst({
      where: { siteId, status: "RUNNING" },
      select: { id: true },
    });
    if (running) {
      throw new ConflictException({
        code: "SEARCH_CONSOLE_SYNC_RUNNING",
        message: "A Search Console sync is already in progress for this site.",
        jobId: running.id,
      });
    }
    const job = await this.sync.runSync(conn, {
      type: SearchConsoleSyncJobType.ON_DEMAND,
      triggeredBy,
      range,
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
      this.prisma.searchConsolePagePerformance.findMany({
        where: { siteId, date: { gte: start, lte: end } },
      }),
      this.prisma.searchConsoleQueryPerformance.findMany({
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
      const dateKey = formatGscDate(row.date);
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
      rangeStart: formatGscDate(start),
      rangeEnd: formatGscDate(end),
    };
  }

  /** Per-page rows for the URLs table column. */
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
    const rows = await this.prisma.searchConsolePagePerformance.findMany({
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
    return Array.from(agg.entries()).map(([page, v]) => ({
      page,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      position: v.weight > 0 ? v.weighted / v.weight : 0,
    }));
  }

  async listSitemaps(siteId: string): Promise<
    Array<{
      sitemapUrl: string;
      type: string | null;
      isPending: boolean;
      isSitemapsIndex: boolean;
      lastSubmitted: string | null;
      lastDownloaded: string | null;
      errors: number;
      warnings: number;
    }>
  > {
    const rows = await this.prisma.searchConsoleSitemap.findMany({
      where: { siteId },
      orderBy: { sitemapUrl: "asc" },
    });
    return rows.map((r) => ({
      sitemapUrl: r.sitemapUrl,
      type: r.type,
      isPending: r.isPending,
      isSitemapsIndex: r.isSitemapsIndex,
      lastSubmitted: r.lastSubmitted?.toISOString() ?? null,
      lastDownloaded: r.lastDownloaded?.toISOString() ?? null,
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
    const job = await this.prisma.searchConsoleSyncJob.create({
      data: {
        siteId,
        type: SearchConsoleSyncJobType.SITEMAP_SUBMIT,
        status: "RUNNING",
        startedAt: new Date(),
        triggeredBy,
      },
    });
    try {
      await this.api.submitSitemap(conn, sitemapUrl);
      await this.prisma.searchConsoleSitemap.upsert({
        where: { siteId_sitemapUrl: { siteId, sitemapUrl } },
        update: { lastSubmitted: new Date(), isPending: true },
        create: {
          siteId,
          sitemapUrl,
          lastSubmitted: new Date(),
          isPending: true,
        },
      });
      await this.prisma.searchConsoleSyncJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          sitemapsSynced: 1,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.searchConsoleSyncJob.update({
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
    await this.api.deleteSitemap(conn, sitemapUrl);
    await this.prisma.searchConsoleSitemap.deleteMany({
      where: { siteId, sitemapUrl },
    });
  }

  async inspectUrl(
    siteId: string,
    url: string,
    languageCode: string | undefined,
    triggeredBy: string | null,
  ): Promise<Prisma.JsonValue> {
    const conn = await this.requireConnection(siteId);
    const job = await this.prisma.searchConsoleSyncJob.create({
      data: {
        siteId,
        type: SearchConsoleSyncJobType.URL_INSPECTION,
        status: "RUNNING",
        startedAt: new Date(),
        triggeredBy,
      },
    });
    try {
      const result = await this.api.inspectUrl(conn, url, languageCode);
      const idx = result.inspectionResult?.indexStatusResult;
      const richItems =
        result.inspectionResult?.richResultsResult?.detectedItems?.length ?? 0;
      await this.prisma.searchConsoleUrlInspection.upsert({
        where: { siteId_url: { siteId, url } },
        update: {
          verdict: idx?.verdict ?? null,
          coverageState: idx?.coverageState ?? null,
          indexingState: idx?.indexingState ?? null,
          robotsTxtState: idx?.robotsTxtState ?? null,
          pageFetchState: idx?.pageFetchState ?? null,
          lastCrawlTime: idx?.lastCrawlTime
            ? new Date(idx.lastCrawlTime)
            : null,
          googleCanonical: idx?.googleCanonical ?? null,
          userCanonical: idx?.userCanonical ?? null,
          mobileUsability:
            result.inspectionResult?.mobileUsabilityResult?.verdict ?? null,
          richResultsItems: richItems,
          inspectionResult: result as unknown as Prisma.InputJsonValue,
          lastInspectedAt: new Date(),
        },
        create: {
          siteId,
          url,
          verdict: idx?.verdict ?? null,
          coverageState: idx?.coverageState ?? null,
          indexingState: idx?.indexingState ?? null,
          robotsTxtState: idx?.robotsTxtState ?? null,
          pageFetchState: idx?.pageFetchState ?? null,
          lastCrawlTime: idx?.lastCrawlTime
            ? new Date(idx.lastCrawlTime)
            : null,
          googleCanonical: idx?.googleCanonical ?? null,
          userCanonical: idx?.userCanonical ?? null,
          mobileUsability:
            result.inspectionResult?.mobileUsabilityResult?.verdict ?? null,
          richResultsItems: richItems,
          inspectionResult: result as unknown as Prisma.InputJsonValue,
          lastInspectedAt: new Date(),
        },
      });
      await this.prisma.searchConsoleSyncJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          inspectionsRun: 1,
        },
      });
      return result as unknown as Prisma.JsonValue;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.searchConsoleSyncJob.update({
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

  async getCachedInspection(
    siteId: string,
    url: string,
  ): Promise<Prisma.JsonValue | null> {
    const row = await this.prisma.searchConsoleUrlInspection.findUnique({
      where: { siteId_url: { siteId, url } },
    });
    return row?.inspectionResult ?? null;
  }

  async listSyncJobs(
    siteId: string,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      type: SearchConsoleSyncJobType;
      status: string;
      startedAt: string | null;
      completedAt: string | null;
      pagesSynced: number;
      queriesSynced: number;
      sitemapsSynced: number;
      inspectionsRun: number;
      failureReason: string | null;
      triggeredBy: string | null;
      createdAt: string;
    }>
  > {
    const rows = await this.prisma.searchConsoleSyncJob.findMany({
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
      inspectionsRun: r.inspectionsRun,
      failureReason: r.failureReason,
      triggeredBy: r.triggeredBy,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  /** Used by the daily cron. Returns connections eligible for refresh. */
  async listConnectionsDueForSync(
    now: Date = new Date(),
  ): Promise<SearchConsoleConnection[]> {
    const cutoff = new Date(now.getTime() - 23 * 60 * 60 * 1000);
    return this.prisma.searchConsoleConnection.findMany({
      where: {
        status: SearchConsoleConnectionStatus.ACTIVE,
        OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: cutoff } }],
        // Skip connections whose underlying site is no longer active —
        // archived sites must not pull Search Console data.
        site: { is: { status: SiteStatus.ACTIVE } },
      },
      orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } },
      take: 50,
    });
  }

  /* ── helpers ──────────────────────────────────────────── */

  private async requireConnection(
    siteId: string,
  ): Promise<SearchConsoleConnection> {
    const conn = await this.prisma.searchConsoleConnection.findUnique({
      where: { siteId },
    });
    if (!conn) {
      throw new NotFoundException({
        code: "SEARCH_CONSOLE_NOT_CONNECTED",
        message: "Connect Google Search Console for this site first.",
      });
    }
    if (conn.status !== SearchConsoleConnectionStatus.ACTIVE) {
      throw new ConflictException({
        code: "SEARCH_CONSOLE_INACTIVE",
        message: `Search Console connection is in status ${conn.status}.`,
        lastError: conn.lastError,
      });
    }
    return conn;
  }

  private ensureConfigured(): void {
    if (!this.oauth.isConfigured()) {
      throw new InternalServerErrorException({
        code: "SEARCH_CONSOLE_OAUTH_NOT_CONFIGURED",
        message:
          "Google OAuth is not configured on the server. Ask an admin to set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, and SEARCH_CONSOLE_OAUTH_REDIRECT_URI.",
      });
    }
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
    // GSC accepts "sc-domain:example.com" or absolute URLs.
    if (trimmed.startsWith("sc-domain:")) return trimmed;
    if (!/^https?:\/\//.test(trimmed)) {
      throw new BadRequestException({
        code: "PROPERTY_URL_INVALID",
        message:
          'propertyUrl must be an absolute http(s) URL or start with "sc-domain:"',
      });
    }
    // Ensure trailing slash for URL-prefix properties.
    return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
  }
}
