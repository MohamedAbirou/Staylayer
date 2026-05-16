/// <reference types="jest" />

import {
  SearchEngineSubmissionStatus,
  SearchEngineSubmissionTarget,
} from "@prisma/client";

import { IndexNowService } from "./indexnow.service";

jest.mock("./indexnow.client", () => ({
  submitToIndexNow: jest.fn(),
}));

import { submitToIndexNow } from "./indexnow.client";

const mockedSubmit = submitToIndexNow as jest.MockedFunction<
  typeof submitToIndexNow
>;

interface MockRow {
  id: string;
  siteId: string;
  target: SearchEngineSubmissionTarget;
  status: SearchEngineSubmissionStatus;
  urls: string[];
  urlCount: number;
  responseStatus: number | null;
  responseBody: string | null;
  reason: string | null;
  attempts: number;
  lastAttemptAt: Date | null;
  nextAttemptAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
}

function makeService() {
  const rowsByQuery: { findManyResult: MockRow[] } = { findManyResult: [] };
  const updateSpy = jest.fn(async ({ where, data }: any) => {
    const row = rowsByQuery.findManyResult.find((r) => r.id === where.id);
    if (!row) throw new Error(`row ${where.id} not found in mock store`);
    Object.assign(row, data);
    return row;
  });

  const prisma = {
    siteSettings: {
      findUnique: jest.fn(async () => ({
        indexNowEnabled: true,
        indexNowKey: "k".repeat(32),
        seoIndexingEnabled: true,
      })),
    },
    sitemapSubmissionLog: {
      findMany: jest.fn(async () => rowsByQuery.findManyResult),
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          rowsByQuery.findManyResult.find(
            (r) => r.id === where.id && r.siteId === where.siteId,
          ) ?? null
        );
      }),
      update: updateSpy,
      create: jest.fn(),
    },
  } as any;

  const robotsService = {
    resolveCanonicalHost: jest.fn(async () => "example.com"),
  } as any;

  const svc = new IndexNowService(prisma, robotsService);
  return { svc, prisma, robotsService, rowsByQuery, updateSpy };
}

function row(overrides: Partial<MockRow> = {}): MockRow {
  return {
    id: "log-1",
    siteId: "site-1",
    target: SearchEngineSubmissionTarget.INDEXNOW_AUTO_PUBLISH,
    status: SearchEngineSubmissionStatus.FAILED,
    urls: ["https://example.com/foo"],
    urlCount: 1,
    responseStatus: 500,
    responseBody: "boom",
    reason: null,
    attempts: 1,
    lastAttemptAt: new Date(Date.now() - 60_000),
    nextAttemptAt: new Date(Date.now() - 1_000),
    createdBy: null,
    createdAt: new Date(Date.now() - 120_000),
    ...overrides,
  };
}

describe("IndexNowService backoff math", () => {
  const { svc } = makeService();

  it("returns increasing waits for successive attempts and caps at the last entry", () => {
    expect(svc.backoffMs(1)).toBe(60_000);
    expect(svc.backoffMs(2)).toBe(5 * 60_000);
    expect(svc.backoffMs(3)).toBe(15 * 60_000);
    expect(svc.backoffMs(4)).toBe(60 * 60_000);
    // Past the schedule, stays at the largest backoff.
    expect(svc.backoffMs(99)).toBe(60 * 60_000);
  });

  it("clamps non-positive inputs to the first window", () => {
    expect(svc.backoffMs(0)).toBe(60_000);
    expect(svc.backoffMs(-5)).toBe(60_000);
  });
});

describe("IndexNowService.processPendingRetries", () => {
  beforeEach(() => {
    mockedSubmit.mockReset();
  });

  it("retries failed rows whose window has elapsed and marks success on 200", async () => {
    const { svc, rowsByQuery, updateSpy } = makeService();
    const target = row({ id: "r1", attempts: 1 });
    rowsByQuery.findManyResult = [target];
    mockedSubmit.mockResolvedValue({ ok: true, status: 200, body: "OK" });

    const result = await svc.processPendingRetries();

    expect(result.processed).toBe(1);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(target.status).toBe(SearchEngineSubmissionStatus.SUCCESS);
    expect(target.attempts).toBe(2);
    expect(target.nextAttemptAt).toBeNull();
  });

  it("schedules another retry on failure with the next backoff window", async () => {
    const { svc, rowsByQuery } = makeService();
    const target = row({ id: "r2", attempts: 1 });
    rowsByQuery.findManyResult = [target];
    mockedSubmit.mockResolvedValue({ ok: false, status: 503, body: "down" });

    await svc.processPendingRetries();

    expect(target.status).toBe(SearchEngineSubmissionStatus.FAILED);
    expect(target.attempts).toBe(2);
    // attempts was 1 → became 2 → next backoff index is backoff[1] = 5min
    expect(target.nextAttemptAt).not.toBeNull();
    const gap = target.nextAttemptAt!.getTime() - Date.now();
    expect(gap).toBeGreaterThan(4 * 60_000);
    expect(gap).toBeLessThan(6 * 60_000);
  });

  it("gives up and clears nextAttemptAt after MAX_ATTEMPTS reached", async () => {
    const { svc, rowsByQuery } = makeService();
    // attempts=4 already → after this failure it'll become 5 (= MAX_ATTEMPTS)
    const target = row({ id: "r3", attempts: 4 });
    rowsByQuery.findManyResult = [target];
    mockedSubmit.mockResolvedValue({ ok: false, status: 500, body: "no" });

    await svc.processPendingRetries();

    expect(target.attempts).toBe(5);
    expect(target.status).toBe(SearchEngineSubmissionStatus.FAILED);
    expect(target.nextAttemptAt).toBeNull();
    expect(target.reason).toMatch(/Gave up/);
  });

  it("marks the row SKIPPED if IndexNow has since been disabled", async () => {
    const { svc, prisma, rowsByQuery } = makeService();
    const target = row({ id: "r4" });
    rowsByQuery.findManyResult = [target];
    prisma.siteSettings.findUnique.mockResolvedValueOnce({
      indexNowEnabled: false,
      indexNowKey: "k".repeat(32),
      seoIndexingEnabled: true,
    });

    await svc.processPendingRetries();

    expect(target.status).toBe(SearchEngineSubmissionStatus.SKIPPED);
    expect(target.nextAttemptAt).toBeNull();
    expect(mockedSubmit).not.toHaveBeenCalled();
  });

  it("processes nothing while another tick is already running", async () => {
    const { svc, rowsByQuery } = makeService();
    rowsByQuery.findManyResult = [row({ id: "r5" })];
    mockedSubmit.mockResolvedValue({ ok: true, status: 200, body: "OK" });

    (svc as any).retryRunning = true;
    const result = await svc.processPendingRetries();
    expect(result.processed).toBe(0);
    expect(mockedSubmit).not.toHaveBeenCalled();
  });
});

describe("IndexNowService.retrySubmission", () => {
  beforeEach(() => {
    mockedSubmit.mockReset();
  });

  it("rejects retrying SUCCESS rows", async () => {
    const { svc, rowsByQuery } = makeService();
    rowsByQuery.findManyResult = [
      row({ id: "ok-1", status: SearchEngineSubmissionStatus.SUCCESS }),
    ];
    await expect(
      svc.retrySubmission("site-1", "ok-1", "user@example.com"),
    ).rejects.toThrow(/already succeeded/i);
  });

  it("rejects retrying SKIPPED rows", async () => {
    const { svc, rowsByQuery } = makeService();
    rowsByQuery.findManyResult = [
      row({ id: "sk-1", status: SearchEngineSubmissionStatus.SKIPPED }),
    ];
    await expect(svc.retrySubmission("site-1", "sk-1", null)).rejects.toThrow(
      /Skipped/i,
    );
  });

  it("force-retries even when attempts >= MAX_ATTEMPTS", async () => {
    const { svc, rowsByQuery } = makeService();
    const target = row({ id: "max-1", attempts: 5 });
    rowsByQuery.findManyResult = [target];
    mockedSubmit.mockResolvedValue({ ok: true, status: 200, body: "OK" });

    const result = await svc.retrySubmission("site-1", "max-1", "ops");

    expect(result.status).toBe(SearchEngineSubmissionStatus.SUCCESS);
    expect(target.attempts).toBe(6);
    expect(target.reason).toMatch(/manually by ops/);
  });

  it("404s when row belongs to another site", async () => {
    const { svc, rowsByQuery } = makeService();
    rowsByQuery.findManyResult = [row({ id: "r6", siteId: "other-site" })];
    await expect(svc.retrySubmission("site-1", "r6", null)).rejects.toThrow(
      /not found/i,
    );
  });
});
