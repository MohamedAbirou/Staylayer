import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainStatus } from "@prisma/client";
import { timingSafeEqual } from "node:crypto";
import { FormsService } from "../forms/forms.service";
import { PrismaService } from "../prisma/prisma.service";
import { SeoService } from "../seo/seo.service";
import {
  applyJsonLdOverride,
  normalizeOverride,
} from "../seo/page-schema/page-schema-merge";
import { PublicRuntimeCacheService } from "./public-runtime.cache.service";
import {
  HostResolutionService,
  ResolveHostResponse,
} from "./host-resolution.service";
import { PreviewTokenService } from "./preview-token.service";
import {
  buildAbsoluteUrl,
  isHomepagePathname,
  isSupportedRuntimeLocale,
  normalizeHostname,
  normalizePathname,
  pathnameToCanonicalPath,
  pathnameToSlug,
  stripWww,
} from "./public-runtime.util";
import { extractImagesFromPuck } from "../seo/sitemap/extract-images";

function matchesAnyExclusion(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (!pattern) continue;
    if (pattern === path) return true;
    if (pattern.includes("*")) {
      const regex = new RegExp(
        "^" +
          pattern
            .split("*")
            .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
            .join(".*") +
          "$",
      );
      if (regex.test(path)) return true;
    }
  }
  return false;
}

type RuntimePageRecord = {
  id: string;
  slug: string;
  locale: string;
  title: string;
  puckData: Record<string, unknown>;
  seoTitle: string | null;
  seoDescription: string | null;
  targetKeywords: string | null;
  internalBrief: string | null;
  seoOgImage: string | null;
  seoCanonical: string | null;
  seoNoindex: boolean;
  jsonLdOverride: unknown;
  updatedAt: Date;
};

@Injectable()
export class PublicRuntimeService {
  private static readonly PAGE_CACHE_TTL_SECONDS = 60;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly formsService: FormsService,
    private readonly seoService: SeoService,
    private readonly cacheService: PublicRuntimeCacheService,
    private readonly hostResolutionService: HostResolutionService,
    private readonly previewTokenService: PreviewTokenService,
  ) {}

  assertTrustedWebsite(secret: string | undefined): void {
    const configuredSecret =
      this.configService.get<string>("WEBSITE_RUNTIME_SECRET")?.trim() ?? "";
    const providedSecret = String(secret ?? "");

    if (!configuredSecret || !providedSecret) {
      throw new UnauthorizedException({
        code: "INVALID_RUNTIME_SECRET",
        message: "Website runtime secret is missing",
      });
    }

    const provided = Buffer.from(providedSecret);
    const expected = Buffer.from(configuredSecret);

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new UnauthorizedException({
        code: "INVALID_RUNTIME_SECRET",
        message: "Website runtime secret is invalid",
      });
    }
  }

  async resolveHost(input: {
    hostname: string;
    pathname?: string;
    previewToken?: string;
  }): Promise<ResolveHostResponse> {
    return this.hostResolutionService.resolveHost(input);
  }

  async listSiteHosts(siteId: string): Promise<string[]> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        publicSubdomain: true,
        preferredHostVariant: true,
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
    });

    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found",
      });
    }

    return this.listAllowedPreviewHosts({
      publicSubdomain: site.publicSubdomain,
      domains: site.domains,
      preferredHostVariant: site.preferredHostVariant,
    });
  }

  async getPagePayload(input: {
    hostname: string;
    pathname: string;
    locale?: string;
    draft?: boolean;
  }) {
    const hostname = normalizeHostname(input.hostname);
    const pathname = normalizePathname(input.pathname);
    const resolution = await this.hostResolutionService.resolveHost({
      hostname,
      pathname,
    });

    if (resolution.action === "not_found") {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Public site was not found for this hostname",
      });
    }

    if (resolution.action === "redirect") {
      return this.buildEmptyPayload(hostname, pathname, {
        location: resolution.location,
        permanent: resolution.permanent,
      });
    }

    const draft = input.draft === true;
    const locale = this.resolveLocale(
      input.locale,
      resolution.defaultLocale,
      resolution.enabledLocales,
    );
    const cacheKey = `runtime:page:${resolution.canonicalHost}:${pathname}:${locale}:${draft ? 1 : 0}`;

    if (!draft) {
      const cached =
        await this.cacheService.getJson<Record<string, unknown>>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const site = await this.prisma.site.findUnique({
      where: { id: resolution.siteId },
      select: {
        id: true,
        name: true,
        publicSubdomain: true,
        publishedRevision: true,
        previewTokenVersion: true,
        primaryLocale: true,
        enabledLocales: true,
        settings: {
          select: {
            siteName: true,
            logoUrl: true,
            faviconUrl: true,
            defaultLocale: true,
            activeLocales: true,
            seoTitleTemplate: true,
            seoDefaultDesc: true,
            seoOgImage: true,
            seoIndexingEnabled: true,
            seoLocaleDefaults: true,
            gaTrackingId: true,
            gtmContainerId: true,
            clarityId: true,
            googleSiteVerify: true,
            bingSiteVerify: true,
            yandexSiteVerify: true,
            pinterestSiteVerify: true,
            twitterHandle: true,
            facebookUrl: true,
            linkedinUrl: true,
            instagramUrl: true,
            youtubeUrl: true,
            tiktokUrl: true,
            pinterestUrl: true,
            supportEmail: true,
          },
        },
      },
    });

    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Resolved site no longer exists",
      });
    }

    const redirect = await this.seoService.resolveRedirect(
      site.id,
      pathname,
      locale,
    );
    if (redirect) {
      return this.buildEmptyPayload(resolution.canonicalHost, pathname, {
        location: buildAbsoluteUrl(resolution.canonicalHost, redirect.toPath),
        permanent: redirect.permanent,
      });
    }

    const page = await this.loadRuntimePage({
      siteId: site.id,
      pathname,
      locale,
      fallbackLocale: site.settings?.defaultLocale || site.primaryLocale,
      draft,
    });

    if (!page) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Published page not found for this hostname and path",
      });
    }

    const pageAvailableLocales = await this.listRuntimePageLocales({
      siteId: site.id,
      pathname,
      draft,
    });

    const formsByKey = await this.loadFormsByKey({
      siteId: site.id,
      pathname,
      locale: page.locale,
      puckData: page.puckData,
    });
    const localeSeoDefaults = this.getLocaleSeoDefaults(
      site.settings?.seoLocaleDefaults,
      page.locale,
    );
    const structuredData = await this.buildStructuredData({
      siteId: site.id,
      hostname: resolution.canonicalHost,
      pathname,
      siteName: site.settings?.siteName || site.name,
      pageTitle: page.title,
      puckData: page.puckData,
      logoUrl: this.toNullableString(site.settings?.logoUrl),
      sameAs: [
        this.toNullableString(site.settings?.facebookUrl),
        this.toNullableString(site.settings?.linkedinUrl),
        this.toNullableString(site.settings?.instagramUrl),
        this.toNullableString(site.settings?.youtubeUrl),
        this.toNullableString(site.settings?.tiktokUrl),
        this.toNullableString(site.settings?.pinterestUrl),
      ].filter((value): value is string => Boolean(value)),
      jsonLdOverride: page.jsonLdOverride,
    });
    const payload = {
      site: {
        id: site.id,
        name: site.settings?.siteName || site.name,
        canonicalHost: resolution.canonicalHost,
        defaultLocale: site.settings?.defaultLocale || site.primaryLocale,
        enabledLocales: Array.from(
          new Set(
            (site.settings?.activeLocales ?? site.enabledLocales).filter(
              Boolean,
            ),
          ),
        ),
        theme: {
          logoUrl: this.toNullableString(site.settings?.logoUrl),
          faviconUrl: this.toNullableString(site.settings?.faviconUrl),
        },
        indexingEnabled: site.settings?.seoIndexingEnabled !== false,
        analytics: {
          gaTrackingId: this.toNullableString(site.settings?.gaTrackingId),
          gtmContainerId: this.toNullableString(site.settings?.gtmContainerId),
          clarityId: this.toNullableString(site.settings?.clarityId),
        },
        verification: {
          googleSiteVerification: this.toNullableString(
            site.settings?.googleSiteVerify,
          ),
          bingSiteVerification: this.toNullableString(
            site.settings?.bingSiteVerify,
          ),
          yandexSiteVerification: this.toNullableString(
            site.settings?.yandexSiteVerify,
          ),
          pinterestSiteVerification: this.toNullableString(
            site.settings?.pinterestSiteVerify,
          ),
        },
        social: {
          twitterHandle: this.normalizeTwitterHandle(
            site.settings?.twitterHandle,
          ),
          facebookUrl: this.toNullableString(site.settings?.facebookUrl),
          linkedinUrl: this.toNullableString(site.settings?.linkedinUrl),
          instagramUrl: this.toNullableString(site.settings?.instagramUrl),
          youtubeUrl: this.toNullableString(site.settings?.youtubeUrl),
          tiktokUrl: this.toNullableString(site.settings?.tiktokUrl),
          pinterestUrl: this.toNullableString(site.settings?.pinterestUrl),
        },
        contact: {
          supportEmail: this.toNullableString(site.settings?.supportEmail),
        },
      },
      page: {
        id: page.id,
        slug: isHomepagePathname(pathname) ? "" : pathnameToSlug(pathname),
        locale: page.locale,
        availableLocales: pageAvailableLocales,
        title: page.title,
        puckData: page.puckData,
        seo: {
          title: this.buildSeoTitle(
            page.seoTitle,
            page.title,
            localeSeoDefaults.titleTemplate || site.settings?.seoTitleTemplate,
          ),
          description:
            this.toNullableString(page.seoDescription) ||
            localeSeoDefaults.description ||
            this.toNullableString(site.settings?.seoDefaultDesc) ||
            "",
          keywords: this.parseKeywords(page.targetKeywords),
          canonicalUrl: this.resolveCanonicalUrl(
            page.seoCanonical,
            resolution.canonicalHost,
            pathname,
          ),
          ogImage:
            this.toNullableString(page.seoOgImage) ||
            localeSeoDefaults.ogImage ||
            this.toNullableString(site.settings?.seoOgImage),
          noindex:
            draft ||
            !site.settings?.seoIndexingEnabled ||
            page.seoNoindex === true,
        },
      },
      navigation: await this.buildNavigation(site.id, page.locale),
      forms: {
        byKey: formsByKey,
      },
      structuredData,
      cache: {
        siteTag: `site:${site.id}`,
        pageTag: `page:${site.id}:${pathnameToCanonicalPath(pathname)}`,
      },
    };

    if (!draft) {
      await this.cacheService.setJson(
        cacheKey,
        payload,
        PublicRuntimeService.PAGE_CACHE_TTL_SECONDS,
      );
    }

    return payload;
  }

  async getRoutes(input: { hostname: string }) {
    const hostname = normalizeHostname(input.hostname);
    const resolution = await this.hostResolutionService.resolveHost({
      hostname,
      pathname: "/",
    });

    if (resolution.action !== "serve") {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Sitemap routes are only available for resolved public hosts",
      });
    }

    const [pages, settings] = await Promise.all([
      this.prisma.page.findMany({
        where: {
          siteId: resolution.siteId,
          published: true,
          deletedAt: null,
        },
        select: {
          slug: true,
          locale: true,
          updatedAt: true,
          puckData: true,
        },
        orderBy: [{ slug: "asc" }, { locale: "asc" }],
      }),
      this.prisma.siteSettings.findUnique({
        where: { siteId: resolution.siteId },
        select: {
          sitemapExcludedPaths: true,
          sitemapIncludeImages: true,
          seoIndexingEnabled: true,
        },
      }),
    ]);

    const excludedPaths = (settings?.sitemapExcludedPaths ?? [])
      .map((p) => p.trim())
      .filter(Boolean);
    const includeImages = settings?.sitemapIncludeImages ?? true;

    const routeMap = new Map<
      string,
      { lastModified: Date; locales: Set<string>; images: Set<string> }
    >();

    for (const page of pages) {
      const path = this.slugToPath(page.slug);
      const existing = routeMap.get(path);

      if (!existing) {
        const entry = {
          lastModified: page.updatedAt,
          locales: new Set([page.locale]),
          images: new Set<string>(),
        };
        if (includeImages) {
          for (const img of extractImagesFromPuck(page.puckData)) {
            entry.images.add(img);
          }
        }
        routeMap.set(path, entry);
        continue;
      }

      if (page.updatedAt > existing.lastModified) {
        existing.lastModified = page.updatedAt;
      }

      existing.locales.add(page.locale);
      if (includeImages) {
        for (const img of extractImagesFromPuck(page.puckData)) {
          existing.images.add(img);
        }
      }
    }

    return {
      siteId: resolution.siteId,
      canonicalHost: resolution.canonicalHost,
      sitemap: {
        indexingEnabled: settings?.seoIndexingEnabled ?? true,
        includeImages,
        excludedPaths,
      },
      routes: Array.from(routeMap.entries())
        .map(([path, value]) => ({
          path,
          url: buildAbsoluteUrl(resolution.canonicalHost, path),
          locales: Array.from(value.locales).sort(),
          lastModified: value.lastModified.toISOString(),
          images: Array.from(value.images),
          excluded: matchesAnyExclusion(path, excludedPaths),
        }))
        .filter((route) => !route.excluded)
        .map(({ excluded: _excluded, ...rest }) => rest),
    };
  }

  /**
   * Lean payload used by the website's `robots.js` and middleware. Returns
   * only the data needed to render `/robots.txt` and verify IndexNow key
   * file requests.
   */
  async getSiteMeta(input: { hostname: string }) {
    const hostname = normalizeHostname(input.hostname);
    const resolution = await this.hostResolutionService.resolveHost({
      hostname,
      pathname: "/",
    });
    if (resolution.action !== "serve") {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site meta is only available for resolved public hosts",
      });
    }
    const settings = await this.prisma.siteSettings.findUnique({
      where: { siteId: resolution.siteId },
      select: {
        seoIndexingEnabled: true,
        robotsCustomRules: true,
        robotsAiCrawlerPolicy: true,
        indexNowEnabled: true,
        indexNowKey: true,
        sitemapIncludeImages: true,
      },
    });
    return {
      siteId: resolution.siteId,
      canonicalHost: resolution.canonicalHost,
      indexingEnabled: settings?.seoIndexingEnabled ?? true,
      robots: {
        customRules: settings?.robotsCustomRules ?? "",
        aiCrawlerPolicy: settings?.robotsAiCrawlerPolicy ?? {},
      },
      indexNow: {
        enabled: settings?.indexNowEnabled ?? false,
        hasKey: Boolean(settings?.indexNowKey),
      },
      sitemap: {
        includeImages: settings?.sitemapIncludeImages ?? true,
      },
    };
  }

  /**
   * Verify whether the supplied key matches the IndexNow key configured for
   * the site that resolves from the supplied hostname. Used by the website
   * middleware to serve `/{key}.txt`.
   */
  async verifyIndexNowKey(input: {
    hostname: string;
    key: string;
  }): Promise<{ valid: boolean; key: string | null }> {
    const candidate = (input.key || "").trim();
    if (
      !candidate ||
      candidate.length < 8 ||
      candidate.length > 128 ||
      !/^[a-zA-Z0-9-]+$/.test(candidate)
    ) {
      return { valid: false, key: null };
    }
    const resolution = await this.hostResolutionService.resolveHost({
      hostname: normalizeHostname(input.hostname),
      pathname: "/",
    });
    if (resolution.action !== "serve") return { valid: false, key: null };
    const settings = await this.prisma.siteSettings.findUnique({
      where: { siteId: resolution.siteId },
      select: { indexNowKey: true },
    });
    if (!settings?.indexNowKey || settings.indexNowKey.length < 8) {
      return { valid: false, key: null };
    }
    const expected = Buffer.from(settings.indexNowKey);
    const provided = Buffer.from(candidate);
    if (expected.length !== provided.length) return { valid: false, key: null };
    const valid = timingSafeEqual(expected, provided);
    return { valid, key: valid ? candidate : null };
  }

  async createPreviewLink(input: {
    siteId: string;
    actorId: string;
    requestedHost?: string;
    requestedPathname?: string;
    expiresInSeconds?: number;
  }) {
    const site = await this.prisma.site.findUnique({
      where: { id: input.siteId },
      select: {
        id: true,
        publicSubdomain: true,
        preferredHostVariant: true,
        previewTokenVersion: true,
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
    });

    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found",
      });
    }

    const allowedHosts = this.listAllowedPreviewHosts({
      publicSubdomain: site.publicSubdomain,
      domains: site.domains,
      preferredHostVariant: site.preferredHostVariant,
    });
    const requestedHost = input.requestedHost
      ? normalizeHostname(input.requestedHost)
      : null;
    const host = requestedHost ?? allowedHosts[0] ?? null;

    if (!host) {
      throw new BadRequestException({
        code: "PREVIEW_HOST_UNAVAILABLE",
        message: "No public host is available for this site preview",
      });
    }

    if (requestedHost && !allowedHosts.includes(requestedHost)) {
      throw new BadRequestException({
        code: "PREVIEW_HOST_UNAVAILABLE",
        message: "The requested preview host does not belong to this site",
      });
    }

    const pathname = normalizePathname(input.requestedPathname ?? "/");
    const expiresInSeconds = input.expiresInSeconds ?? 600;
    const token = this.previewTokenService.createToken({
      siteId: site.id,
      actorId: input.actorId,
      host,
      pathPrefix: pathname,
      tokenVersion: site.previewTokenVersion,
      expiresInSeconds,
    });

    const previewUrl = new URL(`https://${host}/api/preview`);
    previewUrl.searchParams.set("token", token.token);
    previewUrl.searchParams.set("path", pathname);

    return {
      siteId: site.id,
      host,
      pathname,
      expiresAt: token.expiresAt,
      token: token.token,
      url: previewUrl.toString(),
    };
  }

  private async loadRuntimePage(input: {
    siteId: string;
    pathname: string;
    locale: string;
    fallbackLocale: string;
    draft: boolean;
  }): Promise<RuntimePageRecord | null> {
    const candidateLocales = Array.from(
      new Set([input.locale, input.fallbackLocale].filter(Boolean)),
    );
    const slugCandidates = isHomepagePathname(input.pathname)
      ? ["home", "index"]
      : [pathnameToSlug(input.pathname)];

    for (const locale of candidateLocales) {
      for (const slug of slugCandidates) {
        const page = await this.prisma.page.findFirst({
          where: {
            siteId: input.siteId,
            slug,
            locale,
            deletedAt: null,
            ...(input.draft ? {} : { published: true }),
          },
          select: {
            id: true,
            slug: true,
            locale: true,
            title: true,
            puckData: true,
            seoTitle: true,
            seoDescription: true,
            targetKeywords: true,
            internalBrief: true,
            seoOgImage: true,
            seoCanonical: true,
            seoNoindex: true,
            jsonLdOverride: true,
            updatedAt: true,
          },
        });

        if (page) {
          return {
            ...page,
            puckData: (page.puckData ?? {}) as Record<string, unknown>,
          };
        }
      }
    }

    return null;
  }

  private async listRuntimePageLocales(input: {
    siteId: string;
    pathname: string;
    draft: boolean;
  }): Promise<string[]> {
    const slugCandidates = isHomepagePathname(input.pathname)
      ? ["home", "index"]
      : [pathnameToSlug(input.pathname)];

    const pages = await this.prisma.page.findMany({
      where: {
        siteId: input.siteId,
        slug: { in: slugCandidates },
        deletedAt: null,
        ...(input.draft ? {} : { published: true }),
      },
      select: {
        locale: true,
      },
      orderBy: [{ locale: "asc" }],
    });

    return Array.from(
      new Set(pages.map((page) => page.locale).filter(Boolean)),
    );
  }

  private async loadFormsByKey(input: {
    siteId: string;
    pathname: string;
    locale: string;
    puckData: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    const keys = this.extractContactSectionFormKeys(input.puckData);

    if (keys.size === 0) {
      return {};
    }

    const pageSlug = pathnameToSlug(input.pathname);
    const entries = await Promise.all(
      Array.from(keys).map(async (key) => {
        try {
          const resolvedForm = await this.formsService.resolvePublicForm(
            input.siteId,
            {
              pageSlug,
              locale: input.locale,
              formKey: key || undefined,
            },
          );

          return [
            key,
            resolvedForm
              ? {
                  ...resolvedForm,
                  action: "/api/forms/submit",
                }
              : null,
          ] as const;
        } catch {
          return [key, null] as const;
        }
      }),
    );

    return Object.fromEntries(entries);
  }

  private extractContactSectionFormKeys(
    value: unknown,
    keys: Set<string> = new Set<string>(),
  ): Set<string> {
    if (Array.isArray(value)) {
      value.forEach((entry) => this.extractContactSectionFormKeys(entry, keys));
      return keys;
    }

    if (!value || typeof value !== "object") {
      return keys;
    }

    const record = value as Record<string, unknown>;
    if (record.type === "ContactSection") {
      const props =
        record.props && typeof record.props === "object"
          ? (record.props as Record<string, unknown>)
          : null;
      const formKey =
        typeof props?.formKey === "string"
          ? props.formKey.trim()
          : typeof record.formKey === "string"
            ? record.formKey.trim()
            : "";

      keys.add(formKey);
    }

    for (const child of Object.values(record)) {
      this.extractContactSectionFormKeys(child, keys);
    }

    return keys;
  }

  private async buildStructuredData(input: {
    siteId: string;
    hostname: string;
    pathname: string;
    siteName: string;
    pageTitle: string;
    puckData: Record<string, unknown>;
    logoUrl: string | null;
    sameAs: string[];
    jsonLdOverride?: unknown;
  }): Promise<Record<string, unknown>[]> {
    const entries: Record<string, unknown>[] = [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: input.siteName,
        url: buildAbsoluteUrl(input.hostname, "/"),
      },
    ];

    const orgEntry: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: input.siteName,
      url: buildAbsoluteUrl(input.hostname, "/"),
    };
    if (input.logoUrl) {
      orgEntry.logo = input.logoUrl;
    }
    if (input.sameAs.length > 0) {
      orgEntry.sameAs = input.sameAs;
    }
    entries.push(orgEntry);

    const businessJsonLd = await this.seoService.generateJsonLd(input.siteId);
    if (businessJsonLd) {
      if (input.sameAs.length > 0 && !businessJsonLd.sameAs) {
        businessJsonLd.sameAs = input.sameAs;
      }
      entries.push(businessJsonLd);
    }

    const enabledSchemas = await this.seoService.getEnabledSchemas(
      input.siteId,
    );

    const breadcrumb = enabledSchemas.includes("BreadcrumbList")
      ? this.buildBreadcrumbJsonLd(
          input.hostname,
          input.pathname,
          input.pageTitle,
        )
      : null;
    if (breadcrumb) {
      entries.push(breadcrumb);
    }

    const pageSchemas = await this.seoService.generatePageTypeJsonLd(
      input.siteId,
      {
        hostname: input.hostname,
        pathname: input.pathname,
        puckData: input.puckData,
      },
    );
    entries.push(...pageSchemas);

    if (input.jsonLdOverride !== undefined && input.jsonLdOverride !== null) {
      const override = normalizeOverride(input.jsonLdOverride);
      return applyJsonLdOverride(entries, override);
    }

    return entries;
  }

  private getLocaleSeoDefaults(raw: unknown, locale: string) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { titleTemplate: null, description: null, ogImage: null };
    }

    const localeDefaults = (raw as Record<string, unknown>)[locale];
    if (
      !localeDefaults ||
      typeof localeDefaults !== "object" ||
      Array.isArray(localeDefaults)
    ) {
      return { titleTemplate: null, description: null, ogImage: null };
    }

    const defaults = localeDefaults as Record<string, unknown>;

    return {
      titleTemplate: this.toNullableString(
        typeof defaults.titleTemplate === "string"
          ? defaults.titleTemplate
          : null,
      ),
      description: this.toNullableString(
        typeof defaults.description === "string" ? defaults.description : null,
      ),
      ogImage: this.toNullableString(
        typeof defaults.ogImage === "string" ? defaults.ogImage : null,
      ),
    };
  }

  private buildBreadcrumbJsonLd(
    hostname: string,
    pathname: string,
    pageTitle: string,
  ): Record<string, unknown> | null {
    const canonicalPath = pathnameToCanonicalPath(pathname);
    if (canonicalPath === "/") {
      return null;
    }

    const segments = canonicalPath.slice(1).split("/");
    const items = [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: buildAbsoluteUrl(hostname, "/"),
      },
      ...segments.map((segment, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name:
          index === segments.length - 1
            ? pageTitle
            : this.humanizeSlugSegment(segment),
        item: buildAbsoluteUrl(
          hostname,
          `/${segments.slice(0, index + 1).join("/")}`,
        ),
      })),
    ];

    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items,
    };
  }

  private async buildNavigation(siteId: string, locale: string) {
    const pages = await this.prisma.page.findMany({
      where: {
        siteId,
        locale,
        published: true,
        deletedAt: null,
      },
      select: {
        slug: true,
        title: true,
      },
      orderBy: [{ slug: "asc" }, { title: "asc" }],
    });

    return pages.map((page) => ({
      title: page.title,
      path: this.slugToPath(page.slug),
    }));
  }

  private resolveLocale(
    requestedLocale: string | undefined,
    defaultLocale: string,
    enabledLocales: string[],
  ): string {
    if (
      requestedLocale &&
      isSupportedRuntimeLocale(requestedLocale) &&
      enabledLocales.includes(requestedLocale)
    ) {
      return requestedLocale;
    }

    return defaultLocale;
  }

  private buildSeoTitle(
    pageSeoTitle: string | null,
    pageTitle: string,
    template: string | null | undefined,
  ): string {
    if (pageSeoTitle?.trim()) {
      return pageSeoTitle.trim();
    }

    const normalizedTemplate = this.toNullableString(template);
    if (normalizedTemplate?.includes("%s")) {
      return normalizedTemplate.replace("%s", pageTitle);
    }

    return pageTitle;
  }

  private buildEmptyPayload(
    hostname: string,
    pathname: string,
    redirect?: { location: string; permanent: boolean },
  ) {
    return {
      site: {
        id: "",
        name: "",
        canonicalHost: hostname,
        defaultLocale: "en",
        enabledLocales: ["en"],
        theme: {
          logoUrl: null,
          faviconUrl: null,
        },
      },
      page: null,
      navigation: [],
      forms: {
        byKey: {},
      },
      structuredData: [],
      ...(redirect ? { redirect } : {}),
      cache: {
        siteTag: "",
        pageTag: `page::${pathnameToCanonicalPath(pathname)}`,
      },
    };
  }

  private slugToPath(slug: string): string {
    if (slug === "home" || slug === "index") {
      return "/";
    }

    return `/${slug}`;
  }

  private humanizeSlugSegment(segment: string): string {
    return segment
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private listAllowedPreviewHosts(input: {
    publicSubdomain: string | null;
    domains: Array<{ host: string; isPrimary: boolean }>;
    preferredHostVariant: "APEX" | "WWW";
  }): string[] {
    const hosts = new Set<string>();

    const primaryDomain =
      input.domains.find((domain) => domain.isPrimary) ?? input.domains[0];
    if (primaryDomain) {
      const baseDomain = stripWww(primaryDomain.host);
      const apexDomain = input.domains.find(
        (domain) =>
          stripWww(domain.host) === baseDomain &&
          !domain.host.startsWith("www."),
      );
      const wwwDomain = input.domains.find(
        (domain) =>
          stripWww(domain.host) === baseDomain &&
          domain.host.startsWith("www."),
      );
      const canonicalDomain =
        input.preferredHostVariant === "WWW"
          ? (wwwDomain?.host ?? primaryDomain.host)
          : (apexDomain?.host ?? primaryDomain.host);

      hosts.add(canonicalDomain);
      input.domains.forEach((domain) => hosts.add(domain.host));
    }

    const platformRootDomain = normalizeHostname(
      this.configService.get<string>("PLATFORM_ROOT_DOMAIN"),
    );

    if (input.publicSubdomain && platformRootDomain) {
      hosts.add(`${input.publicSubdomain}.${platformRootDomain}`);
    }

    return Array.from(hosts);
  }

  private toNullableString(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private normalizeTwitterHandle(
    value: string | null | undefined,
  ): string | null {
    const normalized = value?.trim();
    if (!normalized) return null;
    const stripped = normalized.replace(/^@+/, "");
    if (!stripped) return null;
    return `@${stripped}`;
  }

  private parseKeywords(value: string | null | undefined): string[] {
    if (!value) return [];
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && entry.length <= 80)
      .slice(0, 32);
  }

  private resolveCanonicalUrl(
    perPageCanonical: string | null | undefined,
    canonicalHost: string,
    pathname: string,
  ): string {
    const override = perPageCanonical?.trim();
    if (override) {
      if (/^https?:\/\//i.test(override)) {
        try {
          return new URL(override).toString();
        } catch {
          // fall through to default
        }
      } else if (override.startsWith("/")) {
        return buildAbsoluteUrl(canonicalHost, override);
      }
    }
    return buildAbsoluteUrl(canonicalHost, pathname);
  }
}
