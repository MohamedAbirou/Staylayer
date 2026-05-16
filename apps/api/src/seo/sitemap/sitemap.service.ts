import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { extractImagesFromPuck } from "./extract-images";
import { RobotsService } from "../robots/robots.service";

export interface SitemapPreviewRoute {
  path: string;
  url: string;
  locales: string[];
  lastModified: string;
  images: string[];
  excluded: boolean;
  excludedReason: string | null;
}

export interface SitemapPreviewResult {
  siteId: string;
  canonicalHost: string;
  indexingEnabled: boolean;
  sitemapEnabled: boolean;
  includeImages: boolean;
  excludedPaths: string[];
  totalPages: number;
  includedRoutes: number;
  excludedRoutes: number;
  totalImages: number;
  routes: SitemapPreviewRoute[];
}

@Injectable()
export class SitemapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly robotsService: RobotsService,
  ) {}

  async preview(siteId: string): Promise<SitemapPreviewResult> {
    const settings = await this.prisma.siteSettings.findUnique({
      where: { siteId },
      select: {
        seoIndexingEnabled: true,
        sitemapExcludedPaths: true,
        sitemapIncludeImages: true,
      },
    });
    if (!settings) {
      throw new NotFoundException({
        code: "SITE_SETTINGS_NOT_FOUND",
        message: "Site settings have not been initialized",
      });
    }

    const canonicalHost = await this.robotsService.resolveCanonicalHost(siteId);

    const pages = await this.prisma.page.findMany({
      where: { siteId, published: true, deletedAt: null },
      select: {
        slug: true,
        locale: true,
        updatedAt: true,
        puckData: true,
      },
      orderBy: [{ slug: "asc" }, { locale: "asc" }],
    });

    const routeMap = new Map<
      string,
      {
        lastModified: Date;
        locales: Set<string>;
        images: Set<string>;
      }
    >();
    for (const page of pages) {
      const path = this.slugToPath(page.slug);
      let entry = routeMap.get(path);
      if (!entry) {
        entry = {
          lastModified: page.updatedAt,
          locales: new Set([page.locale]),
          images: new Set<string>(),
        };
        routeMap.set(path, entry);
      } else {
        if (page.updatedAt > entry.lastModified) {
          entry.lastModified = page.updatedAt;
        }
        entry.locales.add(page.locale);
      }
      if (settings.sitemapIncludeImages) {
        for (const img of extractImagesFromPuck(page.puckData)) {
          entry.images.add(img);
        }
      }
    }

    const exclusions = settings.sitemapExcludedPaths
      .map((p) => p.trim())
      .filter(Boolean);

    let included = 0;
    let excluded = 0;
    let imageCount = 0;
    const routes: SitemapPreviewRoute[] = [];
    for (const [path, value] of routeMap) {
      const match = this.matchExclusion(path, exclusions);
      const isExcluded = match !== null;
      if (isExcluded) excluded += 1;
      else included += 1;
      imageCount += value.images.size;
      routes.push({
        path,
        url: canonicalHost
          ? `https://${canonicalHost}${path === "/" ? "" : path}`
          : path,
        locales: Array.from(value.locales).sort(),
        lastModified: value.lastModified.toISOString(),
        images: Array.from(value.images),
        excluded: isExcluded,
        excludedReason: match,
      });
    }

    return {
      siteId,
      canonicalHost,
      indexingEnabled: settings.seoIndexingEnabled,
      sitemapEnabled: settings.seoIndexingEnabled,
      includeImages: settings.sitemapIncludeImages,
      excludedPaths: exclusions,
      totalPages: pages.length,
      includedRoutes: included,
      excludedRoutes: excluded,
      totalImages: imageCount,
      routes,
    };
  }

  /**
   * Match a route path against the operator-configured exclusion list. Each
   * pattern may be:
   *   - an exact path:           "/legal/private"
   *   - a wildcard suffix:       "/drafts/*"
   *   - a wildcard prefix:       "*\/preview"   (rare)
   *   - a globbed pattern:       "/a/*\/b"
   */
  matchExclusion(path: string, patterns: string[]): string | null {
    for (const pattern of patterns) {
      if (!pattern) continue;
      if (pattern === path) return pattern;
      if (pattern.includes("*")) {
        const regex = new RegExp(
          "^" +
            pattern
              .split("*")
              .map((segment) => segment.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
              .join(".*") +
            "$",
        );
        if (regex.test(path)) return pattern;
      }
    }
    return null;
  }

  private slugToPath(slug: string): string {
    if (!slug || slug === "/") return "/";
    return slug.startsWith("/") ? slug : `/${slug}`;
  }
}
