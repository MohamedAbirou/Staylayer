/// <reference types="jest" />

import { SettingsService } from "./settings.service";

function buildSettingsRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "settings-1",
    siteName: "Azure Bay Liam",
    supportEmail: "",
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
    activeLocales: ["en", "es"],
    updatedAt: new Date("2026-05-12T23:45:00.000Z"),
    updatedBy: "owner@example.com",
    ...overrides,
  };
}

function buildPrismaMock() {
  const prisma = {
    $transaction: jest.fn(),
    site: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    siteSettings: {
      upsert: jest.fn(),
    },
    deployment: {
      findFirst: jest.fn(),
    },
  };

  prisma.$transaction.mockImplementation(
    async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
  );

  return prisma;
}

describe("SettingsService", () => {
  it("triggers a new deployment when locale configuration changes", async () => {
    const prisma = buildPrismaMock();
    const billingService = {
      assertCanUpdateSiteLocales: jest.fn().mockResolvedValue(undefined),
    };
    const configService = {
      get: jest.fn(),
    };
    const deploymentsService = {
      provisionSite: jest.fn().mockResolvedValue({ id: "dep-2" }),
    };

    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      primaryLocale: "en",
      enabledLocales: ["en"],
    });
    prisma.siteSettings.upsert.mockResolvedValue(buildSettingsRecord());
    prisma.deployment.findFirst.mockResolvedValue({ id: "dep-1" });

    const service = new SettingsService(
      prisma as never,
      billingService as never,
      configService as never,
      deploymentsService as never,
    );

    const result = await service.update(
      "site-1",
      { activeLocales: ["en", "es"] },
      "owner@example.com",
    );

    expect(billingService.assertCanUpdateSiteLocales).toHaveBeenCalledWith(
      "site-1",
      ["en", "es"],
    );
    expect(prisma.site.update).toHaveBeenCalledWith({
      where: { id: "site-1" },
      data: {
        enabledLocales: ["en", "es"],
        primaryLocale: undefined,
      },
    });
    expect(deploymentsService.provisionSite).toHaveBeenCalledWith("site-1");
    expect(result.activeLocales).toEqual(["en", "es"]);
  });
});
