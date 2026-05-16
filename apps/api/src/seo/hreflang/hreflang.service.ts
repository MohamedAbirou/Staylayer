import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  HreflangIssueSeverity,
  HreflangIssueType,
  HreflangScanStatus,
  Prisma,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { BillingService } from "../../billing/billing.service";

import { validateHreflang } from "./hreflang-validator";

const MAX_BULK_STUBS = 50;

interface RunScanOptions {
  triggeredBy?: string | null;
}

interface ListIssuesOptions {
  scanId?: string;
  type?: HreflangIssueType;
  severity?: HreflangIssueSeverity;
  slug?: string;
  includeDismissed?: boolean;
  limit?: number;
  cursor?: string;
}

interface BulkCreateStubsInput {
  pairs: Array<{ slug: string; locale: string }>;
  triggeredBy?: string | null;
}

export interface BulkCreateStubResult {
  created: Array<{ slug: string; locale: string; pageId: string }>;
  skipped: Array<{ slug: string; locale: string; reason: string }>;
}

@Injectable()
export class HreflangScanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {}

  async runScan(siteId: string, options: RunScanOptions = {}) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        primaryLocale: true,
        enabledLocales: true,
        settings: {
          select: { defaultLocale: true, activeLocales: true },
        },
      },
    });
    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found",
      });
    }

    const defaultLocale =
      site.settings?.defaultLocale || site.primaryLocale || "en";
    const activeLocales = Array.from(
      new Set(
        (site.settings?.activeLocales ?? site.enabledLocales ?? []).filter(
          (l): l is string => Boolean(l),
        ),
      ),
    );

    const scan = await this.prisma.hreflangScan.create({
      data: {
        siteId,
        status: HreflangScanStatus.RUNNING,
        defaultLocale,
        activeLocales,
        triggeredBy: options.triggeredBy ?? null,
      },
    });

    try {
      const pages = await this.prisma.page.findMany({
        where: { siteId, deletedAt: null },
        select: { id: true, slug: true, locale: true, published: true },
      });

      const result = validateHreflang({
        defaultLocale,
        activeLocales,
        pages,
      });

      const issueRows = result.issues.map((issue) => ({
        scanId: scan.id,
        siteId,
        type: issue.type,
        severity: issue.severity,
        slug: issue.slug,
        locale: issue.locale,
        pageId: issue.pageId,
        details: (issue.details ?? {}) as Prisma.InputJsonValue,
      }));

      if (issueRows.length > 0) {
        await this.prisma.hreflangIssue.createMany({ data: issueRows });
      }

      const updated = await this.prisma.hreflangScan.update({
        where: { id: scan.id },
        data: {
          status: HreflangScanStatus.COMPLETED,
          totalSlugs: result.totalSlugs,
          totalPages: result.totalPages,
          errorCount: result.bySeverity[HreflangIssueSeverity.ERROR],
          warningCount: result.bySeverity[HreflangIssueSeverity.WARNING],
          infoCount: result.bySeverity[HreflangIssueSeverity.INFO],
          completedAt: new Date(),
        },
      });

      return { scan: updated, byType: result.byType };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await this.prisma.hreflangScan.update({
        where: { id: scan.id },
        data: {
          status: HreflangScanStatus.FAILED,
          failureReason: message.slice(0, 1000),
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async listScans(siteId: string, limit = 25) {
    const safeLimit = Math.max(1, Math.min(limit, 100));
    return this.prisma.hreflangScan.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    });
  }

  async getScan(siteId: string, scanId: string) {
    const scan = await this.prisma.hreflangScan.findFirst({
      where: { id: scanId, siteId },
    });
    if (!scan) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Hreflang scan not found",
      });
    }
    return scan;
  }

  async getLatestScan(siteId: string) {
    return this.prisma.hreflangScan.findFirst({
      where: { siteId, status: HreflangScanStatus.COMPLETED },
      orderBy: { createdAt: "desc" },
    });
  }

  async listIssues(siteId: string, options: ListIssuesOptions = {}) {
    const limit = Math.max(1, Math.min(options.limit ?? 100, 500));
    let scanId = options.scanId;
    if (!scanId) {
      const latest = await this.getLatestScan(siteId);
      scanId = latest?.id;
    }
    if (!scanId) {
      return { scanId: null, data: [], nextCursor: null };
    }

    const where: Prisma.HreflangIssueWhereInput = {
      siteId,
      scanId,
    };
    if (options.type) where.type = options.type;
    if (options.severity) where.severity = options.severity;
    if (options.slug) where.slug = options.slug;
    if (!options.includeDismissed) where.dismissedAt = null;

    const rows = await this.prisma.hreflangIssue.findMany({
      where,
      orderBy: [{ severity: "asc" }, { slug: "asc" }, { locale: "asc" }],
      take: limit + 1,
      ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
    });

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return {
      scanId,
      data,
      nextCursor: hasMore ? (data[data.length - 1]?.id ?? null) : null,
    };
  }

  async dismissIssue(siteId: string, issueId: string, actor: string | null) {
    const issue = await this.prisma.hreflangIssue.findFirst({
      where: { id: issueId, siteId },
    });
    if (!issue) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Issue not found",
      });
    }
    if (issue.dismissedAt) return issue;
    return this.prisma.hreflangIssue.update({
      where: { id: issueId },
      data: { dismissedAt: new Date(), dismissedBy: actor },
    });
  }

  async undismissIssue(siteId: string, issueId: string) {
    const issue = await this.prisma.hreflangIssue.findFirst({
      where: { id: issueId, siteId },
    });
    if (!issue) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Issue not found",
      });
    }
    if (!issue.dismissedAt) return issue;
    return this.prisma.hreflangIssue.update({
      where: { id: issueId },
      data: { dismissedAt: null, dismissedBy: null },
    });
  }

  /**
   * Bulk-create draft stub pages for missing (slug, locale) pairs by copying
   * the puckData of the same slug's default-locale page (or any published
   * sibling as a fallback).
   *
   * Each stub respects the per-tenant page-count plan limit. We pre-check the
   * total before creating any stubs to avoid partial work.
   */
  async bulkCreateStubs(
    siteId: string,
    input: BulkCreateStubsInput,
  ): Promise<BulkCreateStubResult> {
    const pairs = Array.from(
      new Map(
        input.pairs.map((p) => [`${p.slug}|${p.locale}`, p] as const),
      ).values(),
    );
    if (pairs.length === 0) {
      return { created: [], skipped: [] };
    }
    if (pairs.length > MAX_BULK_STUBS) {
      throw new BadRequestException({
        code: "TOO_MANY_PAIRS",
        message: `Cannot create more than ${MAX_BULK_STUBS} stubs in one request`,
      });
    }

    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        primaryLocale: true,
        settings: { select: { defaultLocale: true } },
      },
    });
    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found",
      });
    }
    const defaultLocale =
      site.settings?.defaultLocale || site.primaryLocale || "en";

    // Pre-check plan budget once for the full batch to avoid partial work.
    await this.billingService.assertCanIncreasePageCount(siteId, pairs.length);

    const slugs = Array.from(new Set(pairs.map((p) => p.slug)));
    const sourcePages = await this.prisma.page.findMany({
      where: {
        siteId,
        slug: { in: slugs },
        deletedAt: null,
      },
      orderBy: [{ published: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        slug: true,
        locale: true,
        title: true,
        puckData: true,
        published: true,
        seoTitle: true,
        seoDescription: true,
        targetKeywords: true,
        internalBrief: true,
        seoOgImage: true,
      },
    });

    const sourceBySlug = new Map<string, (typeof sourcePages)[number]>();
    for (const page of sourcePages) {
      const existing = sourceBySlug.get(page.slug);
      if (!existing) {
        sourceBySlug.set(page.slug, page);
        continue;
      }
      if (page.locale === defaultLocale && existing.locale !== defaultLocale) {
        sourceBySlug.set(page.slug, page);
      }
    }

    const created: BulkCreateStubResult["created"] = [];
    const skipped: BulkCreateStubResult["skipped"] = [];

    for (const pair of pairs) {
      const source = sourceBySlug.get(pair.slug);
      if (!source) {
        skipped.push({
          slug: pair.slug,
          locale: pair.locale,
          reason: "no_source_page",
        });
        continue;
      }

      const exists = await this.prisma.page.findUnique({
        where: {
          siteId_slug_locale: {
            siteId,
            slug: pair.slug,
            locale: pair.locale,
          },
        },
        select: { id: true },
      });
      if (exists) {
        skipped.push({
          slug: pair.slug,
          locale: pair.locale,
          reason: "already_exists",
        });
        continue;
      }

      try {
        const newPage = await this.prisma.page.create({
          data: {
            siteId,
            slug: pair.slug,
            locale: pair.locale,
            title: `[${pair.locale}] ${source.title}`,
            puckData: source.puckData as Prisma.InputJsonValue,
            published: false,
            seoTitle: source.seoTitle,
            seoDescription: source.seoDescription,
            targetKeywords: source.targetKeywords,
            internalBrief: source.internalBrief,
            seoOgImage: source.seoOgImage,
          },
          select: { id: true },
        });
        await this.prisma.pageVersion.create({
          data: {
            pageId: newPage.id,
            puckData: source.puckData as Prisma.InputJsonValue,
            savedBy: input.triggeredBy ?? "hreflang-bulk-fixer",
            note: `Stub created from ${source.locale} via hreflang fixer`,
          },
        });
        await this.prisma.pageTranslationMeta
          .create({
            data: {
              pageId: newPage.id,
              sourcePageId: source.id,
              isStale: true,
            },
          })
          .catch(() => undefined);
        created.push({
          slug: pair.slug,
          locale: pair.locale,
          pageId: newPage.id,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "unknown_error";
        if (error instanceof ConflictException) {
          skipped.push({
            slug: pair.slug,
            locale: pair.locale,
            reason: "conflict",
          });
        } else {
          skipped.push({
            slug: pair.slug,
            locale: pair.locale,
            reason: msg.slice(0, 200),
          });
        }
      }
    }

    return { created, skipped };
  }
}
