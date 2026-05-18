/// <reference types="jest" />

import { ConflictException } from "@nestjs/common";
import { SiteStatus, SiteType, TenantMembershipRole } from "@prisma/client";
import { TenantWorkspaceService } from "./tenant-workspace.service";

function buildPrismaMock() {
  const prisma = {
    $transaction: jest.fn(),
    site: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    domain: {
      deleteMany: jest.fn(),
    },
    siteSettings: {
      create: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    tenantMembership: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    user: {
      create: jest.fn(),
    },
  };

  prisma.$transaction.mockImplementation(
    async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
  );

  return prisma;
}

describe("TenantWorkspaceService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let billingService: {
    assertCanProvisionSite: jest.Mock;
    assertCanAddSeat: jest.Mock;
  };
  let usersService: {
    findByEmail: jest.Mock;
    hashPassword: jest.Mock;
  };
  let customerAccessService: {
    createWorkspaceInvitation: jest.Mock;
    sendWorkspaceAccountSetupEmail: jest.Mock;
    revokeWorkspaceInvitation: jest.Mock;
    resendWorkspaceInvitation: jest.Mock;
  };
  let notificationsService: {
    create: jest.Mock;
    createForTenantRoles: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let publicRuntimeCacheService: { deleteKeys: jest.Mock };
  let service: TenantWorkspaceService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.site.findUnique.mockResolvedValue(null);
    prisma.tenant.findUnique.mockResolvedValue({ name: "Azure Bay" });
    billingService = {
      assertCanProvisionSite: jest.fn().mockResolvedValue(undefined),
      assertCanAddSeat: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      findByEmail: jest.fn(),
      hashPassword: jest.fn(),
    };
    customerAccessService = {
      createWorkspaceInvitation: jest.fn(),
      sendWorkspaceAccountSetupEmail: jest.fn().mockResolvedValue({
        accepted: true,
      }),
      revokeWorkspaceInvitation: jest.fn(),
      resendWorkspaceInvitation: jest.fn(),
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue(null),
      createForTenantRoles: jest.fn().mockResolvedValue([]),
    };
    configService = {
      get: jest.fn((key: string) =>
        key === "HOSTED_SITE_ROOT_DOMAIN" ? "staylayer.test" : undefined,
      ),
    };
    publicRuntimeCacheService = {
      deleteKeys: jest.fn().mockResolvedValue(undefined),
    };

    service = new TenantWorkspaceService(
      prisma as never,
      billingService as never,
      usersService as never,
      customerAccessService as never,
      notificationsService as never,
      configService as never,
      publicRuntimeCacheService as never,
    );
  });

  it("hides archived sites from the workspace studio site list", async () => {
    prisma.site.findMany.mockResolvedValue([]);

    await service.listSites("tenant-1");

    expect(prisma.site.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "tenant-1",
          status: { not: SiteStatus.ARCHIVED },
        },
      }),
    );
  });

  it("creates a site after enforcing the tenant site cap", async () => {
    prisma.site.create.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      name: "Azure Bay Villas",
      slug: "azure-bay-villas",
      publicSubdomain: "azure-bay-villas",
      status: SiteStatus.ACTIVE,
      primaryLocale: "en",
      enabledLocales: ["en", "es"],
      siteType: SiteType.VACATION_RENTAL,
      createdAt: new Date("2026-05-06T12:00:00.000Z"),
    });

    const created = await service.createSite("tenant-1", {
      name: " Azure Bay Villas ",
      primaryLocale: "en",
      enabledLocales: ["en", "es", "en"],
    });

    expect(billingService.assertCanProvisionSite).toHaveBeenCalledWith(
      "tenant-1",
    );
    expect(prisma.site.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          slug: "azure-bay-villas",
          publicSubdomain: "azure-bay-villas",
          enabledLocales: ["en", "es"],
          siteType: SiteType.VACATION_RENTAL,
        }),
      }),
    );
    expect(prisma.siteSettings.create).toHaveBeenCalledWith({
      data: {
        siteId: "site-1",
        siteName: "Azure Bay Villas",
        defaultLocale: "en",
        activeLocales: ["en", "es"],
      },
    });
    expect(created.slug).toBe("azure-bay-villas");
    expect(created.publicSubdomain).toBe("azure-bay-villas");
  });

  it("normalizes and auto-suffixes generated public subdomains when occupied", async () => {
    prisma.site.findUnique
      .mockResolvedValueOnce({ id: "site-existing" })
      .mockResolvedValueOnce(null);
    prisma.site.create.mockResolvedValue({
      id: "site-2",
      tenantId: "tenant-1",
      name: "Azure Bay Villas",
      slug: "azure-bay-villas",
      publicSubdomain: "azure-bay-villas-2",
      status: SiteStatus.ACTIVE,
      primaryLocale: "en",
      enabledLocales: ["en"],
      siteType: SiteType.VACATION_RENTAL,
      createdAt: new Date("2026-05-06T12:00:00.000Z"),
    });

    const created = await service.createSite("tenant-1", {
      name: "Azure Bay Villas",
    });

    expect(prisma.site.findUnique).toHaveBeenNthCalledWith(1, {
      where: { publicSubdomain: "azure-bay-villas" },
      select: { id: true },
    });
    expect(prisma.site.findUnique).toHaveBeenNthCalledWith(2, {
      where: { publicSubdomain: "azure-bay-villas-2" },
      select: { id: true },
    });
    expect(prisma.site.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicSubdomain: "azure-bay-villas-2",
        }),
      }),
    );
    expect(created.publicSubdomain).toBe("azure-bay-villas-2");
  });

  it("normalizes explicit public subdomains and rejects collisions", async () => {
    prisma.site.findUnique.mockResolvedValue({ id: "site-existing" });

    await expect(
      service.createSite("tenant-1", {
        name: "Azure Bay Villas",
        publicSubdomain: " Azure Bay Villas ",
      }),
    ).rejects.toMatchObject({
      response: {
        code: "CONFLICT",
        message: "This public subdomain is already taken.",
      },
    });

    expect(prisma.site.findUnique).toHaveBeenCalledWith({
      where: { publicSubdomain: "azure-bay-villas" },
      select: { id: true },
    });
    expect(prisma.site.create).not.toHaveBeenCalled();
  });

  it("archives a site, detaches domains, and releases public routing identifiers", async () => {
    prisma.site.findFirst.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      name: "Azure Bay Villas",
      slug: "azure-bay-villas",
      publicSubdomain: "azure-bay-villas",
      status: SiteStatus.ACTIVE,
      primaryLocale: "en",
      enabledLocales: ["en"],
      siteType: SiteType.VACATION_RENTAL,
      createdAt: new Date("2026-05-06T12:00:00.000Z"),
      domains: [{ host: "azure.example" }],
    });
    prisma.site.update.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      name: "Azure Bay Villas",
      slug: "azure-bay-villas-archived-site-1",
      publicSubdomain: null,
      status: SiteStatus.ARCHIVED,
      primaryLocale: "en",
      enabledLocales: ["en"],
      siteType: SiteType.VACATION_RENTAL,
      createdAt: new Date("2026-05-06T12:00:00.000Z"),
    });

    const deleted = await service.deleteSite("tenant-1", "site-1");

    expect(prisma.site.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "site-1",
          tenantId: "tenant-1",
          status: { not: SiteStatus.ARCHIVED },
        },
      }),
    );
    expect(prisma.domain.deleteMany).toHaveBeenCalledWith({
      where: { siteId: "site-1" },
    });
    expect(prisma.site.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "site-1" },
        data: {
          status: SiteStatus.ARCHIVED,
          slug: "azure-bay-villas-archived-site-1",
          publicSubdomain: null,
        },
      }),
    );
    expect(publicRuntimeCacheService.deleteKeys).toHaveBeenCalledWith([
      "runtime:host:azure-bay-villas.staylayer.test",
      "runtime:host:azure.example",
      "runtime:host:www.azure.example",
    ]);
    expect(notificationsService.createForTenantRoles).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        title: "Azure Bay Villas was deleted from Workspace Studio",
      }),
    );
    expect(deleted.status).toBe(SiteStatus.ARCHIVED);
  });

  it("sends a workspace invitation instead of attaching a member immediately", async () => {
    customerAccessService.createWorkspaceInvitation.mockResolvedValue({
      id: "invite-1",
      email: "member@example.com",
      role: TenantMembershipRole.ADMIN,
      status: "pending",
      createdAt: "2026-05-06T12:00:00.000Z",
      expiresAt: "2026-05-13T12:00:00.000Z",
    });

    const member = await service.inviteMember(
      "tenant-1",
      {
        email: " MEMBER@example.com ",
        role: TenantMembershipRole.ADMIN,
      },
      "user-1",
    );

    expect(
      customerAccessService.createWorkspaceInvitation,
    ).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      email: " MEMBER@example.com ",
      role: TenantMembershipRole.ADMIN,
      invitedByUserId: "user-1",
    });
    expect(member.email).toBe("member@example.com");
  });

  it("creates a new customer account and membership in one transaction", async () => {
    usersService.findByEmail.mockResolvedValue(null);
    usersService.hashPassword.mockResolvedValue("hashed-password");
    prisma.user.create.mockResolvedValue({
      id: "user-2",
      email: "new@example.com",
    });
    prisma.tenantMembership.create.mockResolvedValue({
      id: "membership-2",
      tenantId: "tenant-1",
      role: TenantMembershipRole.EDITOR,
      isDefault: true,
      createdAt: new Date("2026-05-06T12:00:00.000Z"),
      user: {
        id: "user-2",
        email: "new@example.com",
      },
    });

    const member = await service.createMember("tenant-1", {
      email: "new@example.com",
      password: "AzureBay123!",
      role: TenantMembershipRole.EDITOR,
    });

    expect(billingService.assertCanAddSeat).toHaveBeenCalledWith("tenant-1");
    expect(usersService.hashPassword).toHaveBeenCalledWith("AzureBay123!");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "new@example.com",
        passwordHash: "hashed-password",
        emailVerifiedAt: expect.any(Date),
        platformRole: null,
      },
      select: {
        id: true,
        email: true,
      },
    });
    expect(
      customerAccessService.sendWorkspaceAccountSetupEmail,
    ).toHaveBeenCalledWith({
      userId: "user-2",
      email: "new@example.com",
      tenantName: "Azure Bay",
      role: TenantMembershipRole.EDITOR,
    });
    expect(member.userId).toBe("user-2");
  });

  it("removes a workspace member and reassigns their default workspace", async () => {
    prisma.tenantMembership.findFirst
      .mockResolvedValueOnce({
        id: "membership-2",
        tenantId: "tenant-1",
        role: TenantMembershipRole.EDITOR,
        isDefault: true,
        createdAt: new Date("2026-05-06T12:00:00.000Z"),
        user: {
          id: "user-2",
          email: "editor@example.com",
        },
      })
      .mockResolvedValueOnce({ id: "membership-3" });

    const removed = await service.removeMember(
      "tenant-1",
      "membership-2",
      "owner-1",
    );

    expect(prisma.tenantMembership.delete).toHaveBeenCalledWith({
      where: { id: "membership-2" },
    });
    expect(prisma.tenantMembership.update).toHaveBeenCalledWith({
      where: { id: "membership-3" },
      data: { isDefault: true },
    });
    expect(notificationsService.createForTenantRoles).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        title: "Team member removed: editor@example.com",
      }),
    );
    expect(removed.email).toBe("editor@example.com");
  });

  it("blocks self-removal from workspace studio", async () => {
    prisma.tenantMembership.findFirst.mockResolvedValue({
      id: "membership-1",
      tenantId: "tenant-1",
      role: TenantMembershipRole.OWNER,
      isDefault: true,
      createdAt: new Date("2026-05-06T12:00:00.000Z"),
      user: {
        id: "owner-1",
        email: "owner@example.com",
      },
    });

    await expect(
      service.removeMember("tenant-1", "membership-1", "owner-1"),
    ).rejects.toMatchObject({
      response: {
        code: "SELF_REMOVAL_BLOCKED",
      },
    });
    expect(prisma.tenantMembership.delete).not.toHaveBeenCalled();
  });

  it("blocks removing the final owner", async () => {
    prisma.tenantMembership.findFirst.mockResolvedValue({
      id: "membership-1",
      tenantId: "tenant-1",
      role: TenantMembershipRole.OWNER,
      isDefault: false,
      createdAt: new Date("2026-05-06T12:00:00.000Z"),
      user: {
        id: "owner-2",
        email: "owner2@example.com",
      },
    });
    prisma.tenantMembership.count.mockResolvedValue(1);

    await expect(
      service.removeMember("tenant-1", "membership-1", "owner-1"),
    ).rejects.toMatchObject({
      response: {
        code: "LAST_OWNER_BLOCKED",
      },
    });
    expect(prisma.tenantMembership.delete).not.toHaveBeenCalled();
  });

  it("delegates revokeInvitation to the customer access service", async () => {
    customerAccessService.revokeWorkspaceInvitation.mockResolvedValue({
      id: "inv-1",
      email: "guest@example.com",
      role: TenantMembershipRole.EDITOR,
      status: "pending",
      createdAt: "2026-05-01T10:00:00.000Z",
      expiresAt: "2026-05-08T10:00:00.000Z",
    });

    const result = await service.revokeInvitation("tenant-1", "inv-1");

    expect(
      customerAccessService.revokeWorkspaceInvitation,
    ).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      invitationId: "inv-1",
    });
    expect(result.id).toBe("inv-1");
  });

  it("surfaces conflict errors from revokeInvitation", async () => {
    customerAccessService.revokeWorkspaceInvitation.mockRejectedValue(
      new ConflictException({
        code: "INVITATION_ALREADY_ACCEPTED",
        message: "x",
      }),
    );

    await expect(
      service.revokeInvitation("tenant-1", "inv-1"),
    ).rejects.toMatchObject({
      response: { code: "INVITATION_ALREADY_ACCEPTED" },
    });
  });

  it("delegates resendInvitation to the customer access service", async () => {
    customerAccessService.resendWorkspaceInvitation.mockResolvedValue({
      id: "inv-2",
      email: "guest@example.com",
      role: TenantMembershipRole.EDITOR,
      status: "pending",
      createdAt: "2026-05-09T10:00:00.000Z",
      expiresAt: "2026-05-16T10:00:00.000Z",
    });

    const result = await service.resendInvitation(
      "tenant-1",
      "inv-1",
      "owner-1",
    );

    expect(
      customerAccessService.resendWorkspaceInvitation,
    ).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      invitationId: "inv-1",
      invitedByUserId: "owner-1",
    });
    expect(result.id).toBe("inv-2");
  });

  it("surfaces conflict errors from resendInvitation", async () => {
    customerAccessService.resendWorkspaceInvitation.mockRejectedValue(
      new ConflictException({
        code: "INVITATION_ALREADY_ACCEPTED",
        message: "x",
      }),
    );

    await expect(
      service.resendInvitation("tenant-1", "inv-1", "owner-1"),
    ).rejects.toMatchObject({
      response: { code: "INVITATION_ALREADY_ACCEPTED" },
    });
  });
});
