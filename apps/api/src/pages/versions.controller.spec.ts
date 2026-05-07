/// <reference types="jest" />

import { ForbiddenException } from "@nestjs/common";
import { Request } from "express";
import { VersionsController } from "./versions.controller";
import { VersionsService } from "./versions.service";
import { WorkspaceAccessService } from "../auth/workspace-access.service";

function buildRequest(overrides: Partial<Request> = {}): Request {
  return {
    user: { sub: "user-1" },
    query: {},
    headers: {},
    ...overrides,
  } as Request;
}

describe("VersionsController", () => {
  let controller: VersionsController;
  let versionsService: {
    listVersions: jest.Mock;
    restoreVersion: jest.Mock;
  };
  let workspaceAccessService: {
    ensureSiteAccess: jest.Mock;
  };

  beforeEach(() => {
    versionsService = {
      listVersions: jest.fn(),
      restoreVersion: jest.fn(),
    };
    workspaceAccessService = {
      ensureSiteAccess: jest.fn(),
    };

    controller = new VersionsController(
      versionsService as unknown as VersionsService,
      workspaceAccessService as unknown as WorkspaceAccessService,
    );
  });

  it("uses the resolved site scope when listing versions", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    versionsService.listVersions.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    await controller.listVersions(
      "home",
      {
        siteId: "tenant-b-site",
        page: 1,
        limit: 20,
      } as never,
      buildRequest(),
    );

    expect(versionsService.listVersions).toHaveBeenCalledWith(
      "site-1",
      "home",
      "en",
      1,
      20,
    );
  });

  it("fails closed before restoring a version when site access is denied", async () => {
    const error = new ForbiddenException();
    workspaceAccessService.ensureSiteAccess.mockRejectedValue(error);

    await expect(
      controller.restoreVersion(
        "home",
        "version-1",
        { siteId: "tenant-b-site", locale: "en" } as never,
        buildRequest(),
      ),
    ).rejects.toBe(error);

    expect(versionsService.restoreVersion).not.toHaveBeenCalled();
  });

  it("uses the resolved site scope when restoring a version", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    versionsService.restoreVersion.mockResolvedValue({ id: "page-1" });

    await controller.restoreVersion(
      "home",
      "version-1",
      { siteId: "tenant-b-site", locale: "en" } as never,
      buildRequest(),
    );

    expect(versionsService.restoreVersion).toHaveBeenCalledWith(
      "site-1",
      "home",
      "en",
      "version-1",
      "user-1",
    );
  });

  it("fails closed before listing page versions when site access is denied", async () => {
    const error = new ForbiddenException();
    workspaceAccessService.ensureSiteAccess.mockRejectedValue(error);

    await expect(
      controller.listVersions(
        "home",
        { siteId: "tenant-b-site", page: 1, limit: 20 } as never,
        buildRequest(),
      ),
    ).rejects.toBe(error);

    expect(versionsService.listVersions).not.toHaveBeenCalled();
  });
});
