/// <reference types="jest" />

import {
  Role,
  SiteStatus,
  SiteType,
  TenantMembershipRole,
} from "@prisma/client";
import { TenantWorkspaceService } from "./tenant-workspace.service";

function buildPrismaMock() {
  const prisma = {
    $transaction: jest.fn(),
    site: {
      create: jest.fn(),
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
  let service: TenantWorkspaceService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    billingService = {
      assertCanProvisionSite: jest.fn().mockResolvedValue(undefined),
      assertCanAddSeat: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      findByEmail: jest.fn(),
      hashPassword: jest.fn(),
    };

    service = new TenantWorkspaceService(
      prisma as never,
      billingService as never,
      usersService as never,
    );
  });

  it("creates a site after enforcing the tenant site cap", async () => {
    prisma.site.create.mockResolvedValue({
      id: "site-1",
      tenantId: "tenant-1",
      name: "Azure Bay Villas",
      slug: "azure-bay-villas",
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
  });

  it("adds an existing user to the tenant after enforcing the seat cap", async () => {
    usersService.findByEmail.mockResolvedValue({
      id: "user-1",
      email: "member@example.com",
    });
    prisma.tenantMembership.findUnique.mockResolvedValue(null);
    prisma.tenantMembership.count.mockResolvedValue(0);
    prisma.tenantMembership.create.mockResolvedValue({
      id: "membership-1",
      tenantId: "tenant-1",
      role: TenantMembershipRole.ADMIN,
      isDefault: true,
      createdAt: new Date("2026-05-06T12:00:00.000Z"),
      user: {
        id: "user-1",
        email: "member@example.com",
      },
    });

    const member = await service.inviteMember("tenant-1", {
      email: " MEMBER@example.com ",
      role: TenantMembershipRole.ADMIN,
    });

    expect(billingService.assertCanAddSeat).toHaveBeenCalledWith("tenant-1");
    expect(prisma.tenantMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tenantId: "tenant-1",
          userId: "user-1",
          role: TenantMembershipRole.ADMIN,
          isDefault: true,
        },
      }),
    );
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
        platformRole: null,
        role: Role.EDITOR,
      },
      select: {
        id: true,
        email: true,
      },
    });
    expect(member.userId).toBe("user-2");
  });
});
