/// <reference types="jest" />

import { ForbiddenException } from "@nestjs/common";
import { Request } from "express";
import { AdminService } from "../admin/admin.service";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { DomainsController } from "./domains.controller";
import { DomainsService } from "./domains.service";

function buildRequest(overrides: Partial<Request> = {}): Request {
  return {
    user: { sub: "user-1" },
    query: {},
    headers: {},
    ...overrides,
  } as Request;
}

describe("DomainsController", () => {
  let controller: DomainsController;
  let domainsService: {
    getRuntimeProfile: jest.Mock;
    listForSite: jest.Mock;
    add: jest.Mock;
    setPrimary: jest.Mock;
    retryForSite: jest.Mock;
    remove: jest.Mock;
  };
  let workspaceAccessService: {
    ensureSiteAccess: jest.Mock;
  };
  let adminService: {
    createAuditLogForSite: jest.Mock;
  };

  beforeEach(() => {
    domainsService = {
      getRuntimeProfile: jest.fn(),
      listForSite: jest.fn(),
      add: jest.fn(),
      setPrimary: jest.fn(),
      retryForSite: jest.fn(),
      remove: jest.fn(),
    };
    workspaceAccessService = {
      ensureSiteAccess: jest.fn(),
    };
    adminService = {
      createAuditLogForSite: jest.fn(),
    };

    controller = new DomainsController(
      domainsService as unknown as DomainsService,
      workspaceAccessService as unknown as WorkspaceAccessService,
      adminService as unknown as AdminService,
    );
  });

  it("uses the resolved site scope when listing domains", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    domainsService.listForSite.mockResolvedValue([]);

    await controller.list({ siteId: "tenant-b-site" } as never, buildRequest());

    expect(domainsService.listForSite).toHaveBeenCalledWith("site-1");
  });

  it("uses the resolved site scope when loading the runtime profile", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    domainsService.getRuntimeProfile.mockResolvedValue({
      siteId: "site-1",
      defaultHostname: "sunset-villa.staylayer.com",
    });

    await controller.runtimeProfile(
      { siteId: "tenant-b-site" } as never,
      buildRequest(),
    );

    expect(domainsService.getRuntimeProfile).toHaveBeenCalledWith("site-1");
  });

  it("fails closed before adding a domain when site access is denied", async () => {
    const error = new ForbiddenException();
    workspaceAccessService.ensureSiteAccess.mockRejectedValue(error);

    await expect(
      controller.add(
        { siteId: "tenant-b-site" } as never,
        { hostname: "stay.example.com" } as never,
        buildRequest(),
      ),
    ).rejects.toBe(error);

    expect(domainsService.add).not.toHaveBeenCalled();
  });

  it("uses the resolved site scope when setting a primary domain", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    domainsService.setPrimary.mockResolvedValue({ id: "domain-1" });

    await controller.setPrimary(
      "domain-1",
      { siteId: "tenant-b-site" } as never,
      buildRequest(),
    );

    expect(domainsService.setPrimary).toHaveBeenCalledWith(
      "site-1",
      "domain-1",
    );
  });

  it("uses the resolved site scope when removing a domain", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");

    await controller.remove(
      "domain-1",
      { siteId: "tenant-b-site" } as never,
      buildRequest(),
    );

    expect(domainsService.remove).toHaveBeenCalledWith("site-1", "domain-1");
  });

  it("uses the resolved site scope when retrying a domain verification", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    domainsService.retryForSite.mockResolvedValue({
      hostname: "stay.example.com",
      status: "DNS_REQUIRED",
    });

    await controller.retry(
      "domain-1",
      { siteId: "tenant-b-site" } as never,
      buildRequest(),
    );

    expect(domainsService.retryForSite).toHaveBeenCalledWith(
      "site-1",
      "domain-1",
    );
    expect(adminService.createAuditLogForSite).toHaveBeenCalledWith({
      siteId: "site-1",
      actorUserId: "user-1",
      action: "domain.retry_requested",
      targetType: "domain",
      targetId: "domain-1",
      metadata: {
        hostname: "stay.example.com",
        status: "DNS_REQUIRED",
      },
    });
  });
});
