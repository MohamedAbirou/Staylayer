/// <reference types="jest" />

import { ForbiddenException } from "@nestjs/common";
import { Request } from "express";
import { AdminService } from "../admin/admin.service";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { DeploymentsController } from "./deployments.controller";
import { DeploymentsService } from "./deployments.service";

function buildRequest(overrides: Partial<Request> = {}): Request {
  return {
    user: { sub: "user-1" },
    query: {},
    headers: {},
    ...overrides,
  } as Request;
}

describe("DeploymentsController", () => {
  let controller: DeploymentsController;
  let deploymentsService: {
    getLatestSiteDeployment: jest.Mock;
    listSiteDeployments: jest.Mock;
    resolveCustomerSiteDeployment: jest.Mock;
    resolveCustomerSiteDeployments: jest.Mock;
    provisionSite: jest.Mock;
    retrySiteDeployment: jest.Mock;
  };
  let workspaceAccessService: {
    ensureSiteAccess: jest.Mock;
  };
  let adminService: {
    createAuditLogForSite: jest.Mock;
  };

  beforeEach(() => {
    deploymentsService = {
      getLatestSiteDeployment: jest.fn(),
      listSiteDeployments: jest.fn(),
      resolveCustomerSiteDeployment: jest.fn(),
      resolveCustomerSiteDeployments: jest.fn(),
      provisionSite: jest.fn(),
      retrySiteDeployment: jest.fn(),
    };
    workspaceAccessService = {
      ensureSiteAccess: jest.fn(),
    };
    adminService = {
      createAuditLogForSite: jest.fn(),
    };

    controller = new DeploymentsController(
      deploymentsService as unknown as DeploymentsService,
      workspaceAccessService as unknown as WorkspaceAccessService,
      adminService as unknown as AdminService,
    );
  });

  it("uses the resolved site scope when reading the latest deployment", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    deploymentsService.getLatestSiteDeployment.mockResolvedValue({
      id: "dep-1",
      siteId: "site-1",
      status: "PENDING",
      url: null,
      errorMessage: null,
      providerDeployId: null,
      createdAt: new Date("2026-05-04T08:00:00.000Z"),
      updatedAt: new Date("2026-05-04T08:00:00.000Z"),
    });
    deploymentsService.resolveCustomerSiteDeployment.mockResolvedValue({
      id: "dep-1",
      siteId: "site-1",
      status: "PENDING",
      url: null,
      providerUrl: null,
      errorMessage: null,
      providerDeployId: null,
      createdAt: new Date("2026-05-04T08:00:00.000Z"),
      updatedAt: new Date("2026-05-04T08:00:00.000Z"),
    });

    await controller.getLatest({ siteId: "site-2" } as never, buildRequest());

    expect(deploymentsService.getLatestSiteDeployment).toHaveBeenCalledWith(
      "site-1",
    );
    expect(
      deploymentsService.resolveCustomerSiteDeployment,
    ).toHaveBeenCalledWith("site-1", expect.objectContaining({ id: "dep-1" }));
  });

  it("returns an explicit customer deployment payload", async () => {
    const createdAt = new Date("2026-05-04T08:00:00.000Z");
    const updatedAt = new Date("2026-05-04T08:05:00.000Z");

    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    deploymentsService.getLatestSiteDeployment.mockResolvedValue({
      id: "dep-1",
      siteId: "site-1",
      status: "FAILED",
      url: "https://preview.vercel.app",
      errorMessage: "provider deploy failed",
      providerDeployId: "dpl_1",
      provider: "vercel",
      createdAt,
      updatedAt,
    });
    deploymentsService.resolveCustomerSiteDeployment.mockResolvedValue({
      id: "dep-1",
      siteId: "site-1",
      status: "FAILED",
      url: null,
      providerUrl: "https://preview.vercel.app",
      errorMessage: "provider deploy failed",
      providerDeployId: "dpl_1",
      createdAt,
      updatedAt,
    });

    await expect(
      controller.getLatest({ siteId: "site-1" } as never, buildRequest()),
    ).resolves.toEqual({
      id: "dep-1",
      siteId: "site-1",
      status: "FAILED",
      url: null,
      providerUrl: "https://preview.vercel.app",
      errorMessage: "provider deploy failed",
      providerDeployId: "dpl_1",
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  });

  it("uses the resolved site scope when listing deployment history", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    deploymentsService.listSiteDeployments.mockResolvedValue([]);
    deploymentsService.resolveCustomerSiteDeployments.mockResolvedValue([]);

    await controller.list(
      { siteId: "site-2", limit: 5 } as never,
      buildRequest(),
    );

    expect(deploymentsService.listSiteDeployments).toHaveBeenCalledWith(
      "site-1",
      5,
    );
    expect(
      deploymentsService.resolveCustomerSiteDeployments,
    ).toHaveBeenCalledWith("site-1", []);
  });

  it("fails closed before provisioning when site access is denied", async () => {
    const error = new ForbiddenException();
    workspaceAccessService.ensureSiteAccess.mockRejectedValue(error);

    await expect(
      controller.provision(
        { siteId: "tenant-b-site" } as never,
        buildRequest(),
      ),
    ).rejects.toBe(error);

    expect(deploymentsService.provisionSite).not.toHaveBeenCalled();
  });

  it("writes an audit log when a customer provisions a deployment", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    deploymentsService.provisionSite.mockResolvedValue({
      id: "dep-1",
      siteId: "site-1",
      status: "DEPLOYING",
    });
    deploymentsService.resolveCustomerSiteDeployment.mockResolvedValue({
      id: "dep-1",
      siteId: "site-1",
      status: "DEPLOYING",
      url: null,
      providerUrl: null,
      errorMessage: null,
      providerDeployId: null,
      createdAt: new Date("2026-05-04T08:00:00.000Z"),
      updatedAt: new Date("2026-05-04T08:00:00.000Z"),
    });

    await controller.provision({ siteId: "site-1" } as never, buildRequest());

    expect(adminService.createAuditLogForSite).toHaveBeenCalledWith({
      siteId: "site-1",
      actorUserId: "user-1",
      action: "deployment.provision_requested",
      targetType: "deployment",
      targetId: "dep-1",
      metadata: {
        status: "DEPLOYING",
      },
    });
  });

  it("uses the resolved site scope when retrying a failed deployment", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    deploymentsService.retrySiteDeployment.mockResolvedValue({ id: "dep-2" });
    deploymentsService.resolveCustomerSiteDeployment.mockResolvedValue({
      id: "dep-2",
      siteId: "site-1",
      status: "RETRYING",
      url: null,
      providerUrl: null,
      errorMessage: null,
      providerDeployId: null,
      createdAt: new Date("2026-05-04T08:00:00.000Z"),
      updatedAt: new Date("2026-05-04T08:00:00.000Z"),
    });

    await controller.retry(
      "dep-1",
      { siteId: "tenant-b-site" } as never,
      buildRequest(),
    );

    expect(deploymentsService.retrySiteDeployment).toHaveBeenCalledWith(
      "site-1",
      "dep-1",
    );
    expect(adminService.createAuditLogForSite).toHaveBeenCalledWith({
      siteId: "site-1",
      actorUserId: "user-1",
      action: "deployment.retry_requested",
      targetType: "deployment",
      targetId: "dep-2",
      metadata: {
        retryOfDeploymentId: "dep-1",
      },
    });
  });
});
