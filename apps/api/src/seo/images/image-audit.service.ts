import { Injectable, NotFoundException } from "@nestjs/common";
import { ImageAltQuality, Prisma } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { SitemapService } from "../sitemap/sitemap.service";
import type { CrawlImageRecord } from "../crawler/crawler-engine";

import { analyzeImage, type ImageFlag, type ImageInput } from "./image-rules";

/** Hard cap on persisted findings per page (already enforced in the
 * crawler engine but defensive here too). */
export const MAX_FINDINGS_PER_PAGE = 100;

export interface ImageAuditPageInput {
  /** Page URL (used for log/diagnostics only). */
  pageUrl: string;
  images: CrawlImageRecord[];
  ogImage: string | null;
}

export interface ImageAuditPageResult {
  /** Findings to persist as `SeoCrawlImageFinding` rows. */
  findings: ImageFindingDraft[];
  /** Page-level rollups merged into the URL result row. */
  rollups: {
    total: number;
    missing: number;
    issues: number;
  };
  /** Delta rollups merged into the SeoCrawlJob row. */
  jobDeltas: {
    imageTotal: number;
    imageMissingAlt: number;
    imageFilenameAlt: number;
    imageOversizedOg: number;
    imageUndersizedOg: number;
    imageMissingDims: number;
    imageNotLazy: number;
    imageMissingSitemap: number;
  };
}

export interface ImageFindingDraft {
  src: string;
  filename: string | null;
  alt: string | null;
  hasAlt: boolean;
  altQuality: ImageAltQuality;
  widthAttr: number | null;
  heightAttr: number | null;
  loadingAttr: string | null;
  isOgImage: boolean;
  inSitemap: boolean;
  aboveFold: boolean;
  flags: ImageFlag[];
}

@Injectable()
export class ImageAuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sitemapService: SitemapService,
  ) {}

  /**
   * Builds the set of image URLs declared in the tenant's sitemap so the
   * per-page audit can flag images that escape the sitemap. URLs are
   * normalized (lowercase host, no query/hash) for collision-free lookup.
   *
   * Returns an empty Set if the sitemap cannot be generated (uninit settings,
   * no canonical host yet) — those are not failures for an audit.
   */
  async loadSitemapImageSet(siteId: string): Promise<Set<string>> {
    try {
      const preview = await this.sitemapService.preview(siteId);
      const set = new Set<string>();
      for (const route of preview.routes) {
        for (const image of route.images) {
          const normalized = normalizeImageUrl(image);
          if (normalized) set.add(normalized);
        }
      }
      return set;
    } catch {
      return new Set();
    }
  }

  /**
   * Pure analysis: takes a page's images + sitemap snapshot and produces
   * persistable findings + rollups. No DB writes here so the crawler can
   * batch persistence efficiently.
   */
  analyzePage(
    input: ImageAuditPageInput,
    sitemapImages: Set<string>,
  ): ImageAuditPageResult {
    const findings: ImageFindingDraft[] = [];
    const jobDeltas = emptyJobDeltas();
    let missing = 0;
    let issues = 0;

    const ogImageAbs = input.ogImage
      ? (normalizeImageUrl(input.ogImage) ?? input.ogImage)
      : null;

    // Synthetic finding when the page declares no og:image at all — Open
    // Graph previews fall back to the platform's autodiscovery and almost
    // always look bad without an explicit asset.
    if (!input.ogImage) {
      findings.push({
        src: "",
        filename: null,
        alt: null,
        hasAlt: false,
        altQuality: ImageAltQuality.MISSING,
        widthAttr: null,
        heightAttr: null,
        loadingAttr: null,
        isOgImage: true,
        inSitemap: false,
        aboveFold: false,
        flags: ["og_missing"],
      });
      issues += 1;
      jobDeltas.imageOversizedOg += 0;
    }

    const slice = input.images.slice(0, MAX_FINDINGS_PER_PAGE);
    for (let i = 0; i < slice.length; i += 1) {
      const img = slice[i];
      const normalized = normalizeImageUrl(img.src);
      const isOgImage =
        ogImageAbs !== null && normalized !== null && normalized === ogImageAbs;
      const inSitemap = normalized !== null && sitemapImages.has(normalized);

      const rules: ImageInput = {
        src: img.src,
        alt: img.alt,
        width: img.width,
        height: img.height,
        loading: img.loading,
        hasSrcset: img.hasSrcset,
        domIndex: i,
        isOgImage,
        inSitemap,
      };
      const analysis = analyzeImage(rules);

      findings.push({
        src: img.src,
        filename: analysis.filename,
        alt: img.alt,
        hasAlt: analysis.hasAlt,
        altQuality: analysis.altQuality,
        widthAttr: img.width,
        heightAttr: img.height,
        loadingAttr: img.loading,
        isOgImage,
        inSitemap,
        aboveFold: analysis.aboveFold,
        flags: analysis.flags,
      });

      if (!analysis.hasAlt) missing += 1;
      if (analysis.flags.length > 0) issues += 1;

      jobDeltas.imageTotal += 1;
      if (analysis.altQuality === ImageAltQuality.MISSING)
        jobDeltas.imageMissingAlt += 1;
      if (analysis.altQuality === ImageAltQuality.FILENAME_LIKE)
        jobDeltas.imageFilenameAlt += 1;
      if (analysis.flags.includes("og_too_small"))
        jobDeltas.imageUndersizedOg += 1;
      if (
        analysis.flags.includes("missing_dimensions") ||
        analysis.flags.includes("missing_width") ||
        analysis.flags.includes("missing_height")
      ) {
        jobDeltas.imageMissingDims += 1;
      }
      if (
        analysis.flags.includes("above_fold_lazy") ||
        analysis.flags.includes("below_fold_eager")
      ) {
        jobDeltas.imageNotLazy += 1;
      }
      if (analysis.flags.includes("not_in_sitemap"))
        jobDeltas.imageMissingSitemap += 1;
    }

    return {
      findings,
      rollups: {
        total: findings.length,
        missing,
        issues,
      },
      jobDeltas,
    };
  }

  /** Reads job-level image rollups. Used by the dashboard summary card. */
  async getJobSummary(siteId: string, jobId: string) {
    const job = await this.prisma.seoCrawlJob.findFirst({
      where: { id: jobId, siteId },
      select: {
        id: true,
        status: true,
        imageTotal: true,
        imageMissingAlt: true,
        imageFilenameAlt: true,
        imageOversizedOg: true,
        imageUndersizedOg: true,
        imageMissingDims: true,
        imageNotLazy: true,
        imageMissingSitemap: true,
      },
    });
    if (!job) {
      throw new NotFoundException({
        code: "SEO_CRAWL_JOB_NOT_FOUND",
        message: "Crawl job not found",
      });
    }
    return {
      jobId: job.id,
      status: job.status,
      imageTotal: job.imageTotal,
      imageMissingAlt: job.imageMissingAlt,
      imageFilenameAlt: job.imageFilenameAlt,
      imageOversizedOg: job.imageOversizedOg,
      imageUndersizedOg: job.imageUndersizedOg,
      imageMissingDims: job.imageMissingDims,
      imageNotLazy: job.imageNotLazy,
      imageMissingSitemap: job.imageMissingSitemap,
    };
  }

  /**
   * Lists pages with image issues for the dashboard Images tab. Ordered
   * by the page's image-issue count so the worst offenders surface first.
   */
  async listPagesWithImageIssues(
    siteId: string,
    jobId: string,
    params: { cursor?: string; limit?: number } = {},
  ) {
    await this.assertJobAccess(siteId, jobId);
    const take = clampInt(params.limit ?? 50, 1, 200);

    const rows = await this.prisma.seoCrawlUrlResult.findMany({
      where: {
        crawlJobId: jobId,
        imageFindingsTotal: { gt: 0 },
      },
      orderBy: [
        { imageFindingsIssues: "desc" },
        { imageFindingsMissing: "desc" },
        { url: "asc" },
      ],
      cursor: params.cursor ? { id: params.cursor } : undefined,
      skip: params.cursor ? 1 : 0,
      take: take + 1,
      select: {
        id: true,
        url: true,
        pathname: true,
        statusCode: true,
        ogImage: true,
        imageFindingsTotal: true,
        imageFindingsMissing: true,
        imageFindingsIssues: true,
      },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    return {
      items: items.map((r) => ({
        resultId: r.id,
        url: r.url,
        pathname: r.pathname,
        statusCode: r.statusCode,
        ogImage: r.ogImage,
        imageFindingsTotal: r.imageFindingsTotal,
        imageFindingsMissing: r.imageFindingsMissing,
        imageFindingsIssues: r.imageFindingsIssues,
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /** Lists every image finding for a single page (drill-down). */
  async listPageImageFindings(
    siteId: string,
    jobId: string,
    resultId: string,
    params: { limit?: number } = {},
  ) {
    await this.assertJobAccess(siteId, jobId);
    const take = clampInt(params.limit ?? 100, 1, MAX_FINDINGS_PER_PAGE);

    const result = await this.prisma.seoCrawlUrlResult.findFirst({
      where: { id: resultId, crawlJobId: jobId },
      select: { id: true, url: true, pathname: true, ogImage: true },
    });
    if (!result) {
      throw new NotFoundException({
        code: "SEO_CRAWL_RESULT_NOT_FOUND",
        message: "Crawl result not found",
      });
    }

    const findings = await this.prisma.seoCrawlImageFinding.findMany({
      where: { urlResultId: resultId },
      orderBy: { createdAt: "asc" },
      take,
    });

    return {
      resultId: result.id,
      url: result.url,
      pathname: result.pathname,
      ogImage: result.ogImage,
      findings: findings.map((f) => ({
        id: f.id,
        src: f.src,
        filename: f.filename,
        alt: f.alt,
        hasAlt: f.hasAlt,
        altQuality: f.altQuality,
        widthAttr: f.widthAttr,
        heightAttr: f.heightAttr,
        loadingAttr: f.loadingAttr,
        isOgImage: f.isOgImage,
        inSitemap: f.inSitemap,
        aboveFold: f.aboveFold,
        flags: Array.isArray(f.flags) ? (f.flags as string[]) : [],
      })),
    };
  }

  /** Persists a batch of findings + rollups in one transaction. */
  async persistPageFindings(
    crawlJobId: string,
    urlResultId: string,
    pageResult: ImageAuditPageResult,
    ogImage: string | null,
  ): Promise<void> {
    if (pageResult.findings.length === 0) {
      await this.prisma.seoCrawlUrlResult.update({
        where: { id: urlResultId },
        data: {
          ogImage,
          imageFindingsTotal: 0,
          imageFindingsMissing: 0,
          imageFindingsIssues: 0,
        },
      });
      return;
    }
    const data: Prisma.SeoCrawlImageFindingCreateManyInput[] =
      pageResult.findings.map((f) => ({
        crawlJobId,
        urlResultId,
        src: f.src.slice(0, 2000),
        filename: f.filename ? f.filename.slice(0, 255) : null,
        alt: f.alt ? f.alt.slice(0, 500) : null,
        hasAlt: f.hasAlt,
        altQuality: f.altQuality,
        widthAttr: f.widthAttr,
        heightAttr: f.heightAttr,
        loadingAttr: f.loadingAttr,
        isOgImage: f.isOgImage,
        inSitemap: f.inSitemap,
        aboveFold: f.aboveFold,
        flags: f.flags as unknown as Prisma.InputJsonValue,
      }));

    await this.prisma.$transaction([
      this.prisma.seoCrawlImageFinding.createMany({ data }),
      this.prisma.seoCrawlUrlResult.update({
        where: { id: urlResultId },
        data: {
          ogImage,
          imageFindingsTotal: pageResult.rollups.total,
          imageFindingsMissing: pageResult.rollups.missing,
          imageFindingsIssues: pageResult.rollups.issues,
        },
      }),
    ]);
  }

  async incrementJobRollups(
    jobId: string,
    deltas: ImageAuditPageResult["jobDeltas"],
  ): Promise<void> {
    if (
      deltas.imageTotal === 0 &&
      deltas.imageMissingAlt === 0 &&
      deltas.imageFilenameAlt === 0 &&
      deltas.imageOversizedOg === 0 &&
      deltas.imageUndersizedOg === 0 &&
      deltas.imageMissingDims === 0 &&
      deltas.imageNotLazy === 0 &&
      deltas.imageMissingSitemap === 0
    ) {
      return;
    }
    await this.prisma.seoCrawlJob.update({
      where: { id: jobId },
      data: {
        imageTotal: { increment: deltas.imageTotal },
        imageMissingAlt: { increment: deltas.imageMissingAlt },
        imageFilenameAlt: { increment: deltas.imageFilenameAlt },
        imageOversizedOg: { increment: deltas.imageOversizedOg },
        imageUndersizedOg: { increment: deltas.imageUndersizedOg },
        imageMissingDims: { increment: deltas.imageMissingDims },
        imageNotLazy: { increment: deltas.imageNotLazy },
        imageMissingSitemap: { increment: deltas.imageMissingSitemap },
      },
    });
  }

  private async assertJobAccess(siteId: string, jobId: string): Promise<void> {
    const job = await this.prisma.seoCrawlJob.findFirst({
      where: { id: jobId, siteId },
      select: { id: true },
    });
    if (!job) {
      throw new NotFoundException({
        code: "SEO_CRAWL_JOB_NOT_FOUND",
        message: "Crawl job not found",
      });
    }
  }
}

function emptyJobDeltas(): ImageAuditPageResult["jobDeltas"] {
  return {
    imageTotal: 0,
    imageMissingAlt: 0,
    imageFilenameAlt: 0,
    imageOversizedOg: 0,
    imageUndersizedOg: 0,
    imageMissingDims: 0,
    imageNotLazy: 0,
    imageMissingSitemap: 0,
  };
}

export function normalizeImageUrl(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    u.hash = "";
    u.search = "";
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    // Relative URL — normalize path and lowercase
    const stripped = trimmed.split("#")[0].split("?")[0];
    return stripped.toLowerCase();
  }
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
