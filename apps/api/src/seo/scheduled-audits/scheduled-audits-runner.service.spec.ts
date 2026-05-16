import { Test } from "@nestjs/testing";

import { PrismaService } from "../../prisma/prisma.service";
import { AiCitationService } from "../ai-citation/ai-citation.service";
import { SeoAuditTasksService } from "../audit-tasks/audit-tasks.service";
import { SeoAuditRunnerService } from "./scheduled-audits-runner.service";
import { SeoAuditScheduleService } from "./scheduled-audits-schedule.service";

interface PrismaMockState {
  pages: Array<{ slug: string; locale: string }>;
  previousSnapshots: Record<string, any>;
  createdSnapshots: any[];
  alertUpserts: any[];
  runRow: any;
}

function buildPrismaMock(state: PrismaMockState) {
  return {
    seoAuditRun: {
      create: jest.fn(async ({ data }) => {
        state.runRow = { id: "run-1", ...data };
        return state.runRow;
      }),
      update: jest.fn(async ({ where, data }) => {
        state.runRow = { ...state.runRow, ...data, id: where.id };
        return state.runRow;
      }),
    },
    page: {
      findMany: jest.fn(async () => state.pages),
    },
    seoAuditSnapshot: {
      findFirst: jest.fn(async ({ where }) => {
        const key = `${where.slug}::${where.locale}`;
        return state.previousSnapshots[key] ?? null;
      }),
      create: jest.fn(async ({ data }) => {
        state.createdSnapshots.push(data);
        return { id: `snap-${state.createdSnapshots.length}`, ...data };
      }),
    },
    operationalAlert: {
      upsert: jest.fn(async (args) => {
        state.alertUpserts.push(args);
        return { id: "alert-1" };
      }),
    },
  };
}

function buildResult(
  score: number,
  opts: Partial<{ allowsCitation: boolean }> = {},
) {
  return {
    score,
    grade: score >= 70 ? "B" : score >= 55 ? "C" : "F",
    findings: [],
    siteId: "site-1",
    slug: "about",
    locale: "en",
    analyzedAt: new Date().toISOString(),
    signals: {
      robots: { allowsCitation: opts.allowsCitation ?? true, flags: [] },
      entityFacts: { count: 3, samples: [] },
      answerReady: { count: 1, samples: [] },
      freshness: { daysSinceUpdate: 5 },
      structure: { headingDepth: 2, paragraphCount: 4, listCount: 1 },
    },
  };
}

describe("SeoAuditRunnerService", () => {
  let runner: SeoAuditRunnerService;
  let prismaMock: ReturnType<typeof buildPrismaMock>;
  let aiCitationMock: { analyzePage: jest.Mock };
  let scheduleMock: { markRan: jest.Mock };
  let tasksMock: { upsertTaskForAlert: jest.Mock };
  let state: PrismaMockState;

  beforeEach(async () => {
    state = {
      pages: [
        { slug: "about", locale: "en" },
        { slug: "pricing", locale: "en" },
      ],
      previousSnapshots: {},
      createdSnapshots: [],
      alertUpserts: [],
      runRow: null,
    };
    prismaMock = buildPrismaMock(state);
    aiCitationMock = { analyzePage: jest.fn() };
    scheduleMock = { markRan: jest.fn().mockResolvedValue(null) };
    tasksMock = { upsertTaskForAlert: jest.fn().mockResolvedValue(null) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SeoAuditRunnerService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AiCitationService, useValue: aiCitationMock },
        { provide: SeoAuditScheduleService, useValue: scheduleMock },
        { provide: SeoAuditTasksService, useValue: tasksMock },
      ],
    }).compile();

    runner = moduleRef.get(SeoAuditRunnerService);
  });

  it("captures one snapshot per page and reports SUCCESS", async () => {
    aiCitationMock.analyzePage.mockResolvedValueOnce(buildResult(80));
    aiCitationMock.analyzePage.mockResolvedValueOnce(buildResult(70));

    const run = await runner.runAudit("site-1", { kind: "MANUAL" });

    expect(state.createdSnapshots).toHaveLength(2);
    expect(run.status).toBe("SUCCESS");
    expect(run.pagesAudited).toBe(2);
    expect(run.alertsCreated).toBe(0);
    expect(run.averageScore).toBe(75);
    expect(scheduleMock.markRan).toHaveBeenCalledWith(
      "site-1",
      expect.any(Date),
    );
  });

  it("creates a CRITICAL alert when crawler permissions flip", async () => {
    state.previousSnapshots["about::en"] = {
      slug: "about",
      locale: "en",
      score: 80,
      allowsCitation: true,
      findingsCount: 0,
    };
    state.previousSnapshots["pricing::en"] = {
      slug: "pricing",
      locale: "en",
      score: 80,
      allowsCitation: true,
      findingsCount: 0,
    };
    aiCitationMock.analyzePage.mockResolvedValueOnce(
      buildResult(30, { allowsCitation: false }),
    );
    aiCitationMock.analyzePage.mockResolvedValueOnce(buildResult(82));

    const run = await runner.runAudit("site-1", { kind: "SCHEDULED" });

    expect(run.alertsCreated).toBe(1);
    expect(state.alertUpserts).toHaveLength(1);
    const args = state.alertUpserts[0];
    expect(args.create.type).toBe("SEO_AUDIT_CRITICAL");
    expect(args.create.severity).toBe("CRITICAL");
    expect(args.where.siteId_type_fingerprint.fingerprint).toBe(
      "seo-audit:about:en:CRAWLER_BLOCKED",
    );
  });

  it("creates a WARNING alert when score drops past the threshold", async () => {
    state.previousSnapshots["about::en"] = {
      slug: "about",
      locale: "en",
      score: 70,
      allowsCitation: true,
      findingsCount: 0,
    };
    state.previousSnapshots["pricing::en"] = {
      slug: "pricing",
      locale: "en",
      score: 70,
      allowsCitation: true,
      findingsCount: 0,
    };
    aiCitationMock.analyzePage.mockResolvedValueOnce(buildResult(40));
    aiCitationMock.analyzePage.mockResolvedValueOnce(buildResult(68));

    const run = await runner.runAudit("site-1", { kind: "SCHEDULED" });

    expect(run.alertsCreated).toBe(1);
    expect(state.alertUpserts[0].create.type).toBe("SEO_AUDIT_REGRESSION");
    expect(state.alertUpserts[0].create.severity).toBe("WARNING");
  });

  it("marks a run PARTIAL when some pages fail but others succeed", async () => {
    aiCitationMock.analyzePage.mockResolvedValueOnce(buildResult(80));
    aiCitationMock.analyzePage.mockRejectedValueOnce(new Error("boom"));

    const run = await runner.runAudit("site-1", { kind: "MANUAL" });

    expect(run.status).toBe("PARTIAL");
    expect(run.pagesAudited).toBe(1);
    expect(run.error).toBe("boom");
  });

  it("marks a run FAILED when every page errors", async () => {
    aiCitationMock.analyzePage.mockRejectedValue(new Error("kaboom"));

    const run = await runner.runAudit("site-1", { kind: "MANUAL" });

    expect(run.status).toBe("FAILED");
    expect(run.pagesAudited).toBe(0);
    expect(run.averageScore).toBeNull();
  });
});
