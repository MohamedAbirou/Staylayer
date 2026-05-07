/// <reference types="jest" />

import { ConfigService } from "@nestjs/config";
import {
  DomainStatus,
  OperationalAlertStatus,
  OperationalAlertType,
} from "@prisma/client";
import { DeploymentProvider } from "../deployments/deployment-provider.port";
import { PrismaService } from "../prisma/prisma.service";
import { DomainVerificationService } from "./domain-verification.service";

describe("DomainVerificationService", () => {
  let service: DomainVerificationService;
  let prisma: {
    domain: {
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    operationalAlert: {
      upsert: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let deploymentProvider: jest.Mocked<DeploymentProvider>;

  beforeEach(() => {
    prisma = {
      domain: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      operationalAlert: {
        upsert: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    deploymentProvider = {
      name: "vercel",
      ensureProject: jest.fn(),
      syncEnvironmentVariables: jest.fn(),
      triggerDeployment: jest.fn(),
      getDeploymentStatus: jest.fn(),
      ensureDomainAttachment: jest.fn(),
      getDomainAttachmentStatus: jest.fn(),
    };

    deploymentProvider.ensureDomainAttachment.mockResolvedValue({
      domain: "stay.example.com",
      providerDomainId: "vercel-domain-1",
      providerStatus: "vercel",
      verificationStatus: "verified",
      dnsConfig: null,
      isAssigned: true,
      isVerified: true,
      isFailed: false,
      errorMessage: null,
      metadata: {},
    });

    service = new DomainVerificationService(
      prisma as unknown as PrismaService,
      {
        get: jest.fn(),
      } as unknown as ConfigService,
      deploymentProvider,
    );
  });

  it("marks the domain as dns_required when no DNS records resolve", async () => {
    prisma.domain.findUnique.mockResolvedValue({
      id: "domain-1",
      siteId: "site-1",
      host: "stay.example.com",
      status: DomainStatus.PENDING,
      createdAt: new Date("2026-05-05T10:00:00.000Z"),
      verificationRequestedAt: new Date("2026-05-05T10:00:00.000Z"),
      verifiedAt: null,
      site: {
        deployments: [
          {
            providerProjectId: "prj-1",
            url: "https://stay-demo.vercel.app",
          },
        ],
      },
    });
    jest
      .spyOn(service as never, "resolveDnsState")
      .mockResolvedValue({ cname: null, addresses: [] } as never);

    await service.verifyDomain("domain-1", "manual");

    expect(prisma.domain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "domain-1" },
        data: expect.objectContaining({
          status: DomainStatus.DNS_REQUIRED,
          lastError: "No DNS record found for stay.example.com",
        }),
      }),
    );
    expect(prisma.operationalAlert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          siteId: "site-1",
          type: OperationalAlertType.DOMAIN_FAILURE,
          status: OperationalAlertStatus.OPEN,
        }),
      }),
    );
  });

  it("marks the domain active when DNS resolves and HTTPS is reachable", async () => {
    prisma.domain.findUnique.mockResolvedValue({
      id: "domain-1",
      siteId: "site-1",
      host: "stay.example.com",
      status: DomainStatus.VERIFYING,
      createdAt: new Date("2026-05-05T10:00:00.000Z"),
      verificationRequestedAt: new Date("2026-05-05T10:00:00.000Z"),
      verifiedAt: null,
      site: {
        deployments: [
          {
            providerProjectId: "prj-1",
            url: "https://stay-demo.vercel.app",
          },
        ],
      },
    });
    jest.spyOn(service as never, "resolveDnsState").mockResolvedValue({
      cname: "stay-demo.vercel.app",
      addresses: [],
    } as never);
    jest.spyOn(service as never, "probeHttps").mockResolvedValue({
      active: true,
      httpStatus: 200,
      errorMessage: null,
    } as never);

    await service.verifyDomain("domain-1", "manual");

    expect(prisma.domain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DomainStatus.ACTIVE,
          lastError: null,
        }),
      }),
    );
  });

  it("marks the domain as provider_attach_pending when provider verification is incomplete", async () => {
    deploymentProvider.ensureDomainAttachment.mockResolvedValueOnce({
      domain: "stay.example.com",
      providerDomainId: "vercel-domain-1",
      providerStatus: "vercel",
      verificationStatus: "pending",
      dnsConfig: null,
      isAssigned: true,
      isVerified: false,
      isFailed: false,
      errorMessage: null,
      metadata: {},
    });
    prisma.domain.findUnique.mockResolvedValue({
      id: "domain-1",
      siteId: "site-1",
      host: "stay.example.com",
      status: DomainStatus.PENDING,
      createdAt: new Date("2026-05-05T10:00:00.000Z"),
      verificationRequestedAt: new Date("2026-05-05T10:00:00.000Z"),
      verifiedAt: null,
      site: {
        deployments: [
          {
            providerProjectId: "prj-1",
            url: "https://stay-demo.vercel.app",
          },
        ],
      },
    });
    jest.spyOn(service as never, "resolveDnsState").mockResolvedValue({
      cname: "stay-demo.vercel.app",
      addresses: [],
    } as never);

    await service.verifyDomain("domain-1", "manual");

    expect(prisma.domain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DomainStatus.PROVIDER_ATTACH_PENDING,
          lastError:
            "Provider attachment is still pending for stay.example.com",
        }),
      }),
    );
  });

  it("records the exact provider-recommended DNS record when configuration is wrong", async () => {
    deploymentProvider.ensureDomainAttachment.mockResolvedValueOnce({
      domain: "stay.example.com",
      providerDomainId: "vercel-domain-1",
      providerStatus: "vercel",
      verificationStatus: "pending",
      dnsConfig: {
        configuredBy: "A",
        acceptedChallenges: ["dns-01"],
        misconfigured: true,
        recommendedRecords: [
          {
            type: "A",
            name: "@",
            host: "stay.example.com",
            value: "216.198.79.1",
            acceptedValues: ["216.198.79.1"],
            rank: 1,
          },
        ],
      },
      isAssigned: true,
      isVerified: false,
      isFailed: false,
      errorMessage: null,
      metadata: {},
    });
    prisma.domain.findUnique.mockResolvedValue({
      id: "domain-1",
      siteId: "site-1",
      host: "stay.example.com",
      status: DomainStatus.PENDING,
      createdAt: new Date("2026-05-05T10:00:00.000Z"),
      verificationRequestedAt: new Date("2026-05-05T10:00:00.000Z"),
      verifiedAt: null,
      site: {
        deployments: [
          {
            providerProjectId: "prj-1",
            url: "https://stay-demo.vercel.app",
          },
        ],
      },
    });
    jest.spyOn(service as never, "resolveDnsState").mockResolvedValue({
      cname: null,
      addresses: ["76.76.21.21"],
    } as never);

    await service.verifyDomain("domain-1", "manual");

    expect(prisma.domain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: DomainStatus.DNS_REQUIRED,
          lastError: "A record for @ should point to 216.198.79.1",
          verificationDetails: expect.objectContaining({
            providerConfiguredBy: "A",
            recommendedRecords: [
              expect.objectContaining({
                type: "A",
                name: "@",
                isMatch: false,
              }),
            ],
          }),
        }),
      }),
    );
  });
});
