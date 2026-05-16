import { Test } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";

import {
  AiCitationService,
  buildAnalyzerInput,
  segmentsToBlocks,
} from "./ai-citation.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("segmentsToBlocks", () => {
  it("buckets keys by heading / paragraph / list / qa", () => {
    const blocks = segmentsToBlocks([
      { path: "content[0].props.title", text: "Welcome" },
      {
        path: "content[0].props.body",
        text: "Body copy long enough to count.",
      },
      { path: "content[1].props.question", text: "What time is check-in?" },
      { path: "content[1].props.answer", text: "4pm." },
      { path: "content[2].props.item", text: "Wifi" },
    ]);
    expect(blocks).toEqual([
      { type: "heading", text: "Welcome", level: 1 },
      { type: "paragraph", text: "Body copy long enough to count." },
      { type: "heading", text: "What time is check-in?", level: 3 },
      { type: "qa", text: "What time is check-in? — 4pm." },
      { type: "list", text: "Wifi" },
    ]);
  });

  it("falls back to paragraph for long unknown keys and list for short", () => {
    const blocks = segmentsToBlocks([
      {
        path: "x.misc",
        text: "This is a fairly long fallback paragraph string.",
      },
      { path: "x.misc", text: "short" },
    ]);
    expect(blocks[0]!.type).toBe("paragraph");
    expect(blocks[1]!.type).toBe("list");
  });

  it("ignores empty / whitespace strings", () => {
    expect(segmentsToBlocks([{ path: "a.title", text: "   " }])).toEqual([]);
  });
});

describe("buildAnalyzerInput", () => {
  it("synthesises a heading from the page title and forwards noindex", () => {
    const out = buildAnalyzerInput({
      title: "My Page",
      seoTitle: "My Page | Site",
      seoDescription: "A description that is long enough.",
      seoNoindex: true,
      puckData: {
        content: [{ props: { text: "Hello world paragraph." } }],
      },
      updatedAt: new Date(),
      structuredDataTypes: ["Hotel"],
    });
    expect(out.title).toBe("My Page");
    expect(out.robots?.noindex).toBe(true);
    expect(out.structuredDataTypes).toEqual(["Hotel"]);
    // First block should be the synthesised title heading.
    expect(out.blocks[0]).toEqual({
      type: "heading",
      text: "My Page",
      level: 1,
    });
  });
});

describe("AiCitationService", () => {
  let service: AiCitationService;
  let prisma: {
    page: { findFirst: jest.Mock };
    siteStructuredData: { findUnique: jest.Mock };
    aiCitationAudit: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      page: { findFirst: jest.fn() },
      siteStructuredData: { findUnique: jest.fn() },
      aiCitationAudit: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiCitationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(AiCitationService);
  });

  describe("analyzePage", () => {
    test("throws NotFound when the page is missing", async () => {
      prisma.page.findFirst.mockResolvedValue(null);
      await expect(
        service.analyzePage("s1", "missing", "en"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    test("persists a new audit when none exists", async () => {
      prisma.page.findFirst.mockResolvedValue({
        id: "p1",
        siteId: "s1",
        slug: "home",
        locale: "en",
        title: "Cozy Lakeside Cottage in Aspen",
        seoTitle: "Cozy Lakeside Cottage in Aspen | Lakeside Retreats",
        seoDescription:
          "A 2-bedroom lakeside cottage in Aspen with private dock, hot tub, and fireplace. Book direct and save 10%.",
        seoNoindex: false,
        puckData: {
          content: [
            { props: { heading: "What time is check-in?" } },
            {
              props: {
                text: "Check-in is at 4 pm and check-out is by 11 am. Reservations are confirmed via email.",
              },
            },
            {
              props: {
                text: "Lakeside Retreats is a family-run property located at 123 Lake Road, Aspen, 81611.",
              },
            },
          ],
        },
        jsonLdOverride: null,
        updatedAt: new Date(),
      });
      prisma.siteStructuredData.findUnique.mockResolvedValue({
        businessType: "Hotel",
      });
      prisma.aiCitationAudit.findUnique.mockResolvedValue(null);
      prisma.aiCitationAudit.create.mockImplementation(({ data }) =>
        Promise.resolve({
          id: "a1",
          analyzedAt: new Date(),
          ...data,
        }),
      );

      const result = await service.analyzePage("s1", "home", "en");

      expect(prisma.aiCitationAudit.create).toHaveBeenCalledTimes(1);
      expect(prisma.aiCitationAudit.update).not.toHaveBeenCalled();
      expect(result.siteId).toBe("s1");
      expect(result.score).toBeGreaterThan(0);
      expect(result.grade).toMatch(/^[A-F]$/);
    });

    test("updates the existing audit row when one already exists", async () => {
      prisma.page.findFirst.mockResolvedValue({
        id: "p1",
        siteId: "s1",
        slug: "home",
        locale: "en",
        title: "Hello",
        seoTitle: null,
        seoDescription: null,
        seoNoindex: false,
        puckData: {},
        jsonLdOverride: null,
        updatedAt: new Date(),
      });
      prisma.siteStructuredData.findUnique.mockResolvedValue(null);
      prisma.aiCitationAudit.findUnique.mockResolvedValue({ id: "a1" });
      prisma.aiCitationAudit.update.mockImplementation(({ data }) =>
        Promise.resolve({
          id: "a1",
          siteId: "s1",
          slug: "home",
          locale: "en",
          analyzedAt: new Date(),
          ...data,
        }),
      );

      await service.analyzePage("s1", "home", "en");

      expect(prisma.aiCitationAudit.update).toHaveBeenCalledWith({
        where: { id: "a1" },
        data: expect.objectContaining({
          siteId: "s1",
          slug: "home",
          locale: "en",
        }),
      });
      expect(prisma.aiCitationAudit.create).not.toHaveBeenCalled();
    });
  });

  describe("getReport", () => {
    test("returns stored audit when present", async () => {
      const now = new Date();
      prisma.aiCitationAudit.findUnique.mockResolvedValue({
        id: "a1",
        siteId: "s1",
        slug: "home",
        locale: "en",
        score: 88,
        grade: "A",
        findings: [
          {
            code: "FRESH_CONTENT",
            severity: "success",
            message: "ok",
            delta: 4,
          },
        ],
        signals: { entityFacts: { count: 5, samples: [] } },
        analyzedAt: now,
      });

      const r = await service.getReport("s1", "home", "en");
      expect(r.score).toBe(88);
      expect(r.grade).toBe("A");
      expect(r.analyzedAt).toBe(now.toISOString());
      expect(prisma.page.findFirst).not.toHaveBeenCalled();
    });

    test("falls back to analyzing on the fly when no audit exists", async () => {
      prisma.aiCitationAudit.findUnique.mockResolvedValue(null);
      prisma.page.findFirst.mockResolvedValue({
        id: "p1",
        siteId: "s1",
        slug: "home",
        locale: "en",
        title: "T",
        seoTitle: null,
        seoDescription: null,
        seoNoindex: false,
        puckData: {},
        jsonLdOverride: null,
        updatedAt: new Date(),
      });
      prisma.siteStructuredData.findUnique.mockResolvedValue(null);
      prisma.aiCitationAudit.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: "a1", analyzedAt: new Date(), ...data }),
      );

      const r = await service.getReport("s1", "home", "en");
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(prisma.aiCitationAudit.create).toHaveBeenCalled();
    });
  });

  describe("getOverview", () => {
    test("aggregates rows and computes average score, worst first", async () => {
      const now = new Date();
      prisma.aiCitationAudit.findMany.mockResolvedValue([
        {
          siteId: "s1",
          slug: "low",
          locale: "en",
          score: 40,
          entityFactCount: 1,
          answerReadyCount: 0,
          freshnessDays: 200,
          findings: [
            { code: "ROBOTS_NOINDEX", severity: "error", message: "blocked" },
            { code: "THIN_CONTENT", severity: "warning", message: "too thin" },
          ],
          signals: {},
          analyzedAt: now,
        },
        {
          siteId: "s1",
          slug: "high",
          locale: "en",
          score: 90,
          entityFactCount: 6,
          answerReadyCount: 3,
          freshnessDays: 10,
          findings: [],
          signals: {},
          analyzedAt: now,
        },
      ]);

      const out = await service.getOverview("s1");
      expect(out.pageCount).toBe(2);
      expect(out.averageScore).toBe(65);
      expect(out.rows[0]!.slug).toBe("low");
      expect(out.rows[0]!.topIssue).toBe("blocked");
      expect(out.rows[1]!.topIssue).toBeNull();
    });

    test("returns null average for empty site", async () => {
      prisma.aiCitationAudit.findMany.mockResolvedValue([]);
      const out = await service.getOverview("s1");
      expect(out.pageCount).toBe(0);
      expect(out.averageScore).toBeNull();
      expect(out.rows).toEqual([]);
    });
  });
});
