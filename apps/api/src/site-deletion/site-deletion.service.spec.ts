/// <reference types="jest" />

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { SiteDeletionJobStatus, SiteStatus } from "@prisma/client";

import { SiteDeletionService } from "./site-deletion.service";

function buildPrismaMock() {
  const prisma = {
    site: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    siteDeletionJob: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    page: { count: jest.fn(), deleteMany: jest.fn() },
    formDefinition: { count: jest.fn(), deleteMany: jest.fn() },
    formSubmission: { count: jest.fn(), deleteMany: jest.fn() },
    formDelivery: { count: jest.fn(), deleteMany: jest.fn() },
    domain: { count: jest.fn() },
    deployment: { count: jest.fn(), findMany: jest.fn() },
    sitePublishedRevision: { count: jest.fn() },
    searchConsolePagePerformance: { count: jest.fn(), deleteMany: jest.fn() },
    searchConsoleQueryPerformance: { count: jest.fn(), deleteMany: jest.fn() },
    bingPagePerformance: { count: jest.fn(), deleteMany: jest.fn() },
    bingQueryPerformance: { count: jest.fn(), deleteMany: jest.fn() },
    psiAudit: { count: jest.fn(), deleteMany: jest.fn() },
    cruxRecord: { count: jest.fn(), deleteMany: jest.fn() },
    hreflangIssue: { count: jest.fn(), deleteMany: jest.fn() },
    hreflangScan: { deleteMany: jest.fn() },
    seoCrawlJob: { count: jest.fn(), deleteMany: jest.fn() },
    seoAuditRun: { count: jest.fn(), deleteMany: jest.fn() },
    seoAuditTask: { count: jest.fn(), deleteMany: jest.fn() },
    seoAuditSnapshot: { deleteMany: jest.fn() },
    aiCitationAudit: { count: jest.fn() },
    translationJob: { count: jest.fn() },
    translationUsage: { count: jest.fn(), deleteMany: jest.fn() },
    redirect: { count: jest.fn() },
    notification: { count: jest.fn(), deleteMany: jest.fn() },
    auditLog: { count: jest.fn() },
    searchConsoleConnection: { findUnique: jest.fn() },
    bingWebmasterConnection: { findUnique: jest.fn() },
    seoAuditSchedule: { findUnique: jest.fn() },
    searchConsoleUrlInspection: { deleteMany: jest.fn() },
    searchConsoleSitemap: { deleteMany: jest.fn() },
    bingSitemap: { deleteMany: jest.fn() },
    bingCrawlIssue: { deleteMany: jest.fn() },
  };
  return prisma;
}

function defaultCounts(prisma: ReturnType<typeof buildPrismaMock>) {
  for (const model of Object.values(prisma) as Array<{
    [k: string]: jest.Mock | undefined;
  }>) {
    if (model.count) model.count.mockResolvedValue(0);
  }
  prisma.deployment.findMany.mockResolvedValue([]);
  prisma.searchConsoleConnection.findUnique.mockResolvedValue(null);
  prisma.bingWebmasterConnection.findUnique.mockResolvedValue(null);
  prisma.seoAuditSchedule.findUnique.mockResolvedValue(null);
}

describe("SiteDeletionService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let notifications: { createForTenantRoles: jest.Mock };
  let admin: { createAuditLogForTenant: jest.Mock };
  let config: { get: jest.Mock };
  let cache: { deleteKeys: jest.Mock };
  let service: SiteDeletionService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    defaultCounts(prisma);
    notifications = { createForTenantRoles: jest.fn().mockResolvedValue([]) };
    admin = { createAuditLogForTenant: jest.fn().mockResolvedValue(undefined) };
    config = {
      get: jest.fn((key: string) =>
        key === "HOSTED_SITE_ROOT_DOMAIN" ? "staylayer.test" : undefined,
      ),
    };
    cache = { deleteKeys: jest.fn().mockResolvedValue(undefined) };
    service = new SiteDeletionService(
      prisma as never,
      notifications as never,
      admin as never,
      config as never,
      cache as never,
    );
  });

  describe("computeDeletionImpact", () => {
    it("throws when the site is missing", async () => {
      prisma.site.findFirst.mockResolvedValue(null);
      await expect(
        service.computeDeletionImpact("tenant-1", "site-x"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("returns a blocking reason for non-archived sites", async () => {
      prisma.site.findFirst.mockResolvedValue({
        id: "site-1",
        tenantId: "tenant-1",
        name: "Azure Bay",
        status: SiteStatus.ACTIVE,
        archivedAt: null,
        archivedSlug: null,
        archivedPublicSubdomain: null,
        archivedDomains: [],
      });

      const impact = await service.computeDeletionImpact("tenant-1", "site-1");

      expect(impact.blockingReasons).toHaveLength(1);
      expect(impact.riskFlags).toEqual([]);
    });

    it("aggregates counts and surfaces provider resources", async () => {
      prisma.site.findFirst.mockResolvedValue({
        id: "site-1",
        tenantId: "tenant-1",
        name: "Azure Bay",
        status: SiteStatus.ARCHIVED,
        archivedAt: new Date("2026-05-01T00:00:00Z"),
        archivedSlug: "azure-bay",
        archivedPublicSubdomain: "azure-bay",
        archivedDomains: ["azure-bay.com"],
      });
      prisma.formSubmission.count.mockResolvedValueOnce(5);
      prisma.page.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(4); // published
      prisma.domain.count.mockResolvedValueOnce(2);
      prisma.searchConsoleConnection.findUnique.mockResolvedValueOnce({
        id: "sc",
      });
      prisma.deployment.findMany.mockResolvedValueOnce([
        {
          id: "dep-1",
          provider: "vercel",
          providerProjectId: "prj_123",
          providerDeployId: "dep_abc",
        },
      ]);

      const impact = await service.computeDeletionImpact("tenant-1", "site-1");

      expect(impact.counts.formSubmissions).toBe(5);
      expect(impact.counts.publishedPages).toBe(4);
      expect(impact.providerResources).toHaveLength(1);
      expect(impact.riskFlags).toEqual(
        expect.arrayContaining([
          "HAS_SUBMISSIONS",
          "HAS_PROVIDER_RESOURCES",
          "HAS_ACTIVE_INTEGRATIONS",
          "HAS_PUBLISHED_PAGES",
          "HAS_CONNECTED_DOMAINS",
        ]),
      );
      expect(impact.blockingReasons).toHaveLength(0);
    });
  });

  describe("queuePermanentDeletion", () => {
    beforeEach(() => {
      prisma.site.findFirst.mockResolvedValue({
        id: "site-1",
        tenantId: "tenant-1",
        name: "Azure Bay",
        status: SiteStatus.ARCHIVED,
        archivedAt: new Date(),
        archivedSlug: "azure-bay",
        archivedPublicSubdomain: "azure-bay",
        archivedDomains: [],
      });
      prisma.siteDeletionJob.findFirst.mockResolvedValue(null);
      prisma.siteDeletionJob.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: "job-1",
          tenantId: "tenant-1",
          siteId: "site-1",
          siteName: "Azure Bay",
          archivedSlug: "azure-bay",
          status: SiteDeletionJobStatus.QUEUED,
          progress: 0,
          totalSteps: 12,
          currentStep: null,
          requestedByUserId: null,
          errorCode: null,
          errorMessage: null,
          startedAt: null,
          completedAt: null,
          createdAt: new Date("2026-06-08T00:00:00Z"),
          updatedAt: new Date("2026-06-08T00:00:00Z"),
          ...data,
        }),
      );
    });

    it("rejects mismatched site-name confirmation", async () => {
      await expect(
        service.queuePermanentDeletion(
          "tenant-1",
          "site-1",
          { confirmSiteName: "wrong-name" },
          "user-1",
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.siteDeletionJob.create).not.toHaveBeenCalled();
    });

    it("rejects when required risk acknowledgements are missing", async () => {
      prisma.formSubmission.count.mockResolvedValueOnce(3);

      await expect(
        service.queuePermanentDeletion(
          "tenant-1",
          "site-1",
          { confirmSiteName: "Azure Bay" },
          "user-1",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "RISK_ACKNOWLEDGEMENTS_REQUIRED",
        }),
      });
    });

    it("rejects when a deletion job already exists for the site", async () => {
      prisma.siteDeletionJob.findFirst.mockResolvedValueOnce({ id: "old-job" });

      await expect(
        service.queuePermanentDeletion(
          "tenant-1",
          "site-1",
          { confirmSiteName: "Azure Bay" },
          "user-1",
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("queues the job, writes audit, and notifies admins on success", async () => {
      const result = await service.queuePermanentDeletion(
        "tenant-1",
        "site-1",
        { confirmSiteName: "Azure Bay" },
        "user-1",
      );

      expect(result.status).toBe(SiteDeletionJobStatus.QUEUED);
      expect(admin.createAuditLogForTenant).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "site.permanent_delete.queued",
          targetId: "site-1",
        }),
      );
      expect(notifications.createForTenantRoles).toHaveBeenCalled();
    });
  });

  describe("runJob", () => {
    it("does not run a job that is no longer claimable", async () => {
      prisma.siteDeletionJob.updateMany.mockResolvedValueOnce({ count: 0 });
      prisma.siteDeletionJob.findUnique.mockResolvedValueOnce({
        id: "job-1",
        tenantId: "tenant-1",
        siteId: "site-1",
        siteName: "x",
        archivedSlug: null,
        status: SiteDeletionJobStatus.RUNNING,
        progress: 0,
        totalSteps: 12,
        currentStep: null,
        requestedByUserId: null,
        errorCode: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.runJob("job-1");
      expect(result.status).toBe(SiteDeletionJobStatus.RUNNING);
      expect(prisma.site.delete).not.toHaveBeenCalled();
    });

    it("executes every deletion step, busts cache, and completes", async () => {
      prisma.siteDeletionJob.updateMany.mockResolvedValueOnce({ count: 1 });
      const baseJob = {
        id: "job-1",
        tenantId: "tenant-1",
        siteId: "site-1",
        siteName: "Azure Bay",
        archivedSlug: "azure-bay",
        status: SiteDeletionJobStatus.RUNNING,
        progress: 0,
        totalSteps: 12,
        currentStep: "delete_pages",
        requestedByUserId: "user-1",
        errorCode: null,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.siteDeletionJob.findUnique.mockResolvedValueOnce(baseJob);
      prisma.site.findUnique.mockResolvedValueOnce({
        id: "site-1",
        publicSubdomain: null,
        archivedPublicSubdomain: "azure-bay",
        archivedDomains: ["azure-bay.com"],
        domains: [{ host: "www.azure-bay.com" }],
      });

      // All deleteMany return 0 by default — set up the deletes:
      const deletes = [
        prisma.page.deleteMany,
        prisma.formDelivery.deleteMany,
        prisma.formSubmission.deleteMany,
        prisma.searchConsolePagePerformance.deleteMany,
        prisma.searchConsoleQueryPerformance.deleteMany,
        prisma.bingPagePerformance.deleteMany,
        prisma.bingQueryPerformance.deleteMany,
        prisma.seoAuditTask.deleteMany,
        prisma.seoAuditSnapshot.deleteMany,
        prisma.seoAuditRun.deleteMany,
        prisma.psiAudit.deleteMany,
        prisma.cruxRecord.deleteMany,
        prisma.hreflangIssue.deleteMany,
        prisma.hreflangScan.deleteMany,
        prisma.bingCrawlIssue.deleteMany,
        prisma.seoCrawlJob.deleteMany,
        prisma.searchConsoleUrlInspection.deleteMany,
        prisma.searchConsoleSitemap.deleteMany,
        prisma.bingSitemap.deleteMany,
        prisma.notification.deleteMany,
        prisma.translationUsage.deleteMany,
      ];
      for (const d of deletes) d.mockResolvedValue({ count: 1 });

      prisma.site.delete.mockResolvedValue({ id: "site-1" });
      prisma.siteDeletionJob.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          ...baseJob,
          ...data,
        }),
      );

      const result = await service.runJob("job-1");

      expect(prisma.site.delete).toHaveBeenCalledWith({
        where: { id: "site-1" },
      });
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { siteId: "site-1" },
      });
      expect(prisma.translationUsage.deleteMany).toHaveBeenCalledWith({
        where: { siteId: "site-1" },
      });
      expect(cache.deleteKeys).toHaveBeenCalled();
      expect(admin.createAuditLogForTenant).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "site.permanent_delete.completed",
        }),
      );
      expect(result.status).toBe(SiteDeletionJobStatus.COMPLETED);
    });

    it("marks the job as FAILED on error and records an audit", async () => {
      prisma.siteDeletionJob.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.siteDeletionJob.findUnique.mockResolvedValueOnce({
        id: "job-1",
        tenantId: "tenant-1",
        siteId: "site-1",
        siteName: "Azure Bay",
        archivedSlug: null,
        status: SiteDeletionJobStatus.RUNNING,
        progress: 0,
        totalSteps: 12,
        currentStep: "delete_pages",
        requestedByUserId: "user-1",
        errorCode: null,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.site.findUnique.mockResolvedValueOnce({
        id: "site-1",
        publicSubdomain: null,
        archivedPublicSubdomain: null,
        archivedDomains: [],
        domains: [],
      });
      prisma.page.deleteMany.mockRejectedValueOnce(new Error("db down"));
      prisma.siteDeletionJob.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: "job-1",
          tenantId: "tenant-1",
          siteId: "site-1",
          siteName: "Azure Bay",
          archivedSlug: null,
          status: SiteDeletionJobStatus.FAILED,
          progress: 0,
          totalSteps: 12,
          currentStep: "delete_pages",
          requestedByUserId: "user-1",
          errorCode: null,
          errorMessage: null,
          startedAt: new Date(),
          completedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        }),
      );

      const result = await service.runJob("job-1");

      expect(result.status).toBe(SiteDeletionJobStatus.FAILED);
      expect(prisma.site.delete).not.toHaveBeenCalled();
      expect(admin.createAuditLogForTenant).toHaveBeenCalledWith(
        expect.objectContaining({ action: "site.permanent_delete.failed" }),
      );
    });
  });
});
