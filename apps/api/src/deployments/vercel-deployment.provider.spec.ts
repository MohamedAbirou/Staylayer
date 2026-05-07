/// <reference types="jest" />

import { ConfigService } from "@nestjs/config";
import { VercelDeploymentProvider } from "./vercel-deployment.provider";

describe("VercelDeploymentProvider", () => {
  const originalFetch = global.fetch;

  let provider: VercelDeploymentProvider;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const configService = {
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
        buildCommand: "cd ../.. && pnpm --filter @myallocator/website build",
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
          buildCommand: "cd ../.. && pnpm --filter @myallocator/website build",
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
        readyState: "QUEUED",
        status: "QUEUED",
        url: "existing-project.vercel.app",
      }),
    );

    await provider.triggerDeployment({
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
        buildCommand: "cd ../.. && pnpm --filter @myallocator/website build",
        outputDirectory: ".next",
        installCommand: "cd ../.. && pnpm install --frozen-lockfile",
        nodeVersion: "20.x",
      },
      meta: {
        siteId: "site_123",
        deploymentId: "dep_123",
      },
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
            buildCommand:
              "cd ../.. && pnpm --filter @myallocator/website build",
            outputDirectory: ".next",
            installCommand: "cd ../.. && pnpm install --frozen-lockfile",
          },
          deploymentId: "dpl_prev",
          withLatestCommit: true,
        }),
      }),
    );
  });
});

function createResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  } as unknown as Response;
}
