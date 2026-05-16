import { ImageAltQuality } from "@prisma/client";
import { ImageAuditService } from "./image-audit.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { SitemapService } from "../sitemap/sitemap.service";

function buildService() {
  const prisma = {
    seoCrawlJob: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    seoCrawlUrlResult: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    seoCrawlImageFinding: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(async (ops: unknown[]) => ops),
  } as unknown as PrismaService;
  const sitemap = {
    preview: jest.fn(),
  } as unknown as SitemapService;
  return {
    service: new ImageAuditService(prisma, sitemap),
    prisma,
    sitemap,
  };
}

describe("ImageAuditService", () => {
  describe("loadSitemapImageSet", () => {
    it("returns normalized URLs from sitemap preview", async () => {
      const { service, sitemap } = buildService();
      (sitemap.preview as jest.Mock).mockResolvedValue({
        routes: [
          {
            images: [
              "https://example.com/img/a.jpg",
              "https://example.com/img/b.jpg?v=2",
            ],
          },
          { images: ["https://EXAMPLE.com/img/a.jpg"] },
        ],
      });
      const set = await service.loadSitemapImageSet("site1");
      expect(set.has("https://example.com/img/a.jpg")).toBe(true);
      expect(set.has("https://example.com/img/b.jpg")).toBe(true);
      expect(set.size).toBe(2);
    });

    it("returns empty set when sitemap throws", async () => {
      const { service, sitemap } = buildService();
      (sitemap.preview as jest.Mock).mockRejectedValue(new Error("nope"));
      const set = await service.loadSitemapImageSet("site1");
      expect(set.size).toBe(0);
    });
  });

  describe("analyzePage", () => {
    it("emits synthetic og_missing finding when og:image is null", () => {
      const { service } = buildService();
      const result = service.analyzePage(
        { pageUrl: "https://x", images: [], ogImage: null },
        new Set(),
      );
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].flags).toContain("og_missing");
      expect(result.findings[0].isOgImage).toBe(true);
    });

    it("matches og:image with rendered <img>", () => {
      const { service } = buildService();
      const result = service.analyzePage(
        {
          pageUrl: "https://x",
          ogImage: "https://example.com/og.jpg",
          images: [
            {
              src: "https://example.com/og.jpg",
              alt: "Hero photo of property",
              width: 1200,
              height: 630,
              loading: null,
              hasSrcset: false,
            },
          ],
        },
        new Set(["https://example.com/og.jpg"]),
      );
      const og = result.findings.find((f) => f.isOgImage);
      expect(og).toBeDefined();
      expect(og?.altQuality).toBe(ImageAltQuality.GOOD);
      expect(og?.flags).toEqual([]);
    });

    it("rolls up missingAlt + filenameAlt + missingDims correctly", () => {
      const { service } = buildService();
      const result = service.analyzePage(
        {
          pageUrl: "https://x",
          ogImage: "https://example.com/og.jpg",
          images: [
            {
              src: "https://example.com/img1.jpg",
              alt: null,
              width: null,
              height: null,
              loading: null,
              hasSrcset: false,
            },
            {
              src: "https://example.com/IMG_1234.jpg",
              alt: "IMG_1234",
              width: 800,
              height: 600,
              loading: null,
              hasSrcset: false,
            },
          ],
        },
        new Set(),
      );
      expect(result.jobDeltas.imageMissingAlt).toBe(1);
      expect(result.jobDeltas.imageFilenameAlt).toBe(1);
      expect(result.jobDeltas.imageMissingDims).toBe(1);
      expect(result.jobDeltas.imageTotal).toBe(2);
    });
  });

  describe("persistPageFindings", () => {
    it("writes zero-counts when no findings", async () => {
      const { service, prisma } = buildService();
      await service.persistPageFindings(
        "job1",
        "result1",
        {
          findings: [],
          rollups: { total: 0, missing: 0, issues: 0 },
          jobDeltas: {
            imageTotal: 0,
            imageMissingAlt: 0,
            imageFilenameAlt: 0,
            imageOversizedOg: 0,
            imageUndersizedOg: 0,
            imageMissingDims: 0,
            imageNotLazy: 0,
            imageMissingSitemap: 0,
          },
        },
        "https://example.com/og.jpg",
      );
      expect(prisma.seoCrawlUrlResult.update).toHaveBeenCalledWith({
        where: { id: "result1" },
        data: {
          ogImage: "https://example.com/og.jpg",
          imageFindingsTotal: 0,
          imageFindingsMissing: 0,
          imageFindingsIssues: 0,
        },
      });
    });
  });
});
