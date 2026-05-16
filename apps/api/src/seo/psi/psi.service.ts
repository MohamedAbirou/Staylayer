import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  CruxFormFactor,
  Prisma,
  PsiAuditStatus,
  PsiStrategy,
} from "@prisma/client";

import { BillingService } from "../../billing/billing.service";
import { PrismaService } from "../../prisma/prisma.service";

import {
  PageSpeedInsightsClient,
  PerformanceProviderError,
} from "./psi-api.service";
import {
  asJsonInput,
  parseCruxRecord,
  parseLighthouseResult,
} from "./psi-mapper";

const DEFAULT_PSI_CACHE_HOURS = 6;
const DEFAULT_CRUX_CACHE_HOURS = 24;

export interface RunAuditOptions {
  url: string;
  strategy: PsiStrategy;
  triggeredBy?: string;
  forceRefresh?: boolean;
}

export interface ListAuditsOptions {
  url?: string;
  strategy?: PsiStrategy;
  status?: PsiAuditStatus;
  limit?: number;
  cursor?: string;
}

export interface FetchCruxOptions {
  url?: string;
  origin?: string;
  formFactor?: CruxFormFactor;
  forceRefresh?: boolean;
}

@Injectable()
export class PsiAuditService {
  private readonly logger = new Logger(PsiAuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly psi: PageSpeedInsightsClient,
  ) {}

  describeConfig(): {
    configured: boolean;
    psiCacheMaxAgeHours: number;
    cruxCacheMaxAgeHours: number;
  } {
    return {
      configured: this.psi.isConfigured(),
      psiCacheMaxAgeHours: this.getPsiCacheMaxAgeHours(),
      cruxCacheMaxAgeHours: this.getCruxCacheMaxAgeHours(),
    };
  }

  private getPsiCacheMaxAgeHours(): number {
    const raw = process.env.PSI_CACHE_MAX_AGE_HOURS;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_PSI_CACHE_HOURS;
  }

  private getCruxCacheMaxAgeHours(): number {
    const raw = process.env.CRUX_CACHE_MAX_AGE_HOURS;
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_CRUX_CACHE_HOURS;
  }

  private assertConfigured(): void {
    if (!this.psi.isConfigured()) {
      throw new ConflictException({
        code: "PSI_NOT_CONFIGURED",
        message:
          "PageSpeed Insights is not configured for this deployment (missing PSI_API_KEY).",
      });
    }
  }

  private normalizeUrl(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) {
      throw new BadRequestException("url is required");
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException("url must be an absolute URL");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new BadRequestException(
        "url must use http or https protocol",
      );
    }
    return parsed.toString();
  }

  async runAudit(
    siteId: string,
    options: RunAuditOptions,
  ): Promise<{
    audit: Awaited<ReturnType<PsiAuditService["getAuditById"]>>;
    cached: boolean;
  }> {
    this.assertConfigured();
    const url = this.normalizeUrl(options.url);
    const strategy = options.strategy;
    const cacheCutoff = new Date(
      Date.now() - this.getPsiCacheMaxAgeHours() * 60 * 60 * 1000,
    );

    if (!options.forceRefresh) {
      const cached = await this.prisma.psiAudit.findFirst({
        where: {
          siteId,
          url,
          strategy,
          status: PsiAuditStatus.COMPLETED,
          createdAt: { gte: cacheCutoff },
        },
        orderBy: { createdAt: "desc" },
      });
      if (cached) {
        return { audit: cached, cached: true };
      }
    }

    // Plan limit only consumes budget when we actually call the provider.
    await this.billing.assertCanRunPsiAudit(siteId);

    const audit = await this.prisma.psiAudit.create({
      data: {
        siteId,
        url,
        strategy,
        status: PsiAuditStatus.RUNNING,
        triggeredBy: options.triggeredBy ?? null,
      },
    });

    try {
      const result = await this.psi.runAudit({
        url,
        strategy: strategy === PsiStrategy.MOBILE ? "MOBILE" : "DESKTOP",
      });
      const parsed = parseLighthouseResult(result.lighthouseResult);

      const updated = await this.prisma.psiAudit.update({
        where: { id: audit.id },
        data: {
          status: PsiAuditStatus.COMPLETED,
          completedAt: new Date(),
          performanceScore: parsed.performanceScore,
          accessibilityScore: parsed.accessibilityScore,
          bestPracticesScore: parsed.bestPracticesScore,
          seoScore: parsed.seoScore,
          pwaScore: parsed.pwaScore,
          largestContentfulPaintMs: parsed.largestContentfulPaintMs,
          firstContentfulPaintMs: parsed.firstContentfulPaintMs,
          cumulativeLayoutShift: parsed.cumulativeLayoutShift,
          totalBlockingTimeMs: parsed.totalBlockingTimeMs,
          interactionToNextPaintMs: parsed.interactionToNextPaintMs,
          speedIndexMs: parsed.speedIndexMs,
          timeToInteractiveMs: parsed.timeToInteractiveMs,
          lighthouseVersion: parsed.lighthouseVersion,
          userAgent: parsed.userAgent,
          fetchTime: parsed.fetchTime,
          finalUrl: parsed.finalUrl,
          totalByteWeight: parsed.totalByteWeight,
          numRequests: parsed.numRequests,
          lighthouseResult: asJsonInput(
            result.lighthouseResult,
          ) as Prisma.InputJsonValue,
          loadingExperience: asJsonInput(
            result.loadingExperience,
          ) as Prisma.InputJsonValue,
          originLoadingExperience: asJsonInput(
            result.originLoadingExperience,
          ) as Prisma.InputJsonValue,
        },
      });

      return { audit: updated, cached: false };
    } catch (error) {
      const reason =
        error instanceof PerformanceProviderError
          ? `${error.providerCode ?? error.status}: ${error.message}`
          : error instanceof Error
            ? error.message
            : "Unknown provider error";
      this.logger.warn(
        `PSI audit ${audit.id} failed (${siteId} ${url} ${strategy}): ${reason}`,
      );
      const failed = await this.prisma.psiAudit.update({
        where: { id: audit.id },
        data: {
          status: PsiAuditStatus.FAILED,
          completedAt: new Date(),
          failureReason: reason.slice(0, 1000),
        },
      });
      return { audit: failed, cached: false };
    }
  }

  async listAudits(siteId: string, options: ListAuditsOptions = {}) {
    const take = Math.min(Math.max(options.limit ?? 25, 1), 200);
    return this.prisma.psiAudit.findMany({
      where: {
        siteId,
        ...(options.url ? { url: options.url } : {}),
        ...(options.strategy ? { strategy: options.strategy } : {}),
        ...(options.status ? { status: options.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      ...(options.cursor
        ? { cursor: { id: options.cursor }, skip: 1 }
        : {}),
      select: {
        id: true,
        url: true,
        strategy: true,
        status: true,
        performanceScore: true,
        accessibilityScore: true,
        bestPracticesScore: true,
        seoScore: true,
        largestContentfulPaintMs: true,
        firstContentfulPaintMs: true,
        cumulativeLayoutShift: true,
        totalBlockingTimeMs: true,
        interactionToNextPaintMs: true,
        speedIndexMs: true,
        fetchTime: true,
        failureReason: true,
        createdAt: true,
        completedAt: true,
      },
    });
  }

  async getAuditById(siteId: string, auditId: string) {
    const audit = await this.prisma.psiAudit.findFirst({
      where: { id: auditId, siteId },
    });
    if (!audit) {
      throw new NotFoundException("PSI audit not found");
    }
    return audit;
  }

  async getLatestPerUrl(siteId: string, limit = 25) {
    const take = Math.min(Math.max(limit, 1), 100);
    // Latest COMPLETED audit per (url, strategy) — done in JS after a bounded fetch.
    const recent = await this.prisma.psiAudit.findMany({
      where: { siteId, status: PsiAuditStatus.COMPLETED },
      orderBy: { createdAt: "desc" },
      take: take * 4,
      select: {
        id: true,
        url: true,
        strategy: true,
        performanceScore: true,
        accessibilityScore: true,
        bestPracticesScore: true,
        seoScore: true,
        largestContentfulPaintMs: true,
        firstContentfulPaintMs: true,
        cumulativeLayoutShift: true,
        totalBlockingTimeMs: true,
        interactionToNextPaintMs: true,
        createdAt: true,
      },
    });
    const seen = new Set<string>();
    const out: typeof recent = [];
    for (const row of recent) {
      const key = `${row.url}::${row.strategy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
      if (out.length >= take) break;
    }
    return out;
  }

  async fetchCruxRecord(
    siteId: string,
    options: FetchCruxOptions,
  ): Promise<{
    record: Awaited<ReturnType<PsiAuditService["readCruxRow"]>>;
    cached: boolean;
    notFound: boolean;
  }> {
    this.assertConfigured();

    if (!options.url && !options.origin) {
      throw new BadRequestException("Either url or origin is required");
    }
    if (options.url && options.origin) {
      throw new BadRequestException(
        "Provide either url or origin, not both",
      );
    }
    const scope: "URL" | "ORIGIN" = options.url ? "URL" : "ORIGIN";
    const recordKey = this.normalizeUrl(
      (options.url ?? options.origin) as string,
    );
    const formFactor = options.formFactor ?? CruxFormFactor.ALL;
    const cacheCutoff = new Date(
      Date.now() - this.getCruxCacheMaxAgeHours() * 60 * 60 * 1000,
    );

    if (!options.forceRefresh) {
      const cached = await this.readCruxRow(
        siteId,
        scope,
        recordKey,
        formFactor,
      );
      if (cached && cached.fetchedAt >= cacheCutoff) {
        return { record: cached, cached: true, notFound: false };
      }
    }

    try {
      const result = await this.psi.fetchCruxRecord({
        url: options.url,
        origin: options.origin,
        formFactor:
          formFactor === CruxFormFactor.ALL ? "ALL" : formFactor,
      });

      if (result.notFound || !result.record) {
        return { record: null, cached: false, notFound: true };
      }

      const parsed = parseCruxRecord(result.record);
      const row = await this.prisma.cruxRecord.upsert({
        where: {
          siteId_scope_recordKey_formFactor: {
            siteId,
            scope,
            recordKey,
            formFactor,
          },
        },
        create: {
          siteId,
          scope,
          recordKey,
          formFactor,
          lcpP75Ms: parsed.lcpP75Ms,
          fcpP75Ms: parsed.fcpP75Ms,
          clsP75: parsed.clsP75,
          inpP75Ms: parsed.inpP75Ms,
          ttfbP75Ms: parsed.ttfbP75Ms,
          fidP75Ms: parsed.fidP75Ms,
          record: asJsonInput(result.record) as Prisma.InputJsonValue,
          collectionPeriodStart: parsed.collectionPeriodStart,
          collectionPeriodEnd: parsed.collectionPeriodEnd,
          fetchedAt: new Date(),
        },
        update: {
          lcpP75Ms: parsed.lcpP75Ms,
          fcpP75Ms: parsed.fcpP75Ms,
          clsP75: parsed.clsP75,
          inpP75Ms: parsed.inpP75Ms,
          ttfbP75Ms: parsed.ttfbP75Ms,
          fidP75Ms: parsed.fidP75Ms,
          record: asJsonInput(result.record) as Prisma.InputJsonValue,
          collectionPeriodStart: parsed.collectionPeriodStart,
          collectionPeriodEnd: parsed.collectionPeriodEnd,
          fetchedAt: new Date(),
        },
      });

      return { record: row, cached: false, notFound: false };
    } catch (error) {
      if (
        error instanceof PerformanceProviderError &&
        error.status === 404
      ) {
        return { record: null, cached: false, notFound: true };
      }
      throw error;
    }
  }

  private async readCruxRow(
    siteId: string,
    scope: "URL" | "ORIGIN",
    recordKey: string,
    formFactor: CruxFormFactor,
  ) {
    return this.prisma.cruxRecord.findUnique({
      where: {
        siteId_scope_recordKey_formFactor: {
          siteId,
          scope,
          recordKey,
          formFactor,
        },
      },
    });
  }

  async getMonthlyQuota(siteId: string): Promise<{
    limit: number;
    used: number;
    remaining: number;
  }> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { tenantId: true },
    });
    if (!site) {
      throw new NotFoundException("Site not found");
    }
    const snapshot = await this.billing.getTenantPlanSnapshot(site.tenantId);
    const limit = snapshot.limits.psiAuditsPerMonth;
    const used = snapshot.usage.psiAuditsThisMonth;
    return { limit, used, remaining: Math.max(limit - used, 0) };
  }
}
