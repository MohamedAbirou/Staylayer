import { ConflictException } from "@nestjs/common";
import { PsiAuditStatus, PsiStrategy } from "@prisma/client";

import { PsiAuditService } from "./psi.service";
import {
  PageSpeedInsightsClient,
  PerformanceProviderError,
} from "./psi-api.service";

type Prisma = {
  psiAudit: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    findMany: jest.Mock;
  };
  site: { findUnique: jest.Mock };
  cruxRecord: { findUnique: jest.Mock; upsert: jest.Mock };
};

const makePrisma = (): Prisma => ({
  psiAudit: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  site: { findUnique: jest.fn() },
  cruxRecord: { findUnique: jest.fn(), upsert: jest.fn() },
});

const makeBilling = () =>
  ({
    assertCanRunPsiAudit: jest.fn().mockResolvedValue({
      limit: 100,
      used: 0,
      remaining: 99,
    }),
    getTenantPlanSnapshot: jest.fn(),
  }) as unknown as {
    assertCanRunPsiAudit: jest.Mock;
    getTenantPlanSnapshot: jest.Mock;
  };

const makePsi = (
  overrides: Partial<PageSpeedInsightsClient> = {},
): PageSpeedInsightsClient =>
  ({
    providerName: "google_pagespeed_insights",
    isConfigured: () => true,
    runAudit: jest.fn(),
    fetchCruxRecord: jest.fn(),
    ...overrides,
  }) as unknown as PageSpeedInsightsClient;

describe("PsiAuditService", () => {
  let prisma: Prisma;
  let billing: ReturnType<typeof makeBilling>;
  let psi: PageSpeedInsightsClient;
  let service: PsiAuditService;

  beforeEach(() => {
    prisma = makePrisma();
    billing = makeBilling();
    psi = makePsi();
    service = new PsiAuditService(
      prisma as never,
      billing as never,
      psi as never,
    );
  });

  it("rejects non-http urls", async () => {
    await expect(
      service.runAudit("site-1", {
        url: "javascript:alert(1)",
        strategy: PsiStrategy.MOBILE,
      }),
    ).rejects.toThrow(/http or https/);
  });

  it("returns cached audit without consuming plan quota when within cache window", async () => {
    const cached = {
      id: "audit-cached",
      siteId: "site-1",
      url: "https://example.com/",
      strategy: PsiStrategy.MOBILE,
      status: PsiAuditStatus.COMPLETED,
      createdAt: new Date(),
    };
    prisma.psiAudit.findFirst.mockResolvedValue(cached);

    const result = await service.runAudit("site-1", {
      url: "https://example.com/",
      strategy: PsiStrategy.MOBILE,
    });

    expect(result.cached).toBe(true);
    expect(result.audit).toEqual(cached);
    expect(billing.assertCanRunPsiAudit).not.toHaveBeenCalled();
    expect(prisma.psiAudit.create).not.toHaveBeenCalled();
  });

  it("creates audit, calls provider, parses Lighthouse and completes", async () => {
    prisma.psiAudit.findFirst.mockResolvedValue(null);
    prisma.psiAudit.create.mockResolvedValue({ id: "audit-1" });
    prisma.psiAudit.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: "audit-1", ...data }),
    );
    (psi.runAudit as jest.Mock).mockResolvedValue({
      rawResponse: {},
      lighthouseResult: {
        categories: { performance: { score: 0.81 } },
        audits: {
          "largest-contentful-paint": { numericValue: 1900 },
        },
      },
      loadingExperience: null,
      originLoadingExperience: null,
    });

    const result = await service.runAudit("site-1", {
      url: "https://example.com/",
      strategy: PsiStrategy.MOBILE,
    });

    expect(result.cached).toBe(false);
    expect(billing.assertCanRunPsiAudit).toHaveBeenCalledWith("site-1");
    expect(prisma.psiAudit.update).toHaveBeenCalled();
    const updateCall = prisma.psiAudit.update.mock.calls[0]![0];
    expect(updateCall.data.status).toBe(PsiAuditStatus.COMPLETED);
    expect(updateCall.data.performanceScore).toBe(0.81);
    expect(updateCall.data.largestContentfulPaintMs).toBe(1900);
  });

  it("marks audit FAILED when provider throws", async () => {
    prisma.psiAudit.findFirst.mockResolvedValue(null);
    prisma.psiAudit.create.mockResolvedValue({ id: "audit-2" });
    prisma.psiAudit.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: "audit-2", ...data }),
    );
    (psi.runAudit as jest.Mock).mockRejectedValue(
      new PerformanceProviderError("quota exhausted", 429, "RATE_LIMITED"),
    );

    const result = await service.runAudit("site-1", {
      url: "https://example.com/",
      strategy: PsiStrategy.DESKTOP,
    });

    expect(result.audit.status).toBe(PsiAuditStatus.FAILED);
    expect(result.audit.failureReason).toContain("RATE_LIMITED");
  });

  it("forceRefresh bypasses cache and consumes quota", async () => {
    prisma.psiAudit.findFirst.mockResolvedValue({ id: "old", status: PsiAuditStatus.COMPLETED });
    prisma.psiAudit.create.mockResolvedValue({ id: "audit-3" });
    prisma.psiAudit.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: "audit-3", ...data }),
    );
    (psi.runAudit as jest.Mock).mockResolvedValue({
      rawResponse: {},
      lighthouseResult: { categories: {}, audits: {} },
      loadingExperience: null,
      originLoadingExperience: null,
    });

    await service.runAudit("site-1", {
      url: "https://example.com/",
      strategy: PsiStrategy.MOBILE,
      forceRefresh: true,
    });

    expect(billing.assertCanRunPsiAudit).toHaveBeenCalled();
    expect(prisma.psiAudit.create).toHaveBeenCalled();
  });

  it("surfaces plan limit conflict from billing", async () => {
    prisma.psiAudit.findFirst.mockResolvedValue(null);
    billing.assertCanRunPsiAudit.mockRejectedValue(
      new ConflictException({ code: "PLAN_LIMIT_EXCEEDED" }),
    );

    await expect(
      service.runAudit("site-1", {
        url: "https://example.com/",
        strategy: PsiStrategy.MOBILE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.psiAudit.create).not.toHaveBeenCalled();
  });
});
