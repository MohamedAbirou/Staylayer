import { Injectable } from "@nestjs/common";
import {
  BingWebmasterConnection,
  BingWebmasterConnectionStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

import { SeoTokenEncryptionService } from "../search-console/search-console-encryption.service";

/**
 * Bing Webmaster Tools JSON API root. All endpoints accept either GET
 * (with query parameters) or POST (with a JSON body) and require an
 * `apikey` query parameter. Reference:
 * https://docs.microsoft.com/en-us/bingwebmaster/getting-access
 */
const API_BASE = "https://ssl.bing.com/webmaster/api.svc/json";

/** Bing's serialized date format: `/Date(1234567890000)/` or ISO. */
export function parseBingDate(raw: unknown): Date | null {
  if (raw == null) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const m = /^\/Date\((-?\d+)(?:[+-]\d+)?\)\/?$/.exec(trimmed);
  if (m) {
    const ts = Number(m[1]);
    if (Number.isFinite(ts)) return new Date(ts);
    return null;
  }
  const iso = new Date(trimmed);
  if (Number.isNaN(iso.getTime())) return null;
  return iso;
}

export interface BingUserSite {
  Url: string;
  DnsVerificationCode?: string | null;
  IsVerified?: boolean;
}

export interface BingRankAndTrafficRow {
  Date: string;
  Clicks: number;
  Impressions: number;
  AvgClickPosition?: number;
  AvgImpressionPosition?: number;
}

export interface BingPageStatsRow {
  Date: string;
  Page: string;
  Clicks: number;
  Impressions: number;
  AvgClickPosition?: number;
  AvgImpressionPosition?: number;
}

export interface BingQueryStatsRow {
  Date: string;
  Query: string;
  Clicks: number;
  Impressions: number;
  AvgClickPosition?: number;
  AvgImpressionPosition?: number;
}

export interface BingPageQueryStatsRow extends BingQueryStatsRow {
  Page: string;
}

export interface BingSitemapDto {
  Url: string;
  Status?: string;
  LastSubmitted?: string;
  LastDownloaded?: string;
  UrlCount?: number;
  Errors?: number;
  Warnings?: number;
}

export interface BingCrawlIssueDto {
  Url: string;
  IssueCode?: string | number;
  Category?: string;
  HttpCode?: number;
  Severity?: string;
  FirstDetectedAt?: string;
  LastSeenAt?: string;
}

export interface BingLinkCountsResponse {
  TotalLinks?: number;
  Links?: Array<{ Domain?: string; Count?: number }>;
}

export class BingApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly bodyText: string,
    public readonly method: string,
  ) {
    super(
      `Bing Webmaster API ${method} ${status} ${statusText}: ${bodyText.slice(
        0,
        200,
      )}`,
    );
    this.name = "BingApiError";
  }
}

/**
 * Build a `prefix***suffix` fingerprint for surfacing in the UI without
 * exposing the secret. Returns null for inputs that are too short.
 */
export function buildApiKeyFingerprint(rawKey: string): string | null {
  const k = rawKey.trim();
  if (k.length < 8) return null;
  return `${k.slice(0, 4)}***${k.slice(-4)}`;
}

/**
 * Thin REST wrapper around the Bing Webmaster Tools API. Authenticates with
 * the per-connection AES-encrypted API key. Methods accept the connection
 * object and decrypt the key on each call (no in-memory caching).
 */
@Injectable()
export class BingWebmasterApiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: SeoTokenEncryptionService,
  ) {}

  /** Decrypt the connection's API key. Marks the connection as ERROR on failure. */
  async resolveApiKey(connection: BingWebmasterConnection): Promise<string> {
    try {
      return this.encryption.decrypt(connection.encryptedApiKey);
    } catch (err) {
      await this.markError(
        connection.id,
        "API key could not be decrypted; reconnect required.",
      );
      throw err;
    }
  }

  private async markError(
    connectionId: string,
    message: string,
  ): Promise<void> {
    await this.prisma.bingWebmasterConnection
      .update({
        where: { id: connectionId },
        data: {
          status: BingWebmasterConnectionStatus.ERROR,
          lastError: message.slice(0, 500),
          consecutiveFailures: { increment: 1 },
        },
      })
      .catch(() => {
        /* swallow — already in error path */
      });
  }

  /**
   * Authenticated GET. The `path` is appended to the API base; the apikey
   * query parameter is added automatically alongside any `query` entries.
   */
  async getJson<T>(
    connection: BingWebmasterConnection,
    path: string,
    query: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const apikey = await this.resolveApiKey(connection);
    const url = this.buildUrl(path, { ...query, apikey });
    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    return this.handleResponse<T>(connection, resp, "GET");
  }

  /** Authenticated POST. Body is JSON-encoded; apikey goes in query string. */
  async postJson<T>(
    connection: BingWebmasterConnection,
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const apikey = await this.resolveApiKey(connection);
    const url = this.buildUrl(path, { apikey });
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
    return this.handleResponse<T>(connection, resp, "POST");
  }

  private async handleResponse<T>(
    connection: BingWebmasterConnection,
    resp: Response,
    method: string,
  ): Promise<T> {
    if (resp.status === 204) return undefined as T;
    const text = await resp.text();
    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        await this.markError(
          connection.id,
          `Bing API ${resp.status}: invalid or revoked API key`,
        );
      }
      throw new BingApiError(resp.status, resp.statusText, text, method);
    }
    if (!text) return undefined as T;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BingApiError(
        resp.status,
        "Invalid JSON",
        text.slice(0, 200),
        method,
      );
    }
    // Bing wraps every response in `{ d: ... }`. Unwrap when present.
    if (parsed && typeof parsed === "object" && "d" in parsed) {
      return (parsed as { d: T }).d;
    }
    return parsed as T;
  }

  private buildUrl(
    path: string,
    params: Record<string, string | number | undefined>,
  ): string {
    const u = new URL(`${API_BASE}/${path.replace(/^\/+/, "")}`);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      u.searchParams.set(k, String(v));
    }
    return u.toString();
  }

  /* ── Endpoints ────────────────────────────────────────── */

  /** GetUserSites — verifies the API key is valid and which sites it covers. */
  async listUserSites(
    connection: BingWebmasterConnection,
  ): Promise<BingUserSite[]> {
    const res = await this.getJson<BingUserSite[] | { Sites?: BingUserSite[] }>(
      connection,
      "GetUserSites",
    );
    if (Array.isArray(res)) return res;
    return res?.Sites ?? [];
  }

  /** GetRankAndTrafficStats — daily site totals (no page/query breakdown). */
  async getRankAndTrafficStats(
    connection: BingWebmasterConnection,
  ): Promise<BingRankAndTrafficRow[]> {
    return (
      (await this.getJson<BingRankAndTrafficRow[]>(
        connection,
        "GetRankAndTrafficStats",
        { siteUrl: connection.propertyUrl },
      )) ?? []
    );
  }

  /** GetPageStats — daily per-page clicks/impressions. */
  async getPageStats(
    connection: BingWebmasterConnection,
  ): Promise<BingPageStatsRow[]> {
    return (
      (await this.getJson<BingPageStatsRow[]>(connection, "GetPageStats", {
        siteUrl: connection.propertyUrl,
      })) ?? []
    );
  }

  /** GetQueryStats — daily per-query clicks/impressions. */
  async getQueryStats(
    connection: BingWebmasterConnection,
  ): Promise<BingQueryStatsRow[]> {
    return (
      (await this.getJson<BingQueryStatsRow[]>(connection, "GetQueryStats", {
        siteUrl: connection.propertyUrl,
      })) ?? []
    );
  }

  /** GetPageQueryStats — page × query × date. Optional page filter. */
  async getPageQueryStats(
    connection: BingWebmasterConnection,
    page?: string,
  ): Promise<BingPageQueryStatsRow[]> {
    return (
      (await this.getJson<BingPageQueryStatsRow[]>(
        connection,
        "GetPageQueryStats",
        { siteUrl: connection.propertyUrl, page },
      )) ?? []
    );
  }

  /** GetFeeds — list submitted sitemaps. */
  async listSitemaps(
    connection: BingWebmasterConnection,
  ): Promise<BingSitemapDto[]> {
    return (
      (await this.getJson<BingSitemapDto[]>(connection, "GetFeeds", {
        siteUrl: connection.propertyUrl,
      })) ?? []
    );
  }

  /** SubmitFeed — submit a sitemap. */
  async submitSitemap(
    connection: BingWebmasterConnection,
    sitemapUrl: string,
  ): Promise<void> {
    await this.postJson<void>(connection, "SubmitFeed", {
      siteUrl: connection.propertyUrl,
      feedUrl: sitemapUrl,
    });
  }

  /** RemoveFeed — un-submit a sitemap. */
  async removeSitemap(
    connection: BingWebmasterConnection,
    sitemapUrl: string,
  ): Promise<void> {
    await this.postJson<void>(connection, "RemoveFeed", {
      siteUrl: connection.propertyUrl,
      feedUrl: sitemapUrl,
    });
  }

  /** GetCrawlIssues — current crawl issues. */
  async listCrawlIssues(
    connection: BingWebmasterConnection,
  ): Promise<BingCrawlIssueDto[]> {
    return (
      (await this.getJson<BingCrawlIssueDto[]>(connection, "GetCrawlIssues", {
        siteUrl: connection.propertyUrl,
      })) ?? []
    );
  }

  /** GetLinkCounts — backlink summary. */
  async getLinkCounts(
    connection: BingWebmasterConnection,
  ): Promise<BingLinkCountsResponse> {
    return (
      (await this.getJson<BingLinkCountsResponse>(connection, "GetLinkCounts", {
        siteUrl: connection.propertyUrl,
      })) ?? { TotalLinks: 0, Links: [] }
    );
  }
}
