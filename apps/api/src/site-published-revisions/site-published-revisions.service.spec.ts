/// <reference types="jest" />

import { NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { SitePublishedRevisionsService } from "./site-published-revisions.service";

describe("SitePublishedRevisionsService", () => {
  let service: SitePublishedRevisionsService;
  let prisma: {
    site: { findUnique: jest.Mock; update: jest.Mock };
    page: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    siteSettings: { findUnique: jest.Mock; upsert: jest.Mock };
    sitePublishedRevision: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      site: { findUnique: jest.fn(), update: jest.fn() },
      page: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      siteSettings: { findUnique: jest.fn(), upsert: jest.fn() },
      sitePublishedRevision: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    // Run the transaction callback against the same prisma mock by default.
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => unknown) => fn(prisma),
    );

    service = new SitePublishedRevisionsService(
      prisma as unknown as PrismaService,
    );
  });

  it("captures a snapshot of published pages and settings and increments the revision", async () => {
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      publishedRevision: 3,
    });
    prisma.page.findMany.mockResolvedValue([
      {
        slug: "home",
        locale: "en",
        title: "Home",
        puckData: { root: {}, content: [] },
        seoTitle: "Home",
        seoDescription: null,
        seoKeywords: null,
        seoOgImage: null,
        seoCanonical: null,
        seoNoindex: false,
      },
    ]);
    prisma.siteSettings.findUnique.mockResolvedValue({
      siteName: "Sunset",
      siteSubtitle: "",
      supportEmail: "",
      publicPhone: "",
      whatsAppUrl: "",
      address: "",
      region: "",
      primaryCtaLabel: "",
      defaultInquiryRoutingEmail: "",
      inquiryWebhookUrl: "",
      inquiryWebhookSecret: "",
      logoUrl: "",
      faviconUrl: "",
      seoTitleTemplate: "",
      seoDefaultDesc: "",
      seoOgImage: "",
      seoIndexingEnabled: true,
      googleSiteVerify: "",
      gaTrackingId: "",
      gtmContainerId: "",
      clarityId: "",
      twitterHandle: "",
      linkedinUrl: "",
      facebookUrl: "",
      defaultLocale: "en",
      activeLocales: ["en"],
    });
    prisma.site.update.mockResolvedValue({ publishedRevision: 4 });
    prisma.sitePublishedRevision.create.mockResolvedValue({
      id: "rev-4",
      revision: 4,
      createdAt: new Date("2026-05-13T20:00:01.000Z"),
    });

    const result = await service.captureSnapshot("site-1", {
      deploymentId: "dep-1",
    });

    expect(result).toEqual({
      id: "rev-4",
      revision: 4,
      createdAt: new Date("2026-05-13T20:00:01.000Z"),
    });
    expect(prisma.site.update).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: { publishedRevision: { increment: 1 } },
      select: { publishedRevision: true },
    });
    expect(prisma.sitePublishedRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          siteId: "site-1",
          revision: 4,
          deploymentId: "dep-1",
          rolledBackFrom: null,
        }),
      }),
    );
  });

  it("throws SITE_NOT_FOUND when capturing for a missing site", async () => {
    prisma.site.findUnique.mockResolvedValue(null);
    await expect(service.captureSnapshot("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("restores published pages from a target revision and re-snapshots the result", async () => {
    prisma.sitePublishedRevision.findUnique.mockResolvedValue({
      id: "rev-2",
      siteId: "site-1",
      revision: 2,
      pagesSnapshot: [
        {
          slug: "home",
          locale: "en",
          title: "Home v2",
          puckData: { root: {}, content: [] },
          seoTitle: null,
          seoDescription: null,
          seoKeywords: null,
          seoOgImage: null,
          seoCanonical: null,
          seoNoindex: false,
        },
      ],
      settingsSnapshot: null,
    });
    // Pages currently published but not in snapshot:
    prisma.page.findMany
      .mockResolvedValueOnce([
        { id: "page-home", slug: "home", locale: "en" },
        { id: "page-about", slug: "about", locale: "en" },
      ])
      .mockResolvedValueOnce([
        {
          slug: "home",
          locale: "en",
          title: "Home v2",
          puckData: { root: {}, content: [] },
          seoTitle: null,
          seoDescription: null,
          seoKeywords: null,
          seoOgImage: null,
          seoCanonical: null,
          seoNoindex: false,
        },
      ]);
    prisma.page.findUnique.mockResolvedValue({ id: "page-home" });
    prisma.page.update.mockResolvedValue({});
    prisma.page.updateMany.mockResolvedValue({ count: 1 });
    prisma.siteSettings.findUnique.mockResolvedValue(null);
    prisma.site.update.mockResolvedValue({ publishedRevision: 5 });
    prisma.sitePublishedRevision.create.mockResolvedValue({
      id: "rev-5",
      revision: 5,
      createdAt: new Date("2026-05-13T21:00:00.000Z"),
    });

    const result = await service.restoreToRevision("site-1", 2, {
      deploymentId: "dep-rollback",
    });

    expect(result).toEqual({
      id: "rev-5",
      revision: 5,
      createdAt: new Date("2026-05-13T21:00:00.000Z"),
    });
    // Drafts not in snapshot should be unpublished, not deleted.
    expect(prisma.page.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["page-about"] } },
      data: { published: false },
    });
    expect(prisma.sitePublishedRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          siteId: "site-1",
          revision: 5,
          deploymentId: "dep-rollback",
          rolledBackFrom: 2,
        }),
      }),
    );
  });

  it("throws REVISION_NOT_FOUND when restoring an unknown revision", async () => {
    prisma.sitePublishedRevision.findUnique.mockResolvedValue(null);
    await expect(
      service.restoreToRevision("site-1", 999),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
