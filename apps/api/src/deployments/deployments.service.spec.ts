/// <reference types="jest" />

import { ConfigService } from "@nestjs/config";
import { DeploymentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DeploymentProvider } from "./deployment-provider.port";
import { DeploymentsService } from "./deployments.service";

describe("DeploymentsService", () => {
  let service: DeploymentsService;
  let prisma: {
    deployment: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    domain: {
      findFirst: jest.Mock;
    };
    site: {
      findUnique: jest.Mock;
    };
  };
  let provider: jest.Mocked<DeploymentProvider>;
  let configService: {
    get: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      deployment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      domain: {
        findFirst: jest.fn(),
      },
      site: {
        findUnique: jest.fn(),
      },
    };

    provider = {
      name: "vercel",
      ensureProject: jest.fn(),
      syncEnvironmentVariables: jest.fn(),
      triggerDeployment: jest.fn(),
      getDeploymentStatus: jest.fn(),
      ensureDomainAttachment: jest.fn(),
      getDomainAttachmentStatus: jest.fn(),
    };

    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          DEPLOYMENTS_CMS_API_URL: "https://api.example.com",
          DEPLOYMENTS_REVALIDATE_SECRET: "secret-123",
          DEPLOYMENTS_WEBSITE_ROOT_DIRECTORY: "apps/website",
          DEPLOYMENTS_WEBSITE_BUILD_COMMAND:
            "cd ../.. && pnpm install && pnpm --filter @myallocator/website build",
          DEPLOYMENTS_WEBSITE_INSTALL_COMMAND:
            "cd ../.. && pnpm install --frozen-lockfile",
          DEPLOYMENTS_WEBSITE_OUTPUT_DIRECTORY: ".next",
          DEPLOYMENTS_WEBSITE_FRAMEWORK: "nextjs",
          DEPLOYMENTS_PROJECT_NAME_PREFIX: "maa-site",
        };

        return values[key];
      }),
    };

    service = new DeploymentsService(
      prisma as unknown as PrismaService,
      configService as unknown as ConfigService,
      provider,
    );
  });

  it("returns an existing in-flight deployment without calling the provider", async () => {
    const deployment = {
      id: "dep-1",
      siteId: "site-1",
      status: DeploymentStatus.PENDING,
    };

    prisma.deployment.findFirst.mockResolvedValue(deployment);

    await expect(service.provisionSite("site-1")).resolves.toBe(deployment);

    expect(prisma.site.findUnique).not.toHaveBeenCalled();
    expect(provider.ensureProject).not.toHaveBeenCalled();
  });

  it("creates a deployment, syncs env, and stores provider metadata", async () => {
    prisma.deployment.findFirst.mockResolvedValueOnce(null);
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      name: "Harbor House",
      slug: "harbor-house",
      primaryLocale: "en",
      enabledLocales: ["en", "fr"],
      settings: { siteName: "Harbor House" },
      domains: [{ host: "stay.harborhouse.example" }],
      deployments: [],
    });
    prisma.deployment.create.mockResolvedValue({
      id: "dep-1",
      siteId: "site-1",
      status: DeploymentStatus.PENDING,
      provider: "vercel",
      providerProjectId: null,
      providerDeployId: null,
      url: null,
      metadata: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.deployment.update
      .mockResolvedValueOnce({ status: DeploymentStatus.CREATING_PROJECT })
      .mockResolvedValueOnce({ status: DeploymentStatus.SYNCING_ENV })
      .mockResolvedValueOnce({ status: DeploymentStatus.DEPLOYING })
      .mockResolvedValueOnce({
        id: "dep-1",
        siteId: "site-1",
        status: DeploymentStatus.DEPLOYING,
        provider: "vercel",
        providerProjectId: "prj_1",
        providerDeployId: "dpl_1",
        url: "https://harbor-house.vercel.app",
        metadata: {
          providerReadyState: "BUILDING",
        },
        errorMessage: null,
      });

    provider.ensureProject.mockResolvedValue({
      projectId: "prj_1",
      projectName: "maa-site-harbor-house-12345678",
      created: true,
    });
    provider.syncEnvironmentVariables.mockResolvedValue();
    provider.triggerDeployment.mockResolvedValue({
      providerDeployId: "dpl_1",
      url: "https://harbor-house.vercel.app",
      readyState: "BUILDING",
      rawStatus: "QUEUED",
      isLive: false,
      isFailed: false,
      errorMessage: null,
    });

    const result = await service.provisionSite("site-1");

    expect(provider.ensureProject).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: expect.stringContaining("harbor-house"),
        projectSettings: expect.objectContaining({
          framework: "nextjs",
          rootDirectory: "apps/website",
          buildCommand:
            "cd ../.. && corepack prepare pnpm@10.33.4 --activate && pnpm --filter @myallocator/website build",
          installCommand:
            "cd ../.. && corepack prepare pnpm@10.33.4 --activate && pnpm install --registry https://registry.npmjs.org --fetch-timeout=60000 --fetch-retries=3 --no-frozen-lockfile",
          outputDirectory: ".next",
          nodeVersion: "20.x",
        }),
      }),
    );
    expect(provider.syncEnvironmentVariables).toHaveBeenCalledWith(
      expect.objectContaining({
        environment: expect.arrayContaining([
          expect.objectContaining({ key: "REQUIRE_CMS_DATA", value: "1" }),
          expect.objectContaining({ key: "SITE_ID", value: "site-1" }),
          expect.objectContaining({
            key: "NEXT_PUBLIC_SITE_ID",
            value: "site-1",
          }),
          expect.objectContaining({ key: "SITE_SLUG", value: "harbor-house" }),
          expect.objectContaining({
            key: "REVALIDATE_SECRET",
            value: "secret-123",
            type: "encrypted",
          }),
        ]),
      }),
    );
    expect(provider.triggerDeployment).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "prj_1",
      }),
    );
    expect(result).toMatchObject({
      status: DeploymentStatus.DEPLOYING,
      providerProjectId: "prj_1",
      providerDeployId: "dpl_1",
    });
  });

  it("creates a fresh deployment when a live deployment already exists", async () => {
    prisma.deployment.findFirst.mockResolvedValueOnce(null);
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      name: "Harbor House",
      slug: "harbor-house",
      primaryLocale: "en",
      enabledLocales: ["en", "fr"],
      settings: { siteName: "Harbor House" },
      domains: [{ host: "stay.harborhouse.example" }],
      deployments: [
        {
          id: "dep-live",
          providerProjectId: "prj_live",
          providerDeployId: "dpl_live",
          status: DeploymentStatus.LIVE,
        },
      ],
    });
    prisma.deployment.create.mockResolvedValue({
      id: "dep-2",
      siteId: "site-1",
      status: DeploymentStatus.PENDING,
      provider: "vercel",
      providerProjectId: "prj_live",
      providerDeployId: null,
      url: null,
      metadata: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.deployment.update
      .mockResolvedValueOnce({ status: DeploymentStatus.CREATING_PROJECT })
      .mockResolvedValueOnce({ status: DeploymentStatus.SYNCING_ENV })
      .mockResolvedValueOnce({ status: DeploymentStatus.DEPLOYING })
      .mockResolvedValueOnce({
        id: "dep-2",
        siteId: "site-1",
        status: DeploymentStatus.DEPLOYING,
        provider: "vercel",
        providerProjectId: "prj_live",
        providerDeployId: "dpl_2",
        url: "https://harbor-house.vercel.app",
        metadata: {
          providerReadyState: "BUILDING",
        },
        errorMessage: null,
      });

    provider.ensureProject.mockResolvedValue({
      projectId: "prj_live",
      projectName: "maa-site-harbor-house-12345678",
      created: false,
    });
    provider.syncEnvironmentVariables.mockResolvedValue();
    provider.triggerDeployment.mockResolvedValue({
      providerDeployId: "dpl_2",
      url: "https://harbor-house.vercel.app",
      readyState: "BUILDING",
      rawStatus: "QUEUED",
      isLive: false,
      isFailed: false,
      errorMessage: null,
    });

    const result = await service.provisionSite("site-1");

    expect(provider.ensureProject).toHaveBeenCalledWith(
      expect.objectContaining({
        existingProjectId: "prj_live",
      }),
    );
    expect(provider.triggerDeployment).toHaveBeenCalledWith(
      expect.objectContaining({
        previousDeploymentId: "dpl_live",
      }),
    );
    expect(result).toMatchObject({
      id: "dep-2",
      status: DeploymentStatus.DEPLOYING,
      providerProjectId: "prj_live",
    });
  });

  it("marks the deployment failed when provider provisioning throws", async () => {
    prisma.deployment.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      name: "Harbor House",
      slug: "harbor-house",
      primaryLocale: "en",
      enabledLocales: ["en"],
      settings: { siteName: "Harbor House" },
      domains: [],
      deployments: [],
    });
    prisma.deployment.create.mockResolvedValue({
      id: "dep-1",
      siteId: "site-1",
      status: DeploymentStatus.PENDING,
      provider: "vercel",
      providerProjectId: null,
      providerDeployId: null,
      url: null,
      metadata: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.deployment.update
      .mockResolvedValueOnce({ status: DeploymentStatus.CREATING_PROJECT })
      .mockResolvedValueOnce({ status: DeploymentStatus.SYNCING_ENV })
      .mockResolvedValueOnce({
        id: "dep-1",
        siteId: "site-1",
        status: DeploymentStatus.FAILED,
        errorMessage: "env sync failed",
      });

    provider.ensureProject.mockResolvedValue({
      projectId: "prj_1",
      projectName: "maa-site-harbor-house-12345678",
      created: true,
    });
    provider.syncEnvironmentVariables.mockRejectedValue(
      new Error("env sync failed"),
    );

    await expect(service.provisionSite("site-1")).resolves.toMatchObject({
      status: DeploymentStatus.FAILED,
      errorMessage: "env sync failed",
    });
  });

  it("creates a new retry attempt for failed deployments and reuses the project id", async () => {
    prisma.deployment.findUnique.mockResolvedValue({
      id: "dep-failed",
      siteId: "site-1",
      status: DeploymentStatus.FAILED,
      provider: "vercel",
      providerProjectId: "prj_1",
      providerDeployId: "dpl_prev",
      metadata: null,
      errorMessage: "boom",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.site.findUnique.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      name: "Harbor House",
      slug: "harbor-house",
      primaryLocale: "en",
      enabledLocales: ["en", "fr"],
      settings: { siteName: "Harbor House" },
      domains: [],
      deployments: [
        {
          id: "dep-failed",
          providerProjectId: "prj_1",
          providerDeployId: "dpl_prev",
          status: DeploymentStatus.FAILED,
        },
      ],
    });
    prisma.deployment.create.mockResolvedValue({
      id: "dep-retry",
      siteId: "site-1",
      status: DeploymentStatus.RETRYING,
      provider: "vercel",
      providerProjectId: "prj_1",
      providerDeployId: null,
      url: null,
      metadata: null,
      errorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.deployment.update
      .mockResolvedValueOnce({ status: DeploymentStatus.CREATING_PROJECT })
      .mockResolvedValueOnce({ status: DeploymentStatus.SYNCING_ENV })
      .mockResolvedValueOnce({ status: DeploymentStatus.DEPLOYING })
      .mockResolvedValueOnce({
        id: "dep-retry",
        siteId: "site-1",
        status: DeploymentStatus.LIVE,
        provider: "vercel",
        providerProjectId: "prj_1",
        providerDeployId: "dpl_2",
        url: "https://harbor-house.vercel.app",
        errorMessage: null,
      });

    provider.ensureProject.mockResolvedValue({
      projectId: "prj_1",
      projectName: "maa-site-harbor-house-12345678",
      created: false,
    });
    provider.syncEnvironmentVariables.mockResolvedValue();
    provider.triggerDeployment.mockResolvedValue({
      providerDeployId: "dpl_2",
      url: "https://harbor-house.vercel.app",
      readyState: "READY",
      rawStatus: "READY",
      isLive: true,
      isFailed: false,
      errorMessage: null,
    });

    const result = await service.retryDeployment("dep-failed");

    expect(provider.ensureProject).toHaveBeenCalledWith(
      expect.objectContaining({
        existingProjectId: "prj_1",
      }),
    );
    expect(provider.triggerDeployment).toHaveBeenCalledWith(
      expect.objectContaining({
        previousDeploymentId: "dpl_prev",
      }),
    );
    expect(result).toMatchObject({
      status: DeploymentStatus.LIVE,
      providerProjectId: "prj_1",
      providerDeployId: "dpl_2",
    });
  });

  it("includes errorMessage in the admin deployments list payload", async () => {
    prisma.deployment.findMany.mockResolvedValue([
      {
        id: "dep-1",
        siteId: "site-1",
        status: DeploymentStatus.FAILED,
        providerProjectId: "prj_1",
        errorMessage: "Build step failed",
        createdAt: new Date("2026-05-04T08:00:00.000Z"),
        updatedAt: new Date("2026-05-04T08:03:00.000Z"),
        site: {
          name: "Harbor House",
          tenant: { name: "Harbor Group" },
        },
      },
    ]);
    prisma.deployment.count.mockResolvedValue(1);

    await expect(
      service.listAdminDeployments({ status: "FAILED", page: 1, limit: 20 }),
    ).resolves.toEqual({
      data: [
        {
          id: "dep-1",
          siteId: "site-1",
          siteName: "Harbor House",
          tenantName: "Harbor Group",
          status: "FAILED",
          providerProjectId: "prj_1",
          errorMessage: "Build step failed",
          deployedAt: null,
          createdAt: "2026-05-04T08:00:00.000Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
  });

  it("prefers the verified primary domain for customer-facing live URLs", async () => {
    prisma.domain.findFirst.mockResolvedValue({
      host: "stay.harborhouse.example",
    });

    await expect(
      service.resolveCustomerSiteDeployment("site-1", {
        id: "dep-live",
        siteId: "site-1",
        status: DeploymentStatus.LIVE,
        url: "https://harbor-house.vercel.app",
        errorMessage: null,
        providerDeployId: "dpl_live",
        createdAt: new Date("2026-05-04T08:00:00.000Z"),
        updatedAt: new Date("2026-05-04T08:05:00.000Z"),
      } as never),
    ).resolves.toMatchObject({
      url: "https://stay.harborhouse.example",
      providerUrl: "https://harbor-house.vercel.app",
      providerDeployId: "dpl_live",
    });
  });
});
