/// <reference types="jest" />

import { ForbiddenException } from "@nestjs/common";
import { FormSubmissionStatus, FormType } from "@prisma/client";
import { Request } from "express";
import { AdminService } from "../admin/admin.service";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { FormsController } from "./forms.controller";
import { FormsService } from "./forms.service";

function buildRequest(overrides: Partial<Request> = {}): Request {
  return {
    user: { sub: "user-1" },
    query: {},
    headers: {},
    ...overrides,
  } as Request;
}

describe("FormsController", () => {
  let controller: FormsController;
  let formsService: {
    listForSite: jest.Mock;
    updateStatus: jest.Mock;
  };
  let workspaceAccessService: {
    ensureSiteAccess: jest.Mock;
  };
  let adminService: {
    createAuditLogForSite: jest.Mock;
  };

  beforeEach(() => {
    formsService = {
      listForSite: jest.fn(),
      updateStatus: jest.fn(),
    };
    workspaceAccessService = {
      ensureSiteAccess: jest.fn(),
    };
    adminService = {
      createAuditLogForSite: jest.fn(),
    };

    controller = new FormsController(
      formsService as unknown as FormsService,
      workspaceAccessService as unknown as WorkspaceAccessService,
      adminService as unknown as AdminService,
    );
  });

  it("uses the resolved site scope when listing submissions", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    formsService.listForSite.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
    });

    await controller.list(
      {
        siteId: "tenant-b-site",
        status: FormSubmissionStatus.RECEIVED,
        page: 1,
        limit: 25,
      } as never,
      buildRequest(),
    );

    expect(formsService.listForSite).toHaveBeenCalledWith("site-1", {
      status: FormSubmissionStatus.RECEIVED,
      page: 1,
      limit: 25,
    });
  });

  it("fails closed before listing submissions when site access is denied", async () => {
    const error = new ForbiddenException();
    workspaceAccessService.ensureSiteAccess.mockRejectedValue(error);

    await expect(
      controller.list({ siteId: "tenant-b-site" } as never, buildRequest()),
    ).rejects.toBe(error);

    expect(formsService.listForSite).not.toHaveBeenCalled();
  });

  it("uses the resolved site scope when updating submission status", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    formsService.updateStatus.mockResolvedValue({
      id: "submission-1",
      status: FormSubmissionStatus.ARCHIVED,
      formType: FormType.CONTACT,
      pageSlug: "contact-us",
    });

    await controller.updateStatus(
      "submission-1",
      { status: FormSubmissionStatus.ARCHIVED } as never,
      { siteId: "tenant-b-site" } as never,
      buildRequest(),
    );

    expect(formsService.updateStatus).toHaveBeenCalledWith(
      "site-1",
      "submission-1",
      FormSubmissionStatus.ARCHIVED,
    );
    expect(adminService.createAuditLogForSite).toHaveBeenCalledWith({
      siteId: "site-1",
      actorUserId: "user-1",
      action: "submission.status_updated",
      targetType: "form_submission",
      targetId: "submission-1",
      metadata: {
        status: FormSubmissionStatus.ARCHIVED,
        formType: FormType.CONTACT,
        pageSlug: "contact-us",
      },
    });
  });
});
