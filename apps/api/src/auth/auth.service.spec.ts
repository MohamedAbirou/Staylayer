/// <reference types="jest" />

import { SiteStatus, TenantStatus } from "@prisma/client";
import { AuthService } from "./auth.service";

function buildAuthUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "owner@example.com",
    passwordHash: "hash",
    emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    platformRole: null,
    failedAttempts: 0,
    lockedUntil: null,
    memberships: [],
    ...overrides,
  };
}

function buildMembership(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: "tenant-1",
    role: "OWNER",
    isDefault: false,
    tenant: {
      id: "tenant-1",
      slug: "acme",
      name: "Acme",
      status: TenantStatus.ACTIVE,
      sites: [
        {
          id: "site-1",
          slug: "main",
          name: "Main site",
          status: SiteStatus.ACTIVE,
        },
      ],
    },
    ...overrides,
  };
}

describe("AuthService", () => {
  let usersService: {
    findAuthUserById: jest.Mock;
    findAuthUserByEmail: jest.Mock;
    verifyPassword: jest.Mock;
    incrementFailedAttempts: jest.Mock;
    resetFailedAttempts: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let configService: { get: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    usersService = {
      findAuthUserById: jest.fn(),
      findAuthUserByEmail: jest.fn(),
      verifyPassword: jest.fn(),
      incrementFailedAttempts: jest.fn(),
      resetFailedAttempts: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue("access-token"),
      verifyAsync: jest.fn(),
    };
    configService = { get: jest.fn().mockReturnValue("test") };

    service = new AuthService(
      usersService as never,
      jwtService as never,
      configService as never,
    );
  });

  it("logs into another active workspace when the default tenant is suspended", async () => {
    usersService.findAuthUserById.mockResolvedValue(
      buildAuthUser({
        memberships: [
          buildMembership({
            tenantId: "suspended-tenant",
            isDefault: true,
            tenant: {
              id: "suspended-tenant",
              slug: "paused",
              name: "Paused Workspace",
              status: TenantStatus.SUSPENDED,
              sites: [],
            },
          }),
          buildMembership({
            tenantId: "active-tenant",
            isDefault: false,
            tenant: {
              id: "active-tenant",
              slug: "active",
              name: "Active Workspace",
              status: TenantStatus.ACTIVE,
              sites: [],
            },
          }),
        ],
      }),
    );

    const result = await service.login({
      id: "user-1",
      email: "owner@example.com",
      platformRole: null,
    });

    expect(result.activeTenant).toEqual({
      id: "active-tenant",
      slug: "active",
      name: "Active Workspace",
      status: TenantStatus.ACTIVE,
    });
    expect(result.activeMembershipRole).toBe("OWNER");
    expect(result.memberships).toHaveLength(1);
  });

  it("chooses the first active membership when multiple active memberships have no default", async () => {
    usersService.findAuthUserById.mockResolvedValue(
      buildAuthUser({
        memberships: [
          buildMembership({
            tenantId: "tenant-a",
            role: "EDITOR",
            tenant: {
              id: "tenant-a",
              slug: "alpha",
              name: "Alpha",
              status: TenantStatus.ACTIVE,
              sites: [],
            },
          }),
          buildMembership({
            tenantId: "tenant-b",
            role: "OWNER",
            tenant: {
              id: "tenant-b",
              slug: "beta",
              name: "Beta",
              status: TenantStatus.ACTIVE,
              sites: [],
            },
          }),
        ],
      }),
    );

    const result = await service.login({
      id: "user-1",
      email: "owner@example.com",
      platformRole: null,
    });

    expect(result.activeTenant?.id).toBe("tenant-a");
    expect(result.activeMembershipRole).toBe("EDITOR");
  });
});
