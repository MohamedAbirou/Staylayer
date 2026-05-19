/// <reference types="jest" />

import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { PlatformRole } from "@prisma/client";
import { OperatorAuthService } from "./operator-auth.service";
import {
  OPERATOR_JWT_AUDIENCE,
  OPERATOR_JWT_ISSUER,
} from "./operator-auth.types";

function buildOperatorUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "op-1",
    email: "support@staylayer.com",
    passwordHash: "argon2-hash",
    emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
    platformRole: PlatformRole.SUPPORT_ADMIN,
    operatorFailedAttempts: 0,
    operatorLockedUntil: null,
    operatorMfaEnrolledAt: null,
    operatorMfaSecret: null,
    memberships: [],
    ...overrides,
  };
}

function buildCustomerUser(overrides: Record<string, unknown> = {}) {
  return buildOperatorUser({
    id: "user-1",
    email: "owner@example.com",
    platformRole: null,
    ...overrides,
  });
}

function buildPrismaMock() {
  const sessionStore = new Map<string, Record<string, unknown>>();
  let idCounter = 0;
  const operatorRefreshSession = {
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const id = `sess-${++idCounter}`;
      const row = { id, revokedAt: null, ...data };
      sessionStore.set(data.jti as string, row);
      return row;
    }),
    findUnique: jest.fn(async ({ where }: { where: { jti: string } }) => {
      return sessionStore.get(where.jti) ?? null;
    }),
    update: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        for (const row of sessionStore.values()) {
          if (row.id === where.id) {
            Object.assign(row, data);
            return row;
          }
        }
        return null;
      },
    ),
    updateMany: jest.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        let count = 0;
        for (const row of sessionStore.values()) {
          if (where.jti && row.jti !== where.jti) continue;
          if (where.userId && row.userId !== where.userId) continue;
          if (
            Object.prototype.hasOwnProperty.call(where, "revokedAt") &&
            (where.revokedAt as null) === null &&
            row.revokedAt !== null
          )
            continue;
          Object.assign(row, data);
          count++;
        }
        return { count };
      },
    ),
  };
  const tx = { operatorRefreshSession };
  const prisma = {
    operatorRefreshSession,
    $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) =>
      cb(tx),
    ),
    __sessionStore: sessionStore,
  };
  return prisma;
}

describe("OperatorAuthService", () => {
  let usersService: {
    findAuthUserById: jest.Mock;
    findAuthUserByEmail: jest.Mock;
    verifyPassword: jest.Mock;
    incrementOperatorFailedAttempts: jest.Mock;
    resetOperatorFailedAttempts: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let configService: { get: jest.Mock };
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: OperatorAuthService;

  beforeEach(() => {
    usersService = {
      findAuthUserById: jest.fn(),
      findAuthUserByEmail: jest.fn(),
      verifyPassword: jest.fn(),
      incrementOperatorFailedAttempts: jest.fn(),
      resetOperatorFailedAttempts: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn().mockResolvedValue("signed-token"),
      verifyAsync: jest.fn(),
    };
    configService = { get: jest.fn().mockReturnValue("test") };
    prisma = buildPrismaMock();

    service = new OperatorAuthService(
      usersService as never,
      jwtService as never,
      configService as never,
      prisma as never,
    );
  });

  describe("validateOperator", () => {
    it("returns the operator profile on a valid operator login", async () => {
      usersService.findAuthUserByEmail.mockResolvedValue(buildOperatorUser());
      usersService.verifyPassword.mockResolvedValue(true);

      const result = await service.validateOperator(
        "support@staylayer.com",
        "Password1!",
      );

      expect(result).toEqual({
        id: "op-1",
        email: "support@staylayer.com",
        platformRole: PlatformRole.SUPPORT_ADMIN,
        mfaEnrolled: false,
      });
      expect(usersService.resetOperatorFailedAttempts).toHaveBeenCalledWith(
        "op-1",
      );
    });

    it("rejects a customer-only account with a generic credentials error", async () => {
      usersService.findAuthUserByEmail.mockResolvedValue(buildCustomerUser());
      usersService.verifyPassword.mockResolvedValue(true);

      await expect(
        service.validateOperator("owner@example.com", "Password1!"),
      ).rejects.toMatchObject({
        response: { code: "OPERATOR_INVALID_CREDENTIALS" },
      });
      expect(usersService.resetOperatorFailedAttempts).toHaveBeenCalledWith(
        "user-1",
      );
    });

    it("rejects on unknown email with the generic credentials error", async () => {
      usersService.findAuthUserByEmail.mockResolvedValue(null);
      usersService.verifyPassword.mockResolvedValue(false);

      await expect(
        service.validateOperator("ghost@example.com", "Password1!"),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects when an operator password is wrong and increments lockout counter", async () => {
      usersService.findAuthUserByEmail.mockResolvedValue(buildOperatorUser());
      usersService.verifyPassword.mockResolvedValue(false);

      await expect(
        service.validateOperator("support@staylayer.com", "bad-password"),
      ).rejects.toMatchObject({
        response: { code: "OPERATOR_INVALID_CREDENTIALS" },
      });
      expect(usersService.incrementOperatorFailedAttempts).toHaveBeenCalledWith(
        "op-1",
      );
    });

    it("denies access when the account is locked", async () => {
      const future = new Date(Date.now() + 60_000);
      usersService.findAuthUserByEmail.mockResolvedValue(
        buildOperatorUser({ operatorLockedUntil: future }),
      );

      await expect(
        service.validateOperator("support@staylayer.com", "Password1!"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe("issueLoginTokens", () => {
    it("signs access and refresh tokens, persists a JTI-bound session, returns permissions", async () => {
      const result = await service.issueLoginTokens(
        {
          id: "op-1",
          email: "support@staylayer.com",
          platformRole: PlatformRole.SUPPORT_ADMIN,
        },
        { userAgent: "ua", ip: "1.2.3.4" },
      );

      expect(result.auth.user).toEqual({
        id: "op-1",
        email: "support@staylayer.com",
        platformRole: PlatformRole.SUPPORT_ADMIN,
      });
      expect(result.auth.accessToken).toBe("signed-token");
      expect(result.refreshToken).toBe("signed-token");
      expect(Array.isArray(result.auth.permissions)).toBe(true);
      expect(result.auth.permissions).toContain("support_case.read.all");

      const refreshPayload = jwtService.signAsync.mock.calls[1][0] as Record<
        string,
        unknown
      >;
      const refreshOptions = jwtService.signAsync.mock.calls[1][1];
      expect(refreshPayload.jti).toBeUndefined();
      expect(refreshOptions).toMatchObject({
        audience: OPERATOR_JWT_AUDIENCE,
        issuer: OPERATOR_JWT_ISSUER,
      });
      expect(refreshOptions.jwtid).toBeTruthy();
      expect(prisma.operatorRefreshSession.create).toHaveBeenCalledTimes(1);
      const created = prisma.operatorRefreshSession.create.mock.calls[0][0]
        .data as Record<string, unknown>;
      expect(created.userAgentHash).not.toBe("ua");
      expect(typeof created.userAgentHash).toBe("string");
      expect(created.ipHash).not.toBe("1.2.3.4");
    });
  });

  describe("refresh", () => {
    it("rotates a valid refresh: marks old session revoked and issues a new one", async () => {
      await service.issueLoginTokens({
        id: "op-1",
        email: "support@staylayer.com",
        platformRole: PlatformRole.SUPPORT_ADMIN,
      });
      const firstJti = (
        prisma.operatorRefreshSession.create.mock.calls[0][0].data as {
          jti: string;
        }
      ).jti;
      jwtService.verifyAsync.mockResolvedValue({
        sub: "op-1",
        type: "operator-refresh",
        jti: firstJti,
      });
      usersService.findAuthUserById.mockResolvedValue(buildOperatorUser());

      const result = await service.refresh("raw");

      expect(result.auth.user.id).toBe("op-1");
      expect(result.auth.permissions.length).toBeGreaterThan(0);
      const old = prisma.__sessionStore.get(firstJti) as Record<
        string,
        unknown
      >;
      expect(old.revokedAt).toBeInstanceOf(Date);
      expect(old.revokedReason).toBe("rotated");
      expect(prisma.operatorRefreshSession.create).toHaveBeenCalledTimes(2);
    });

    it("rejects a refresh whose JTI is unknown server-side", async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: "op-1",
        type: "operator-refresh",
        jti: "unknown-jti",
      });

      await expect(service.refresh("raw")).rejects.toMatchObject({
        response: { code: "OPERATOR_REFRESH_UNKNOWN" },
      });
    });

    it("detects re-use of a revoked JTI and revokes all sessions for the user", async () => {
      await service.issueLoginTokens({
        id: "op-1",
        email: "support@staylayer.com",
        platformRole: PlatformRole.SUPPORT_ADMIN,
      });
      const firstJti = (
        prisma.operatorRefreshSession.create.mock.calls[0][0].data as {
          jti: string;
        }
      ).jti;
      const row = prisma.__sessionStore.get(firstJti)!;
      row.revokedAt = new Date();
      row.revokedReason = "rotated";

      jwtService.verifyAsync.mockResolvedValue({
        sub: "op-1",
        type: "operator-refresh",
        jti: firstJti,
      });

      await expect(service.refresh("raw")).rejects.toMatchObject({
        response: { code: "OPERATOR_REFRESH_REUSED" },
      });
    });

    it("rejects when the operator role has been revoked", async () => {
      await service.issueLoginTokens({
        id: "op-1",
        email: "support@staylayer.com",
        platformRole: PlatformRole.SUPPORT_ADMIN,
      });
      const firstJti = (
        prisma.operatorRefreshSession.create.mock.calls[0][0].data as {
          jti: string;
        }
      ).jti;
      jwtService.verifyAsync.mockResolvedValue({
        sub: "op-1",
        type: "operator-refresh",
        jti: firstJti,
      });
      usersService.findAuthUserById.mockResolvedValue(buildCustomerUser());

      await expect(service.refresh("raw")).rejects.toMatchObject({
        response: { code: "OPERATOR_ROLE_REVOKED" },
      });
    });

    it("rejects a refresh missing a JTI claim", async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: "op-1",
        type: "operator-refresh",
      });

      await expect(service.refresh("raw")).rejects.toMatchObject({
        response: { code: "OPERATOR_REFRESH_INVALID" },
      });
    });

    it("rejects an expired or invalid refresh token", async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error("expired"));

      await expect(service.refresh("raw")).rejects.toMatchObject({
        response: { code: "OPERATOR_REFRESH_EXPIRED" },
      });
    });
  });

  describe("revokeRefreshToken (logout)", () => {
    it("marks the matching session row revoked", async () => {
      await service.issueLoginTokens({
        id: "op-1",
        email: "support@staylayer.com",
        platformRole: PlatformRole.SUPPORT_ADMIN,
      });
      const jti = (
        prisma.operatorRefreshSession.create.mock.calls[0][0].data as {
          jti: string;
        }
      ).jti;
      jwtService.verifyAsync.mockResolvedValue({
        sub: "op-1",
        type: "operator-refresh",
        jti,
      });

      await service.revokeRefreshToken("raw");
      const row = prisma.__sessionStore.get(jti)!;
      expect(row.revokedAt).toBeInstanceOf(Date);
      expect(row.revokedReason).toBe("logout");
    });

    it("is a no-op when no token is provided", async () => {
      await expect(
        service.revokeRefreshToken(undefined),
      ).resolves.toBeUndefined();
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it("swallows verify errors silently", async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error("expired"));
      await expect(service.revokeRefreshToken("raw")).resolves.toBeUndefined();
    });
  });

  describe("getSession", () => {
    it("returns the operator profile + permission bundle", async () => {
      usersService.findAuthUserById.mockResolvedValue(buildOperatorUser());

      const session = await service.getSession("op-1");
      expect(session.user).toEqual({
        id: "op-1",
        email: "support@staylayer.com",
        platformRole: PlatformRole.SUPPORT_ADMIN,
      });
      expect(session.permissions).toEqual(
        expect.arrayContaining([
          "support_case.read.all",
          "support_case.resolve.all",
        ]),
      );
      expect(session.permissions).not.toContain(
        "billing.subscription.change_plan.all",
      );
    });

    it("returns the full permission set for PLATFORM_OWNER", async () => {
      usersService.findAuthUserById.mockResolvedValue(
        buildOperatorUser({ platformRole: PlatformRole.PLATFORM_OWNER }),
      );
      const session = await service.getSession("op-1");
      expect(session.permissions).toEqual(
        expect.arrayContaining([
          "operator_user.manage.all",
          "billing.subscription.change_plan.all",
          "support_case.resolve.all",
        ]),
      );
    });

    it("rejects if the operator role was revoked between requests", async () => {
      usersService.findAuthUserById.mockResolvedValue(buildCustomerUser());
      await expect(service.getSession("op-1")).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe("cookie options", () => {
    it("uses sameSite=strict and httpOnly and scopes path to /operator/auth", () => {
      const opts = service.getRefreshCookieOptions();
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe("strict");
      expect(opts.path).toBe("/operator/auth");
      expect(opts.maxAge).toBeGreaterThan(0);
    });

    it("marks the cookie as secure in production", () => {
      configService.get.mockReturnValue("production");
      expect(service.getRefreshCookieOptions().secure).toBe(true);
    });

    it("clears the cookie with maxAge 0 and the same path", () => {
      const opts = service.getClearRefreshCookieOptions();
      expect(opts.maxAge).toBe(0);
      expect(opts.path).toBe("/operator/auth");
    });
  });
});
