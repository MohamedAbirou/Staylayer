/// <reference types="jest" />

import { ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainStatus, HostVariant } from "@prisma/client";
import { BillingService } from "../billing/billing.service";
import { PrismaService } from "../prisma/prisma.service";
import { PublicRuntimeCacheService } from "../public-runtime/public-runtime.cache.service";
import { RevalidationService } from "../revalidation/revalidation.service";
import { DomainVerificationService } from "./domain-verification.service";
import { DomainsService } from "./domains.service";

describe("DomainsService", () => {
  let service: DomainsService;
  let prisma: {
    domain: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    site: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    deployment: {
      findFirst: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
  };
  let billingService: {
    assertCanAddDomain: jest.Mock;
  };
  let domainVerificationService: {
    requestVerification: jest.Mock;
    getConfiguredWebsiteProjectId: jest.Mock;
    getConfiguredWebsiteExpectedTarget: jest.Mock;
  };
  let cacheService: { deleteKeys: jest.Mock };
  let revalidationService: { revalidateSite: jest.Mock };

  beforeEach(() => {
    prisma = {
      domain: {
        findMany: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      site: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      deployment: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(),
    };
    configService = {
      get: jest.fn(),
    };
    billingService = {
      assertCanAddDomain: jest.fn().mockResolvedValue(undefined),
    };
    domainVerificationService = {
      requestVerification: jest.fn(),
      getConfiguredWebsiteProjectId: jest.fn(),
      getConfiguredWebsiteExpectedTarget: jest.fn(),
    };
    cacheService = { deleteKeys: jest.fn().mockResolvedValue(undefined) };
    revalidationService = {
      revalidateSite: jest.fn().mockResolvedValue(undefined),
    };

    service = new DomainsService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      billingService as unknown as BillingService,
      domainVerificationService as unknown as DomainVerificationService,
      cacheService as unknown as PublicRuntimeCacheService,
      revalidationService as unknown as RevalidationService,
    );
  });

  it("returns the shared runtime profile for a site", async () => {
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      publicSubdomain: "sunset-villa",
      preferredHostVariant: HostVariant.APEX,
      publishedRevision: 4,
    });
    prisma.deployment.findFirst.mockResolvedValue({
      id: "dep-9",
      updatedAt: new Date("2026-05-13T20:00:01.000Z"),
      metadata: { publishedAt: "2026-05-13T20:00:01.000Z" },
    });
    configService.get.mockReturnValue("staylayer.com");
    domainVerificationService.getConfiguredWebsiteProjectId.mockReturnValue(
      "website-project-id",
    );
    domainVerificationService.getConfiguredWebsiteExpectedTarget.mockReturnValue(
      "staylayer-web.vercel.app",
    );

    await expect(service.getRuntimeProfile("site-1")).resolves.toEqual({
      siteId: "site-1",
      publicSubdomain: "sunset-villa",
      preferredHostVariant: HostVariant.APEX,
      platformRootDomain: "staylayer.com",
      defaultHostname: "sunset-villa.staylayer.com",
      defaultHostnameIssue: null,
      websiteProjectId: "website-project-id",
      websiteProjectTarget: "staylayer-web.vercel.app",
      sharedRuntimeReady: true,
      publishedRevision: 4,
      lastPublishedAt: "2026-05-13T20:00:01.000Z",
      lastPublishedDeploymentId: "dep-9",
    });
  });

  it("checks plan domain capacity before creating a new custom domain", async () => {
    prisma.domain.findUnique.mockResolvedValue(null);
    prisma.domain.count.mockResolvedValue(0);
    prisma.domain.create.mockResolvedValue({
      id: "domain-1",
      host: "stay.example.com",
      status: DomainStatus.PENDING,
      isPrimary: true,
      lastCheckedAt: null,
      lastError: null,
      verificationDetails: null,
      createdAt: new Date("2026-05-05T12:00:00.000Z"),
    });

    await service.add("site-1", "stay.example.com");

    expect(billingService.assertCanAddDomain).toHaveBeenCalledWith("site-1");
    expect(prisma.domain.create).toHaveBeenCalled();
  });

  it("does not create a domain when the plan limit is exhausted", async () => {
    prisma.domain.findUnique.mockResolvedValue(null);
    billingService.assertCanAddDomain.mockRejectedValue(
      new ConflictException({
        code: "PLAN_LIMIT_EXCEEDED",
        message: "This plan does not include another custom domain",
      }),
    );

    await expect(
      service.add("site-1", "stay.example.com"),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.domain.create).not.toHaveBeenCalled();
  });

  it("includes DNS diagnostics in the admin domain list payload", async () => {
    prisma.domain.findMany.mockResolvedValue([
      {
        id: "domain-1",
        siteId: "site-1",
        host: "www.example.com",
        status: DomainStatus.DNS_REQUIRED,
        isPrimary: true,
        lastError: null,
        lastCheckedAt: new Date("2026-05-07T12:00:00.000Z"),
        verifiedAt: null,
        verificationDetails: {
          expectedTarget: "cname.vercel-dns.com",
          providerAttachmentStatus: "pending",
          providerVerificationStatus: "misconfigured",
          providerError: "Domain missing provider target",
          providerConfiguredBy: "cname",
          providerMisconfigured: true,
          providerAcceptedChallenges: ["cname"],
          recommendedRecords: [
            {
              type: "CNAME",
              name: "www",
              host: "www",
              value: "cname.vercel-dns.com",
              acceptedValues: ["cname.vercel-dns.com"],
              rank: 1,
              isMatch: false,
            },
          ],
          observedCname: "wrong-target.example.net",
          observedAddresses: [],
          dnsConfigured: true,
          dnsMatchesExpected: false,
          sslStatus: "provisioning",
          sslActive: false,
        },
        site: {
          name: "Harbor House",
          tenant: { name: "Northwind" },
        },
      },
    ]);
    prisma.domain.count.mockResolvedValue(1);

    await expect(service.adminList({})).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: "domain-1",
          domain: "www.example.com",
          verificationStatus: "PENDING",
          dnsConfigured: true,
          dnsMatchesExpected: false,
          providerError: "Domain missing provider target",
          providerConfiguredBy: "cname",
          providerMisconfigured: true,
          providerAcceptedChallenges: ["cname"],
          recommendedRecords: [
            expect.objectContaining({
              type: "CNAME",
              value: "cname.vercel-dns.com",
              isMatch: false,
            }),
          ],
          observedCname: "wrong-target.example.net",
          sslStatus: "provisioning",
          nextAction:
            "Update your DNS records to point at the deployment target.",
        }),
      ],
      total: 1,
    });
  });
});
