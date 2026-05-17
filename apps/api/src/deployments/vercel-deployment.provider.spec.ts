/// <reference types="jest" />

import { ConfigService } from "@nestjs/config";
import { VercelDeploymentProvider } from "./vercel-deployment.provider";

describe("VercelDeploymentProvider", () => {
  const originalFetch = global.fetch;

  let provider: VercelDeploymentProvider;
  let fetchMock: jest.Mock;
  let configService: { get: jest.Mock };

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          DEPLOYMENTS_VERCEL_ACCESS_TOKEN: "vercel-token",
          DEPLOYMENTS_VERCEL_GIT_REPO: "owner/repo",
          DEPLOYMENTS_VERCEL_GIT_REPO_ID: "repo_123",
          DEPLOYMENTS_VERCEL_GIT_PROVIDER: "github",
          DEPLOYMENTS_VERCEL_PRODUCTION_BRANCH: "master",
        };

        return values[key];
      }),
    };

    provider = new VercelDeploymentProvider(
      configService as unknown as ConfigService,
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("updates an existing project before reusing it for a new deployment", async () => {
    fetchMock.mockResolvedValue(
      createResponse({
        id: "prj_123",
        name: "existing-project",
        latestDeployments: [{ id: "dpl_prev" }],
      }),
    );

    const result = await provider.ensureProject({
      projectName: "new-project-name",
      existingProjectId: "prj_123",
      site: {
        siteId: "site_123",
        siteSlug: "azure-bay-villas",
        siteName: "Azure Bay Villas",
        tenantId: "tenant_123",
        primaryLocale: "en",
        enabledLocales: ["en"],
        primaryDomain: "stay.example.com",
      },
      projectSettings: {
        framework: "nextjs",
        rootDirectory: "apps/website",
        buildCommand: "cd ../.. && pnpm --filter @staylayer/website build",
        outputDirectory: ".next",
        installCommand: "cd ../.. && pnpm install --frozen-lockfile",
        nodeVersion: "20.x",
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vercel.com/v9/projects/prj_123",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({
          Authorization: "Bearer vercel-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          framework: "nextjs",
          rootDirectory: "apps/website",
          buildCommand: "cd ../.. && pnpm --filter @staylayer/website build",
          outputDirectory: ".next",
          installCommand: "cd ../.. && pnpm install --frozen-lockfile",
          nodeVersion: "20.x",
        }),
      }),
    );

    expect(result).toEqual({
      projectId: "prj_123",
      projectName: "existing-project",
      created: false,
      metadata: {
        latestDeploymentId: "dpl_prev",
      },
    });
  });

  it("does not send nodeVersion when triggering a deployment", async () => {
    fetchMock.mockResolvedValue(
      createResponse({
        id: "dpl_123",
        aliasFinal: "existing-project.vercel.app",
        alias: ["existing-project.vercel.app"],
        target: "production",
        readyState: "QUEUED",
        status: "QUEUED",
        url: "existing-project-r4nd0m.vercel.app",
      }),
    );

    await expect(
      provider.triggerDeployment({
        projectId: "prj_123",
        projectName: "existing-project",
        previousDeploymentId: "dpl_prev",
        site: {
          siteId: "site_123",
          siteSlug: "azure-bay-villas",
          siteName: "Azure Bay Villas",
          tenantId: "tenant_123",
          primaryLocale: "en",
          enabledLocales: ["en"],
          primaryDomain: "stay.example.com",
        },
        projectSettings: {
          framework: "nextjs",
          rootDirectory: "apps/website",
          buildCommand: "cd ../.. && pnpm --filter @staylayer/website build",
          outputDirectory: ".next",
          installCommand: "cd ../.. && pnpm install --frozen-lockfile",
          nodeVersion: "20.x",
        },
        meta: {
          siteId: "site_123",
          deploymentId: "dep_123",
        },
      }),
    ).resolves.toMatchObject({
      url: "https://existing-project.vercel.app",
      providerUrl: "https://existing-project-r4nd0m.vercel.app",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vercel.com/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "existing-project",
          project: "prj_123",
          target: "production",
          meta: {
            siteId: "site_123",
            deploymentId: "dep_123",
          },
          projectSettings: {
            framework: "nextjs",
            rootDirectory: "apps/website",
            buildCommand: "cd ../.. && pnpm --filter @staylayer/website build",
            outputDirectory: ".next",
            installCommand: "cd ../.. && pnpm install --frozen-lockfile",
          },
          deploymentId: "dpl_prev",
          withLatestCommit: true,
        }),
      }),
    );
  });

  it("fetches deployment events and maps them into timeline phases and logs", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          id: "dpl_123",
          aliasFinal: "existing-project.vercel.app",
          alias: ["existing-project.vercel.app"],
          target: "production",
          name: "existing-project",
          readyState: "BUILDING",
          status: "QUEUED",
          url: "existing-project-r4nd0m.vercel.app",
        }),
      )
      .mockResolvedValueOnce(
        createResponse([
          {
            type: "build",
            created: "1715076000000",
            payload: {
              id: "evt_1",
              text: "Installing dependencies",
              info: {
                step: "install",
              },
            },
          },
          {
            type: "build",
            created: "1715076060000",
            payload: {
              id: "evt_2",
              text: "Compiling website",
              info: {
                step: "build",
              },
            },
          },
        ]),
      );

    const result = await provider.getDeploymentStatus({
      providerDeployId: "dpl_123",
      projectId: "prj_123",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vercel.com/v3/deployments/dpl_123/events?builds=1&direction=forward&limit=-1",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(result.timeline).toEqual([
      expect.objectContaining({
        key: "provider:install",
        label: "Install",
        status: "completed",
      }),
      expect.objectContaining({
        key: "provider:build",
        label: "Build",
        status: "active",
      }),
    ]);
    expect(result).toMatchObject({
      url: "https://existing-project.vercel.app",
      providerUrl: "https://existing-project-r4nd0m.vercel.app",
    });
    expect(result.logs).toEqual([
      expect.objectContaining({
        id: "evt_1",
        phaseKey: "provider:install",
        text: "Installing dependencies",
      }),
      expect.objectContaining({
        id: "evt_2",
        phaseKey: "provider:build",
        text: "Compiling website",
      }),
    ]);
  });

  it("maps flattened deployment event payloads into timeline phases and logs", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          id: "dpl_flat",
          aliasFinal: "existing-project.vercel.app",
          alias: ["existing-project.vercel.app"],
          target: "production",
          name: "existing-project",
          readyState: "BUILDING",
          status: "BUILDING",
          url: "existing-project-r4nd0m.vercel.app",
        }),
      )
      .mockResolvedValueOnce(
        createResponse([
          {
            type: "build",
            id: "evt_flat_1",
            created: "1715076000000",
            text: "Restoring build cache",
            statusCode: 200,
            info: {
              step: "build",
            },
          },
        ]),
      );

    const result = await provider.getDeploymentStatus({
      providerDeployId: "dpl_flat",
      projectId: "prj_123",
    });

    expect(result.timeline).toEqual([
      expect.objectContaining({
        key: "provider:build",
        label: "Build",
        status: "active",
      }),
    ]);
    expect(result.logs).toEqual([
      expect.objectContaining({
        id: "evt_flat_1",
        phaseKey: "provider:build",
        text: "Restoring build cache",
      }),
    ]);
  });

  it("calls the Vercel rollback endpoint for an existing deployment", async () => {
    fetchMock.mockResolvedValue(createResponse({ ok: true }));

    await expect(
      provider.rollbackDeployment({
        projectId: "prj_123",
        providerDeployId: "dpl_live",
      }),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vercel.com/v1/projects/prj_123/rollback/dpl_live",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("maps Vercel domain config recommendations into DNS diagnostics", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          id: "domain_123",
          name: "www.stay.example.com",
          apexName: "stay.example.com",
          verified: false,
          serviceType: "vercel",
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          configuredBy: "CNAME",
          acceptedChallenges: ["dns-01"],
          recommendedIPv4: [],
          recommendedCNAME: [
            {
              rank: 1,
              value: "cname.vercel-dns.com",
            },
          ],
          misconfigured: true,
        }),
      );

    const result = await provider.getDomainAttachmentStatus({
      projectId: "prj_123",
      domain: "www.stay.example.com",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.vercel.com/v6/domains/www.stay.example.com/config?projectIdOrName=prj_123",
      expect.objectContaining({
        method: "GET",
      }),
    );
    expect(result.dnsConfig).toEqual({
      configuredBy: "CNAME",
      acceptedChallenges: ["dns-01"],
      misconfigured: true,
      recommendedRecords: [
        {
          type: "CNAME",
          name: "www",
          host: "www.stay.example.com",
          value: "cname.vercel-dns.com",
          acceptedValues: ["cname.vercel-dns.com"],
          rank: 1,
        },
      ],
    });
  });

  it("uses shared runtime Vercel DNS overrides before legacy API recommendations", async () => {
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        DEPLOYMENTS_VERCEL_ACCESS_TOKEN: "vercel-token",
        DEPLOYMENTS_VERCEL_GIT_REPO: "owner/repo",
        DEPLOYMENTS_VERCEL_GIT_REPO_ID: "repo_123",
        DEPLOYMENTS_VERCEL_GIT_PROVIDER: "github",
        DEPLOYMENTS_VERCEL_PRODUCTION_BRANCH: "master",
        WEBSITE_VERCEL_PROJECT_ID: "prj_website",
        WEBSITE_VERCEL_RECOMMENDED_CNAME:
          "8554cd63a71398d3.vercel-dns-017.com.",
      };

      return values[key];
    });
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          id: "domain_123",
          name: "www.stay.example.com",
          apexName: "stay.example.com",
          verified: true,
          serviceType: "vercel",
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          configuredBy: "CNAME",
          acceptedChallenges: ["http-01"],
          recommendedIPv4: [
            {
              rank: 1,
              value: ["76.76.21.21"],
            },
          ],
          recommendedCNAME: [
            {
              rank: 1,
              value: "cname.vercel-dns.com.",
            },
          ],
          misconfigured: false,
        }),
      );

    const result = await provider.getDomainAttachmentStatus({
      projectId: "prj_website",
      domain: "www.stay.example.com",
    });

    expect(result.dnsConfig?.recommendedRecords).toEqual([
      {
        type: "CNAME",
        name: "www",
        host: "www.stay.example.com",
        value: "8554cd63a71398d3.vercel-dns-017.com.",
        acceptedValues: ["8554cd63a71398d3.vercel-dns-017.com."],
        rank: 0,
      },
    ]);
  });

  it("uses only the apex A record for shared runtime apex domains", async () => {
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string> = {
        DEPLOYMENTS_VERCEL_ACCESS_TOKEN: "vercel-token",
        DEPLOYMENTS_VERCEL_GIT_REPO: "owner/repo",
        DEPLOYMENTS_VERCEL_GIT_REPO_ID: "repo_123",
        DEPLOYMENTS_VERCEL_GIT_PROVIDER: "github",
        DEPLOYMENTS_VERCEL_PRODUCTION_BRANCH: "master",
        WEBSITE_VERCEL_PROJECT_ID: "prj_website",
        WEBSITE_VERCEL_RECOMMENDED_APEX_IPV4: "216.198.79.1",
        WEBSITE_VERCEL_RECOMMENDED_CNAME:
          "8554cd63a71398d3.vercel-dns-017.com.",
      };

      return values[key];
    });
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          id: "domain_123",
          name: "stay.example.com",
          apexName: "stay.example.com",
          verified: true,
          serviceType: "vercel",
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          configuredBy: "A",
          acceptedChallenges: ["http-01"],
          recommendedIPv4: [
            {
              rank: 1,
              value: ["76.76.21.21"],
            },
          ],
          recommendedCNAME: [
            {
              rank: 1,
              value: "cname.vercel-dns.com.",
            },
          ],
          misconfigured: true,
        }),
      );

    const result = await provider.getDomainAttachmentStatus({
      projectId: "prj_website",
      domain: "stay.example.com",
    });

    expect(result.dnsConfig?.recommendedRecords).toEqual([
      {
        type: "A",
        name: "@",
        host: "stay.example.com",
        value: "216.198.79.1",
        acceptedValues: ["216.198.79.1"],
        rank: 0,
      },
    ]);
  });

  it("filters legacy Vercel API recommendations to the applicable record type", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          id: "domain_123",
          name: "stay.example.com",
          apexName: "stay.example.com",
          verified: false,
          serviceType: "vercel",
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          configuredBy: "A",
          acceptedChallenges: ["dns-01"],
          recommendedIPv4: [
            {
              rank: 1,
              value: ["76.76.21.21"],
            },
          ],
          recommendedCNAME: [
            {
              rank: 1,
              value: "cname.vercel-dns.com.",
            },
          ],
          misconfigured: true,
        }),
      );

    const result = await provider.getDomainAttachmentStatus({
      projectId: "prj_123",
      domain: "stay.example.com",
    });

    expect(result.dnsConfig?.recommendedRecords).toEqual([
      {
        type: "A",
        name: "@",
        host: "stay.example.com",
        value: "76.76.21.21",
        acceptedValues: ["76.76.21.21"],
        rank: 1,
      },
    ]);
  });

  it("prefers Vercel project verification DNS records over legacy config recommendations", async () => {
    fetchMock
      .mockResolvedValueOnce(
        createResponse({
          id: "domain_123",
          name: "www.stay.example.com",
          apexName: "stay.example.com",
          verified: true,
          serviceType: "vercel",
          verification: [
            {
              type: "CNAME",
              domain: "www.stay.example.com",
              value: "8554cd63a71398d3.vercel-dns-017.com.",
              reason: "DNS Change Recommended",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          configuredBy: "CNAME",
          acceptedChallenges: ["http-01"],
          recommendedIPv4: [
            {
              rank: 1,
              value: ["76.76.21.21"],
            },
          ],
          recommendedCNAME: [
            {
              rank: 1,
              value: "cname.vercel-dns.com.",
            },
          ],
          misconfigured: false,
        }),
      );

    const result = await provider.getDomainAttachmentStatus({
      projectId: "prj_123",
      domain: "www.stay.example.com",
    });

    expect(result.dnsConfig).toEqual({
      configuredBy: "CNAME",
      acceptedChallenges: ["http-01"],
      misconfigured: true,
      recommendedRecords: [
        {
          type: "CNAME",
          name: "www",
          host: "www.stay.example.com",
          value: "8554cd63a71398d3.vercel-dns-017.com.",
          acceptedValues: ["8554cd63a71398d3.vercel-dns-017.com."],
          rank: 0,
        },
      ],
    });
  });
});

function createResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}
