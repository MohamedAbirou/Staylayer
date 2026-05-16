import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import {
  Prisma,
  SeoCrawlIssueSeverity,
  SeoCrawlJob,
  SeoCrawlJobStatus,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { BillingService } from "../../billing/billing.service";
import { RobotsService } from "../robots/robots.service";
import { ImageAuditService } from "../images/image-audit.service";

import { CrawlPageOutcome, runCrawlEngine } from "./crawler-engine";
import { IssueDraft, inspectUrl } from "./issue-rules";

const DEFAULT_MAX_DEPTH = 5;
const RESULT_CHUNK_SIZE = 200;
const ISSUE_CHUNK_SIZE = 500;
const LINK_CHUNK_SIZE = 1000;

interface ActiveJobState {
  jobId: string;
  cancelled: boolean;
}

interface PageBookkeeping {
  resultId: string;
  outboundInternalUrls: string[];
  statusCode: number;
}

@Injectable()
export class CrawlerService implements OnModuleInit {
  private readonly logger = new Logger(CrawlerService.name);
  private readonly activeJobs = new Map<string, ActiveJobState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly robotsService: RobotsService,
    private readonly billingService: BillingService,
    private readonly imageAuditService: ImageAuditService,
  ) {}

  /**
   * Recover jobs that were RUNNING when the API process was last killed —
   * we can't resume an in-process crawl, so we mark them failed so the UI
   * doesn't show stuck spinners.
   */
  async onModuleInit(): Promise<void> {
    try {
      const stranded = await this.prisma.seoCrawlJob.updateMany({
        where: {
          status: {
            in: [SeoCrawlJobStatus.PENDING, SeoCrawlJobStatus.RUNNING],
          },
        },
        data: {
          status: SeoCrawlJobStatus.FAILED,
          failureReason: "API restarted before the crawl completed.",
          completedAt: new Date(),
        },
      });
      if (stranded.count > 0) {
        this.logger.warn(
          `Marked ${stranded.count} SEO crawl job(s) as FAILED after restart.`,
        );
      }
    } catch (err) {
      this.logger.error(
        "Failed to reconcile stranded SEO crawl jobs on startup",
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  // ── public API ────────────────────────────────────────────────────────

  async startCrawl(
    siteId: string,
    options: { urlLimit: number; maxDepth?: number },
    actor: string | null,
  ): Promise<SeoCrawlJob> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, tenantId: true },
    });
    if (!site) {
      throw new NotFoundException({
        code: "SITE_NOT_FOUND",
        message: "Site not found",
      });
    }

    const effectiveLimit = await this.billingService.assertCanRunCrawl(
      siteId,
      options.urlLimit,
    );

    const existingActive = await this.prisma.seoCrawlJob.findFirst({
      where: {
        siteId,
        status: {
          in: [SeoCrawlJobStatus.PENDING, SeoCrawlJobStatus.RUNNING],
        },
      },
      select: { id: true },
    });
    if (existingActive) {
      throw new ConflictException({
        code: "SEO_CRAWL_ALREADY_RUNNING",
        message:
          "Another SEO crawl is already in progress for this site. Wait for it to finish or cancel it.",
        jobId: existingActive.id,
      });
    }

    const canonicalHost = await this.robotsService.resolveCanonicalHost(siteId);
    if (!canonicalHost) {
      throw new BadRequestException({
        code: "SEO_CRAWL_NO_CANONICAL_HOST",
        message:
          "This site has no verified primary domain yet. Add and verify a domain before running a crawl.",
      });
    }

    const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
    const startUrl = `https://${canonicalHost}/`;

    const job = await this.prisma.seoCrawlJob.create({
      data: {
        siteId,
        status: SeoCrawlJobStatus.PENDING,
        startUrl,
        canonicalHost,
        urlLimit: effectiveLimit,
        maxDepth,
        createdBy: actor,
      },
    });

    // Schedule asynchronously so the HTTP response returns immediately.
    setImmediate(() => {
      this.runJob(job.id).catch((err) => {
        this.logger.error(
          `SEO crawl ${job.id} failed unexpectedly`,
          err instanceof Error ? err.stack : String(err),
        );
      });
    });

    return job;
  }

  async getJob(siteId: string, jobId: string): Promise<SeoCrawlJob> {
    const job = await this.prisma.seoCrawlJob.findFirst({
      where: { id: jobId, siteId },
    });
    if (!job) {
      throw new NotFoundException({
        code: "SEO_CRAWL_JOB_NOT_FOUND",
        message: "Crawl job not found",
      });
    }
    return job;
  }

  async listJobs(
    siteId: string,
    params: { limit?: number } = {},
  ): Promise<SeoCrawlJob[]> {
    const take = clampInt(params.limit ?? 20, 1, 100);
    return this.prisma.seoCrawlJob.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  async listResults(
    siteId: string,
    jobId: string,
    filters: {
      cursor?: string;
      limit?: number;
      statusCode?: number;
      hasIssues?: boolean;
    } = {},
  ) {
    await this.getJob(siteId, jobId); // authz
    const take = clampInt(filters.limit ?? 50, 1, 200);

    const where: Prisma.SeoCrawlUrlResultWhereInput = { crawlJobId: jobId };
    if (typeof filters.statusCode === "number") {
      where.statusCode = filters.statusCode;
    }
    if (filters.hasIssues === true) {
      where.errorCount = { gt: 0 };
    }

    const rows = await this.prisma.seoCrawlUrlResult.findMany({
      where,
      orderBy: [{ errorCount: "desc" }, { url: "asc" }],
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      skip: filters.cursor ? 1 : 0,
      take: take + 1,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async listIssues(
    siteId: string,
    jobId: string,
    filters: {
      cursor?: string;
      limit?: number;
      severity?: SeoCrawlIssueSeverity;
      code?: string;
    } = {},
  ) {
    await this.getJob(siteId, jobId);
    const take = clampInt(filters.limit ?? 50, 1, 200);

    const where: Prisma.SeoCrawlIssueWhereInput = { crawlJobId: jobId };
    if (filters.severity) where.severity = filters.severity;
    if (filters.code) where.code = filters.code;

    const rows = await this.prisma.seoCrawlIssue.findMany({
      where,
      orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      skip: filters.cursor ? 1 : 0,
      take: take + 1,
      include: {
        result: { select: { url: true, statusCode: true } },
      },
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async cancelCrawl(siteId: string, jobId: string): Promise<SeoCrawlJob> {
    const job = await this.getJob(siteId, jobId);
    if (
      job.status !== SeoCrawlJobStatus.PENDING &&
      job.status !== SeoCrawlJobStatus.RUNNING
    ) {
      throw new ConflictException({
        code: "SEO_CRAWL_NOT_ACTIVE",
        message: "Only pending or running crawls can be canceled.",
      });
    }
    const active = this.activeJobs.get(jobId);
    if (active) {
      active.cancelled = true;
    }
    // For PENDING jobs the runner may not have started yet; mark canceled
    // up front and the runner will exit immediately.
    return this.prisma.seoCrawlJob.update({
      where: { id: jobId },
      data: {
        status: SeoCrawlJobStatus.CANCELED,
        completedAt: new Date(),
      },
    });
  }

  async exportResultsCsv(siteId: string, jobId: string): Promise<string> {
    const job = await this.getJob(siteId, jobId);
    const rows = await this.prisma.seoCrawlUrlResult.findMany({
      where: { crawlJobId: jobId },
      orderBy: { url: "asc" },
    });

    const header = [
      "url",
      "status",
      "depth",
      "responseTimeMs",
      "title",
      "metaDescription",
      "canonical",
      "h1First",
      "wordCount",
      "internalLinks",
      "externalLinks",
      "brokenLinks",
      "imagesMissingAlt",
      "indexable",
      "errorCount",
      "warningCount",
    ];

    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csv(r.url),
          r.statusCode,
          r.depth,
          r.responseTimeMs ?? "",
          csv(r.title ?? ""),
          csv(r.metaDescription ?? ""),
          csv(r.canonical ?? ""),
          csv(r.h1First ?? ""),
          r.wordCount,
          r.internalLinks,
          r.externalLinks,
          r.brokenLinks,
          r.imagesMissingAlt,
          r.indexable ? "yes" : "no",
          r.errorCount,
          r.warningCount,
        ].join(","),
      );
    }

    // Touch `job` to satisfy strict-mode unused-var rules and ensure the
    // job exists (authz already validated above).
    void job;

    return lines.join("\n");
  }

  // ── runner ────────────────────────────────────────────────────────────

  private async runJob(jobId: string): Promise<void> {
    const state: ActiveJobState = { jobId, cancelled: false };
    this.activeJobs.set(jobId, state);

    try {
      const job = await this.prisma.seoCrawlJob.findUnique({
        where: { id: jobId },
      });
      if (!job) return;
      if (
        job.status === SeoCrawlJobStatus.CANCELED ||
        job.status === SeoCrawlJobStatus.FAILED
      ) {
        return;
      }

      await this.prisma.seoCrawlJob.update({
        where: { id: jobId },
        data: {
          status: SeoCrawlJobStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      const pages = new Map<string, PageBookkeeping>();
      const resultBuffer: Prisma.SeoCrawlUrlResultCreateManyInput[] = [];
      const linkBuffer: Prisma.SeoCrawlPageLinkCreateManyInput[] = [];
      const issueBuffer: {
        code: string;
        severity: SeoCrawlIssueSeverity;
        category: IssueDraft["category"];
        message: string;
        recommendation: string | null;
        context: Prisma.InputJsonValue | null;
        urlKey: string;
      }[] = [];
      // Image audit buffers — persisted after the result rows exist so the
      // FK from finding → url_result is satisfied.
      const imageAuditBuffer = new Map<
        string,
        {
          result: import("../images/image-audit.service").ImageAuditPageResult;
          ogImage: string | null;
        }
      >();
      const sitemapImageSet = await this.imageAuditService.loadSitemapImageSet(
        job.siteId,
      );
      let completedUrls = 0;
      let errorCount = 0;
      let warningCount = 0;
      let infoCount = 0;

      const onPage = async (page: CrawlPageOutcome) => {
        if (state.cancelled) return;

        const drafts = inspectUrl({
          url: page.url,
          pathname: page.pathname,
          statusCode: page.statusCode,
          responseTimeMs: page.responseTimeMs,
          contentType: page.contentType,
          contentLength: page.contentLength,
          title: page.title,
          metaDescription: page.metaDescription,
          canonical: page.canonical,
          h1Count: page.h1Count,
          h1First: page.h1First,
          h2Count: page.h2Count,
          h3Count: page.h3Count,
          wordCount: page.wordCount,
          imageCount: page.imageCount,
          imagesMissingAlt: page.imagesMissingAlt,
          internalLinks: page.internalLinks,
          externalLinks: page.externalLinks,
          brokenLinks: 0, // updated in the post-pass
          redirectChain: page.redirectChain,
          finalUrl: page.finalUrl,
          robotsHeader: page.robotsHeader,
          indexable: page.indexable,
          noindexReason: page.noindexReason,
          fetchError: page.fetchError,
        });

        const pageErrorCount = drafts.filter(
          (d) => d.severity === "ERROR",
        ).length;
        const pageWarningCount = drafts.filter(
          (d) => d.severity === "WARNING",
        ).length;

        const resultId = cuid();
        pages.set(page.url, {
          resultId,
          outboundInternalUrls: page.outboundInternalUrls,
          statusCode: page.statusCode,
        });

        resultBuffer.push({
          id: resultId,
          crawlJobId: jobId,
          url: page.url,
          pathname: page.pathname,
          depth: page.depth,
          statusCode: page.statusCode,
          contentType: page.contentType,
          contentLength: page.contentLength,
          responseTimeMs: page.responseTimeMs,
          title: page.title,
          metaDescription: page.metaDescription,
          canonical: page.canonical,
          h1Count: page.h1Count,
          h1First: page.h1First,
          h2Count: page.h2Count,
          h3Count: page.h3Count,
          wordCount: page.wordCount,
          imageCount: page.imageCount,
          imagesMissingAlt: page.imagesMissingAlt,
          internalLinks: page.internalLinks,
          externalLinks: page.externalLinks,
          brokenLinks: 0,
          redirectChain: page.redirectChain as unknown as Prisma.InputJsonValue,
          finalUrl: page.finalUrl,
          robotsHeader: page.robotsHeader,
          indexable: page.indexable,
          noindexReason: page.noindexReason,
          errorCount: pageErrorCount,
          warningCount: pageWarningCount,
          fetchError: page.fetchError,
        });

        for (const d of drafts) {
          issueBuffer.push({
            code: d.code,
            severity: d.severity,
            category: d.category,
            message: d.message,
            recommendation: d.recommendation,
            context: (d.context ?? null) as Prisma.InputJsonValue | null,
            urlKey: page.url,
          });
          if (d.severity === "ERROR") errorCount += 1;
          else if (d.severity === "WARNING") warningCount += 1;
          else infoCount += 1;
        }

        for (const link of page.outboundLinks) {
          linkBuffer.push({
            crawlJobId: jobId,
            sourceResultId: resultId,
            targetUrl: link.targetUrl,
            targetPathname: link.targetPathname,
            targetResultId: null,
            anchorText: link.anchorText,
            rel: link.rel,
            nofollow: link.nofollow,
            isInternal: link.isInternal,
          });
        }

        // Image audit — only when the URL responded as HTML; we still emit
        // a synthetic og_missing finding for HTML pages with no og:image.
        if (
          page.statusCode >= 200 &&
          page.statusCode < 300 &&
          !page.fetchError
        ) {
          const audit = this.imageAuditService.analyzePage(
            {
              pageUrl: page.url,
              images: page.imageRecords,
              ogImage: page.ogImage,
            },
            sitemapImageSet,
          );
          imageAuditBuffer.set(page.url, {
            result: audit,
            ogImage: page.ogImage,
          });
        }

        completedUrls += 1;
        await this.flushBuffers(
          jobId,
          resultBuffer,
          issueBuffer,
          linkBuffer,
          pages,
        );

        // Progress checkpoint — update aggregates periodically so the UI
        // can stream progress.
        if (completedUrls % 25 === 0) {
          await this.prisma.seoCrawlJob.update({
            where: { id: jobId },
            data: {
              completedUrls,
              errorCount,
              warningCount,
              infoCount,
            },
          });
        }
      };

      const engineResult = await runCrawlEngine({
        startUrl: job.startUrl,
        canonicalHost: job.canonicalHost,
        urlLimit: job.urlLimit,
        maxDepth: job.maxDepth,
        onPage,
        isCancelled: () => state.cancelled,
      });

      // Final flush of any remaining buffered rows.
      await this.flushBuffers(
        jobId,
        resultBuffer,
        issueBuffer,
        linkBuffer,
        pages,
        true,
      );

      // Back-fill target_result_id on internal link edges now that every
      // crawled URL has a result row. This single SQL update is dramatically
      // cheaper than per-row lookups during the crawl and powers fast orphan
      // / inbound queries via the (crawl_job_id, target_result_id) index.
      await this.backfillLinkTargets(jobId);

      // Persist image findings now that all url_result rows exist.
      await this.persistImageAudit(jobId, pages, imageAuditBuffer);

      // Broken-link post-pass: for each error page (status >= 400), increment
      // the brokenLinks count on every referrer that linked to it.
      const { totalBroken, brokenLinkIssueCount } =
        await this.applyBrokenLinkPass(jobId, pages);
      errorCount += brokenLinkIssueCount;

      if (state.cancelled) {
        await this.prisma.seoCrawlJob.update({
          where: { id: jobId },
          data: {
            status: SeoCrawlJobStatus.CANCELED,
            completedUrls,
            totalUrls: completedUrls,
            errorCount,
            warningCount,
            infoCount,
            brokenLinkCount: totalBroken,
            durationMs: engineResult.durationMs,
            completedAt: new Date(),
          },
        });
        return;
      }

      await this.prisma.seoCrawlJob.update({
        where: { id: jobId },
        data: {
          status: SeoCrawlJobStatus.COMPLETED,
          completedUrls,
          totalUrls: engineResult.totalUrls,
          errorCount,
          warningCount,
          infoCount,
          brokenLinkCount: totalBroken,
          durationMs: engineResult.durationMs,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(
        `SEO crawl ${jobId} crashed`,
        err instanceof Error ? err.stack : String(err),
      );
      await this.prisma.seoCrawlJob
        .update({
          where: { id: jobId },
          data: {
            status: SeoCrawlJobStatus.FAILED,
            failureReason:
              err instanceof Error
                ? err.message.slice(0, 500)
                : "Unknown crawler error",
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  private async flushBuffers(
    jobId: string,
    resultBuffer: Prisma.SeoCrawlUrlResultCreateManyInput[],
    issueBuffer: {
      code: string;
      severity: SeoCrawlIssueSeverity;
      category: IssueDraft["category"];
      message: string;
      recommendation: string | null;
      context: Prisma.InputJsonValue | null;
      urlKey: string;
    }[],
    linkBuffer: Prisma.SeoCrawlPageLinkCreateManyInput[],
    pages: Map<string, PageBookkeeping>,
    force = false,
  ): Promise<void> {
    void jobId;
    if (
      resultBuffer.length >= RESULT_CHUNK_SIZE ||
      (force && resultBuffer.length > 0)
    ) {
      const batch = resultBuffer.splice(0, resultBuffer.length);
      await this.prisma.seoCrawlUrlResult.createMany({
        data: batch,
        skipDuplicates: true,
      });
    }

    if (
      issueBuffer.length >= ISSUE_CHUNK_SIZE ||
      (force && issueBuffer.length > 0)
    ) {
      const batch = issueBuffer.splice(0, issueBuffer.length);
      const data = batch
        .map((i) => {
          const bookkeeping = pages.get(i.urlKey);
          if (!bookkeeping) return null;
          return {
            crawlJobId: jobId,
            urlResultId: bookkeeping.resultId,
            code: i.code,
            severity: i.severity,
            category: i.category,
            message: i.message,
            recommendation: i.recommendation,
            context: i.context as Prisma.InputJsonValue,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);
      if (data.length > 0) {
        await this.prisma.seoCrawlIssue.createMany({ data });
      }
    }

    if (
      linkBuffer.length >= LINK_CHUNK_SIZE ||
      (force && linkBuffer.length > 0)
    ) {
      const batch = linkBuffer.splice(0, linkBuffer.length);
      await this.prisma.seoCrawlPageLink.createMany({ data: batch });
    }
  }

  /**
   * Resolves `target_result_id` on every internal link whose target URL was
   * actually crawled in the same job. Runs once at the end of the crawl so
   * the link-graph analysis can use indexed FK joins instead of URL strings.
   */
  private async backfillLinkTargets(jobId: string): Promise<void> {
    try {
      await this.prisma.$executeRaw`
        UPDATE "seo_crawl_page_link" l
        SET "target_result_id" = r."id"
        FROM "seo_crawl_url_result" r
        WHERE l."crawl_job_id" = ${jobId}
          AND r."crawl_job_id" = ${jobId}
          AND l."is_internal" = TRUE
          AND l."target_result_id" IS NULL
          AND l."target_url" = r."url"
      `;
    } catch (err) {
      this.logger.error(
        `Failed to backfill link targets for crawl ${jobId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  /**
   * Persist image findings + roll job-level totals up once the URL result
   * rows exist. Runs after the BFS engine has settled.
   */
  private async persistImageAudit(
    jobId: string,
    pages: Map<string, PageBookkeeping>,
    audits: Map<
      string,
      {
        result: import("../images/image-audit.service").ImageAuditPageResult;
        ogImage: string | null;
      }
    >,
  ): Promise<void> {
    if (audits.size === 0) return;
    const totalDeltas = {
      imageTotal: 0,
      imageMissingAlt: 0,
      imageFilenameAlt: 0,
      imageOversizedOg: 0,
      imageUndersizedOg: 0,
      imageMissingDims: 0,
      imageNotLazy: 0,
      imageMissingSitemap: 0,
    };
    for (const [url, entry] of audits) {
      const book = pages.get(url);
      if (!book) continue;
      try {
        await this.imageAuditService.persistPageFindings(
          jobId,
          book.resultId,
          entry.result,
          entry.ogImage,
        );
        for (const k of Object.keys(totalDeltas) as Array<
          keyof typeof totalDeltas
        >) {
          totalDeltas[k] += entry.result.jobDeltas[k];
        }
      } catch (err) {
        this.logger.error(
          `Failed to persist image findings for crawl ${jobId} url ${url}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
    try {
      await this.imageAuditService.incrementJobRollups(jobId, totalDeltas);
    } catch (err) {
      this.logger.error(
        `Failed to increment image rollups for crawl ${jobId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async applyBrokenLinkPass(
    jobId: string,
    pages: Map<string, PageBookkeeping>,
  ): Promise<{ totalBroken: number; brokenLinkIssueCount: number }> {
    const errorUrls = new Set<string>();
    for (const [url, b] of pages.entries()) {
      if (b.statusCode >= 400 || b.statusCode === 0) {
        errorUrls.add(url);
      }
    }
    if (errorUrls.size === 0)
      return { totalBroken: 0, brokenLinkIssueCount: 0 };

    let totalBroken = 0;
    const updates: Promise<unknown>[] = [];
    const issueRows: Prisma.SeoCrawlIssueCreateManyInput[] = [];

    for (const [pageUrl, b] of pages.entries()) {
      if (errorUrls.has(pageUrl)) continue;
      const broken = b.outboundInternalUrls.filter((u) => errorUrls.has(u));
      if (broken.length === 0) continue;
      totalBroken += broken.length;
      updates.push(
        this.prisma.seoCrawlUrlResult.update({
          where: { id: b.resultId },
          data: {
            brokenLinks: broken.length,
            errorCount: { increment: 1 },
          },
        }),
      );
      issueRows.push({
        crawlJobId: jobId,
        urlResultId: b.resultId,
        code: "BROKEN_LINKS",
        severity: SeoCrawlIssueSeverity.ERROR,
        category: "LINKS",
        message: `${broken.length} broken outbound link${broken.length === 1 ? "" : "s"} from this page.`,
        recommendation:
          "Update or remove dead links — they degrade UX and waste crawl budget.",
        context: { brokenUrls: broken.slice(0, 25) } as Prisma.InputJsonValue,
      });
    }

    if (updates.length > 0) await Promise.all(updates);
    if (issueRows.length > 0) {
      await this.prisma.seoCrawlIssue.createMany({ data: issueRows });
    }
    return { totalBroken, brokenLinkIssueCount: issueRows.length };
  }
}

// ── tiny helpers ──────────────────────────────────────────────────────

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function csv(value: string): string {
  if (value == null) return "";
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Lightweight collision-resistant ID generator. We mint result IDs on the
 * Node side so the issue rows that reference them can be inserted in the
 * same createMany batch without an extra round-trip per URL.
 */
function cuid(): string {
  const base = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 12);
  const rnd2 = Math.random().toString(36).slice(2, 8);
  return `c${base}${rnd}${rnd2}`;
}
