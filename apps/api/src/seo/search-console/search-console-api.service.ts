import { Injectable, Logger } from "@nestjs/common";
import {
  Prisma,
  SearchConsoleConnection,
  SearchConsoleConnectionStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

import { SeoTokenEncryptionService } from "./search-console-encryption.service";
import {
  GoogleTokenResponse,
  SearchConsoleOAuthService,
} from "./search-console-oauth.service";

const API_BASE = "https://searchconsole.googleapis.com/v1";

// Refresh access tokens this many seconds before they're due to expire so
// we don't race a long-running request against expiry.
const ACCESS_TOKEN_EARLY_REFRESH_SECONDS = 60;

export interface GscSearchAnalyticsRow {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscSearchAnalyticsResponse {
  rows?: GscSearchAnalyticsRow[];
  responseAggregationType?: string;
}

export interface GscSitemap {
  path: string;
  lastSubmitted?: string;
  isPending?: boolean;
  isSitemapsIndex?: boolean;
  type?: string;
  lastDownloaded?: string;
  warnings?: string;
  errors?: string;
  contents?: Array<{
    type: string;
    submitted?: string;
    indexed?: string;
  }>;
}

export interface GscSitemapsListResponse {
  sitemap?: GscSitemap[];
}

export interface GscSitesListResponse {
  siteEntry?: Array<{
    siteUrl: string;
    permissionLevel: string;
  }>;
}

export interface GscUrlInspectionResult {
  inspectionResult: {
    inspectionResultLink?: string;
    indexStatusResult?: {
      verdict?: string;
      coverageState?: string;
      robotsTxtState?: string;
      indexingState?: string;
      lastCrawlTime?: string;
      pageFetchState?: string;
      googleCanonical?: string;
      userCanonical?: string;
      referringUrls?: string[];
      crawledAs?: string;
    };
    mobileUsabilityResult?: {
      verdict?: string;
    };
    richResultsResult?: {
      verdict?: string;
      detectedItems?: Array<{ richResultType?: string }>;
    };
    ampResult?: { verdict?: string };
  };
}

export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly bodyText: string,
  ) {
    super(`Google Search Console API ${status} ${statusText}: ${bodyText}`);
    this.name = "GoogleApiError";
  }
}

/**
 * Thin REST wrapper around the Google Search Console API. Refreshes the
 * cached access token automatically using the connection's stored refresh
 * token. All methods accept a connection-id-or-object and re-read the
 * connection from the DB if needed.
 */
@Injectable()
export class SearchConsoleApiService {
  private readonly logger = new Logger(SearchConsoleApiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: SearchConsoleOAuthService,
    private readonly encryption: SeoTokenEncryptionService,
  ) {}

  async ensureAccessToken(connection: SearchConsoleConnection): Promise<string> {
    const now = Date.now();
    if (
      connection.accessTokenCache &&
      connection.accessTokenExpiresAt &&
      connection.accessTokenExpiresAt.getTime() - ACCESS_TOKEN_EARLY_REFRESH_SECONDS * 1000 >
        now
    ) {
      try {
        return this.encryption.decrypt(connection.accessTokenCache);
      } catch (err) {
        this.logger.warn(
          `Failed to decrypt cached access token (will refresh): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return this.refreshAndStore(connection);
  }

  private async refreshAndStore(
    connection: SearchConsoleConnection,
  ): Promise<string> {
    let refreshToken: string;
    try {
      refreshToken = this.encryption.decrypt(connection.encryptedRefreshToken);
    } catch (err) {
      await this.markError(connection.id, "Refresh token could not be decrypted");
      throw err;
    }

    let token: GoogleTokenResponse;
    try {
      token = await this.oauth.refreshAccessToken(refreshToken);
    } catch (err) {
      await this.markError(
        connection.id,
        err instanceof Error ? err.message : String(err),
      );
      throw err;
    }

    const expiresAt = new Date(Date.now() + token.expires_in * 1000);
    await this.prisma.searchConsoleConnection.update({
      where: { id: connection.id },
      data: {
        accessTokenCache: this.encryption.encrypt(token.access_token),
        accessTokenExpiresAt: expiresAt,
        status: SearchConsoleConnectionStatus.ACTIVE,
        lastError: null,
        consecutiveFailures: 0,
      },
    });
    return token.access_token;
  }

  private async markError(connectionId: string, message: string): Promise<void> {
    await this.prisma.searchConsoleConnection
      .update({
        where: { id: connectionId },
        data: {
          status: SearchConsoleConnectionStatus.ERROR,
          lastError: message.slice(0, 500),
          consecutiveFailures: { increment: 1 },
        },
      })
      .catch(() => {
        /* swallow — we're already in an error path */
      });
  }

  /**
   * Generic authenticated GET / POST. Returns parsed JSON or throws
   * {@link GoogleApiError}.
   */
  async authedJson<T>(
    connection: SearchConsoleConnection,
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const accessToken = await this.ensureAccessToken(connection);
    const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const resp = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (resp.status === 204) return undefined as T;
    const text = await resp.text();
    if (!resp.ok) {
      // 401 typically means the token was revoked.
      if (resp.status === 401 || resp.status === 403) {
        await this.markError(
          connection.id,
          `Google API ${resp.status}: ${text.slice(0, 200)}`,
        );
      }
      throw new GoogleApiError(resp.status, resp.statusText, text);
    }
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }

  /** GET /webmasters/v3/sites — list properties the user has access to. */
  async listSites(
    connection: SearchConsoleConnection,
  ): Promise<GscSitesListResponse> {
    return this.authedJson<GscSitesListResponse>(
      connection,
      "GET",
      "https://www.googleapis.com/webmasters/v3/sites",
    );
  }

  /** POST /searchanalytics/query for an arbitrary dimension set. */
  async querySearchAnalytics(
    connection: SearchConsoleConnection,
    request: {
      startDate: string;
      endDate: string;
      dimensions?: Array<"date" | "query" | "page" | "country" | "device">;
      rowLimit?: number;
      startRow?: number;
      type?: "web" | "discover" | "googleNews" | "news" | "image" | "video";
    },
  ): Promise<GscSearchAnalyticsResponse> {
    const path = `/sites/${encodeURIComponent(
      connection.propertyUrl,
    )}/searchAnalytics/query`;
    return this.authedJson<GscSearchAnalyticsResponse>(
      connection,
      "POST",
      path,
      {
        startDate: request.startDate,
        endDate: request.endDate,
        dimensions: request.dimensions ?? [],
        rowLimit: request.rowLimit ?? 25_000,
        startRow: request.startRow ?? 0,
        type: request.type ?? "web",
      },
    );
  }

  /** GET /webmasters/v3/sites/{siteUrl}/sitemaps */
  async listSitemaps(
    connection: SearchConsoleConnection,
  ): Promise<GscSitemapsListResponse> {
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      connection.propertyUrl,
    )}/sitemaps`;
    return this.authedJson<GscSitemapsListResponse>(connection, "GET", url);
  }

  /** PUT submit-sitemap */
  async submitSitemap(
    connection: SearchConsoleConnection,
    sitemapUrl: string,
  ): Promise<void> {
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      connection.propertyUrl,
    )}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
    await this.authedJson<void>(connection, "PUT", url);
  }

  /** DELETE sitemap (un-submit) */
  async deleteSitemap(
    connection: SearchConsoleConnection,
    sitemapUrl: string,
  ): Promise<void> {
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
      connection.propertyUrl,
    )}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
    await this.authedJson<void>(connection, "DELETE", url);
  }

  /** POST /urlInspection/index:inspect */
  async inspectUrl(
    connection: SearchConsoleConnection,
    inspectionUrl: string,
    languageCode?: string,
  ): Promise<GscUrlInspectionResult> {
    return this.authedJson<GscUrlInspectionResult>(
      connection,
      "POST",
      "/urlInspection/index:inspect",
      {
        inspectionUrl,
        siteUrl: connection.propertyUrl,
        languageCode: languageCode ?? "en-US",
      },
    );
  }
}

// Re-export typed Prisma helpers used in tests.
export type { Prisma };
