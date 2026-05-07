/// <reference types="jest" />

import { ConflictException } from "@nestjs/common";
import { DomainStatus } from "@prisma/client";
import { BillingService } from "../billing/billing.service";
import { PrismaService } from "../prisma/prisma.service";
import { DomainVerificationService } from "./domain-verification.service";
import { DomainsService } from "./domains.service";

describe("DomainsService", () => {
  let service: DomainsService;
  let prisma: {
    domain: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let billingService: {
    assertCanAddDomain: jest.Mock;
  };
  let domainVerificationService: {
    requestVerification: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      domain: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    billingService = {
      assertCanAddDomain: jest.fn().mockResolvedValue(undefined),
    };
    domainVerificationService = {
      requestVerification: jest.fn(),
    };

    service = new DomainsService(
      prisma as unknown as PrismaService,
      billingService as unknown as BillingService,
      domainVerificationService as unknown as DomainVerificationService,
    );
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
