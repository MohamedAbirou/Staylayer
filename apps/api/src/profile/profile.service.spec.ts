/// <reference types="jest" />

import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  NotificationCategory,
  TenantMembershipRole,
  TenantStatus,
} from "@prisma/client";
import { ProfileService } from "./profile.service";

function buildPrismaMock() {
  const prisma = {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    tenantMembership: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    workspaceInvitation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    seoAuditTask: {
      count: jest.fn(),
    },
    passwordResetToken: {
      updateMany: jest.fn(),
    },
    notification: {
      deleteMany: jest.fn(),
    },
    notificationPreference: {
      deleteMany: jest.fn(),
    },
    tenantOnboarding: {
      create: jest.fn(),
    },
    site: {
      groupBy: jest.fn(),
    },
  };

  prisma.$transaction.mockImplementation(async (input: unknown) => {
    if (typeof input === "function") {
      return (input as (tx: typeof prisma) => unknown)(prisma);
    }
    if (Array.isArray(input)) {
      return Promise.all(input as Promise<unknown>[]);
    }
    return input;
  });

  return prisma;
}

describe("ProfileService", () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let usersService: { hashPassword: jest.Mock; verifyPassword: jest.Mock };
  let notificationsService: {
    create: jest.Mock;
    createForTenantRoles: jest.Mock;
  };
  let auditWriter: jest.Mock;
  let service: ProfileService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    usersService = {
      hashPassword: jest.fn().mockResolvedValue("new-hash"),
      verifyPassword: jest.fn(),
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue(null),
      createForTenantRoles: jest.fn().mockResolvedValue([]),
    };
    auditWriter = jest.fn().mockResolvedValue(undefined);

    service = new ProfileService(
      prisma as never,
      usersService as never,
      notificationsService as never,
    );
  });

  describe("changePassword", () => {
    it("rejects when the current password is wrong", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "user@example.com",
        passwordHash: "old-hash",
      });
      usersService.verifyPassword.mockResolvedValue(false);

      await expect(
        service.changePassword("u1", "wrong", "longenoughpassword1"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("rejects when the new password equals the current one", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "user@example.com",
        passwordHash: "old-hash",
      });

      await expect(
        service.changePassword("u1", "same-password", "same-password"),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersService.verifyPassword).not.toHaveBeenCalled();
    });

    it("updates the password and notifies the user in every workspace", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "user@example.com",
        passwordHash: "old-hash",
      });
      usersService.verifyPassword.mockResolvedValue(true);
      prisma.tenantMembership.findMany.mockResolvedValue([
        { tenantId: "t1" },
        { tenantId: "t2" },
      ]);

      const result = await service.changePassword(
        "u1",
        "current-secret",
        "new-strong-password-1234",
      );

      expect(usersService.hashPassword).toHaveBeenCalledWith(
        "new-strong-password-1234",
      );
      expect(notificationsService.create).toHaveBeenCalledTimes(2);
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "t1",
          userId: "u1",
          category: NotificationCategory.SYSTEM,
        }),
      );
      expect(result).toHaveProperty("changedAt");
    });
  });

  describe("leaveWorkspace", () => {
    function membershipFixture(overrides: Record<string, unknown> = {}) {
      return {
        id: "m1",
        role: TenantMembershipRole.EDITOR,
        isDefault: false,
        tenant: { id: "t1", slug: "acme", name: "Acme" },
        user: { id: "u1", email: "user@example.com" },
        ...overrides,
      };
    }

    it("rejects when the slug confirmation does not match", async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue(membershipFixture());

      await expect(
        service.leaveWorkspace("u1", "t1", "wrong-slug", auditWriter),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.tenantMembership.delete).not.toHaveBeenCalled();
    });

    it("blocks the final OWNER from leaving", async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue(
        membershipFixture({ role: TenantMembershipRole.OWNER }),
      );
      prisma.tenantMembership.count.mockResolvedValue(1);

      await expect(
        service.leaveWorkspace("u1", "t1", "acme", auditWriter),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: "LAST_OWNER_BLOCKED" }),
      });
      expect(auditWriter).not.toHaveBeenCalled();
    });

    it("removes membership, writes an audit log, and notifies admins", async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue(membershipFixture());

      const result = await service.leaveWorkspace(
        "u1",
        "t1",
        "ACME",
        auditWriter,
      );

      expect(auditWriter).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "t1",
          actorUserId: "u1",
          action: "tenant.member_self_left",
        }),
      );
      expect(notificationsService.createForTenantRoles).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "t1",
          roles: [TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN],
        }),
      );
      expect(result).toEqual({ tenantId: "t1", tenantName: "Acme" });
    });
  });

  describe("createWorkspace", () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        platformRole: null,
      });
      prisma.tenant.findUnique.mockResolvedValue(null);
      prisma.tenantMembership.count.mockResolvedValue(0);
      prisma.tenant.create.mockResolvedValue({
        id: "t1",
        name: "Acme Stays",
        slug: "acme-stays",
      });
      prisma.tenantMembership.create.mockResolvedValue({
        id: "m1",
        role: TenantMembershipRole.OWNER,
        isDefault: true,
        createdAt: new Date("2026-01-02T03:04:05.000Z"),
      });
      prisma.tenantOnboarding.create.mockResolvedValue({ id: "onboarding-1" });
    });

    it("creates a tenant and default owner membership for the user", async () => {
      const result = await service.createWorkspace("u1", {
        name: "Acme Stays",
      });

      expect(prisma.tenantMembership.updateMany).toHaveBeenCalledWith({
        where: { userId: "u1" },
        data: { isDefault: false },
      });
      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: "Acme Stays", slug: "acme-stays" },
        }),
      );
      expect(prisma.tenantMembership.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            tenantId: "t1",
            userId: "u1",
            role: TenantMembershipRole.OWNER,
            isDefault: true,
          },
        }),
      );
      expect(prisma.tenantOnboarding.create).toHaveBeenCalledWith({
        data: { tenantId: "t1" },
      });
      expect(result).toEqual({
        tenantId: "t1",
        tenantSlug: "acme-stays",
        tenantName: "Acme Stays",
        membershipId: "m1",
        role: TenantMembershipRole.OWNER,
        isDefault: true,
        joinedAt: "2026-01-02T03:04:05.000Z",
      });
    });

    it("suffixes the slug when the base slug already exists", async () => {
      prisma.tenant.findUnique
        .mockResolvedValueOnce({ id: "existing" })
        .mockResolvedValueOnce(null);
      prisma.tenant.create.mockResolvedValue({
        id: "t2",
        name: "Acme Stays",
        slug: "acme-stays-2",
      });

      await service.createWorkspace("u1", { name: "Acme Stays" });

      expect(prisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: "Acme Stays", slug: "acme-stays-2" },
        }),
      );
    });

    it("blocks platform users from creating customer workspaces", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        platformRole: "PLATFORM_OWNER",
      });

      await expect(
        service.createWorkspace("u1", { name: "Operator Workspace" }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });

    it("blocks self-service workspace creation after the owner limit", async () => {
      prisma.tenantMembership.count.mockResolvedValue(10);

      await expect(
        service.createWorkspace("u1", { name: "One More Workspace" }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: "WORKSPACE_CREATE_LIMIT_REACHED",
        }),
      });
      expect(prisma.tenant.create).not.toHaveBeenCalled();
    });
  });

  describe("deleteAccount", () => {
    function userFixture() {
      return {
        id: "u1",
        email: "user@example.com",
        passwordHash: "old-hash",
      };
    }

    function overviewUserFixture() {
      return {
        id: "u1",
        email: "user@example.com",
        platformRole: null,
        memberships: [
          {
            tenantId: "t1",
            role: TenantMembershipRole.EDITOR,
            tenant: { id: "t1", slug: "acme", name: "Acme" },
          },
        ],
      };
    }

    function primeImpactQueries(ownerCount = 1, memberCount = 5) {
      prisma.tenantMembership.groupBy.mockImplementation(
        (args: { where: { role?: string } }) => {
          if (args?.where?.role === TenantMembershipRole.OWNER) {
            return Promise.resolve([
              { tenantId: "t1", _count: { _all: ownerCount } },
            ]);
          }
          return Promise.resolve([
            { tenantId: "t1", _count: { _all: memberCount } },
          ]);
        },
      );
      prisma.site.groupBy.mockResolvedValue([]);
      prisma.workspaceInvitation.count.mockResolvedValue(0);
      prisma.seoAuditTask.count.mockResolvedValue(0);
    }

    it("rejects when the confirm email does not match", async () => {
      prisma.user.findUnique.mockResolvedValue(userFixture());

      await expect(
        service.deleteAccount("u1", "wrong@example.com", "pw", auditWriter),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(usersService.verifyPassword).not.toHaveBeenCalled();
    });

    it("rejects when the password is wrong", async () => {
      prisma.user.findUnique.mockResolvedValue(userFixture());
      usersService.verifyPassword.mockResolvedValue(false);

      await expect(
        service.deleteAccount("u1", "user@example.com", "bad", auditWriter),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("blocks deletion when the user is the final owner of any workspace", async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(userFixture())
        .mockResolvedValueOnce(overviewUserFixture()); // for getAccountDeletionImpact
      usersService.verifyPassword.mockResolvedValue(true);
      // Make the membership an OWNER with ownerCount=1 → finalOwner
      (prisma.user.findUnique as jest.Mock).mockReset();
      prisma.user.findUnique
        .mockResolvedValueOnce(userFixture())
        .mockResolvedValueOnce({
          ...overviewUserFixture(),
          memberships: [
            {
              tenantId: "t1",
              role: TenantMembershipRole.OWNER,
              tenant: { id: "t1", slug: "acme", name: "Acme" },
            },
          ],
        });
      usersService.verifyPassword.mockResolvedValue(true);
      primeImpactQueries(1, 1);

      await expect(
        service.deleteAccount(
          "u1",
          "user@example.com",
          "good-password",
          auditWriter,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });

    it("deletes the user, scrubs notifications, and writes audit logs", async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(userFixture())
        .mockResolvedValueOnce(overviewUserFixture());
      usersService.verifyPassword.mockResolvedValue(true);
      primeImpactQueries(2, 5); // ownerCount=2 → not a final owner

      const result = await service.deleteAccount(
        "u1",
        "USER@example.com",
        "good-password",
        auditWriter,
      );

      expect(auditWriter).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "t1",
          actorUserId: "u1",
          action: "account.self_deleted",
        }),
      );
      expect(prisma.notification.deleteMany).toHaveBeenCalledWith({
        where: { userId: "u1" },
      });
      expect(prisma.notificationPreference.deleteMany).toHaveBeenCalledWith({
        where: { userId: "u1" },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: "u1" },
      });
      expect(result).toEqual({
        deletedUserId: "u1",
        email: "user@example.com",
      });
    });
  });

  describe("setDefaultMembership", () => {
    it("clears the previous default and promotes the chosen membership", async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue({ id: "m1" });
      // Mock the follow-up overview() call:
      prisma.user.findUnique.mockResolvedValue({
        id: "u1",
        email: "user@example.com",
        emailVerifiedAt: null,
        platformRole: null,
        createdAt: new Date(),
        memberships: [
          {
            id: "m1",
            tenantId: "t1",
            role: TenantMembershipRole.OWNER,
            isDefault: true,
            createdAt: new Date(),
            tenant: {
              id: "t1",
              slug: "acme",
              name: "Acme",
              status: TenantStatus.ACTIVE,
            },
          },
        ],
      });
      prisma.tenantMembership.groupBy.mockResolvedValue([]);
      prisma.site.groupBy.mockResolvedValue([]);
      prisma.workspaceInvitation.findMany.mockResolvedValue([]);

      const result = await service.setDefaultMembership("u1", "t1");

      expect(prisma.tenantMembership.updateMany).toHaveBeenCalledWith({
        where: { userId: "u1", isDefault: true },
        data: { isDefault: false },
      });
      expect(prisma.tenantMembership.update).toHaveBeenCalledWith({
        where: { id: "m1" },
        data: { isDefault: true },
      });
      expect(result.tenantId).toBe("t1");
      expect(result.isDefault).toBe(true);
    });
  });
});
