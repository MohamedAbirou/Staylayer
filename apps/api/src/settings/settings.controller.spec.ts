/// <reference types="jest" />

import { ForbiddenException } from "@nestjs/common";
import { Request } from "express";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
import { WorkspaceAccessService } from "../auth/workspace-access.service";

function buildRequest(overrides: Partial<Request> = {}): Request {
  return {
    user: { email: "owner@test.com" },
    query: {},
    headers: {},
    ...overrides,
  } as Request;
}

describe("SettingsController", () => {
  let controller: SettingsController;
  let settingsService: {
    get: jest.Mock;
    getReadiness: jest.Mock;
    update: jest.Mock;
  };
  let workspaceAccessService: {
    ensureSiteAccess: jest.Mock;
  };

  beforeEach(() => {
    settingsService = {
      get: jest.fn(),
      getReadiness: jest.fn(),
      update: jest.fn(),
    };
    workspaceAccessService = {
      ensureSiteAccess: jest.fn(),
    };

    controller = new SettingsController(
      settingsService as unknown as SettingsService,
      workspaceAccessService as unknown as WorkspaceAccessService,
    );
  });

  it("uses the resolved site scope when reading settings", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    settingsService.get.mockResolvedValue({ siteId: "site-1" });

    await controller.get({ siteId: "tenant-b-site" } as never, buildRequest());

    expect(workspaceAccessService.ensureSiteAccess).toHaveBeenCalledTimes(1);
    expect(settingsService.get).toHaveBeenCalledWith("site-1");
  });

  it("fails closed before reading settings when site access is denied", async () => {
    const error = new ForbiddenException();
    workspaceAccessService.ensureSiteAccess.mockRejectedValue(error);

    await expect(
      controller.get({ siteId: "tenant-b-site" } as never, buildRequest()),
    ).rejects.toBe(error);

    expect(settingsService.get).not.toHaveBeenCalled();
  });

  it("uses the resolved site scope when reading readiness", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    settingsService.getReadiness.mockResolvedValue({ siteId: "site-1" });

    await controller.getReadiness(
      { siteId: "tenant-b-site" } as never,
      buildRequest(),
    );

    expect(settingsService.getReadiness).toHaveBeenCalledWith("site-1");
  });

  it("fails closed before updating settings when site access is denied", async () => {
    const error = new ForbiddenException();
    workspaceAccessService.ensureSiteAccess.mockRejectedValue(error);

    await expect(
      controller.update(
        { siteId: "tenant-b-site" } as never,
        { siteName: "Blocked Site" } as never,
        buildRequest(),
      ),
    ).rejects.toBe(error);

    expect(settingsService.update).not.toHaveBeenCalled();
  });

  it("uses the resolved site scope when updating settings", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    settingsService.update.mockResolvedValue({ siteId: "site-1" });

    await controller.update(
      { siteId: "site-2" } as never,
      { siteName: "Allowed Site" } as never,
      buildRequest(),
    );

    expect(settingsService.update).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ siteName: "Allowed Site" }),
      "owner@test.com",
    );
  });
});
