import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";

/**
 * Read-only analysis service over the SEO crawl link graph. All numbers are
 * computed on demand from the persisted `SeoCrawlPageLink` edges produced
 * by the crawler runner; nothing is mutated here.
 */
@Injectable()
export class LinkGraphService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * High-level link graph summary for a completed (or partial) crawl job.
   * Caps each "top N" list so a 5000-URL crawl can't return a 5 MB JSON.
   */
  async getJobLinkGraph(
    siteId: string,
    jobId: string,
    options: { topN?: number } = {},
  ): Promise<JobLinkGraph> {
    const topN = clampInt(options.topN ?? 25, 1, 100);

    const job = await this.prisma.seoCrawlJob.findFirst({
      where: { id: jobId, siteId },
      select: { id: true, status: true, totalUrls: true, urlLimit: true },
    });
    if (!job) {
      throw new NotFoundException({
        code: "SEO_CRAWL_NOT_FOUND",
        message: "Crawl job not found",
      });
    }

    const [
      totals,
      indexableCount,
      topInbound,
      topOutbound,
      deepest,
      orphans,
      brokenInternal,
    ] = await Promise.all([
      this.collectTotals(jobId),
      this.prisma.seoCrawlUrlResult.count({
        where: {
          crawlJobId: jobId,
          indexable: true,
          statusCode: { gte: 200, lt: 400 },
        },
      }),
      this.collectTopInbound(jobId, topN),
      this.collectTopOutbound(jobId, topN),
      this.collectDeepestPages(jobId, topN),
      this.collectOrphanPages(jobId, topN),
      this.collectBrokenInternalLinks(jobId, topN),
    ]);

    return {
      jobId,
      jobStatus: job.status,
      totals: {
        ...totals,
        indexablePages: indexableCount,
      },
      topInbound,
      topOutbound,
      deepestPages: deepest,
      orphanPages: orphans,
      brokenInternalLinks: brokenInternal,
    };
  }

  /**
   * Inbound + outbound links for a single URL result inside a crawl job.
   * Useful for the dashboard's drill-down view from the URLs table.
   */
  async getPageLinks(
    siteId: string,
    jobId: string,
    resultId: string,
    options: { limit?: number } = {},
  ): Promise<PageLinks> {
    const limit = clampInt(options.limit ?? 100, 1, 500);

    const result = await this.prisma.seoCrawlUrlResult.findFirst({
      where: { id: resultId, crawlJobId: jobId, job: { siteId } },
      select: {
        id: true,
        url: true,
        pathname: true,
        statusCode: true,
        depth: true,
      },
    });
    if (!result) {
      throw new NotFoundException({
        code: "SEO_CRAWL_RESULT_NOT_FOUND",
        message: "Crawl result not found",
      });
    }

    const [inbound, outbound, inboundCount, outboundCount] = await Promise.all([
      this.prisma.seoCrawlPageLink.findMany({
        where: { crawlJobId: jobId, targetResultId: resultId },
        select: {
          id: true,
          anchorText: true,
          rel: true,
          nofollow: true,
          source: {
            select: {
              id: true,
              url: true,
              pathname: true,
              statusCode: true,
              depth: true,
            },
          },
        },
        take: limit,
        orderBy: { id: "asc" },
      }),
      this.prisma.seoCrawlPageLink.findMany({
        where: { crawlJobId: jobId, sourceResultId: resultId },
        select: {
          id: true,
          targetUrl: true,
          targetPathname: true,
          anchorText: true,
          rel: true,
          nofollow: true,
          isInternal: true,
          target: {
            select: {
              id: true,
              statusCode: true,
              depth: true,
              indexable: true,
            },
          },
        },
        take: limit,
        orderBy: { id: "asc" },
      }),
      this.prisma.seoCrawlPageLink.count({
        where: { crawlJobId: jobId, targetResultId: resultId },
      }),
      this.prisma.seoCrawlPageLink.count({
        where: { crawlJobId: jobId, sourceResultId: resultId },
      }),
    ]);

    return {
      result,
      inbound: inbound.map((row) => ({
        id: row.id,
        anchorText: row.anchorText,
        rel: row.rel,
        nofollow: row.nofollow,
        sourceResultId: row.source.id,
        sourceUrl: row.source.url,
        sourcePathname: row.source.pathname,
        sourceStatusCode: row.source.statusCode,
        sourceDepth: row.source.depth,
      })),
      outbound: outbound.map((row) => ({
        id: row.id,
        targetUrl: row.targetUrl,
        targetPathname: row.targetPathname,
        anchorText: row.anchorText,
        rel: row.rel,
        nofollow: row.nofollow,
        isInternal: row.isInternal,
        targetResultId: row.target?.id ?? null,
        targetStatusCode: row.target?.statusCode ?? null,
        targetDepth: row.target?.depth ?? null,
        targetIndexable: row.target?.indexable ?? null,
      })),
      inboundCount,
      outboundCount,
      truncated: {
        inbound: inboundCount > inbound.length,
        outbound: outboundCount > outbound.length,
      },
    };
  }

  // ── internals ─────────────────────────────────────────────────────────

  private async collectTotals(jobId: string): Promise<{
    totalUrls: number;
    totalLinks: number;
    internalLinks: number;
    externalLinks: number;
    uniqueExternalDomains: number;
  }> {
    const [counts, externals] = await Promise.all([
      this.prisma.seoCrawlPageLink.groupBy({
        by: ["isInternal"],
        where: { crawlJobId: jobId },
        _count: { _all: true },
      }),
      this.prisma.seoCrawlPageLink.findMany({
        where: { crawlJobId: jobId, isInternal: false },
        select: { targetUrl: true },
        take: 50000,
      }),
    ]);

    const totalUrls = await this.prisma.seoCrawlUrlResult.count({
      where: { crawlJobId: jobId },
    });
    let internal = 0;
    let external = 0;
    for (const c of counts) {
      if (c.isInternal) internal = c._count._all;
      else external = c._count._all;
    }
    const uniqueExternalDomains = countUniqueHosts(
      externals.map((e) => e.targetUrl),
    );

    return {
      totalUrls,
      totalLinks: internal + external,
      internalLinks: internal,
      externalLinks: external,
      uniqueExternalDomains,
    };
  }

  private async collectTopInbound(
    jobId: string,
    topN: number,
  ): Promise<LinkGraphPageRanking[]> {
    const grouped = await this.prisma.seoCrawlPageLink.groupBy({
      by: ["targetResultId"],
      where: {
        crawlJobId: jobId,
        targetResultId: { not: null },
        isInternal: true,
      },
      _count: { _all: true },
      orderBy: { _count: { targetResultId: "desc" } },
      take: topN,
    });

    if (grouped.length === 0) return [];
    const ids = grouped
      .map((g) => g.targetResultId)
      .filter((v): v is string => v !== null);
    const rows = await this.prisma.seoCrawlUrlResult.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        url: true,
        pathname: true,
        statusCode: true,
        depth: true,
        indexable: true,
      },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));

    return grouped
      .map((g) => {
        const row = g.targetResultId ? byId.get(g.targetResultId) : null;
        if (!row) return null;
        return {
          resultId: row.id,
          url: row.url,
          pathname: row.pathname,
          statusCode: row.statusCode,
          depth: row.depth,
          indexable: row.indexable,
          count: g._count._all,
        };
      })
      .filter((v): v is LinkGraphPageRanking => v !== null);
  }

  private async collectTopOutbound(
    jobId: string,
    topN: number,
  ): Promise<LinkGraphPageRanking[]> {
    const grouped = await this.prisma.seoCrawlPageLink.groupBy({
      by: ["sourceResultId"],
      where: { crawlJobId: jobId, isInternal: true },
      _count: { _all: true },
      orderBy: { _count: { sourceResultId: "desc" } },
      take: topN,
    });
    if (grouped.length === 0) return [];
    const ids = grouped.map((g) => g.sourceResultId);
    const rows = await this.prisma.seoCrawlUrlResult.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        url: true,
        pathname: true,
        statusCode: true,
        depth: true,
        indexable: true,
      },
    });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return grouped
      .map((g) => {
        const row = byId.get(g.sourceResultId);
        if (!row) return null;
        return {
          resultId: row.id,
          url: row.url,
          pathname: row.pathname,
          statusCode: row.statusCode,
          depth: row.depth,
          indexable: row.indexable,
          count: g._count._all,
        };
      })
      .filter((v): v is LinkGraphPageRanking => v !== null);
  }

  private async collectDeepestPages(
    jobId: string,
    topN: number,
  ): Promise<LinkGraphDepthRow[]> {
    const rows = await this.prisma.seoCrawlUrlResult.findMany({
      where: { crawlJobId: jobId },
      select: {
        id: true,
        url: true,
        pathname: true,
        statusCode: true,
        depth: true,
        indexable: true,
      },
      orderBy: [{ depth: "desc" }, { url: "asc" }],
      take: topN,
    });
    return rows.map((r) => ({
      resultId: r.id,
      url: r.url,
      pathname: r.pathname,
      statusCode: r.statusCode,
      depth: r.depth,
      indexable: r.indexable,
    }));
  }

  /**
   * Pages we crawled (so they're known to exist) that have zero inbound
   * internal links from other crawled pages. Excludes the seed URL (depth 0)
   * because it's always an "entry point" by construction.
   */
  private async collectOrphanPages(
    jobId: string,
    topN: number,
  ): Promise<LinkGraphOrphanRow[]> {
    const candidates = await this.prisma.seoCrawlUrlResult.findMany({
      where: {
        crawlJobId: jobId,
        depth: { gt: 0 },
        statusCode: { gte: 200, lt: 400 },
      },
      select: {
        id: true,
        url: true,
        pathname: true,
        statusCode: true,
        depth: true,
        indexable: true,
        _count: { select: { inboundLinks: true } },
      },
      orderBy: { depth: "desc" },
    });
    return candidates
      .filter((c) => c._count.inboundLinks === 0)
      .slice(0, topN)
      .map((r) => ({
        resultId: r.id,
        url: r.url,
        pathname: r.pathname,
        statusCode: r.statusCode,
        depth: r.depth,
        indexable: r.indexable,
      }));
  }

  /**
   * Internal links that point to a target URL we crawled and got a 4xx/5xx
   * response from. These are the strongest SEO "fix me" signals.
   */
  private async collectBrokenInternalLinks(
    jobId: string,
    topN: number,
  ): Promise<LinkGraphBrokenLinkRow[]> {
    const rows = await this.prisma.seoCrawlPageLink.findMany({
      where: {
        crawlJobId: jobId,
        isInternal: true,
        targetResultId: { not: null },
        target: { statusCode: { gte: 400 } },
      },
      select: {
        id: true,
        anchorText: true,
        targetUrl: true,
        source: { select: { id: true, url: true, pathname: true } },
        target: { select: { id: true, statusCode: true } },
      },
      take: topN,
      orderBy: { id: "asc" },
    });
    return rows.map((r) => ({
      linkId: r.id,
      sourceResultId: r.source.id,
      sourceUrl: r.source.url,
      sourcePathname: r.source.pathname,
      targetResultId: r.target?.id ?? null,
      targetUrl: r.targetUrl,
      targetStatusCode: r.target?.statusCode ?? null,
      anchorText: r.anchorText,
    }));
  }
}

// ── return shapes ────────────────────────────────────────────────────────

export interface JobLinkGraph {
  jobId: string;
  jobStatus: string;
  totals: {
    totalUrls: number;
    indexablePages: number;
    totalLinks: number;
    internalLinks: number;
    externalLinks: number;
    uniqueExternalDomains: number;
  };
  topInbound: LinkGraphPageRanking[];
  topOutbound: LinkGraphPageRanking[];
  deepestPages: LinkGraphDepthRow[];
  orphanPages: LinkGraphOrphanRow[];
  brokenInternalLinks: LinkGraphBrokenLinkRow[];
}

export interface LinkGraphPageRanking {
  resultId: string;
  url: string;
  pathname: string;
  statusCode: number;
  depth: number;
  indexable: boolean;
  count: number;
}

export interface LinkGraphDepthRow {
  resultId: string;
  url: string;
  pathname: string;
  statusCode: number;
  depth: number;
  indexable: boolean;
}

export interface LinkGraphOrphanRow extends LinkGraphDepthRow {}

export interface LinkGraphBrokenLinkRow {
  linkId: string;
  sourceResultId: string;
  sourceUrl: string;
  sourcePathname: string;
  targetResultId: string | null;
  targetUrl: string;
  targetStatusCode: number | null;
  anchorText: string | null;
}

export interface PageLinks {
  result: {
    id: string;
    url: string;
    pathname: string;
    statusCode: number;
    depth: number;
  };
  inbound: PageInboundLink[];
  outbound: PageOutboundLink[];
  inboundCount: number;
  outboundCount: number;
  truncated: { inbound: boolean; outbound: boolean };
}

export interface PageInboundLink {
  id: string;
  anchorText: string | null;
  rel: string | null;
  nofollow: boolean;
  sourceResultId: string;
  sourceUrl: string;
  sourcePathname: string;
  sourceStatusCode: number;
  sourceDepth: number;
}

export interface PageOutboundLink {
  id: string;
  targetUrl: string;
  targetPathname: string | null;
  anchorText: string | null;
  rel: string | null;
  nofollow: boolean;
  isInternal: boolean;
  targetResultId: string | null;
  targetStatusCode: number | null;
  targetDepth: number | null;
  targetIndexable: boolean | null;
}

// ── helpers ──────────────────────────────────────────────────────────────

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function countUniqueHosts(urls: string[]): number {
  const seen = new Set<string>();
  for (const u of urls) {
    try {
      seen.add(new URL(u).hostname.toLowerCase());
    } catch {
      // skip invalid URLs
    }
  }
  return seen.size;
}
