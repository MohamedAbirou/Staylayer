import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { WorkspaceAccessService } from "../workspace-access.service";
import { AuthenticatedRequestUser } from "../auth.types";

function buildUser(
  overrides: Partial<AuthenticatedRequestUser> = {},
): AuthenticatedRequestUser {
  return {
    sub: "user-1",
    email: "user@test.com",
    platformRole: null,
    activeTenantId: "tenant-1",
    activeMembershipRole: "ADMIN",
    activeSiteId: "site-1",
    ...overrides,
  };
}

describe("WorkspaceAccessService", () => {
  it("fills in the active site when the token already carries it", async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: "tenant-1" }),
      },
      site: {
        findUnique: jest.fn().mockResolvedValue({ tenantId: "tenant-1" }),
      },
    } as unknown as PrismaService;
    const service = new WorkspaceAccessService(prisma);
    const request = {
      user: buildUser(),
      query: {} as Record<string, unknown>,
      headers: {},
    };

    await expect(service.ensureSiteAccess(request)).resolves.toBe("site-1");
    expect(request.query.siteId).toBe("site-1");
  });

  it("fails closed when a request tries to override the active site", async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: "tenant-1" }),
      },
      site: {
        findUnique: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = new WorkspaceAccessService(prisma);

    await expect(
      service.ensureSiteAccess({
        user: buildUser(),
        query: { siteId: "site-2" },
        headers: {},
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("throws UNAUTHORIZED when the request carries no user", async () => {
    const prisma = {} as unknown as PrismaService;
    const service = new WorkspaceAccessService(prisma);

    await expect(
      service.ensureSiteAccess({ user: undefined, query: {}, headers: {} }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws TENANT_CONTEXT_REQUIRED when activeTenantId is absent", async () => {
    const prisma = {} as unknown as PrismaService;
    const service = new WorkspaceAccessService(prisma);

    await expect(
      service.ensureSiteAccess({
        user: buildUser({ activeTenantId: null }),
        query: {},
        headers: {},
      }),
    ).rejects.toMatchObject({ response: { code: "TENANT_CONTEXT_REQUIRED" } });
  });

  it("throws TENANT_CONTEXT_REQUIRED when activeMembershipRole is absent", async () => {
    const prisma = {} as unknown as PrismaService;
    const service = new WorkspaceAccessService(prisma);

    await expect(
      service.ensureSiteAccess({
        user: buildUser({ activeMembershipRole: null }),
        query: {},
        headers: {},
      }),
    ).rejects.toMatchObject({ response: { code: "TENANT_CONTEXT_REQUIRED" } });
  });

  it("throws TENANT_CONTEXT_MISMATCH when query tenantId does not match the active tenant", async () => {
    const prisma = {} as unknown as PrismaService;
    const service = new WorkspaceAccessService(prisma);

    await expect(
      service.ensureSiteAccess({
        user: buildUser(),
        query: { tenantId: "tenant-evil" },
        headers: {},
      }),
    ).rejects.toMatchObject({ response: { code: "TENANT_CONTEXT_MISMATCH" } });
  });

  it("throws SITE_CONTEXT_MISMATCH when x-active-site-id header conflicts with token activeSiteId", async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: "tenant-1" }),
      },
      site: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const service = new WorkspaceAccessService(prisma);

    await expect(
      service.ensureSiteAccess({
        user: buildUser({ activeSiteId: "site-1" }),
        query: {},
        headers: { "x-active-site-id": "site-evil" },
      }),
    ).rejects.toMatchObject({ response: { code: "SITE_CONTEXT_MISMATCH" } });
  });

  it("throws SITE_CONTEXT_REQUIRED when no site context is available anywhere", async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: "tenant-1" }),
      },
      site: { findUnique: jest.fn() },
    } as unknown as PrismaService;
    const service = new WorkspaceAccessService(prisma);

    await expect(
      service.ensureSiteAccess({
        user: buildUser({ activeSiteId: null }),
        query: {},
        headers: {},
      }),
    ).rejects.toMatchObject({ response: { code: "SITE_CONTEXT_REQUIRED" } });
  });

  it("throws SITE_ACCESS_DENIED when the site belongs to a different tenant", async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: "tenant-1" }),
      },
      site: {
        findUnique: jest.fn().mockResolvedValue({ tenantId: "tenant-2" }),
      },
    } as unknown as PrismaService;
    const service = new WorkspaceAccessService(prisma);

    await expect(
      service.ensureSiteAccess({
        user: buildUser({ activeSiteId: null }),
        query: { siteId: "site-belonging-to-tenant-2" },
        headers: {},
      }),
    ).rejects.toMatchObject({ response: { code: "SITE_ACCESS_DENIED" } });
  });

  it("resolves a site via x-active-site-id header when token carries no activeSiteId", async () => {
    const prisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: "tenant-1" }),
      },
      site: {
        findUnique: jest.fn().mockResolvedValue({ tenantId: "tenant-1" }),
      },
    } as unknown as PrismaService;
    const service = new WorkspaceAccessService(prisma);
    const request = {
      user: buildUser({ activeSiteId: null }),
      query: {} as Record<string, unknown>,
      headers: { "x-active-site-id": "site-from-header" },
    };

    await expect(service.ensureSiteAccess(request)).resolves.toBe(
      "site-from-header",
    );
    expect(request.query.siteId).toBe("site-from-header");
  });
});
