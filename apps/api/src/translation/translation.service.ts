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
import { RevalidationService } from "../revalidation/revalidation.service";
import {
  extractTranslatableText,
  injectTranslatedText,
  estimateCharacterCount,
} from "./puck-json-extractor";

const BATCH_SIZE = 50;
const DEEPL_PROVIDER = "deepl";

interface TranslationGlossaryContext {
  deeplGlossaryId?: string;
  entryCount: number;
}

export interface GlossaryPreviewEntryDto {
  source: string;
  target: string;
  scope: "site" | "global";
  glossaryId: string;
  glossaryName: string;
  caseSensitive: boolean;
}

export interface GlossaryPreviewDto {
  sourceLocale: string;
  targetLocale: string;
  entryCount: number;
  siteSpecificCount: number;
  globalCount: number;
  providerStatus: "none" | "not_synced" | "out_of_date" | "ready";
  lastSyncedAt: string | null;
  entries: GlossaryPreviewEntryDto[];
}

interface EffectiveGlossaryState {
  sourceLocale: string;
  targetLocale: string;
  entries: GlossaryPreviewEntryDto[];
  entryCount: number;
  siteSpecificCount: number;
  globalCount: number;
  entriesHash: string | null;
  providerStatus: "none" | "not_synced" | "out_of_date" | "ready";
  providerGlossary: {
    providerGlossaryId: string;
    entriesHash: string;
    isStale: boolean;
    lastSyncedAt: Date | null;
  } | null;
}

export interface CreateTranslationJobInput {
  tenantId: string;
  siteId: string;
  sourceLocale: string;
  targetLocale: string;
  pageIds?: string[];
  publishedOnly?: boolean;
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
    private readonly revalidation: RevalidationService,
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

    const selectedPageIds = input.pageIds?.length
      ? Array.from(new Set(input.pageIds.filter(Boolean)))
      : undefined;

    if (selectedPageIds?.length && input.publishedOnly) {
      throw new BadRequestException(
        "Choose either specific pages or published-only scope, not both",
      );
    }

    const pageWhere: Record<string, unknown> = {
      siteId: input.siteId,
      locale: input.sourceLocale,
      deletedAt: null,
    };
    if (selectedPageIds?.length) {
      pageWhere.id = { in: selectedPageIds };
    } else if (input.publishedOnly) {
      pageWhere.published = true;
    }

    const sourcePages = await this.prisma.page.findMany({ where: pageWhere });
    if (sourcePages.length === 0) {
      throw new BadRequestException(
        input.publishedOnly
          ? "No published source pages found for translation"
          : "No source pages found for translation",
      );
    }

    if (
      selectedPageIds?.length &&
      sourcePages.length !== selectedPageIds.length
    ) {
      throw new BadRequestException(
        "Some selected pages were not found in the chosen source locale",
      );
    }

    const persistedPageIds =
      selectedPageIds ??
      (input.publishedOnly ? sourcePages.map((page) => page.id) : undefined);

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
        autoPublish: input.autoPublish ?? true,
        pageIds: (persistedPageIds as Prisma.InputJsonValue) ?? Prisma.JsonNull,
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

    const distinctSlugs = await this.prisma.page.findMany({
      where: { siteId, deletedAt: null },
      distinct: ["slug"],
      select: { slug: true },
    });
    const totalPages = distinctSlugs.length;

    return Promise.all(
      site.enabledLocales.map(async (locale) => {
        const translated = await this.prisma.page.count({
          where: { siteId, locale, deletedAt: null },
        });

        const stale = await this.prisma.pageTranslationMeta.count({
          where: {
            page: { siteId, locale, deletedAt: null },
            isStale: true,
          },
        });

        return {
          locale,
          total: totalPages,
          translated,
          stale,
        };
      }),
    );
  }

  async getGlossaryPreview(
    tenantId: string,
    siteId: string,
    sourceLocale: string,
    targetLocale: string,
  ): Promise<GlossaryPreviewDto> {
    const state = await this.getEffectiveGlossaryState({
      tenantId,
      siteId,
      sourceLocale,
      targetLocale,
    });

    return {
      sourceLocale: state.sourceLocale,
      targetLocale: state.targetLocale,
      entryCount: state.entryCount,
      siteSpecificCount: state.siteSpecificCount,
      globalCount: state.globalCount,
      providerStatus: state.providerStatus,
      lastSyncedAt: state.providerGlossary?.lastSyncedAt?.toISOString() ?? null,
      entries: state.entries,
    };
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
      select: { id: true, siteId: true },
    });
    if (!glossary) {
      throw new NotFoundException("Glossary not found");
    }

    const term = await this.prisma.translationGlossaryTerm.create({
      data: {
        glossaryId,
        sourceTerm: data.sourceTerm,
        targetTerm: data.targetTerm,
        sourceLocale: data.sourceLocale,
        targetLocale: data.targetLocale,
        caseSensitive: data.caseSensitive ?? false,
      },
    });

    await this.invalidateProviderGlossaries({
      tenantId,
      siteId: glossary.siteId,
      localePairs: [
        {
          sourceLocale: data.sourceLocale,
          targetLocale: data.targetLocale,
        },
      ],
    });

    return term;
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
    await this.invalidateProviderGlossaries({
      tenantId,
      siteId: term.glossary.siteId,
      localePairs: [
        {
          sourceLocale: term.sourceLocale,
          targetLocale: term.targetLocale,
        },
      ],
    });
  }

  async deleteGlossary(tenantId: string, glossaryId: string): Promise<void> {
    const glossary = await this.prisma.translationGlossary.findFirst({
      where: { id: glossaryId, tenantId },
      include: {
        terms: {
          select: {
            sourceLocale: true,
            targetLocale: true,
          },
        },
      },
    });
    if (!glossary) {
      throw new NotFoundException("Glossary not found");
    }
    await this.prisma.translationGlossary.delete({ where: { id: glossaryId } });
    await this.invalidateProviderGlossaries({
      tenantId,
      siteId: glossary.siteId,
      localePairs: glossary.terms,
    });
  }

  // ── Private Processing ──────────────────────────────────────────────────────

  private async processJob(jobId: string): Promise<void> {
    await this.prisma.translationJob.update({
      where: { id: jobId },
      data: { status: TranslationJobStatus.PROCESSING, startedAt: new Date() },
    });

    try {
      const job = await this.prisma.translationJob.findUnique({
        where: { id: jobId },
      });
      if (!job) return;

      const pageWhere: Record<string, unknown> = {
        siteId: job.siteId,
        locale: job.sourceLocale,
        deletedAt: null,
      };
      if (Array.isArray(job.pageIds) && job.pageIds.length > 0) {
        pageWhere.id = { in: job.pageIds as string[] };
      }

      const sourcePages = await this.prisma.page.findMany({ where: pageWhere });
      const glossaryContext = await this.ensureGlossaryContext({
        tenantId: job.tenantId,
        siteId: job.siteId,
        sourceLocale: job.sourceLocale,
        targetLocale: job.targetLocale,
      });

      let completedPages = 0;
      let failedPages = 0;
      let totalCharsUsed = 0;

      for (const sourcePage of sourcePages) {
        try {
          const chars = await this.translatePage(
            job,
            sourcePage,
            jobId,
            glossaryContext,
          );
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
          metadata: {
            jobId,
            glossaryEntriesApplied: glossaryContext.entryCount,
          },
        },
      });
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Job ${jobId} failed before completion: ${message}`);
      await this.prisma.translationJob.update({
        where: { id: jobId },
        data: {
          status: TranslationJobStatus.FAILED,
          error: message,
          completedAt: new Date(),
        },
      });
    }
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
    glossaryContext: TranslationGlossaryContext,
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
        glossaryId: glossaryContext.deeplGlossaryId,
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

      if (job.autoPublish) {
        await this.revalidateTranslatedPage(job.siteId, sourcePage.slug);
      }
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

      if (job.autoPublish) {
        await this.revalidateTranslatedPage(job.siteId, sourcePage.slug);
      }
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

  private async ensureGlossaryContext(input: {
    tenantId: string;
    siteId: string;
    sourceLocale: string;
    targetLocale: string;
  }): Promise<TranslationGlossaryContext> {
    const state = await this.getEffectiveGlossaryState(input);

    if (state.entries.length === 0 || !state.entriesHash) {
      await this.prisma.translationProviderGlossary.deleteMany({
        where: {
          siteId: input.siteId,
          provider: DEEPL_PROVIDER,
          sourceLocale: state.sourceLocale,
          targetLocale: state.targetLocale,
        },
      });
      return { entryCount: 0 };
    }

    if (
      state.providerStatus === "ready" &&
      state.providerGlossary?.providerGlossaryId
    ) {
      return {
        deeplGlossaryId: state.providerGlossary.providerGlossaryId,
        entryCount: state.entryCount,
      };
    }

    const glossary = await this.deepl.createGlossary({
      name: `staylayer-${input.siteId}-${state.sourceLocale}-${state.targetLocale}-${state.entriesHash.slice(0, 12)}`,
      sourceLang: state.sourceLocale,
      targetLang: state.targetLocale,
      entries: state.entries.map((entry) => ({
        source: entry.source,
        target: entry.target,
      })),
    });

    await this.prisma.translationProviderGlossary.upsert({
      where: {
        siteId_provider_sourceLocale_targetLocale: {
          siteId: input.siteId,
          provider: DEEPL_PROVIDER,
          sourceLocale: state.sourceLocale,
          targetLocale: state.targetLocale,
        },
      },
      create: {
        tenantId: input.tenantId,
        siteId: input.siteId,
        provider: DEEPL_PROVIDER,
        sourceLocale: state.sourceLocale,
        targetLocale: state.targetLocale,
        providerGlossaryId: glossary.glossaryId,
        entriesHash: state.entriesHash,
        entryCount: state.entryCount,
        isStale: false,
        lastSyncedAt: new Date(),
      },
      update: {
        providerGlossaryId: glossary.glossaryId,
        entriesHash: state.entriesHash,
        entryCount: state.entryCount,
        isStale: false,
        lastSyncedAt: new Date(),
      },
    });

    return {
      deeplGlossaryId: glossary.glossaryId,
      entryCount: state.entryCount,
    };
  }

  private async getEffectiveGlossaryState(input: {
    tenantId: string;
    siteId: string;
    sourceLocale: string;
    targetLocale: string;
  }): Promise<EffectiveGlossaryState> {
    const sourceLocale = this.normalizeLocale(input.sourceLocale);
    const targetLocale = this.normalizeLocale(input.targetLocale);

    const terms = await this.prisma.translationGlossaryTerm.findMany({
      where: {
        sourceLocale: { equals: sourceLocale, mode: "insensitive" },
        targetLocale: { equals: targetLocale, mode: "insensitive" },
        glossary: {
          tenantId: input.tenantId,
          OR: [{ siteId: input.siteId }, { siteId: null }],
        },
      },
      include: {
        glossary: {
          select: {
            id: true,
            name: true,
            siteId: true,
          },
        },
      },
    });

    const providerGlossary =
      await this.prisma.translationProviderGlossary.findUnique({
        where: {
          siteId_provider_sourceLocale_targetLocale: {
            siteId: input.siteId,
            provider: DEEPL_PROVIDER,
            sourceLocale,
            targetLocale,
          },
        },
      });

    if (terms.length === 0) {
      return {
        sourceLocale,
        targetLocale,
        entries: [],
        entryCount: 0,
        siteSpecificCount: 0,
        globalCount: 0,
        entriesHash: null,
        providerStatus: "none",
        providerGlossary,
      };
    }

    const entries = this.resolveGlossaryEntries(input.siteId, terms);
    const entriesHash = this.hashGlossaryEntries(entries);
    const siteSpecificCount = entries.filter(
      (entry) => entry.scope === "site",
    ).length;
    const globalCount = entries.length - siteSpecificCount;

    let providerStatus: EffectiveGlossaryState["providerStatus"] = "not_synced";
    if (providerGlossary) {
      providerStatus =
        providerGlossary.isStale || providerGlossary.entriesHash !== entriesHash
          ? "out_of_date"
          : "ready";
    }

    return {
      sourceLocale,
      targetLocale,
      entries,
      entryCount: entries.length,
      siteSpecificCount,
      globalCount,
      entriesHash,
      providerStatus,
      providerGlossary,
    };
  }

  private resolveGlossaryEntries(
    siteId: string,
    terms: Array<{
      sourceTerm: string;
      targetTerm: string;
      caseSensitive: boolean;
      glossary: { id: string; name: string; siteId: string | null };
    }>,
  ): GlossaryPreviewEntryDto[] {
    const sortedTerms = [...terms].sort((left, right) => {
      const leftScore = left.glossary.siteId === siteId ? 1 : 0;
      const rightScore = right.glossary.siteId === siteId ? 1 : 0;
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      if (left.glossary.id !== right.glossary.id) {
        return left.glossary.id.localeCompare(right.glossary.id);
      }

      return left.sourceTerm.localeCompare(right.sourceTerm);
    });

    const entries: GlossaryPreviewEntryDto[] = [];
    const seenSourceTerms = new Set<string>();

    for (const term of sortedTerms) {
      const source = term.sourceTerm.trim();
      const target = term.targetTerm.trim();
      if (!source || !target) {
        continue;
      }

      if (seenSourceTerms.has(source)) {
        continue;
      }

      seenSourceTerms.add(source);
      entries.push({
        source,
        target,
        scope: term.glossary.siteId === siteId ? "site" : "global",
        glossaryId: term.glossary.id,
        glossaryName: term.glossary.name,
        caseSensitive: term.caseSensitive,
      });
    }

    return entries;
  }

  private hashGlossaryEntries(
    entries: Array<{ source: string; target: string }>,
  ): string {
    return createHash("sha256")
      .update(
        JSON.stringify(
          entries.map((entry) => ({
            source: entry.source,
            target: entry.target,
          })),
        ),
      )
      .digest("hex")
      .slice(0, 32);
  }

  private normalizeLocale(locale: string): string {
    return locale.trim().toLowerCase();
  }

  private async invalidateProviderGlossaries(input: {
    tenantId: string;
    siteId: string | null;
    localePairs: Array<{ sourceLocale: string; targetLocale: string }>;
  }): Promise<void> {
    const pairs = Array.from(
      new Set(
        input.localePairs
          .map((pair) => {
            const sourceLocale = this.normalizeLocale(pair.sourceLocale);
            const targetLocale = this.normalizeLocale(pair.targetLocale);
            if (!sourceLocale || !targetLocale) {
              return null;
            }
            return `${sourceLocale}:${targetLocale}`;
          })
          .filter((pair): pair is string => Boolean(pair)),
      ),
    );

    if (pairs.length === 0) {
      return;
    }

    await this.prisma.translationProviderGlossary.updateMany({
      where: {
        tenantId: input.tenantId,
        provider: DEEPL_PROVIDER,
        ...(input.siteId ? { siteId: input.siteId } : {}),
        OR: pairs.map((pair) => {
          const [sourceLocale, targetLocale] = pair.split(":");
          return { sourceLocale, targetLocale };
        }),
      },
      data: {
        isStale: true,
      },
    });
  }

  private async revalidateTranslatedPage(
    siteId: string,
    slug: string,
  ): Promise<void> {
    try {
      await this.revalidation.revalidatePage(siteId, slug);
    } catch (error) {
      this.logger.warn(
        `Revalidation failed for translated page ${slug}: ${(error as Error).message}`,
      );
    }
  }
}
