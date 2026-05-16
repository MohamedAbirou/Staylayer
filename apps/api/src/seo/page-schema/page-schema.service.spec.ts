import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PageSchemaService } from "./page-schema.service";

const makePrisma = () => ({
  page: {
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  site: {
    findUnique: jest.fn(),
  },
  domain: {
    findFirst: jest.fn().mockResolvedValue(null),
  },
});

const makeSeo = () => ({
  generateJsonLd: jest.fn().mockResolvedValue(null),
  generatePageTypeJsonLd: jest.fn().mockResolvedValue([]),
  getEnabledSchemas: jest.fn().mockResolvedValue(["BreadcrumbList"]),
});

const pageRow = {
  id: "p1",
  slug: "rooms",
  locale: "en",
  title: "Rooms",
  puckData: {},
  jsonLdOverride: null,
};

const siteRow = {
  id: "s1",
  name: "Site",
  primaryLocale: "en",
  enabledLocales: ["en"],
  publicSubdomain: "demo",
  settings: {
    siteName: "Demo",
    logoUrl: null,
    defaultLocale: "en",
    activeLocales: ["en"],
    facebookUrl: null,
    linkedinUrl: null,
    instagramUrl: null,
    youtubeUrl: null,
    tiktokUrl: null,
    pinterestUrl: null,
  },
};

describe("PageSchemaService", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let seo: ReturnType<typeof makeSeo>;
  let service: PageSchemaService;

  beforeEach(() => {
    prisma = makePrisma();
    seo = makeSeo();
    service = new PageSchemaService(
      prisma as never,
      seo as never,
    );
  });

  describe("getOverride", () => {
    it("returns EMPTY_OVERRIDE-shape when page.jsonLdOverride is null", async () => {
      prisma.page.findFirst.mockResolvedValue(pageRow);
      const r = await service.getOverride("s1", {
        slug: "rooms",
        locale: "en",
      });
      expect(r).toEqual({ mode: "merge", disabledTypes: [], customNodes: [] });
    });

    it("throws on unknown locale", async () => {
      await expect(
        service.getOverride("s1", { slug: "rooms", locale: "zz" }),
      ).rejects.toThrow();
    });

    it("throws when page not found", async () => {
      prisma.page.findFirst.mockResolvedValue(null);
      await expect(
        service.getOverride("s1", { slug: "missing", locale: "en" }),
      ).rejects.toThrow();
    });
  });

  describe("upsertOverride", () => {
    it("writes Prisma.JsonNull for empty override", async () => {
      prisma.page.findFirst.mockResolvedValue(pageRow);
      await service.upsertOverride(
        "s1",
        { slug: "rooms", locale: "en" },
        { mode: "merge", disabledTypes: [], customNodes: [] },
      );
      expect(prisma.page.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { jsonLdOverride: Prisma.JsonNull },
        }),
      );
    });

    it("writes object for non-empty override", async () => {
      prisma.page.findFirst.mockResolvedValue(pageRow);
      await service.upsertOverride(
        "s1",
        { slug: "rooms", locale: "en" },
        { mode: "replace", customNodes: [{ "@type": "Article" }] },
      );
      const call = prisma.page.update.mock.calls[0][0];
      expect(call.data.jsonLdOverride).toEqual({
        mode: "replace",
        disabledTypes: [],
        customNodes: [{ "@type": "Article" }],
      });
    });

    it("throws TOO_MANY_NODES when customNodes exceeds MAX_CUSTOM_NODES", async () => {
      prisma.page.findFirst.mockResolvedValue(pageRow);
      const tooMany = Array.from({ length: 31 }, () => ({ "@type": "X" }));
      await expect(
        service.upsertOverride(
          "s1",
          { slug: "rooms", locale: "en" },
          { customNodes: tooMany },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("throws OVERRIDE_TOO_LARGE for >64KB payloads", async () => {
      prisma.page.findFirst.mockResolvedValue(pageRow);
      const big = "x".repeat(70_000);
      await expect(
        service.upsertOverride(
          "s1",
          { slug: "rooms", locale: "en" },
          { customNodes: [{ "@type": "Article", text: big }] },
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe("clearOverride", () => {
    it("writes JsonNull and returns empty override", async () => {
      prisma.page.findFirst.mockResolvedValue(pageRow);
      const r = await service.clearOverride("s1", {
        slug: "rooms",
        locale: "en",
      });
      expect(prisma.page.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { jsonLdOverride: Prisma.JsonNull },
        }),
      );
      expect(r).toEqual({ mode: "merge", disabledTypes: [], customNodes: [] });
    });
  });

  describe("buildPreview", () => {
    it("builds auto graph + merges override", async () => {
      prisma.page.findFirst.mockResolvedValue({
        ...pageRow,
        jsonLdOverride: {
          mode: "merge",
          disabledTypes: [],
          customNodes: [{ "@type": "FAQPage", mainEntity: [] }],
        },
      });
      prisma.site.findUnique.mockResolvedValue(siteRow);

      const r = await service.buildPreview("s1", {
        slug: "rooms",
        locale: "en",
      });
      expect(r.page.id).toBe("p1");
      expect(r.merged.length).toBeGreaterThanOrEqual(r.auto.length);
      expect(r.override.customNodes).toEqual([
        { "@type": "FAQPage", mainEntity: [] },
      ]);
    });

    it("applies override override when provided", async () => {
      prisma.page.findFirst.mockResolvedValue(pageRow);
      prisma.site.findUnique.mockResolvedValue(siteRow);
      const r = await service.buildPreview(
        "s1",
        { slug: "rooms", locale: "en" },
        { mode: "replace", customNodes: [{ "@type": "Article" }] },
      );
      expect(r.merged).toEqual([{ "@type": "Article" }]);
    });
  });

  describe("testRuntime", () => {
    it("returns informative error when no canonical host", async () => {
      prisma.site.findUnique.mockResolvedValue({
        ...siteRow,
        publicSubdomain: null,
      });
      prisma.domain.findFirst.mockResolvedValue(null);
      const r = await service.testRuntime("s1", {
        slug: "rooms",
        locale: "en",
      });
      expect(r.fetched).toBe(false);
      expect(r.error).toMatch(/canonical host/i);
    });
  });

  describe("validateNodes", () => {
    it("delegates to validator", () => {
      const r = service.validateNodes([
        { "@context": "https://schema.org", "@type": "WebSite" },
      ]);
      expect(r.bySeverity.ERROR).toBe(0);
    });
  });
});
