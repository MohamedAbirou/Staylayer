/// <reference types="jest" />

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import {
  SiteDeletionJobStatus,
  SiteStatus,
  SubscriptionStatus,
  TenantDeletionJobStatus,
  TenantMembershipRole,
} from "@prisma/client";

import { TenantDeletionService } from "./tenant-deletion.service";

function buildPrismaMock() {
  return {
    tenant: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    site: {
      findMany: jest.fn(),
    },
    tenantMembership: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    workspaceInvitation: { count: jest.fn() },
    page: { count: jest.fn() },
    deployment: { count: jest.fn(), findMany: jest.fn() },
    domain: { count: jest.fn() },
    formSubmission: { count: jest.fn() },
    formDelivery: { count: jest.fn() },
    auditLog: { count: jest.fn() },
    siteDeletionJob: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    translationJob: { count: jest.fn() },
    notification: { count: jest.fn(), deleteMany: jest.fn() },
    notificationPreference: { deleteMany: jest.fn() },
    translationUsage: { count: jest.fn(), deleteMany: jest.fn() },
    tenantOnboarding: { deleteMany: jest.fn() },
    searchConsoleConnection: { count: jest.fn() },
    bingWebmasterConnection: { count: jest.fn() },
    seoAuditSchedule: { count: jest.fn() },
    subscription: { findMany: jest.fn() },
    tenantDeletionJob: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

function defaultCounts(prisma: ReturnType<typeof buildPrismaMock>) {
  for (const model of Object.values(prisma) as Array<{
    [k: string]: jest.Mock | undefined;
  }>) {
    if (model.count) model.count.mockResolvedValue(0);
  }
  prisma.site.findMany.mockResolvedValue([]);
  prisma.deployment.findMany.mockResolvedValue([]);
  prisma.subscription.findMany.mockResolvedValue([]);
  prisma.tenantMembership.findFirst.mockResolvedValue({
    role: TenantMembershipRole.OWNER,
  });
  prisma.tenantDeletionJob.findFirst.mockResolvedValue(null);
  prisma.siteDeletionJob.findFirst.mockResolvedValue(null);
}

describe("TenantDeletionService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let notifications: { createForTenantRoles: jest.Mock };
  let admin: { createAuditLogForTenant: jest.Mock };
  let config: { get: jest.Mock };
  let cache: { deleteKeys: jest.Mock };
  let users: { verifyPassword: jest.Mock };
  let service: TenantDeletionService;

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
    users = { verifyPassword: jest.fn().mockResolvedValue(true) };
    service = new TenantDeletionService(
      prisma as never,
      notifications as never,
      admin as never,
      config as never,
      users as never,
      cache as never,
    );
  });

  function mockTenant() {
    prisma.tenant.findUnique.mockResolvedValue({
      id: "tenant-1",
      name: "Acme Co",
      slug: "acme",
    });
  }

  describe("computeDeletionImpact", () => {
    it("throws when the tenant is missing", async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      await expect(
        service.computeDeletionImpact("tenant-x"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("aggregates counts, provider resources, subscriptions, and risk flags", async () => {
      mockTenant();
      prisma.site.findMany.mockResolvedValue([
        { id: "s1", name: "Active Site", status: SiteStatus.ACTIVE },
        { id: "s2", name: "Old Site", status: SiteStatus.ARCHIVED },
      ]);
      prisma.tenantMembership.count
        .mockResolvedValueOnce(3) // members
        .mockResolvedValueOnce(1); // owners
      prisma.formSubmission.count.mockResolvedValue(7);
      prisma.domain.count.mockResolvedValue(2);
      prisma.searchConsoleConnection.count.mockResolvedValue(1);
      prisma.deployment.findMany.mockResolvedValue([
        {
          id: "dep-1",
          siteId: "s1",
          provider: "vercel",
          providerProjectId: "prj_x",
          providerDeployId: "dep_y",
        },
      ]);
      prisma.subscription.findMany.mockResolvedValue([
        {
          id: "sub-1",
          provider: "stripe",
          planKey: "growth",
          status: SubscriptionStatus.ACTIVE,
          providerCustomerId: "cus_1",
          providerSubscriptionId: "sub_x",
          currentPeriodEnd: new Date("2026-07-01"),
          cancelAtPeriodEnd: false,
        },
      ]);

      const impact = await service.computeDeletionImpact("tenant-1");

      expect(impact.counts.totalSites).toBe(2);
      expect(impact.counts.activeSites).toBe(1);
      expect(impact.counts.archivedSites).toBe(1);
      expect(impact.providerResources).toHaveLength(1);
      expect(impact.activeSubscriptions).toHaveLength(1);
      expect(impact.riskFlags).toEqual(
        expect.arrayContaining([
          "HAS_OTHER_MEMBERS",
          "HAS_ACTIVE_SITES",
          "HAS_ARCHIVED_SITES",
          "HAS_ACTIVE_SUBSCRIPTION",
          "HAS_PROVIDER_RESOURCES",
          "HAS_CONNECTED_DOMAINS",
          "HAS_FORM_SUBMISSIONS",
          "HAS_ACTIVE_INTEGRATIONS",
        ]),
      );
      expect(impact.blockingReasons).toEqual([]);
    });
  });

  describe("queuePermanentDeletion", () => {
    beforeEach(() => {
      mockTenant();
      prisma.tenantDeletionJob.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          id: "tjob-1",
          tenantId: "tenant-1",
          tenantName: "Acme Co",
          tenantSlug: "acme",
          status: TenantDeletionJobStatus.QUEUED,
          progress: 0,
          totalSteps: 5,
          currentStep: null,
          requestedByUserId: "user-1",
          errorCode: null,
          errorMessage: null,
          startedAt: null,
          completedAt: null,
          createdAt: new Date("2026-06-19T00:00:00Z"),
          updatedAt: new Date("2026-06-19T00:00:00Z"),
          ...data,
        }),
      );
    });

    it("rejects non-owners", async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue({
        role: TenantMembershipRole.ADMIN,
      });
      await expect(
        service.queuePermanentDeletion(
          "tenant-1",
          { confirmTenantSlug: "acme" },
          "user-2",
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("rejects mismatched slug confirmation", async () => {
      await expect(
        service.queuePermanentDeletion(
          "tenant-1",
          { confirmTenantSlug: "wrong" },
          "user-1",
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.tenantDeletionJob.create).not.toHaveBeenCalled();
    });

    it("matches slug case-insensitively", async () => {
      const result = await service.queuePermanentDeletion(
        "tenant-1",
        { confirmTenantSlug: "ACME" },
        "user-1",
      );
      expect(result.status).toBe(TenantDeletionJobStatus.QUEUED);
    });

    it("rejects when required risk acks are missing", async () => {
      prisma.tenantMembership.count
        .mockResolvedValueOnce(3) // members > 1
        .mockResolvedValueOnce(1); // owners

      await expect(
        service.queuePermanentDeletion(
          "tenant-1",
          { confirmTenantSlug: "acme" },
          "user-1",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "RISK_ACKNOWLEDGEMENTS_REQUIRED",
          missingAcknowledgements: expect.arrayContaining([
            "acknowledgeOtherMembers",
          ]),
        }),
      });
    });

    it("rejects when a tenant deletion job is already in flight", async () => {
      prisma.tenantDeletionJob.findFirst.mockResolvedValueOnce({
        id: "existing",
      });
      await expect(
        service.queuePermanentDeletion(
          "tenant-1",
          { confirmTenantSlug: "acme" },
          "user-1",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "TENANT_DELETION_ALREADY_IN_PROGRESS",
        }),
      });
    });

    it("rejects when a site deletion job is in flight", async () => {
      prisma.siteDeletionJob.findFirst.mockResolvedValueOnce({
        id: "site-job",
      });
      await expect(
        service.queuePermanentDeletion(
          "tenant-1",
          { confirmTenantSlug: "acme" },
          "user-1",
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "SITE_DELETION_IN_PROGRESS",
        }),
      });
    });

    it("queues the job, writes audit, and notifies admins on success", async () => {
      const result = await service.queuePermanentDeletion(
        "tenant-1",
        { confirmTenantSlug: "acme" },
        "user-1",
      );

      expect(result.status).toBe(TenantDeletionJobStatus.QUEUED);
      expect(prisma.tenantDeletionJob.create).toHaveBeenCalled();
      expect(admin.createAuditLogForTenant).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "tenant.permanent_delete.queued",
          tenantId: "tenant-1",
          targetId: "tenant-1",
        }),
      );
      expect(notifications.createForTenantRoles).toHaveBeenCalled();
    });
  });

  describe("runJob", () => {
    const baseJob = {
      id: "tjob-1",
      tenantId: "tenant-1",
      tenantName: "Acme Co",
      tenantSlug: "acme",
      status: TenantDeletionJobStatus.RUNNING,
      progress: 0,
      totalSteps: 5,
      currentStep: "snapshot_hosts",
      requestedByUserId: "user-1",
      errorCode: null,
      errorMessage: null,
      acknowledgements: null,
      impactSnapshot: null,
      resultSummary: null,
      startedAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("returns the existing job when not claimable", async () => {
      prisma.tenantDeletionJob.updateMany.mockResolvedValueOnce({ count: 0 });
      prisma.tenantDeletionJob.findUnique.mockResolvedValueOnce(baseJob);

      const result = await service.runJob("tjob-1");
      expect(result.status).toBe(TenantDeletionJobStatus.RUNNING);
      expect(prisma.tenant.delete).not.toHaveBeenCalled();
    });

    it("executes every deletion step and cascades the tenant on success", async () => {
      prisma.tenantDeletionJob.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.tenantDeletionJob.findUnique.mockResolvedValueOnce(baseJob);

      prisma.site.findMany
        .mockResolvedValueOnce([
          {
            id: "s1",
            publicSubdomain: null,
            archivedPublicSubdomain: "old-bay",
            archivedDomains: ["old-bay.com"],
            domains: [{ host: "www.old-bay.com" }],
          },
        ])
        .mockResolvedValueOnce([{ id: "s1" }]);

      for (const fn of [
        prisma.notification.deleteMany,
        prisma.notificationPreference.deleteMany,
        prisma.translationUsage.deleteMany,
        prisma.tenantOnboarding.deleteMany,
      ]) {
        fn.mockResolvedValue({ count: 0 });
      }
      prisma.tenant.delete.mockResolvedValue({ id: "tenant-1" });
      prisma.tenantDeletionJob.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          ...baseJob,
          ...data,
        }),
      );

      const result = await service.runJob("tjob-1");

      expect(prisma.tenant.delete).toHaveBeenCalledWith({
        where: { id: "tenant-1" },
      });
      expect(cache.deleteKeys).toHaveBeenCalled();
      const lastUpdateCall =
        prisma.tenantDeletionJob.update.mock.calls.at(-1)?.[0];
      expect(lastUpdateCall?.data?.status).toBe(
        TenantDeletionJobStatus.COMPLETED,
      );
      // No audit log on completion — tenant is gone.
      expect(admin.createAuditLogForTenant).not.toHaveBeenCalled();
      expect(result.status).toBe(TenantDeletionJobStatus.COMPLETED);
    });

    it("marks the job FAILED with errorCode on a Prisma error", async () => {
      prisma.tenantDeletionJob.updateMany.mockResolvedValueOnce({ count: 1 });
      prisma.tenantDeletionJob.findUnique.mockResolvedValueOnce(baseJob);
      prisma.site.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
      for (const fn of [
        prisma.notification.deleteMany,
        prisma.notificationPreference.deleteMany,
        prisma.translationUsage.deleteMany,
        prisma.tenantOnboarding.deleteMany,
      ]) {
        fn.mockResolvedValue({ count: 0 });
      }
      prisma.tenant.delete.mockRejectedValueOnce(
        new Error("boom: cannot delete tenant"),
      );
      prisma.tenantDeletionJob.update.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          ...baseJob,
          ...data,
        }),
      );

      const result = await service.runJob("tjob-1");
      expect(result.status).toBe(TenantDeletionJobStatus.FAILED);
      expect(result.errorMessage).toMatch(/boom/);
    });
  });

  describe("getJobForRequester", () => {
    it("returns the job when the requester matches", async () => {
      prisma.tenantDeletionJob.findUnique.mockResolvedValue({
        id: "tjob-1",
        tenantId: "tenant-1",
        tenantName: "Acme",
        tenantSlug: "acme",
        status: TenantDeletionJobStatus.COMPLETED,
        progress: 5,
        totalSteps: 5,
        currentStep: null,
        requestedByUserId: "user-1",
        errorCode: null,
        errorMessage: null,
        startedAt: new Date(),
        completedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getJobForRequester("tjob-1", "user-1");
      expect(result.status).toBe(TenantDeletionJobStatus.COMPLETED);
    });

    it("throws NotFound when a different user asks", async () => {
      prisma.tenantDeletionJob.findUnique.mockResolvedValue({
        id: "tjob-1",
        requestedByUserId: "user-1",
      });
      await expect(
        service.getJobForRequester("tjob-1", "user-2"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

// Silence unused import linter — SiteDeletionJobStatus is exercised
// indirectly through the cross-block path during queue tests.
void SiteDeletionJobStatus.QUEUED;
