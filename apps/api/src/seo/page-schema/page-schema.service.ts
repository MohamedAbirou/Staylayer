import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { SUPPORTED_LOCALES } from "../../common/supported-locales";
import { SeoService } from "../seo.service";

import {
  applyJsonLdOverride,
  EMPTY_OVERRIDE,
  isEmptyOverride,
  MAX_CUSTOM_NODES,
  MAX_OVERRIDE_BYTES,
  normalizeOverride,
  type JsonLdOverride,
} from "./page-schema-merge";
import {
  validateJsonLdNodes,
  type JsonLdNode,
  type JsonLdValidationResult,
} from "./page-schema-validator";

interface PageLocator {
  slug: string;
  locale: string;
}

interface PageRecord {
  id: string;
  slug: string;
  locale: string;
  title: string;
  puckData: Prisma.JsonValue;
  jsonLdOverride: Prisma.JsonValue;
}

interface SiteRecord {
  id: string;
  name: string;
  primaryLocale: string;
  enabledLocales: string[];
  canonicalHost: string | null;
  settings: {
    siteName: string | null;
    logoUrl: string | null;
    defaultLocale: string | null;
    activeLocales: string[];
    facebookUrl: string | null;
    linkedinUrl: string | null;
    instagramUrl: string | null;
    youtubeUrl: string | null;
    tiktokUrl: string | null;
    pinterestUrl: string | null;
  } | null;
}

export interface OverrideDto {
  mode: "merge" | "replace";
  disabledTypes: string[];
  customNodes: JsonLdNode[];
}

export interface PreviewResult {
  page: { id: string; slug: string; locale: string; title: string };
  auto: JsonLdNode[];
  merged: JsonLdNode[];
  validation: JsonLdValidationResult;
  override: OverrideDto;
}

export interface RuntimeTestResult {
  url: string;
  status: number | null;
  fetched: boolean;
  scriptCount: number;
  parsedNodes: JsonLdNode[];
  parseErrors: string[];
  error: string | null;
}

@Injectable()
export class PageSchemaService {
  private static readonly RUNTIME_TEST_TIMEOUT_MS = 10_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly seoService: SeoService,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────

  async getOverride(
    siteId: string,
    locator: PageLocator,
  ): Promise<OverrideDto> {
    const page = await this.loadPage(siteId, locator);
    const normalized = normalizeOverride(page.jsonLdOverride);
    return this.toDto(normalized);
  }

  async upsertOverride(
    siteId: string,
    locator: PageLocator,
    input: Partial<OverrideDto>,
  ): Promise<OverrideDto> {
    const page = await this.loadPage(siteId, locator);
    const normalized = this.normalizeAndGuardInput(input);
    const value = isEmptyOverride(normalized)
      ? null
      : (normalized as unknown as Prisma.InputJsonValue);

    await this.prisma.page.update({
      where: { id: page.id },
      data: {
        jsonLdOverride: value === null ? Prisma.JsonNull : value,
      },
    });

    return this.toDto(normalized);
  }

  async clearOverride(
    siteId: string,
    locator: PageLocator,
  ): Promise<OverrideDto> {
    const page = await this.loadPage(siteId, locator);
    await this.prisma.page.update({
      where: { id: page.id },
      data: { jsonLdOverride: Prisma.JsonNull },
    });
    return this.toDto(EMPTY_OVERRIDE);
  }

  validateNodes(nodes: unknown): JsonLdValidationResult {
    return validateJsonLdNodes(nodes);
  }

  async buildPreview(
    siteId: string,
    locator: PageLocator,
    overrideOverride?: Partial<OverrideDto>,
  ): Promise<PreviewResult> {
    const [page, site] = await Promise.all([
      this.loadPage(siteId, locator),
      this.loadSite(siteId),
    ]);

    const auto = await this.buildAutoGraph(site, page);

    const override = overrideOverride
      ? this.normalizeAndGuardInput(overrideOverride)
      : normalizeOverride(page.jsonLdOverride);

    const merged = applyJsonLdOverride(auto, override);
    const validation = validateJsonLdNodes(merged);

    return {
      page: {
        id: page.id,
        slug: page.slug,
        locale: page.locale,
        title: page.title,
      },
      auto,
      merged,
      validation,
      override: this.toDto(override),
    };
  }

  async testRuntime(
    siteId: string,
    locator: PageLocator,
  ): Promise<RuntimeTestResult> {
    const site = await this.loadSite(siteId);
    const host = site.canonicalHost;
    if (!host) {
      return {
        url: "",
        status: null,
        fetched: false,
        scriptCount: 0,
        parsedNodes: [],
        parseErrors: [],
        error:
          "Site has no canonical host configured; cannot fetch a live page.",
      };
    }

    const defaultLocale =
      site.settings?.defaultLocale || site.primaryLocale || "en";
    const path = this.buildLocalizedPath(
      locator.slug,
      locator.locale,
      defaultLocale,
    );
    const url = `https://${host}${path}`;

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      PageSchemaService.RUNTIME_TEST_TIMEOUT_MS,
    );

    let status: number | null = null;
    let html = "";
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "user-agent": "StayLayer-RuntimeTest/1.0" },
      });
      status = response.status;
      html = await response.text();
    } catch (err) {
      clearTimeout(timer);
      return {
        url,
        status,
        fetched: false,
        scriptCount: 0,
        parsedNodes: [],
        parseErrors: [],
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }

    if (status < 200 || status >= 300) {
      return {
        url,
        status,
        fetched: true,
        scriptCount: 0,
        parsedNodes: [],
        parseErrors: [],
        error: `Live page returned HTTP ${status}.`,
      };
    }

    const { nodes, parseErrors } = this.extractJsonLd(html);
    return {
      url,
      status,
      fetched: true,
      scriptCount: nodes.length + parseErrors.length,
      parsedNodes: nodes,
      parseErrors,
      error: null,
    };
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private async loadPage(
    siteId: string,
    locator: PageLocator,
  ): Promise<PageRecord> {
    if (!SUPPORTED_LOCALES.includes(locator.locale as never)) {
      throw new BadRequestException({
        code: "INVALID_LOCALE",
        message: `Locale "${locator.locale}" is not supported.`,
      });
    }
    const page = await this.prisma.page.findFirst({
      where: {
        siteId,
        slug: locator.slug,
        locale: locator.locale,
        deletedAt: null,
      },
      select: {
        id: true,
        slug: true,
        locale: true,
        title: true,
        puckData: true,
        jsonLdOverride: true,
      },
    });
    if (!page) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: `No page found for slug "${locator.slug}" locale "${locator.locale}".`,
      });
    }
    return page;
  }

  private async loadSite(siteId: string): Promise<SiteRecord> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        name: true,
        primaryLocale: true,
        enabledLocales: true,
        publicSubdomain: true,
        settings: {
          select: {
            siteName: true,
            logoUrl: true,
            defaultLocale: true,
            activeLocales: true,
            facebookUrl: true,
            linkedinUrl: true,
            instagramUrl: true,
            youtubeUrl: true,
            tiktokUrl: true,
            pinterestUrl: true,
          },
        },
      },
    });
    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found.",
      });
    }

    const primaryDomain = await this.prisma.domain.findFirst({
      where: { siteId, isPrimary: true, status: "ACTIVE" },
      select: { host: true },
    });
    const canonicalHost =
      primaryDomain?.host ??
      (site.publicSubdomain ? `${site.publicSubdomain}.staylayer.app` : null);

    return {
      id: site.id,
      name: site.name,
      primaryLocale: site.primaryLocale,
      enabledLocales: site.enabledLocales,
      canonicalHost,
      settings: site.settings,
    };
  }

  private normalizeAndGuardInput(input: Partial<OverrideDto>): JsonLdOverride {
    const normalized = normalizeOverride(input);

    if (normalized.customNodes.length > MAX_CUSTOM_NODES) {
      throw new BadRequestException({
        code: "TOO_MANY_NODES",
        message: `customNodes exceeds the ${MAX_CUSTOM_NODES}-node limit.`,
      });
    }

    const serialized = JSON.stringify(normalized);
    if (serialized.length > MAX_OVERRIDE_BYTES) {
      throw new BadRequestException({
        code: "OVERRIDE_TOO_LARGE",
        message: `Override exceeds the ${MAX_OVERRIDE_BYTES}-byte payload limit.`,
      });
    }

    return normalized;
  }

  private toDto(override: JsonLdOverride): OverrideDto {
    return {
      mode: override.mode,
      disabledTypes: [...override.disabledTypes],
      customNodes: override.customNodes.map((n) => ({ ...n })),
    };
  }

  private async buildAutoGraph(
    site: SiteRecord,
    page: PageRecord,
  ): Promise<JsonLdNode[]> {
    const host = site.canonicalHost;
    const siteName = site.settings?.siteName || site.name;
    const defaultLocale =
      site.settings?.defaultLocale || site.primaryLocale || "en";
    const path = this.buildLocalizedPath(page.slug, page.locale, defaultLocale);
    const origin = host ? `https://${host}` : "";

    const entries: JsonLdNode[] = [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteName,
        url: `${origin}/`,
      },
    ];

    const sameAs = [
      site.settings?.facebookUrl,
      site.settings?.linkedinUrl,
      site.settings?.instagramUrl,
      site.settings?.youtubeUrl,
      site.settings?.tiktokUrl,
      site.settings?.pinterestUrl,
    ].filter((v): v is string => Boolean(v));

    const org: JsonLdNode = {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: siteName,
      url: `${origin}/`,
    };
    if (site.settings?.logoUrl) org.logo = site.settings.logoUrl;
    if (sameAs.length > 0) org.sameAs = sameAs;
    entries.push(org);

    if (host) {
      const business = await this.seoService.generateJsonLd(site.id);
      if (business) {
        if (sameAs.length > 0 && !business.sameAs) {
          business.sameAs = sameAs;
        }
        entries.push(business as JsonLdNode);
      }
    }

    const enabledSchemas = await this.seoService.getEnabledSchemas(site.id);
    if (host && path !== "/" && enabledSchemas.includes("BreadcrumbList")) {
      entries.push(this.buildBreadcrumb(host, path, page.title));
    }

    if (host) {
      const pageSchemas = await this.seoService.generatePageTypeJsonLd(
        site.id,
        {
          hostname: host,
          pathname: path,
          puckData: (page.puckData ?? {}) as Record<string, unknown>,
        },
      );
      entries.push(...(pageSchemas as JsonLdNode[]));
    }

    return entries;
  }

  private buildLocalizedPath(
    slug: string,
    locale: string,
    defaultLocale: string,
  ): string {
    const base = slug ? `/${slug}` : "/";
    if (!locale || locale === defaultLocale) return base;
    return base === "/" ? `/${locale}` : `/${locale}${base}`;
  }

  private buildBreadcrumb(
    host: string,
    path: string,
    pageTitle: string,
  ): JsonLdNode {
    const segments = path.split("/").filter(Boolean);
    const items: Array<Record<string, unknown>> = [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `https://${host}/`,
      },
    ];
    let cumulative = "";
    segments.forEach((seg, idx) => {
      cumulative += `/${seg}`;
      const isLast = idx === segments.length - 1;
      items.push({
        "@type": "ListItem",
        position: idx + 2,
        name: isLast ? pageTitle : this.humanize(seg),
        item: `https://${host}${cumulative}`,
      });
    });
    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items,
    };
  }

  private humanize(slug: string): string {
    return slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  private extractJsonLd(html: string): {
    nodes: JsonLdNode[];
    parseErrors: string[];
  } {
    const nodes: JsonLdNode[] = [];
    const parseErrors: string[] = [];
    const regex =
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(html)) !== null) {
      const raw = match[1].trim();
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            if (entry && typeof entry === "object") {
              nodes.push(entry as JsonLdNode);
            }
          }
        } else if (parsed && typeof parsed === "object") {
          if (
            "@graph" in parsed &&
            Array.isArray((parsed as { "@graph": unknown })["@graph"])
          ) {
            for (const entry of (parsed as { "@graph": unknown[] })["@graph"]) {
              if (entry && typeof entry === "object") {
                nodes.push(entry as JsonLdNode);
              }
            }
          } else {
            nodes.push(parsed as JsonLdNode);
          }
        }
      } catch (err) {
        parseErrors.push(
          err instanceof Error ? err.message : "Invalid JSON in ld+json block",
        );
      }
    }
    return { nodes, parseErrors };
  }
}
