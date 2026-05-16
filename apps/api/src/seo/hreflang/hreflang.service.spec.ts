import { HreflangScanStatus } from "@prisma/client";

import { HreflangScanService } from "./hreflang.service";

type PrismaMock = {
  site: { findUnique: jest.Mock };
  page: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock };
  pageVersion: { create: jest.Mock };
  pageTranslationMeta: { create: jest.Mock };
  hreflangScan: {
    create: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  hreflangIssue: {
    createMany: jest.Mock;
    findMany: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
  };
};

const makePrisma = (): PrismaMock => ({
  site: { findUnique: jest.fn() },
  page: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  pageVersion: { create: jest.fn() },
  pageTranslationMeta: { create: jest.fn().mockResolvedValue({}) },
  hreflangScan: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
  },
  hreflangIssue: {
    createMany: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
});

const makeBilling = () => ({
  assertCanIncreasePageCount: jest.fn().mockResolvedValue(undefined),
});

describe("HreflangScanService", () => {
  let prisma: PrismaMock;
  let billing: ReturnType<typeof makeBilling>;
  let service: HreflangScanService;

  beforeEach(() => {
    prisma = makePrisma();
    billing = makeBilling();
    service = new HreflangScanService(prisma as never, billing as never);
  });

  it("runScan persists a COMPLETED scan with rolled-up counts and writes issues", async () => {
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      primaryLocale: "en",
      enabledLocales: ["en", "fr"],
      settings: { defaultLocale: "en", activeLocales: ["en", "fr", "de"] },
    });
    prisma.hreflangScan.create.mockResolvedValue({
      id: "scan-1",
      siteId: "site-1",
      status: HreflangScanStatus.RUNNING,
    });
    prisma.page.findMany.mockResolvedValue([
      { id: "p1", slug: "home", locale: "en", published: true },
      { id: "p2", slug: "home", locale: "fr", published: true },
      // "de" missing — should produce one MISSING_LOCALE warning.
    ]);
    prisma.hreflangIssue.createMany.mockResolvedValue({ count: 1 });
    prisma.hreflangScan.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: "scan-1", ...data }),
    );

    const result = await service.runScan("site-1", {
      triggeredBy: "user-1",
    });

    expect(prisma.hreflangIssue.createMany).toHaveBeenCalledTimes(1);
    const issueArgs = prisma.hreflangIssue.createMany.mock.calls[0][0]
      .data as Array<{ type: string; locale: string | null }>;
    expect(issueArgs).toHaveLength(1);
    expect(issueArgs[0].type).toBe("MISSING_LOCALE");
    expect(issueArgs[0].locale).toBe("de");

    expect(prisma.hreflangScan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "scan-1" },
        data: expect.objectContaining({
          status: HreflangScanStatus.COMPLETED,
          totalSlugs: 1,
          totalPages: 2,
          warningCount: 1,
          errorCount: 0,
        }),
      }),
    );
    expect(result.scan.status).toBe(HreflangScanStatus.COMPLETED);
  });

  it("runScan marks the scan FAILED when page lookup throws", async () => {
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      primaryLocale: "en",
      enabledLocales: ["en"],
      settings: { defaultLocale: "en", activeLocales: ["en"] },
    });
    prisma.hreflangScan.create.mockResolvedValue({
      id: "scan-fail",
      siteId: "site-1",
    });
    prisma.page.findMany.mockRejectedValue(new Error("db down"));
    prisma.hreflangScan.update.mockResolvedValue({});

    await expect(service.runScan("site-1")).rejects.toThrow("db down");
    expect(prisma.hreflangScan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "scan-fail" },
        data: expect.objectContaining({
          status: HreflangScanStatus.FAILED,
          failureReason: "db down",
        }),
      }),
    );
  });

  it("bulkCreateStubs copies source page puckData, skips existing locales, and pre-checks plan", async () => {
    prisma.site.findUnique.mockResolvedValue({
      primaryLocale: "en",
      settings: { defaultLocale: "en" },
    });
    prisma.page.findMany.mockResolvedValue([
      {
        id: "src-en",
        slug: "spa",
        locale: "en",
        title: "Spa",
        puckData: { content: [], root: { props: {} } },
        published: true,
        seoTitle: null,
        seoDescription: null,
        targetKeywords: null,
        internalBrief: null,
        seoOgImage: null,
      },
    ]);
    prisma.page.findUnique.mockImplementation(({ where }) => {
      const w = where.siteId_slug_locale as {
        siteId: string;
        slug: string;
        locale: string;
      };
      if (w.locale === "de") {
        return Promise.resolve({ id: "existing-de" });
      }
      return Promise.resolve(null);
    });
    prisma.page.create.mockResolvedValue({ id: "new-fr" });
    prisma.pageVersion.create.mockResolvedValue({});

    const result = await service.bulkCreateStubs("site-1", {
      pairs: [
        { slug: "spa", locale: "fr" },
        { slug: "spa", locale: "de" },
        { slug: "missing-slug", locale: "fr" },
      ],
      triggeredBy: "user-1",
    });

    expect(billing.assertCanIncreasePageCount).toHaveBeenCalledWith(
      "site-1",
      3,
    );
    expect(result.created).toEqual([
      { slug: "spa", locale: "fr", pageId: "new-fr" },
    ]);
    expect(result.skipped.find((s) => s.locale === "de")?.reason).toBe(
      "already_exists",
    );
    expect(result.skipped.find((s) => s.slug === "missing-slug")?.reason).toBe(
      "no_source_page",
    );
    expect(prisma.page.create).toHaveBeenCalledTimes(1);
    expect(prisma.pageVersion.create).toHaveBeenCalledTimes(1);
  });

  it("dismissIssue marks an issue dismissed and is idempotent", async () => {
    prisma.hreflangIssue.findFirst.mockResolvedValue({
      id: "i1",
      siteId: "site-1",
      dismissedAt: null,
    });
    prisma.hreflangIssue.update.mockResolvedValue({
      id: "i1",
      dismissedAt: new Date(),
    });
    const out = await service.dismissIssue("site-1", "i1", "user-1");
    expect(prisma.hreflangIssue.update).toHaveBeenCalledTimes(1);
    expect(out.dismissedAt).toBeDefined();

    // already dismissed
    prisma.hreflangIssue.findFirst.mockResolvedValue({
      id: "i1",
      siteId: "site-1",
      dismissedAt: new Date(),
    });
    prisma.hreflangIssue.update.mockClear();
    const again = await service.dismissIssue("site-1", "i1", "user-1");
    expect(prisma.hreflangIssue.update).not.toHaveBeenCalled();
    expect(again.dismissedAt).toBeDefined();
  });
});
