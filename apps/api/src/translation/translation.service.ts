import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, TranslationJobStatus } from "@prisma/client";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { BillingService } from "../billing/billing.service";
import { DeepLService } from "./deepl.service";
import {
  extractTranslatableText,
  injectTranslatedText,
  estimateCharacterCount,
} from "./puck-json-extractor";

const BATCH_SIZE = 50;

export interface CreateTranslationJobInput {
  tenantId: string;
  siteId: string;
  sourceLocale: string;
  targetLocale: string;
  pageIds?: string[];
  overwrite?: boolean;
  autoPublish?: boolean;
  createdBy: string;
}

export interface TranslationJobDto {
  id: string;
  tenantId: string;
  siteId: string;
  sourceLocale: string;
  targetLocale: string;
  status: TranslationJobStatus;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  charactersUsed: number;
  overwrite: boolean;
  autoPublish: boolean;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  createdBy: string;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly deepl: DeepLService,
  ) {}

  async createJob(
    input: CreateTranslationJobInput,
  ): Promise<TranslationJobDto> {
    if (!this.deepl.isConfigured()) {
      throw new BadRequestException("Translation service is not configured");
    }

    if (input.sourceLocale === input.targetLocale) {
      throw new BadRequestException(
        "Source and target locale cannot be the same",
      );
    }

    const site = await this.prisma.site.findFirst({
      where: { id: input.siteId, tenantId: input.tenantId },
    });
    if (!site) {
      throw new NotFoundException("Site not found");
    }

    if (!site.enabledLocales.includes(input.targetLocale)) {
      throw new BadRequestException(
        `Target locale "${input.targetLocale}" is not enabled for this site`,
      );
    }

    const pageWhere: Record<string, unknown> = {
      siteId: input.siteId,
      locale: input.sourceLocale,
      deletedAt: null,
    };
    if (input.pageIds?.length) {
      pageWhere.id = { in: input.pageIds };
    }

    const sourcePages = await this.prisma.page.findMany({ where: pageWhere });
    if (sourcePages.length === 0) {
      throw new BadRequestException("No source pages found for translation");
    }

    const totalChars = sourcePages.reduce((sum, page) => {
      const segments = extractTranslatableText(page.puckData);
      return sum + estimateCharacterCount(segments);
    }, 0);

    await this.billing.assertCanConsumeTranslationCharacters(
      input.tenantId,
      totalChars,
    );

    const job = await this.prisma.translationJob.create({
      data: {
        tenantId: input.tenantId,
        siteId: input.siteId,
        sourceLocale: input.sourceLocale,
        targetLocale: input.targetLocale,
        totalPages: sourcePages.length,
        overwrite: input.overwrite ?? false,
        autoPublish: input.autoPublish ?? false,
        pageIds: (input.pageIds as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        createdBy: input.createdBy,
      },
    });

    this.processJob(job.id).catch((err) => {
      this.logger.error(`Job ${job.id} processing error: ${err.message}`);
    });

    return this.toDto(job);
  }

  async getJob(tenantId: string, jobId: string): Promise<TranslationJobDto> {
    const job = await this.prisma.translationJob.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) {
      throw new NotFoundException("Translation job not found");
    }
    return this.toDto(job);
  }

  async listJobs(
    tenantId: string,
    siteId: string,
    params?: { limit?: number; cursor?: string },
  ): Promise<{ data: TranslationJobDto[]; hasMore: boolean }> {
    const limit = params?.limit ?? 20;
    const jobs = await this.prisma.translationJob.findMany({
      where: { tenantId, siteId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(params?.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
    });

    const hasMore = jobs.length > limit;
    if (hasMore) jobs.pop();

    return { data: jobs.map((j) => this.toDto(j)), hasMore };
  }

  async approveJob(
    tenantId: string,
    jobId: string,
  ): Promise<TranslationJobDto> {
    const job = await this.prisma.translationJob.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) {
      throw new NotFoundException("Translation job not found");
    }
    if (job.status !== TranslationJobStatus.REVIEW_REQUIRED) {
      throw new BadRequestException("Job is not in review state");
    }

    const updated = await this.prisma.translationJob.update({
      where: { id: jobId },
      data: { status: TranslationJobStatus.APPROVED, completedAt: new Date() },
    });
    return this.toDto(updated);
  }

  async retryJob(tenantId: string, jobId: string): Promise<TranslationJobDto> {
    const job = await this.prisma.translationJob.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) {
      throw new NotFoundException("Translation job not found");
    }
    if (job.status !== TranslationJobStatus.FAILED) {
      throw new BadRequestException("Only failed jobs can be retried");
    }

    const updated = await this.prisma.translationJob.update({
      where: { id: jobId },
      data: {
        status: TranslationJobStatus.QUEUED,
        error: null,
        completedPages: 0,
        failedPages: 0,
        charactersUsed: 0,
        startedAt: null,
        completedAt: null,
      },
    });

    this.processJob(updated.id).catch((err) => {
      this.logger.error(`Retry job ${updated.id} error: ${err.message}`);
    });

    return this.toDto(updated);
  }

  async getLocaleCompleteness(
    siteId: string,
  ): Promise<
    { locale: string; total: number; translated: number; stale: number }[]
  > {
    const site = await this.prisma.site.findUnique({ where: { id: siteId } });
    if (!site) return [];

    const result: {
      locale: string;
      total: number;
      translated: number;
      stale: number;
    }[] = [];

    const sourcePages = await this.prisma.page.count({
      where: { siteId, locale: site.primaryLocale, deletedAt: null },
    });

    for (const locale of site.enabledLocales) {
      if (locale === site.primaryLocale) {
        result.push({
          locale,
          total: sourcePages,
          translated: sourcePages,
          stale: 0,
        });
        continue;
      }

      const translated = await this.prisma.page.count({
        where: { siteId, locale, deletedAt: null },
      });

      const stale = await this.prisma.pageTranslationMeta.count({
        where: {
          page: { siteId, locale, deletedAt: null },
          isStale: true,
        },
      });

      result.push({ locale, total: sourcePages, translated, stale });
    }

    return result;
  }

  // ── Glossary Management ─────────────────────────────────────────────────────

  async listGlossaries(tenantId: string, siteId?: string) {
    return this.prisma.translationGlossary.findMany({
      where: { tenantId, ...(siteId ? { siteId } : {}) },
      include: { terms: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async createGlossary(
    tenantId: string,
    data: { name: string; siteId?: string },
  ) {
    return this.prisma.translationGlossary.create({
      data: {
        tenantId,
        siteId: data.siteId ?? null,
        name: data.name,
      },
      include: { terms: true },
    });
  }

  async addGlossaryTerm(
    tenantId: string,
    glossaryId: string,
    data: {
      sourceTerm: string;
      targetTerm: string;
      sourceLocale: string;
      targetLocale: string;
      caseSensitive?: boolean;
    },
  ) {
    const glossary = await this.prisma.translationGlossary.findFirst({
      where: { id: glossaryId, tenantId },
    });
    if (!glossary) {
      throw new NotFoundException("Glossary not found");
    }

    return this.prisma.translationGlossaryTerm.create({
      data: {
        glossaryId,
        sourceTerm: data.sourceTerm,
        targetTerm: data.targetTerm,
        sourceLocale: data.sourceLocale,
        targetLocale: data.targetLocale,
        caseSensitive: data.caseSensitive ?? false,
      },
    });
  }

  async removeGlossaryTerm(tenantId: string, termId: string): Promise<void> {
    const term = await this.prisma.translationGlossaryTerm.findUnique({
      where: { id: termId },
      include: { glossary: true },
    });
    if (!term || term.glossary.tenantId !== tenantId) {
      throw new NotFoundException("Term not found");
    }
    await this.prisma.translationGlossaryTerm.delete({ where: { id: termId } });
  }

  async deleteGlossary(tenantId: string, glossaryId: string): Promise<void> {
    const glossary = await this.prisma.translationGlossary.findFirst({
      where: { id: glossaryId, tenantId },
    });
    if (!glossary) {
      throw new NotFoundException("Glossary not found");
    }
    await this.prisma.translationGlossary.delete({ where: { id: glossaryId } });
  }

  // ── Private Processing ──────────────────────────────────────────────────────

  private async processJob(jobId: string): Promise<void> {
    await this.prisma.translationJob.update({
      where: { id: jobId },
      data: { status: TranslationJobStatus.PROCESSING, startedAt: new Date() },
    });

    const job = await this.prisma.translationJob.findUnique({
      where: { id: jobId },
    });
    if (!job) return;

    const pageWhere: Record<string, unknown> = {
      siteId: job.siteId,
      locale: job.sourceLocale,
      deletedAt: null,
    };
    if (job.pageIds) {
      pageWhere.id = { in: job.pageIds as string[] };
    }

    const sourcePages = await this.prisma.page.findMany({ where: pageWhere });
    let completedPages = 0;
    let failedPages = 0;
    let totalCharsUsed = 0;

    for (const sourcePage of sourcePages) {
      try {
        const chars = await this.translatePage(job, sourcePage, jobId);
        totalCharsUsed += chars;
        completedPages++;
      } catch (err) {
        failedPages++;
        this.logger.warn(
          `Job ${jobId}: page ${sourcePage.id} failed: ${(err as Error).message}`,
        );
      }

      await this.prisma.translationJob.update({
        where: { id: jobId },
        data: { completedPages, failedPages, charactersUsed: totalCharsUsed },
      });
    }

    const finalStatus =
      failedPages > 0 && completedPages === 0
        ? TranslationJobStatus.FAILED
        : failedPages > 0
          ? TranslationJobStatus.REVIEW_REQUIRED
          : TranslationJobStatus.COMPLETED;

    await this.prisma.translationJob.update({
      where: { id: jobId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        ...(failedPages > 0 && completedPages === 0
          ? { error: `All ${failedPages} pages failed translation` }
          : {}),
      },
    });

    await this.prisma.translationUsage.create({
      data: {
        tenantId: job.tenantId,
        siteId: job.siteId,
        characters: totalCharsUsed,
        periodStart: new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          1,
        ),
        provider: "deepl",
        metadata: { jobId },
      },
    });
  }

  private async translatePage(
    job: {
      siteId: string;
      sourceLocale: string;
      targetLocale: string;
      overwrite: boolean;
      autoPublish: boolean;
    },
    sourcePage: {
      id: string;
      slug: string;
      title: string;
      puckData: unknown;
      seoTitle: string | null;
      seoDescription: string | null;
    },
    jobId: string,
  ): Promise<number> {
    const segments = extractTranslatableText(sourcePage.puckData);
    const seoTexts: string[] = [];
    if (sourcePage.seoTitle) seoTexts.push(sourcePage.seoTitle);
    if (sourcePage.seoDescription) seoTexts.push(sourcePage.seoDescription);

    const allTexts = [
      ...segments.map((s) => s.text),
      sourcePage.title,
      ...seoTexts,
    ];

    if (allTexts.length === 0) return 0;

    let allTranslated: string[] = [];
    for (let i = 0; i < allTexts.length; i += BATCH_SIZE) {
      const batch = allTexts.slice(i, i + BATCH_SIZE);
      const result = await this.deepl.translate({
        texts: batch,
        sourceLang: job.sourceLocale,
        targetLang: job.targetLocale,
      });
      allTranslated = allTranslated.concat(
        result.translations.map((t) => t.text),
      );
    }

    const translationMap = new Map<string, string>();
    segments.forEach((seg, idx) => {
      translationMap.set(seg.path, allTranslated[idx]);
    });

    const translatedPuckData = injectTranslatedText(
      sourcePage.puckData,
      translationMap,
    );
    const translatedTitle = allTranslated[segments.length];
    const translatedSeoTitle = sourcePage.seoTitle
      ? allTranslated[segments.length + 1]
      : null;
    const translatedSeoDescription = sourcePage.seoDescription
      ? allTranslated[segments.length + (sourcePage.seoTitle ? 2 : 1)]
      : null;

    const contentHash = createHash("sha256")
      .update(JSON.stringify(sourcePage.puckData))
      .digest("hex")
      .slice(0, 16);

    const existingPage = await this.prisma.page.findFirst({
      where: {
        siteId: job.siteId,
        slug: sourcePage.slug,
        locale: job.targetLocale,
        deletedAt: null,
      },
    });

    if (existingPage && !job.overwrite) {
      return estimateCharacterCount(segments);
    }

    if (existingPage) {
      await this.prisma.page.update({
        where: { id: existingPage.id },
        data: {
          title: translatedTitle,
          puckData: translatedPuckData as object,
          seoTitle: translatedSeoTitle,
          seoDescription: translatedSeoDescription,
          published: job.autoPublish ? true : existingPage.published,
        },
      });

      await this.prisma.pageTranslationMeta.upsert({
        where: { pageId: existingPage.id },
        create: {
          pageId: existingPage.id,
          sourcePageId: sourcePage.id,
          lastTranslatedAt: new Date(),
          sourceContentHash: contentHash,
          isStale: false,
          translationJobId: jobId,
        },
        update: {
          lastTranslatedAt: new Date(),
          sourceContentHash: contentHash,
          isStale: false,
          translationJobId: jobId,
        },
      });
    } else {
      const newPage = await this.prisma.page.create({
        data: {
          siteId: job.siteId,
          slug: sourcePage.slug,
          locale: job.targetLocale,
          title: translatedTitle,
          puckData: translatedPuckData as object,
          published: job.autoPublish,
          seoTitle: translatedSeoTitle,
          seoDescription: translatedSeoDescription,
        },
      });

      await this.prisma.pageTranslationMeta.create({
        data: {
          pageId: newPage.id,
          sourcePageId: sourcePage.id,
          lastTranslatedAt: new Date(),
          sourceContentHash: contentHash,
          isStale: false,
          translationJobId: jobId,
        },
      });
    }

    return (
      estimateCharacterCount(segments) +
      sourcePage.title.length +
      seoTexts.join("").length
    );
  }

  private toDto(job: {
    id: string;
    tenantId: string;
    siteId: string;
    sourceLocale: string;
    targetLocale: string;
    status: TranslationJobStatus;
    totalPages: number;
    completedPages: number;
    failedPages: number;
    charactersUsed: number;
    overwrite: boolean;
    autoPublish: boolean;
    error: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    createdBy: string;
  }): TranslationJobDto {
    return {
      id: job.id,
      tenantId: job.tenantId,
      siteId: job.siteId,
      sourceLocale: job.sourceLocale,
      targetLocale: job.targetLocale,
      status: job.status,
      totalPages: job.totalPages,
      completedPages: job.completedPages,
      failedPages: job.failedPages,
      charactersUsed: job.charactersUsed,
      overwrite: job.overwrite,
      autoPublish: job.autoPublish,
      error: job.error,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      createdBy: job.createdBy,
    };
  }
}
