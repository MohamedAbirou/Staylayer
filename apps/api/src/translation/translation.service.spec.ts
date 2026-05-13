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
      update: jest.fn(),
    },
    translationJob: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pageTranslationMeta: {
      create: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    translationGlossaryTerm: {
      findMany: jest.fn(),
    },
    translationProviderGlossary: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    translationUsage: {
      create: jest.fn(),
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

  it("rejects selected pages that are outside the chosen source locale", async () => {
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

    const service = new TranslationService(
      prisma as never,
      billing as never,
      deepl as never,
      revalidation as never,
    );

    await expect(
      service.createJob({
        tenantId: "tenant-1",
        siteId: "site-1",
        sourceLocale: "en",
        targetLocale: "es",
        pageIds: ["page-source-1", "page-source-2"],
        createdBy: "user-1",
      }),
    ).rejects.toThrow(
      "Some selected pages were not found in the chosen source locale",
    );

    expect(prisma.translationJob.create).not.toHaveBeenCalled();
  });

  it("captures a published-only page snapshot for translation jobs", async () => {
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
        id: "page-published-1",
        puckData: {
          hero: {
            heading: "Hello",
          },
        },
      },
      {
        id: "page-published-2",
        puckData: {
          hero: {
            heading: "Pricing",
          },
        },
      },
    ]);
    prisma.translationJob.create.mockResolvedValue({
      id: "job-2",
      tenantId: "tenant-1",
      siteId: "site-1",
      sourceLocale: "en",
      targetLocale: "es",
      status: TranslationJobStatus.QUEUED,
      totalPages: 2,
      completedPages: 0,
      failedPages: 0,
      charactersUsed: 0,
      overwrite: false,
      autoPublish: true,
      error: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date("2026-05-13T10:00:00.000Z"),
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

    await service.createJob({
      tenantId: "tenant-1",
      siteId: "site-1",
      sourceLocale: "en",
      targetLocale: "es",
      publishedOnly: true,
      createdBy: "user-1",
    });

    expect(prisma.page.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        siteId: "site-1",
        locale: "en",
        deletedAt: null,
        published: true,
      }),
    });
    expect(prisma.translationJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pageIds: ["page-published-1", "page-published-2"],
        totalPages: 2,
      }),
    });
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
          glossaryContext: { entryCount: number; deeplGlossaryId?: string },
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
      { entryCount: 0 },
    );

    expect(deepl.translate).toHaveBeenCalledWith({
      texts: ["Bonjour", "Accueil"],
      sourceLang: "fr",
      targetLang: "de",
      glossaryId: undefined,
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
          glossaryContext: { entryCount: number; deeplGlossaryId?: string },
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
      { entryCount: 0 },
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

  it("applies matching glossary terms to translation batches", async () => {
    const prisma = buildPrismaMock();
    const billing = {
      assertCanConsumeTranslationCharacters: jest.fn(),
    };
    const deepl = {
      isConfigured: jest.fn().mockReturnValue(true),
      createGlossary: jest.fn().mockResolvedValue({
        glossaryId: "deepl-glossary-1",
        name: "staylayer-site-1-en-es",
        sourceLang: "EN",
        targetLang: "ES",
        entryCount: 2,
      }),
      translate: jest.fn().mockResolvedValue({
        translations: [
          { text: "StayLayer Hotels", detectedSourceLang: "EN" },
          { text: "Inicio", detectedSourceLang: "EN" },
        ],
        charactersConsumed: 19,
      }),
    };
    const revalidation = {
      revalidatePage: jest.fn().mockResolvedValue(undefined),
    };

    prisma.translationJob.findUnique.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-1",
      siteId: "site-1",
      sourceLocale: "en",
      targetLocale: "es",
      pageIds: null,
      overwrite: false,
      autoPublish: false,
    });
    prisma.page.findMany.mockResolvedValue([
      {
        id: "page-source-1",
        slug: "home",
        title: "Home",
        puckData: {
          hero: {
            heading: "StayLayer",
          },
        },
        seoTitle: null,
        seoDescription: null,
      },
    ]);
    prisma.translationGlossaryTerm.findMany.mockResolvedValue([
      {
        sourceTerm: "StayLayer",
        targetTerm: "StayLayer Hotels",
        caseSensitive: false,
        glossary: {
          id: "glossary-site",
          name: "Site terms",
          siteId: "site-1",
        },
      },
      {
        sourceTerm: "StayLayer",
        targetTerm: "StayLayer Global",
        caseSensitive: false,
        glossary: {
          id: "glossary-global",
          name: "Global terms",
          siteId: null,
        },
      },
      {
        sourceTerm: "Home",
        targetTerm: "Inicio",
        caseSensitive: false,
        glossary: {
          id: "glossary-global",
          name: "Global terms",
          siteId: null,
        },
      },
    ]);
    prisma.page.findFirst.mockResolvedValue(null);
    prisma.page.create.mockResolvedValue({ id: "page-target-1" });
    prisma.pageTranslationMeta.create.mockResolvedValue({ id: "meta-1" });
    prisma.translationJob.update.mockResolvedValue(undefined);
    prisma.translationProviderGlossary.findUnique.mockResolvedValue(null);
    prisma.translationProviderGlossary.upsert.mockResolvedValue({
      id: "provider-glossary-1",
    });
    prisma.translationUsage.create.mockResolvedValue({ id: "usage-1" });

    const service = new TranslationService(
      prisma as never,
      billing as never,
      deepl as never,
      revalidation as never,
    );

    await (
      service as unknown as { processJob: (jobId: string) => Promise<void> }
    ).processJob("job-1");

    expect(prisma.translationGlossaryTerm.findMany).toHaveBeenCalledWith({
      where: {
        sourceLocale: { equals: "en", mode: "insensitive" },
        targetLocale: { equals: "es", mode: "insensitive" },
        glossary: {
          tenantId: "tenant-1",
          OR: [{ siteId: "site-1" }, { siteId: null }],
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
    expect(deepl.createGlossary).toHaveBeenCalledWith({
      name: expect.stringContaining("staylayer-site-1-en-es-"),
      sourceLang: "en",
      targetLang: "es",
      entries: [
        { source: "StayLayer", target: "StayLayer Hotels" },
        { source: "Home", target: "Inicio" },
      ],
    });
    expect(deepl.translate).toHaveBeenCalledWith({
      texts: ["StayLayer", "Home"],
      sourceLang: "en",
      targetLang: "es",
      glossaryId: "deepl-glossary-1",
    });
    expect(prisma.translationProviderGlossary.upsert).toHaveBeenCalledWith({
      where: {
        siteId_provider_sourceLocale_targetLocale: {
          siteId: "site-1",
          provider: "deepl",
          sourceLocale: "en",
          targetLocale: "es",
        },
      },
      create: expect.objectContaining({
        siteId: "site-1",
        provider: "deepl",
        providerGlossaryId: "deepl-glossary-1",
        entryCount: 2,
        isStale: false,
      }),
      update: expect.objectContaining({
        providerGlossaryId: "deepl-glossary-1",
        entryCount: 2,
        isStale: false,
      }),
    });
    expect(prisma.translationUsage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: {
          jobId: "job-1",
          glossaryEntriesApplied: 2,
        },
      }),
    });
  });

  it("reuses a synced provider glossary when the preview hash matches", async () => {
    const prisma = buildPrismaMock();
    const billing = {
      assertCanConsumeTranslationCharacters: jest.fn(),
    };
    const deepl = {
      isConfigured: jest.fn().mockReturnValue(true),
      createGlossary: jest.fn(),
      translate: jest.fn().mockResolvedValue({
        translations: [
          { text: "StayLayer Hotels", detectedSourceLang: "EN" },
          { text: "Inicio", detectedSourceLang: "EN" },
        ],
        charactersConsumed: 19,
      }),
    };
    const revalidation = {
      revalidatePage: jest.fn().mockResolvedValue(undefined),
    };

    prisma.translationJob.findUnique.mockResolvedValue({
      id: "job-1",
      tenantId: "tenant-1",
      siteId: "site-1",
      sourceLocale: "en",
      targetLocale: "es",
      pageIds: null,
      overwrite: false,
      autoPublish: false,
    });
    prisma.page.findMany.mockResolvedValue([
      {
        id: "page-source-1",
        slug: "home",
        title: "Home",
        puckData: {
          hero: {
            heading: "StayLayer",
          },
        },
        seoTitle: null,
        seoDescription: null,
      },
    ]);
    prisma.translationGlossaryTerm.findMany.mockResolvedValue([
      {
        sourceTerm: "StayLayer",
        targetTerm: "StayLayer Hotels",
        caseSensitive: false,
        glossary: {
          id: "glossary-site",
          name: "Site terms",
          siteId: "site-1",
        },
      },
      {
        sourceTerm: "Home",
        targetTerm: "Inicio",
        caseSensitive: false,
        glossary: {
          id: "glossary-global",
          name: "Global terms",
          siteId: null,
        },
      },
    ]);
    prisma.translationProviderGlossary.findUnique.mockResolvedValue({
      providerGlossaryId: "deepl-synced-1",
      entriesHash: "bcb997eb3647bfe4d6e0c2387014f859",
      isStale: false,
      lastSyncedAt: new Date("2026-05-13T12:00:00.000Z"),
    });
    prisma.page.findFirst.mockResolvedValue(null);
    prisma.page.create.mockResolvedValue({ id: "page-target-1" });
    prisma.pageTranslationMeta.create.mockResolvedValue({ id: "meta-1" });
    prisma.translationJob.update.mockResolvedValue(undefined);
    prisma.translationUsage.create.mockResolvedValue({ id: "usage-1" });

    const service = new TranslationService(
      prisma as never,
      billing as never,
      deepl as never,
      revalidation as never,
    );

    await (
      service as unknown as { processJob: (jobId: string) => Promise<void> }
    ).processJob("job-1");

    expect(deepl.createGlossary).not.toHaveBeenCalled();
    expect(deepl.translate).toHaveBeenCalledWith({
      texts: ["StayLayer", "Home"],
      sourceLang: "en",
      targetLang: "es",
      glossaryId: "deepl-synced-1",
    });
  });

  it("returns a glossary preview with site precedence and sync status", async () => {
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

    prisma.translationGlossaryTerm.findMany.mockResolvedValue([
      {
        sourceTerm: "StayLayer",
        targetTerm: "StayLayer Hotels",
        caseSensitive: false,
        glossary: {
          id: "glossary-site",
          name: "Site terms",
          siteId: "site-1",
        },
      },
      {
        sourceTerm: "StayLayer",
        targetTerm: "StayLayer Global",
        caseSensitive: false,
        glossary: {
          id: "glossary-global",
          name: "Global terms",
          siteId: null,
        },
      },
      {
        sourceTerm: "Home",
        targetTerm: "Inicio",
        caseSensitive: true,
        glossary: {
          id: "glossary-global",
          name: "Global terms",
          siteId: null,
        },
      },
    ]);
    prisma.translationProviderGlossary.findUnique.mockResolvedValue({
      providerGlossaryId: "deepl-synced-1",
      entriesHash: "bcb997eb3647bfe4d6e0c2387014f859",
      isStale: false,
      lastSyncedAt: new Date("2026-05-13T12:00:00.000Z"),
    });

    const service = new TranslationService(
      prisma as never,
      billing as never,
      deepl as never,
      revalidation as never,
    );

    await expect(
      service.getGlossaryPreview("tenant-1", "site-1", "en", "es"),
    ).resolves.toEqual({
      sourceLocale: "en",
      targetLocale: "es",
      entryCount: 2,
      siteSpecificCount: 1,
      globalCount: 1,
      providerStatus: "ready",
      lastSyncedAt: "2026-05-13T12:00:00.000Z",
      entries: [
        {
          source: "StayLayer",
          target: "StayLayer Hotels",
          scope: "site",
          glossaryId: "glossary-site",
          glossaryName: "Site terms",
          caseSensitive: false,
        },
        {
          source: "Home",
          target: "Inicio",
          scope: "global",
          glossaryId: "glossary-global",
          glossaryName: "Global terms",
          caseSensitive: true,
        },
      ],
    });
  });
});
