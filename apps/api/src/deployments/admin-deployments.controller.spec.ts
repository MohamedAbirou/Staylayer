/// <reference types="jest" />

import { AdminDeploymentsController } from "./admin-deployments.controller";
import { DeploymentsService } from "./deployments.service";
import { AdminService } from "../admin/admin.service";

describe("AdminDeploymentsController", () => {
  let controller: AdminDeploymentsController;
  let deploymentsService: {
    listAdminDeployments: jest.Mock;
    getDeploymentById: jest.Mock;
    retryDeployment: jest.Mock;
  };
  let adminService: {
    createAuditLogForSite: jest.Mock;
  };

  beforeEach(() => {
    deploymentsService = {
      listAdminDeployments: jest.fn(),
      getDeploymentById: jest.fn(),
      retryDeployment: jest.fn(),
    };
    adminService = {
      createAuditLogForSite: jest.fn(),
    };

    controller = new AdminDeploymentsController(
      deploymentsService as unknown as DeploymentsService,
      adminService as unknown as AdminService,
    );
  });

  it("lists deployments for operator diagnostics", async () => {
    deploymentsService.listAdminDeployments.mockResolvedValue({ data: [] });

    await controller.findAll({ status: "FAILED", page: 2, limit: 10 });

    expect(deploymentsService.listAdminDeployments).toHaveBeenCalledWith({
      status: "FAILED",
      page: 2,
      limit: 10,
    });
  });

  it("loads a deployment by id for operator diagnostics", async () => {
    deploymentsService.getDeploymentById.mockResolvedValue({ id: "dep-1" });

    await controller.findOne("dep-1");

    expect(deploymentsService.getDeploymentById).toHaveBeenCalledWith("dep-1");
  });

  it("retries a failed deployment by id", async () => {
    deploymentsService.retryDeployment.mockResolvedValue({
      id: "dep-2",
      siteId: "site-1",
    });

    await controller.retry("dep-2", {
      user: { sub: "user-1" },
    } as never);

    expect(deploymentsService.retryDeployment).toHaveBeenCalledWith("dep-2");
    expect(adminService.createAuditLogForSite).toHaveBeenCalledWith({
      siteId: "site-1",
      actorUserId: "user-1",
      action: "deployment.retry_requested",
      targetType: "deployment",
      targetId: "dep-2",
      metadata: {
        retryOfDeploymentId: "dep-2",
      },
    });
  });
});
