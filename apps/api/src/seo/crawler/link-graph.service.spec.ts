/// <reference types="jest" />

import { NotFoundException } from "@nestjs/common";

import { LinkGraphService } from "./link-graph.service";

/**
 * Light Prisma stub that records calls and returns canned data. Each crawler
 * link-graph query is exercised end-to-end (assembly + ordering + filtering)
 * without needing a real database.
 */
function makePrismaStub(overrides: {
  jobRow?: unknown;
  resultRow?: unknown;
  totalUrls?: number;
  indexableCount?: number;
  groupByTarget?: Array<{
    targetResultId: string | null;
    _count: { _all: number };
  }>;
  groupBySource?: Array<{ sourceResultId: string; _count: { _all: number } }>;
  resultsByIds?: Array<{
    id: string;
    url: string;
    pathname: string;
    statusCode: number;
    depth: number;
    indexable: boolean;
  }>;
  deepestRows?: Array<{
    id: string;
    url: string;
    pathname: string;
    statusCode: number;
    depth: number;
    indexable: boolean;
  }>;
  orphanCandidates?: Array<{
    id: string;
    url: string;
    pathname: string;
    statusCode: number;
    depth: number;
    indexable: boolean;
    _count: { inboundLinks: number };
  }>;
  brokenInternal?: Array<{
    id: string;
    anchorText: string | null;
    targetUrl: string;
    source: { id: string; url: string; pathname: string };
    target: { id: string; statusCode: number } | null;
  }>;
  externals?: Array<{ targetUrl: string }>;
  groupByInternalCount?: Array<{
    isInternal: boolean;
    _count: { _all: number };
  }>;
  inboundCount?: number;
  outboundCount?: number;
  inboundRows?: unknown[];
  outboundRows?: unknown[];
}) {
  return {
    seoCrawlJob: {
      findFirst: jest.fn().mockResolvedValue(overrides.jobRow ?? null),
    },
    seoCrawlUrlResult: {
      count: jest
        .fn()
        .mockImplementation(
          async () => overrides.indexableCount ?? overrides.totalUrls ?? 0,
        ),
      findMany: jest
        .fn()
        .mockImplementation(
          async (args: { orderBy?: unknown; where?: unknown }) => {
            const w = args.where as Record<string, unknown> | undefined;
            if (
              w &&
              "depth" in w &&
              (w as { depth?: { gt?: number } }).depth?.gt === 0
            ) {
              return overrides.orphanCandidates ?? [];
            }
            if (args.orderBy && Array.isArray(args.orderBy)) {
              return overrides.deepestRows ?? [];
            }
            return overrides.resultsByIds ?? [];
          },
        ),
      findFirst: jest.fn().mockResolvedValue(overrides.resultRow ?? null),
    },
    seoCrawlPageLink: {
      groupBy: jest
        .fn()
        .mockImplementation(async (args: { by: string[]; where?: unknown }) => {
          if (args.by[0] === "targetResultId")
            return overrides.groupByTarget ?? [];
          if (args.by[0] === "sourceResultId")
            return overrides.groupBySource ?? [];
          if (args.by[0] === "isInternal")
            return overrides.groupByInternalCount ?? [];
          return [];
        }),
      findMany: jest
        .fn()
        .mockImplementation(
          async (args: { where?: Record<string, unknown> }) => {
            const w = args.where ?? {};
            if (w.isInternal === false) return overrides.externals ?? [];
            if (w.target) return overrides.brokenInternal ?? [];
            if ("targetResultId" in w && typeof w.targetResultId === "string") {
              return overrides.inboundRows ?? [];
            }
            if ("sourceResultId" in w && typeof w.sourceResultId === "string") {
              return overrides.outboundRows ?? [];
            }
            return [];
          },
        ),
      count: jest
        .fn()
        .mockImplementation(
          async (args: { where?: Record<string, unknown> }) => {
            const w = args.where ?? {};
            if ("targetResultId" in w) return overrides.inboundCount ?? 0;
            if ("sourceResultId" in w) return overrides.outboundCount ?? 0;
            return 0;
          },
        ),
    },
  };
}

describe("LinkGraphService.getJobLinkGraph", () => {
  it("throws NotFound when the job is not visible to the site", async () => {
    const prisma = makePrismaStub({ jobRow: null });
    const svc = new LinkGraphService(prisma as never);
    await expect(svc.getJobLinkGraph("site-1", "job-x")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("aggregates totals, top hubs, deepest pages, orphans, and broken links", async () => {
    const prisma = makePrismaStub({
      jobRow: { id: "job-1", status: "COMPLETED", totalUrls: 3, urlLimit: 100 },
      totalUrls: 3,
      indexableCount: 2,
      groupByInternalCount: [
        { isInternal: true, _count: { _all: 4 } },
        { isInternal: false, _count: { _all: 1 } },
      ],
      externals: [
        { targetUrl: "https://ext.com/a" },
        { targetUrl: "https://ext.com/b" },
      ],
      groupByTarget: [
        { targetResultId: "r2", _count: { _all: 3 } },
        { targetResultId: "r3", _count: { _all: 1 } },
      ],
      groupBySource: [{ sourceResultId: "r1", _count: { _all: 4 } }],
      resultsByIds: [
        {
          id: "r1",
          url: "https://s/",
          pathname: "/",
          statusCode: 200,
          depth: 0,
          indexable: true,
        },
        {
          id: "r2",
          url: "https://s/a",
          pathname: "/a",
          statusCode: 200,
          depth: 1,
          indexable: true,
        },
        {
          id: "r3",
          url: "https://s/b",
          pathname: "/b",
          statusCode: 404,
          depth: 1,
          indexable: false,
        },
      ],
      deepestRows: [
        {
          id: "r2",
          url: "https://s/a",
          pathname: "/a",
          statusCode: 200,
          depth: 5,
          indexable: true,
        },
      ],
      orphanCandidates: [
        {
          id: "r3",
          url: "https://s/b",
          pathname: "/b",
          statusCode: 200,
          depth: 2,
          indexable: true,
          _count: { inboundLinks: 0 },
        },
        {
          id: "r2",
          url: "https://s/a",
          pathname: "/a",
          statusCode: 200,
          depth: 1,
          indexable: true,
          _count: { inboundLinks: 3 },
        },
      ],
      brokenInternal: [
        {
          id: "link-1",
          anchorText: "Broken",
          targetUrl: "https://s/b",
          source: { id: "r1", url: "https://s/", pathname: "/" },
          target: { id: "r3", statusCode: 404 },
        },
      ],
    });

    const svc = new LinkGraphService(prisma as never);
    const graph = await svc.getJobLinkGraph("site-1", "job-1");

    expect(graph.jobId).toBe("job-1");
    expect(graph.totals.internalLinks).toBe(4);
    expect(graph.totals.externalLinks).toBe(1);
    expect(graph.totals.uniqueExternalDomains).toBe(1);
    expect(graph.totals.indexablePages).toBe(2);

    expect(graph.topInbound[0]).toMatchObject({ resultId: "r2", count: 3 });
    expect(graph.topOutbound[0]).toMatchObject({ resultId: "r1", count: 4 });
    expect(graph.deepestPages[0].depth).toBe(5);
    expect(graph.orphanPages.map((o) => o.resultId)).toEqual(["r3"]);
    expect(graph.brokenInternalLinks[0]).toMatchObject({
      sourceUrl: "https://s/",
      targetStatusCode: 404,
    });
  });
});

describe("LinkGraphService.getPageLinks", () => {
  it("throws NotFound when the result is outside the site scope", async () => {
    const prisma = makePrismaStub({ resultRow: null });
    const svc = new LinkGraphService(prisma as never);
    await expect(
      svc.getPageLinks("site-1", "job-1", "missing"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns paginated inbound/outbound rows with truncation flags", async () => {
    const prisma = makePrismaStub({
      resultRow: {
        id: "r1",
        url: "https://s/",
        pathname: "/",
        statusCode: 200,
        depth: 0,
      },
      inboundRows: [
        {
          id: "l1",
          anchorText: "Home",
          rel: null,
          nofollow: false,
          source: {
            id: "r2",
            url: "https://s/a",
            pathname: "/a",
            statusCode: 200,
            depth: 1,
          },
        },
      ],
      outboundRows: [
        {
          id: "l2",
          targetUrl: "https://s/a",
          targetPathname: "/a",
          anchorText: "A",
          rel: null,
          nofollow: false,
          isInternal: true,
          target: { id: "r2", statusCode: 200, depth: 1, indexable: true },
        },
      ],
      inboundCount: 5,
      outboundCount: 1,
    });
    const svc = new LinkGraphService(prisma as never);
    const out = await svc.getPageLinks("site-1", "job-1", "r1", { limit: 1 });
    expect(out.inbound).toHaveLength(1);
    expect(out.outbound).toHaveLength(1);
    expect(out.inboundCount).toBe(5);
    expect(out.truncated.inbound).toBe(true);
    expect(out.truncated.outbound).toBe(false);
    expect(out.outbound[0].targetResultId).toBe("r2");
    expect(out.inbound[0].sourceUrl).toBe("https://s/a");
  });
});
