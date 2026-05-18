import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PlatformRole } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { UsersService } from "../../users/users.service";
import {
  getPermissionsForRole,
  type OperatorPermissionKey,
} from "./permissions/operator-permissions.registry";
import {
  OPERATOR_ACCESS_TOKEN_TTL_SECONDS,
  OPERATOR_JWT_AUDIENCE,
  OPERATOR_JWT_ISSUER,
  OPERATOR_REFRESH_COOKIE_PATH,
  OPERATOR_REFRESH_TOKEN_TTL_SECONDS,
  OperatorAuthResponse,
  OperatorJwtAccessPayload,
  OperatorJwtRefreshPayload,
  OperatorSessionResponse,
} from "./operator-auth.types";

interface ValidatedOperator {
  id: string;
  email: string;
  platformRole: PlatformRole;
}

export interface OperatorSessionContext {
  userAgent?: string | null;
  ip?: string | null;
}

@Injectable()
export class OperatorAuthService {
  private readonly logger = new Logger(OperatorAuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Validate operator credentials.
   *
   * SECURITY: this is the **only** place a non-operator can be turned away.
   * Customer-only accounts must NEVER receive an operator access token even
   * if their password is correct.
   */
  async validateOperator(
    email: string,
    password: string,
  ): Promise<ValidatedOperator> {
    const user = await this.usersService.findAuthUserByEmail(email);

    if (!user) {
      await this.usersService
        .verifyPassword(
          "$argon2id$v=19$m=65536,t=3,p=4$" +
            "ZGVjb3lkZWNveWRlY295ZGVjb3k$" +
            "ZGVjb3lkZWNveWRlY295ZGVjb3lkZWNveWRlY295ZGVjb3lkZWNveWRlY295ZGU",
          password,
        )
        .catch(() => false);
      throw this.invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException({
        code: "ACCOUNT_LOCKED",
        message: `Account locked. Try again after ${user.lockedUntil.toISOString()}`,
      });
    }

    const passwordValid = await this.usersService.verifyPassword(
      user.passwordHash,
      password,
    );

    if (!passwordValid) {
      await this.usersService.incrementFailedAttempts(user.id);
      this.logger.warn(
        `[operator-auth] failed password for ${this.maskEmail(user.email)}`,
      );
      throw this.invalidCredentials();
    }

    if (!user.platformRole) {
      await this.usersService.resetFailedAttempts(user.id);
      this.logger.warn(
        `[operator-auth] customer-only user attempted operator login: ${this.maskEmail(user.email)}`,
      );
      throw this.invalidCredentials();
    }

    await this.usersService.resetFailedAttempts(user.id);

    return {
      id: user.id,
      email: user.email,
      platformRole: user.platformRole,
    };
  }

  async issueLoginTokens(
    operator: ValidatedOperator,
    ctx: OperatorSessionContext = {},
  ): Promise<{ auth: OperatorAuthResponse; refreshToken: string }> {
    const accessToken = await this.signAccessToken(operator);

    const jti = randomUUID();
    const expiresAt = new Date(
      Date.now() + OPERATOR_REFRESH_TOKEN_TTL_SECONDS * 1000,
    );

    await this.prisma.operatorRefreshSession.create({
      data: {
        jti,
        userId: operator.id,
        userAgentHash: this.hash(ctx.userAgent ?? null),
        ipHash: this.hash(ctx.ip ?? null),
        expiresAt,
      },
    });

    const refreshToken = await this.signRefreshToken(operator.id, jti);
    const permissions = this.permissionsForRole(operator.platformRole);

    this.logger.log(
      `[operator-auth] login success ${this.maskEmail(operator.email)} role=${operator.platformRole}`,
    );

    return {
      auth: {
        accessToken,
        expiresIn: OPERATOR_ACCESS_TOKEN_TTL_SECONDS,
        permissions,
        user: {
          id: operator.id,
          email: operator.email,
          platformRole: operator.platformRole,
        },
      },
      refreshToken,
    };
  }

  /**
   * Rotate the operator refresh token with JTI binding and re-use detection.
   *
   * Security flow:
   *  1. Verify JWT signature/audience/issuer/expiry.
   *  2. Look up the JTI in the OperatorRefreshSession table.
   *  3. Reject if the row is missing, revoked, or expired.
   *  4. If the row was already revoked, treat as token re-use: revoke the
   *     entire chain for that operator and force re-authentication.
   *  5. Issue a new JTI-bound refresh token; mark the previous row revoked
   *     with `replacedBySessionId` pointing at the new row.
   */
  async refresh(
    rawRefreshToken: string,
    ctx: OperatorSessionContext = {},
  ): Promise<{ auth: OperatorAuthResponse; refreshToken: string }> {
    let payload: OperatorJwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<OperatorJwtRefreshPayload>(
        rawRefreshToken,
        {
          audience: OPERATOR_JWT_AUDIENCE,
          issuer: OPERATOR_JWT_ISSUER,
        },
      );
    } catch {
      throw new UnauthorizedException({
        code: "OPERATOR_REFRESH_EXPIRED",
        message: "Operator refresh token expired or invalid",
      });
    }

    if (payload.type !== "operator-refresh" || !payload.jti) {
      throw new UnauthorizedException({
        code: "OPERATOR_REFRESH_INVALID",
        message: "Invalid operator refresh token",
      });
    }

    const session = await this.prisma.operatorRefreshSession.findUnique({
      where: { jti: payload.jti },
    });

    if (!session) {
      throw new UnauthorizedException({
        code: "OPERATOR_REFRESH_UNKNOWN",
        message: "Operator session not recognised",
      });
    }

    if (session.userId !== payload.sub) {
      await this.revokeAllForUser(session.userId, "admin_revoked");
      throw new UnauthorizedException({
        code: "OPERATOR_REFRESH_INVALID",
        message: "Operator session is invalid",
      });
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: "OPERATOR_REFRESH_EXPIRED",
        message: "Operator session expired",
      });
    }

    if (session.revokedAt) {
      this.logger.warn(
        `[operator-auth] refresh re-use detected for user=${session.userId} jti=${payload.jti}`,
      );
      await this.revokeAllForUser(session.userId, "reuse_detected");
      throw new UnauthorizedException({
        code: "OPERATOR_REFRESH_REUSED",
        message: "Operator session was revoked. Sign in again.",
      });
    }

    const user = await this.usersService.findAuthUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        code: "OPERATOR_NOT_FOUND",
        message: "Operator no longer exists",
      });
    }

    if (!user.platformRole) {
      await this.revokeAllForUser(user.id, "role_revoked");
      throw new UnauthorizedException({
        code: "OPERATOR_ROLE_REVOKED",
        message: "Operator role has been revoked",
      });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException({
        code: "ACCOUNT_LOCKED",
        message: "Operator account is locked",
      });
    }

    const newJti = randomUUID();
    const newExpiresAt = new Date(
      Date.now() + OPERATOR_REFRESH_TOKEN_TTL_SECONDS * 1000,
    );

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.operatorRefreshSession.create({
        data: {
          jti: newJti,
          userId: user.id,
          userAgentHash: this.hash(ctx.userAgent ?? null),
          ipHash: this.hash(ctx.ip ?? null),
          expiresAt: newExpiresAt,
        },
      });
      await tx.operatorRefreshSession.update({
        where: { id: session.id },
        data: {
          revokedAt: new Date(),
          revokedReason: "rotated",
          replacedBySessionId: created.id,
        },
      });
    });

    const accessToken = await this.signAccessToken({
      id: user.id,
      email: user.email,
      platformRole: user.platformRole,
    });
    const refreshToken = await this.signRefreshToken(user.id, newJti);
    const permissions = this.permissionsForRole(user.platformRole);

    return {
      auth: {
        accessToken,
        expiresIn: OPERATOR_ACCESS_TOKEN_TTL_SECONDS,
        permissions,
        user: {
          id: user.id,
          email: user.email,
          platformRole: user.platformRole,
        },
      },
      refreshToken,
    };
  }

  /**
   * Revoke a single refresh session by its raw token (called on logout).
   */
  async revokeRefreshToken(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    let payload: OperatorJwtRefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<OperatorJwtRefreshPayload>(
        rawRefreshToken,
        {
          audience: OPERATOR_JWT_AUDIENCE,
          issuer: OPERATOR_JWT_ISSUER,
        },
      );
    } catch {
      return;
    }
    if (payload.type !== "operator-refresh" || !payload.jti) return;
    await this.prisma.operatorRefreshSession.updateMany({
      where: { jti: payload.jti, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "logout" },
    });
  }

  async getSession(operatorId: string): Promise<OperatorSessionResponse> {
    const user = await this.usersService.findAuthUserById(operatorId);
    if (!user || !user.platformRole) {
      throw new UnauthorizedException({
        code: "OPERATOR_ROLE_REVOKED",
        message: "Operator role is no longer valid",
      });
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        platformRole: user.platformRole,
      },
      permissions: this.permissionsForRole(user.platformRole),
    };
  }

  async revokeAllForUser(userId: string, reason: string): Promise<void> {
    await this.prisma.operatorRefreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  getRefreshCookieOptions(): {
    httpOnly: true;
    secure: boolean;
    sameSite: "strict";
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "strict",
      path: OPERATOR_REFRESH_COOKIE_PATH,
      maxAge: OPERATOR_REFRESH_TOKEN_TTL_SECONDS * 1000,
    };
  }

  getClearRefreshCookieOptions(): {
    httpOnly: true;
    secure: boolean;
    sameSite: "strict";
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "strict",
      path: OPERATOR_REFRESH_COOKIE_PATH,
      maxAge: 0,
    };
  }

  permissionsForRole(role: PlatformRole): OperatorPermissionKey[] {
    return getPermissionsForRole(role);
  }

  private async signAccessToken(operator: ValidatedOperator): Promise<string> {
    const payload: OperatorJwtAccessPayload = {
      sub: operator.id,
      email: operator.email,
      platformRole: operator.platformRole,
      type: "operator-access",
    };
    return this.jwtService.signAsync(payload, {
      audience: OPERATOR_JWT_AUDIENCE,
      issuer: OPERATOR_JWT_ISSUER,
      expiresIn: OPERATOR_ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  private async signRefreshToken(
    operatorId: string,
    jti: string,
  ): Promise<string> {
    const payload: OperatorJwtRefreshPayload = {
      sub: operatorId,
      jti,
      type: "operator-refresh",
    };
    return this.jwtService.signAsync(payload, {
      audience: OPERATOR_JWT_AUDIENCE,
      issuer: OPERATOR_JWT_ISSUER,
      expiresIn: OPERATOR_REFRESH_TOKEN_TTL_SECONDS,
      jwtid: jti,
    });
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException({
      code: "OPERATOR_INVALID_CREDENTIALS",
      message: "Invalid operator credentials",
    });
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split("@");
    if (!domain) return "***";
    const visible = local.slice(0, 1);
    return `${visible}***@${domain}`;
  }

  private hash(value: string | null): string | null {
    if (!value) return null;
    return createHash("sha256").update(value).digest("hex").slice(0, 32);
  }
}
