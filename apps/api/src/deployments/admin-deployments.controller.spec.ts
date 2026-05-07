/// <reference types="jest" />

import { AdminDeploymentsController } from "./admin-deployments.controller";
import { DeploymentEnvironmentService } from "./deployment-environment.service";
import { DeploymentsService } from "./deployments.service";
import { AdminService } from "../admin/admin.service";

describe("AdminDeploymentsController", () => {
  let controller: AdminDeploymentsController;
  let deploymentsService: {
    listAdminDeployments: jest.Mock;
    getDeploymentById: jest.Mock;
    retryDeployment: jest.Mock;
  };
  let deploymentEnvironmentService: {
    listForSite: jest.Mock;
    upsertCustomerVariable: jest.Mock;
    removeCustomerVariable: jest.Mock;
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
    deploymentEnvironmentService = {
      listForSite: jest.fn(),
      upsertCustomerVariable: jest.fn(),
      removeCustomerVariable: jest.fn(),
    };
    adminService = {
      createAuditLogForSite: jest.fn(),
    };

    controller = new AdminDeploymentsController(
      deploymentsService as unknown as DeploymentsService,
      deploymentEnvironmentService as unknown as DeploymentEnvironmentService,
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

  it("lists site deployment environment variables for operator review", async () => {
    deploymentEnvironmentService.listForSite.mockResolvedValue({
      customerEditable: [],
      operatorManaged: [],
    });

    await controller.listSiteEnvironment("site-1");

    expect(deploymentEnvironmentService.listForSite).toHaveBeenCalledWith(
      "site-1",
    );
  });

  it("allows operators to upsert site environment variables", async () => {
    deploymentEnvironmentService.upsertCustomerVariable.mockResolvedValue({
      id: "env-1",
      key: "BOOKING_API_KEY",
      type: "encrypted",
    });

    await controller.upsertSiteEnvironmentVariable(
      "site-1",
      {
        key: "BOOKING_API_KEY",
        value: "secret-value",
        type: "encrypted",
      },
      {
        user: { sub: "user-1" },
      } as never,
    );

    expect(
      deploymentEnvironmentService.upsertCustomerVariable,
    ).toHaveBeenCalledWith(
      "site-1",
      {
        key: "BOOKING_API_KEY",
        value: "secret-value",
        type: "encrypted",
      },
      "user-1",
    );
    expect(adminService.createAuditLogForSite).toHaveBeenCalledWith({
      siteId: "site-1",
      actorUserId: "user-1",
      action: "deployment.environment_upserted_by_operator",
      targetType: "deployment_environment_variable",
      targetId: "env-1",
      metadata: {
        key: "BOOKING_API_KEY",
        type: "encrypted",
      },
    });
  });

  it("allows operators to remove site environment variables", async () => {
    deploymentEnvironmentService.removeCustomerVariable.mockResolvedValue(
      undefined,
    );

    await controller.removeSiteEnvironmentVariable("site-1", "env-1", {
      user: { sub: "user-1" },
    } as never);

    expect(
      deploymentEnvironmentService.removeCustomerVariable,
    ).toHaveBeenCalledWith("site-1", "env-1");
    expect(adminService.createAuditLogForSite).toHaveBeenCalledWith({
      siteId: "site-1",
      actorUserId: "user-1",
      action: "deployment.environment_removed_by_operator",
      targetType: "deployment_environment_variable",
      targetId: "env-1",
      metadata: null,
    });
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
