import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DomainStatus,
  HostVariant,
  SiteStatus,
  TenantStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PublicRuntimeCacheService } from "./public-runtime.cache.service";
import { PreviewTokenService } from "./preview-token.service";
import {
  buildAbsoluteUrl,
  companionHost,
  extractPlatformSubdomain,
  normalizeHostname,
  normalizePathname,
  stripWww,
} from "./public-runtime.util";
import {
  getConfiguredPlatformRootDomain,
  isUsablePlatformRootDomain,
} from "./platform-root-domain";

export type ResolveHostResponse =
  | {
      action: "serve";
      siteId: string;
      resolutionSource: "custom_domain" | "platform_subdomain";
      canonicalHost: string;
      defaultLocale: string;
      enabledLocales: string[];
      preview: boolean;
      cacheTtlSeconds: number;
      previewTokenVersion: number;
    }
  | {
      action: "redirect";
      location: string;
      permanent: boolean;
    }
  | {
      action: "not_found";
    };

type CachedServeResolution = Omit<
  Extract<ResolveHostResponse, { action: "serve" }>,
  "preview"
>;

@Injectable()
export class HostResolutionService {
  private static readonly HOST_CACHE_TTL_SECONDS = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cacheService: PublicRuntimeCacheService,
    private readonly previewTokenService: PreviewTokenService,
  ) {}

  async resolveHost(input: {
    hostname: string;
    pathname?: string;
    previewToken?: string;
  }): Promise<ResolveHostResponse> {
    const hostname = normalizeHostname(input.hostname);
    const pathname = normalizePathname(input.pathname);

    if (!hostname) {
      return { action: "not_found" };
    }

    const reservedRedirect = this.maybeRedirectReservedHost(hostname, pathname);
    if (reservedRedirect) {
      return reservedRedirect;
    }

    const cacheKey = `runtime:host:${hostname}`;
    const cached =
      await this.cacheService.getJson<CachedServeResolution>(cacheKey);
    if (cached) {
      return this.applyPreview(cached, hostname, pathname, input.previewToken);
    }

    const customDomainMatch = await this.resolveCustomDomain(
      hostname,
      pathname,
    );
    if (customDomainMatch) {
      if (customDomainMatch.action === "serve") {
        await this.cacheService.setJson(
          cacheKey,
          customDomainMatch,
          customDomainMatch.cacheTtlSeconds,
        );
      }

      return this.applyPreview(
        customDomainMatch,
        hostname,
        pathname,
        input.previewToken,
      );
    }

    const platformSubdomainMatch =
      await this.resolvePlatformSubdomain(hostname);
    if (platformSubdomainMatch) {
      await this.cacheService.setJson(
        cacheKey,
        platformSubdomainMatch,
        platformSubdomainMatch.cacheTtlSeconds,
      );

      return this.applyPreview(
        platformSubdomainMatch,
        hostname,
        pathname,
        input.previewToken,
      );
    }

    return { action: "not_found" };
  }

  private async applyPreview(
    resolution:
      | CachedServeResolution
      | Extract<ResolveHostResponse, { action: "redirect" }>
      | Extract<ResolveHostResponse, { action: "not_found" }>,
    hostname: string,
    pathname: string,
    previewToken?: string,
  ): Promise<ResolveHostResponse> {
    if (resolution.action !== "serve") {
      return resolution;
    }

    if (!previewToken) {
      return {
        ...resolution,
        preview: false,
      };
    }

    this.previewTokenService.assertAuthorizedPreview({
      token: previewToken,
      siteId: resolution.siteId,
      hostname,
      pathname,
      tokenVersion: resolution.previewTokenVersion,
    });

    return {
      ...resolution,
      preview: true,
    };
  }

  private maybeRedirectReservedHost(
    hostname: string,
    pathname: string,
  ): Extract<ResolveHostResponse, { action: "redirect" }> | null {
    const platformRootDomain = getConfiguredPlatformRootDomain(
      this.configService,
    );
    const marketingOrigin = this.configService.get<string>(
      "MARKETING_APP_ORIGIN",
    );
    const dashboardOrigin = this.configService.get<string>(
      "DASHBOARD_APP_ORIGIN",
    );

    if (marketingOrigin) {
      const marketingHost = normalizeHostname(new URL(marketingOrigin).host);

      if (
        (platformRootDomain && hostname === platformRootDomain) ||
        (platformRootDomain && hostname === `www.${platformRootDomain}`) ||
        hostname === marketingHost
      ) {
        return {
          action: "redirect",
          location: new URL(pathname, marketingOrigin).toString(),
          permanent: false,
        };
      }
    }

    if (dashboardOrigin) {
      const dashboardHost = normalizeHostname(new URL(dashboardOrigin).host);

      if (hostname === dashboardHost) {
        return {
          action: "redirect",
          location: new URL(pathname, dashboardOrigin).toString(),
          permanent: false,
        };
      }
    }

    return null;
  }

  private async resolveCustomDomain(
    hostname: string,
    pathname: string,
  ): Promise<ResolveHostResponse | null> {
    const candidateHosts = Array.from(
      new Set([hostname, companionHost(hostname)]),
    );

    const matches = await this.prisma.domain.findMany({
      where: {
        host: { in: candidateHosts },
        status: DomainStatus.ACTIVE,
        site: {
          status: SiteStatus.ACTIVE,
          tenant: {
            status: TenantStatus.ACTIVE,
          },
        },
      },
      select: {
        host: true,
        site: {
          select: {
            id: true,
            preferredHostVariant: true,
            primaryLocale: true,
            enabledLocales: true,
            previewTokenVersion: true,
            settings: {
              select: {
                defaultLocale: true,
                activeLocales: true,
              },
            },
            domains: {
              where: {
                status: DomainStatus.ACTIVE,
              },
              select: {
                host: true,
                isPrimary: true,
              },
            },
          },
        },
      },
    });

    if (matches.length === 0) {
      return null;
    }

    const matchedDomain =
      matches.find((entry) => entry.host === hostname) ?? matches[0];
    const canonicalHost = this.resolveCanonicalCustomHost(
      matchedDomain.site.domains,
      matchedDomain.site.preferredHostVariant,
    );

    if (
      canonicalHost &&
      hostname !== canonicalHost &&
      stripWww(hostname) === stripWww(canonicalHost)
    ) {
      return {
        action: "redirect",
        location: buildAbsoluteUrl(canonicalHost, pathname),
        permanent: true,
      };
    }

    return {
      action: "serve",
      siteId: matchedDomain.site.id,
      resolutionSource: "custom_domain",
      canonicalHost: canonicalHost ?? matchedDomain.host,
      defaultLocale:
        matchedDomain.site.settings?.defaultLocale ||
        matchedDomain.site.primaryLocale,
      enabledLocales: Array.from(
        new Set(
          (
            matchedDomain.site.settings?.activeLocales ??
            matchedDomain.site.enabledLocales
          ).filter(Boolean),
        ),
      ),
      preview: false,
      cacheTtlSeconds: HostResolutionService.HOST_CACHE_TTL_SECONDS,
      previewTokenVersion: matchedDomain.site.previewTokenVersion,
    };
  }

  private async resolvePlatformSubdomain(
    hostname: string,
  ): Promise<CachedServeResolution | null> {
    const platformRootDomain = getConfiguredPlatformRootDomain(
      this.configService,
    );

    if (!isUsablePlatformRootDomain(platformRootDomain)) {
      return null;
    }

    const label = extractPlatformSubdomain(hostname, platformRootDomain);

    if (!label) {
      return null;
    }

    const site = await this.prisma.site.findFirst({
      where: {
        publicSubdomain: label,
        status: SiteStatus.ACTIVE,
        tenant: {
          status: TenantStatus.ACTIVE,
        },
      },
      select: {
        id: true,
        publicSubdomain: true,
        primaryLocale: true,
        enabledLocales: true,
        previewTokenVersion: true,
        settings: {
          select: {
            defaultLocale: true,
            activeLocales: true,
          },
        },
      },
    });

    if (!site || !site.publicSubdomain || !platformRootDomain) {
      return null;
    }

    return {
      action: "serve",
      siteId: site.id,
      resolutionSource: "platform_subdomain",
      canonicalHost: `${site.publicSubdomain}.${platformRootDomain}`,
      defaultLocale: site.settings?.defaultLocale || site.primaryLocale,
      enabledLocales: Array.from(
        new Set(
          (site.settings?.activeLocales ?? site.enabledLocales).filter(Boolean),
        ),
      ),
      cacheTtlSeconds: HostResolutionService.HOST_CACHE_TTL_SECONDS,
      previewTokenVersion: site.previewTokenVersion,
    };
  }

  private resolveCanonicalCustomHost(
    domains: Array<{ host: string; isPrimary: boolean }>,
    preferredHostVariant: HostVariant,
  ): string | null {
    if (domains.length === 0) {
      return null;
    }

    const primaryDomain =
      domains.find((domain) => domain.isPrimary) ?? domains[0];
    const baseDomain = stripWww(primaryDomain.host);
    const apexHost = domains.find(
      (domain) =>
        stripWww(domain.host) === baseDomain && !domain.host.startsWith("www."),
    );
    const wwwHost = domains.find(
      (domain) =>
        stripWww(domain.host) === baseDomain && domain.host.startsWith("www."),
    );

    if (preferredHostVariant === HostVariant.WWW && wwwHost) {
      return wwwHost.host;
    }

    if (preferredHostVariant === HostVariant.APEX && apexHost) {
      return apexHost.host;
    }

    return primaryDomain.host;
  }
}
