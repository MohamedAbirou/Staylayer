/// <reference types="jest" />

import { TranslationJobStatus } from "@prisma/client";
import { TranslationService } from "./translation.service";

function buildPrismaMock() {
  return {
    site: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    page: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    translationJob: {
      create: jest.fn(),
    },
    pageTranslationMeta: {
      create: jest.fn(),
      count: jest.fn(),
    },
  };
}

describe("TranslationService", () => {
  it("defaults new translation jobs to auto-publish", async () => {
    const prisma = buildPrismaMock();
    const billing = {
      assertCanConsumeTranslationCharacters: jest
        .fn()
        .mockResolvedValue(undefined),
    };
    const deepl = {
      isConfigured: jest.fn().mockReturnValue(true),
    };
    const revalidation = {
      revalidatePage: jest.fn().mockResolvedValue(undefined),
    };

    prisma.site.findFirst.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      enabledLocales: ["en", "es"],
    });
    prisma.page.findMany.mockResolvedValue([
      {
        id: "page-source-1",
        puckData: {
          hero: {
            heading: "Hello",
          },
        },
      },
    ]);
    prisma.translationJob.create.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-1",
      siteId: "site-1",
      sourceLocale: "en",
      targetLocale: "es",
      status: TranslationJobStatus.QUEUED,
      totalPages: 1,
      completedPages: 0,
      failedPages: 0,
      charactersUsed: 0,
      overwrite: false,
      autoPublish: true,
      error: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date("2026-05-12T23:45:00.000Z"),
      createdBy: "user-1",
    });

    const service = new TranslationService(
      prisma as never,
      billing as never,
      deepl as never,
      revalidation as never,
    );

    jest
      .spyOn(service as never, "processJob")
      .mockResolvedValue(undefined as never);

    const result = await service.createJob({
      tenantId: "tenant-1",
      siteId: "site-1",
      sourceLocale: "en",
      targetLocale: "es",
      createdBy: "user-1",
    });

    expect(prisma.translationJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        autoPublish: true,
      }),
    });
    expect(result.autoPublish).toBe(true);
  });

  it("passes the requested source locale through to DeepL", async () => {
    const prisma = buildPrismaMock();
    const billing = {
      assertCanConsumeTranslationCharacters: jest.fn(),
    };
    const deepl = {
      isConfigured: jest.fn().mockReturnValue(true),
      translate: jest.fn().mockResolvedValue({
        translations: [
          { text: "Willkommen", detectedSourceLang: "FR" },
          { text: "Startseite", detectedSourceLang: "FR" },
        ],
        charactersConsumed: 15,
      }),
    };
    const revalidation = {
      revalidatePage: jest.fn().mockResolvedValue(undefined),
    };

    prisma.page.findFirst.mockResolvedValue(null);
    prisma.page.create.mockResolvedValue({ id: "page-target-1" });
    prisma.pageTranslationMeta.create.mockResolvedValue({ id: "meta-1" });

    const service = new TranslationService(
      prisma as never,
      billing as never,
      deepl as never,
      revalidation as never,
    );

    const translatePage = (
      service as unknown as {
        translatePage: (
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
        ) => Promise<number>;
      }
    ).translatePage.bind(service);

    await translatePage(
      {
        siteId: "site-1",
        sourceLocale: "fr",
        targetLocale: "de",
        overwrite: false,
        autoPublish: false,
      },
      {
        id: "page-source-1",
        slug: "home",
        title: "Accueil",
        puckData: {
          hero: {
            heading: "Bonjour",
          },
        },
        seoTitle: null,
        seoDescription: null,
      },
      "job-1",
    );

    expect(deepl.translate).toHaveBeenCalledWith({
      texts: ["Bonjour", "Accueil"],
      sourceLang: "fr",
      targetLang: "de",
    });
  });

  it("revalidates translated pages when auto-publish is enabled", async () => {
    const prisma = buildPrismaMock();
    const billing = {
      assertCanConsumeTranslationCharacters: jest.fn(),
    };
    const deepl = {
      isConfigured: jest.fn().mockReturnValue(true),
      translate: jest.fn().mockResolvedValue({
        translations: [
          { text: "Hola", detectedSourceLang: "EN" },
          { text: "Inicio", detectedSourceLang: "EN" },
        ],
        charactersConsumed: 9,
      }),
    };
    const revalidation = {
      revalidatePage: jest.fn().mockResolvedValue(undefined),
    };

    prisma.page.findFirst.mockResolvedValue(null);
    prisma.page.create.mockResolvedValue({ id: "page-target-1" });
    prisma.pageTranslationMeta.create.mockResolvedValue({ id: "meta-1" });

    const service = new TranslationService(
      prisma as never,
      billing as never,
      deepl as never,
      revalidation as never,
    );

    const translatePage = (
      service as unknown as {
        translatePage: (
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
        ) => Promise<number>;
      }
    ).translatePage.bind(service);

    await translatePage(
      {
        siteId: "site-1",
        sourceLocale: "en",
        targetLocale: "es",
        overwrite: false,
        autoPublish: true,
      },
      {
        id: "page-source-1",
        slug: "home",
        title: "Home",
        puckData: {
          hero: {
            heading: "Hello",
          },
        },
        seoTitle: null,
        seoDescription: null,
      },
      "job-1",
    );

    expect(revalidation.revalidatePage).toHaveBeenCalledWith("site-1", "home");
  });

  it("computes locale coverage from the site's actual slug footprint", async () => {
    const prisma = buildPrismaMock();
    const billing = {
      assertCanConsumeTranslationCharacters: jest.fn(),
    };
    const deepl = {
      isConfigured: jest.fn().mockReturnValue(true),
    };
    const revalidation = {
      revalidatePage: jest.fn().mockResolvedValue(undefined),
    };

    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      primaryLocale: "es",
      enabledLocales: ["en", "es"],
    });
    prisma.page.findMany.mockResolvedValue([
      { slug: "home" },
      { slug: "pricing" },
      { slug: "contact" },
    ]);
    prisma.page.count.mockResolvedValueOnce(3).mockResolvedValueOnce(3);
    prisma.pageTranslationMeta.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const service = new TranslationService(
      prisma as never,
      billing as never,
      deepl as never,
      revalidation as never,
    );

    await expect(service.getLocaleCompleteness("site-1")).resolves.toEqual([
      { locale: "en", total: 3, translated: 3, stale: 0 },
      { locale: "es", total: 3, translated: 3, stale: 0 },
    ]);
  });
});
