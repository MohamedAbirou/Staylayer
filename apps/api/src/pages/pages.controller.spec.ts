/// <reference types="jest" />

import { ForbiddenException } from "@nestjs/common";
import { Request } from "express";
import { PagesController } from "./pages.controller";
import { PagesService } from "./pages.service";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { RevalidationService } from "../revalidation/revalidation.service";

function buildRequest(overrides: Partial<Request> = {}): Request {
  return {
    user: { sub: "user-1" },
    query: {},
    headers: {},
    ...overrides,
  } as Request;
}

describe("PagesController", () => {
  let controller: PagesController;
  let pagesService: {
    findAll: jest.Mock;
    createPage: jest.Mock;
    findPublishedSlugs: jest.Mock;
    publishPage: jest.Mock;
    updatePage: jest.Mock;
    deletePage: jest.Mock;
    bulkDelete: jest.Mock;
    findBySlug: jest.Mock;
  };
  let revalidationService: {
    revalidatePage: jest.Mock;
  };
  let workspaceAccessService: {
    ensureSiteAccess: jest.Mock;
  };

  beforeEach(() => {
    pagesService = {
      findAll: jest.fn(),
      createPage: jest.fn(),
      findPublishedSlugs: jest.fn(),
      publishPage: jest.fn(),
      updatePage: jest.fn(),
      deletePage: jest.fn(),
      bulkDelete: jest.fn(),
      findBySlug: jest.fn(),
    };
    revalidationService = {
      revalidatePage: jest.fn(),
    };
    workspaceAccessService = {
      ensureSiteAccess: jest.fn(),
    };

    controller = new PagesController(
      pagesService as unknown as PagesService,
      revalidationService as unknown as RevalidationService,
      workspaceAccessService as unknown as WorkspaceAccessService,
    );
  });

  it("uses the resolved site scope when listing pages", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    pagesService.findAll.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 50,
    });

    await controller.findAll(
      {
        siteId: "untrusted-site-id",
        page: 1,
        limit: 50,
      } as never,
      buildRequest(),
    );

    expect(workspaceAccessService.ensureSiteAccess).toHaveBeenCalledTimes(1);
    expect(pagesService.findAll).toHaveBeenCalledWith("site-1", {
      locale: undefined,
      published: undefined,
      deleted: undefined,
      page: 1,
      limit: 50,
      search: undefined,
    });
  });

  it("fails closed before listing pages when site access is denied", async () => {
    const error = new ForbiddenException();
    workspaceAccessService.ensureSiteAccess.mockRejectedValue(error);

    await expect(
      controller.findAll(
        {
          siteId: "tenant-b-site",
          page: 1,
          limit: 50,
        } as never,
        buildRequest(),
      ),
    ).rejects.toBe(error);

    expect(pagesService.findAll).not.toHaveBeenCalled();
  });

  it("uses the resolved site scope when creating a page", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    pagesService.createPage.mockResolvedValue({ id: "page-1" });

    await controller.create(
      { siteId: "site-2" } as never,
      {
        slug: "home",
        locale: "en",
        title: "Home",
        puckData: {},
      } as never,
      buildRequest(),
    );

    expect(workspaceAccessService.ensureSiteAccess).toHaveBeenCalledTimes(1);
    expect(pagesService.createPage).toHaveBeenCalledWith(
      "site-1",
      expect.objectContaining({ slug: "home" }),
      "user-1",
    );
  });

  it("returns published slugs for a public site query without workspace resolution", async () => {
    pagesService.findPublishedSlugs.mockResolvedValue([
      { slug: "home", locale: "en" },
    ]);

    await controller.findPublished({ siteId: "site-1" } as never);

    expect(workspaceAccessService.ensureSiteAccess).not.toHaveBeenCalled();
    expect(pagesService.findPublishedSlugs).toHaveBeenCalledWith(
      "site-1",
      undefined,
    );
  });

  it("revalidates against the resolved site deployment when publishing", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    pagesService.publishPage.mockResolvedValue({
      message: "published",
      slug: "home",
      locale: "en",
    });

    await controller.publish(
      "home",
      { siteId: "site-2", locale: "en" } as never,
      buildRequest(),
    );

    expect(revalidationService.revalidatePage).toHaveBeenCalledWith(
      "site-1",
      "home",
    );
  });

  it("revalidates when saving a published page", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    pagesService.updatePage.mockResolvedValue({
      id: "page-1",
      slug: "home",
      locale: "en",
      published: true,
    });

    await controller.update(
      "home",
      { siteId: "site-2", locale: "en" } as never,
      { title: "Updated home" } as never,
      buildRequest(),
    );

    expect(revalidationService.revalidatePage).toHaveBeenCalledWith(
      "site-1",
      "home",
    );
  });

  it("does not revalidate when saving an unpublished page", async () => {
    workspaceAccessService.ensureSiteAccess.mockResolvedValue("site-1");
    pagesService.updatePage.mockResolvedValue({
      id: "page-1",
      slug: "home",
      locale: "en",
      published: false,
    });

    await controller.update(
      "home",
      { siteId: "site-2", locale: "en" } as never,
      { title: "Draft home" } as never,
      buildRequest(),
    );

    expect(revalidationService.revalidatePage).not.toHaveBeenCalled();
  });

  it("fails closed before updating a page when site access is denied", async () => {
    const error = new ForbiddenException();
    workspaceAccessService.ensureSiteAccess.mockRejectedValue(error);

    await expect(
      controller.update(
        "home",
        { siteId: "tenant-b-site" } as never,
        { title: "Hacked" } as never,
        buildRequest(),
      ),
    ).rejects.toBe(error);

    expect(pagesService.updatePage).not.toHaveBeenCalled();
  });

  it("fails closed before deleting a page when site access is denied", async () => {
    const error = new ForbiddenException();
    workspaceAccessService.ensureSiteAccess.mockRejectedValue(error);

    await expect(
      controller.remove(
        "home",
        { siteId: "tenant-b-site" } as never,
        buildRequest(),
      ),
    ).rejects.toBe(error);

    expect(pagesService.deletePage).not.toHaveBeenCalled();
  });

  it("fails closed before bulk-deleting pages when site access is denied", async () => {
    const error = new ForbiddenException();
    workspaceAccessService.ensureSiteAccess.mockRejectedValue(error);

    await expect(
      controller.bulkDelete(
        { siteId: "tenant-b-site" } as never,
        { pages: [{ slug: "home", locale: "en" }] } as never,
        buildRequest(),
      ),
    ).rejects.toBe(error);

    expect(pagesService.bulkDelete).not.toHaveBeenCalled();
  });

  it("serves a public page by slug without site access verification", async () => {
    pagesService.findBySlug.mockResolvedValue({ slug: "home", title: "Home" });

    await controller.findOne(
      "home",
      { siteId: "site-1", published: true, locale: "en" } as never,
      buildRequest({ user: undefined }),
    );

    expect(workspaceAccessService.ensureSiteAccess).not.toHaveBeenCalled();
    expect(pagesService.findBySlug).toHaveBeenCalledWith(
      "site-1",
      "home",
      "en",
      true,
    );
  });
});
