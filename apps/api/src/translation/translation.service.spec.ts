/// <reference types="jest" />

import { TranslationService } from "./translation.service";

function buildPrismaMock() {
  return {
    page: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    pageTranslationMeta: {
      create: jest.fn(),
    },
  };
}

describe("TranslationService", () => {
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

    prisma.page.findFirst.mockResolvedValue(null);
    prisma.page.create.mockResolvedValue({ id: "page-target-1" });
    prisma.pageTranslationMeta.create.mockResolvedValue({ id: "meta-1" });

    const service = new TranslationService(
      prisma as never,
      billing as never,
      deepl as never,
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
});
