/// <reference types="jest" />

import { SiteStatus, SiteType, TenantMembershipRole } from "@prisma/client";
import { TenantWorkspaceService } from "./tenant-workspace.service";

function buildPrismaMock() {
  const prisma = {
    $transaction: jest.fn(),
    site: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    siteSettings: {
      create: jest.fn(),
    },
    tenantMembership: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
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
  };
  let notificationsService: {
    create: jest.Mock;
    createForTenantRoles: jest.Mock;
  };
  let service: TenantWorkspaceService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.site.findUnique.mockResolvedValue(null);
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
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue(null),
      createForTenantRoles: jest.fn().mockResolvedValue([]),
    };

    service = new TenantWorkspaceService(
      prisma as never,
      billingService as never,
      usersService as never,
      customerAccessService as never,
      notificationsService as never,
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
    expect(member.userId).toBe("user-2");
  });
});
