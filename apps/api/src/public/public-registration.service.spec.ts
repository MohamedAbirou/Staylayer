/// <reference types="jest" />

import { SiteStatus, SiteType, TenantMembershipRole } from "@prisma/client";
import { PublicRegistrationService } from "./public-registration.service";

function buildPrismaMock() {
  const prisma = {
    $transaction: jest.fn(),
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    site: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      create: jest.fn(),
    },
    tenantMembership: {
      create: jest.fn(),
    },
    siteSettings: {
      create: jest.fn(),
    },
    tenantOnboarding: {
      create: jest.fn(),
    },
    tenantOnboardingMilestone: {
      create: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };

  prisma.$transaction.mockImplementation(
    async (callback: (tx: typeof prisma) => unknown) => callback(prisma),
  );

  return prisma;
}

describe("PublicRegistrationService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let usersService: {
    findByEmail: jest.Mock;
    hashPassword: jest.Mock;
  };
  let service: PublicRegistrationService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    prisma.tenant.findUnique.mockResolvedValue(null);
    prisma.site.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
    });
    prisma.tenant.create.mockResolvedValue({ id: "tenant-1" });
    prisma.tenantMembership.create.mockResolvedValue({
      id: "membership-1",
      tenantId: "tenant-1",
      userId: "user-1",
      role: TenantMembershipRole.OWNER,
    });
    prisma.site.create.mockResolvedValue({ id: "site-1" });
    prisma.siteSettings.create.mockResolvedValue({ id: "settings-1" });
    prisma.tenantOnboarding.create.mockResolvedValue({ id: "onboarding-1" });
    prisma.tenantOnboardingMilestone.create.mockResolvedValue({
      id: "milestone-1",
    });
    prisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    usersService = {
      findByEmail: jest.fn().mockResolvedValue(null),
      hashPassword: jest.fn().mockResolvedValue("hashed-password"),
    };

    service = new PublicRegistrationService(
      prisma as never,
      usersService as never,
    );
  });

  it("provisions a normalized public subdomain during public signup", async () => {
    await service.registerCustomer({
      name: "Avery",
      companyName: "Northwind Hospitality",
      propertyName: "Azure Bay Villas",
      workEmail: "owner@example.com",
      password: "AzureBay123!",
      primaryLocale: "en",
      hospitalityType: SiteType.VACATION_RENTAL,
      legalAcceptances: [
        {
          documentKey: "terms-of-service",
          version: "2026-05-11",
        },
        {
          documentKey: "privacy-policy",
          version: "2026-05-11",
        },
      ],
    });

    expect(prisma.site.findUnique).toHaveBeenCalledWith({
      where: { publicSubdomain: "azure-bay-villas" },
      select: { id: true },
    });
    expect(prisma.site.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          publicSubdomain: "azure-bay-villas",
        }),
      }),
    );
  });

  it("auto-suffixes generated signup subdomains when the base label is occupied", async () => {
    prisma.site.findUnique
      .mockResolvedValueOnce({ id: "site-existing" })
      .mockResolvedValueOnce(null);

    await service.registerCustomer({
      name: "Avery",
      companyName: "Northwind Hospitality",
      propertyName: "Azure Bay Villas",
      workEmail: "owner@example.com",
      password: "AzureBay123!",
      primaryLocale: "en",
      hospitalityType: SiteType.VACATION_RENTAL,
      legalAcceptances: [
        {
          documentKey: "terms-of-service",
          version: "2026-05-11",
        },
        {
          documentKey: "privacy-policy",
          version: "2026-05-11",
        },
      ],
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
          status: SiteStatus.ACTIVE,
        }),
      }),
    );
  });
});
