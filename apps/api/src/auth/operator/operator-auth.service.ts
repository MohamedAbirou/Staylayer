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
  OPERATOR_MFA_CHALLENGE_TTL_SECONDS,
  OPERATOR_REFRESH_COOKIE_PATH,
  OPERATOR_REFRESH_TOKEN_TTL_SECONDS,
  OperatorAuthResponse,
  OperatorJwtAccessPayload,
  OperatorJwtRefreshPayload,
  OperatorMfaChallenge,
  OperatorMfaChallengePayload,
  OperatorSessionResponse,
} from "./operator-auth.types";
import {
  buildOtpauthUri,
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotpCode,
} from "./mfa/operator-mfa.util";

interface ValidatedOperator {
  id: string;
  email: string;
  platformRole: PlatformRole;
  mfaEnrolled?: boolean;
}

export interface OperatorSessionContext {
  userAgent?: string | null;
  ip?: string | null;
}

export interface OperatorEnrollmentInitiation {
  secret: string;
  otpauthUri: string;
}

export interface OperatorEnrollmentConfirmation {
  enrolledAt: string;
  recoveryCodes: string[];
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

    if (user.operatorLockedUntil && user.operatorLockedUntil > new Date()) {
      throw new ForbiddenException({
        code: "ACCOUNT_LOCKED",
        message: `Account locked. Try again after ${user.operatorLockedUntil.toISOString()}`,
      });
    }

    const passwordValid = await this.usersService.verifyPassword(
      user.passwordHash,
      password,
    );

    if (!passwordValid) {
      await this.usersService.incrementOperatorFailedAttempts(user.id);
      this.logger.warn(
        `[operator-auth] failed password for ${this.maskEmail(user.email)}`,
      );
      throw this.invalidCredentials();
    }

    if (!user.platformRole) {
      await this.usersService.resetOperatorFailedAttempts(user.id);
      this.logger.warn(
        `[operator-auth] customer-only user attempted operator login: ${this.maskEmail(user.email)}`,
      );
      throw this.invalidCredentials();
    }

    await this.usersService.resetOperatorFailedAttempts(user.id);

    return {
      id: user.id,
      email: user.email,
      platformRole: user.platformRole,
      mfaEnrolled: !!user.operatorMfaEnrolledAt && !!user.operatorMfaSecret,
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

    if (user.operatorLockedUntil && user.operatorLockedUntil > new Date()) {
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

  private async signAccessToken(operator: {
    id: string;
    email: string;
    platformRole: PlatformRole;
  }): Promise<string> {
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
    const payload: Omit<OperatorJwtRefreshPayload, "jti"> = {
      sub: operatorId,
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

  // ── Phase 12 — MFA ────────────────────────────────────────────────

  /**
   * Issue a short-lived challenge token after password validation when the
   * operator has TOTP enrolled. The caller must complete `mfaVerify` with
   * this token + a valid TOTP (or recovery) code to receive their access
   * + refresh tokens.
   */
  async issueMfaChallenge(operatorId: string): Promise<OperatorMfaChallenge> {
    const payload: OperatorMfaChallengePayload = {
      sub: operatorId,
      type: "operator-mfa-challenge",
    };
    const challengeToken = await this.jwtService.signAsync(payload, {
      audience: OPERATOR_JWT_AUDIENCE,
      issuer: OPERATOR_JWT_ISSUER,
      expiresIn: OPERATOR_MFA_CHALLENGE_TTL_SECONDS,
    });
    return {
      mfaRequired: true,
      challengeToken,
      expiresIn: OPERATOR_MFA_CHALLENGE_TTL_SECONDS,
    };
  }

  /**
   * Verify a TOTP / recovery code against a challenge token. On success
   * issues the operator's access + refresh tokens exactly as
   * {@link issueLoginTokens}.
   */
  async verifyMfaChallenge(
    challengeToken: string,
    code: string,
    ctx: OperatorSessionContext = {},
  ): Promise<{ auth: OperatorAuthResponse; refreshToken: string }> {
    let payload: OperatorMfaChallengePayload;
    try {
      payload = await this.jwtService.verifyAsync<OperatorMfaChallengePayload>(
        challengeToken,
        {
          audience: OPERATOR_JWT_AUDIENCE,
          issuer: OPERATOR_JWT_ISSUER,
        },
      );
    } catch {
      throw new UnauthorizedException({
        code: "OPERATOR_MFA_CHALLENGE_INVALID",
        message: "MFA challenge expired or invalid",
      });
    }
    if (payload.type !== "operator-mfa-challenge") {
      throw new UnauthorizedException({
        code: "OPERATOR_MFA_CHALLENGE_INVALID",
        message: "MFA challenge invalid",
      });
    }

    const user = await this.usersService.findAuthUserById(payload.sub);
    if (!user || !user.platformRole) {
      throw new UnauthorizedException({
        code: "OPERATOR_INVALID_CREDENTIALS",
        message: "Invalid operator credentials",
      });
    }
    if (user.operatorLockedUntil && user.operatorLockedUntil > new Date()) {
      throw new ForbiddenException({
        code: "ACCOUNT_LOCKED",
        message: "Operator account is locked",
      });
    }
    if (!user.operatorMfaSecret || !user.operatorMfaEnrolledAt) {
      // Should never happen: a challenge is only issued when enrolled.
      // Treat as soft-failure — emit nothing, force re-login.
      throw new UnauthorizedException({
        code: "OPERATOR_MFA_NOT_ENROLLED",
        message: "MFA is not enrolled for this operator",
      });
    }

    const submitted = (code ?? "").trim().toUpperCase();
    let accepted = false;

    if (/^\d{6}$/.test(submitted)) {
      const secret = decryptMfaSecret(
        user.operatorMfaSecret,
        this.mfaEncryptionKey(),
      );
      accepted = verifyTotpCode(secret, submitted);
    } else {
      // Recovery code path. Constant-time hash + delete-on-use.
      const codeHash = hashRecoveryCode(submitted);
      const row = await this.prisma.operatorMfaRecoveryCode.findUnique({
        where: { codeHash },
      });
      if (row && !row.consumedAt && row.userId === user.id) {
        const result = await this.prisma.operatorMfaRecoveryCode.updateMany({
          where: { id: row.id, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        accepted = result.count === 1;
      }
    }

    if (!accepted) {
      await this.usersService.incrementOperatorFailedAttempts(user.id);
      this.logger.warn(
        `[operator-auth] mfa failure for ${this.maskEmail(user.email)}`,
      );
      throw new UnauthorizedException({
        code: "OPERATOR_MFA_CODE_INVALID",
        message: "MFA code invalid",
      });
    }

    await this.usersService.resetOperatorFailedAttempts(user.id);
    this.logger.log(
      `[operator-auth] mfa success ${this.maskEmail(user.email)} role=${user.platformRole}`,
    );

    return this.issueLoginTokens(
      {
        id: user.id,
        email: user.email,
        platformRole: user.platformRole,
        mfaEnrolled: true,
      },
      ctx,
    );
  }

  /**
   * Begin TOTP enrollment for the currently authenticated operator. The
   * operator stays enrolled in their previous state until they submit a
   * valid code via {@link confirmMfaEnrollment}. The returned secret is
   * shown to the operator once.
   */
  async initiateMfaEnrollment(
    operatorId: string,
  ): Promise<OperatorEnrollmentInitiation> {
    const user = await this.usersService.findAuthUserById(operatorId);
    if (!user || !user.platformRole) {
      throw new UnauthorizedException({
        code: "OPERATOR_NOT_FOUND",
        message: "Operator not found",
      });
    }
    const secret = generateTotpSecret();
    const sealed = encryptMfaSecret(secret, this.mfaEncryptionKey());
    // Stash the pending secret without setting `operatorMfaEnrolledAt` —
    // the enrollment is only "active" once a code is confirmed.
    await this.prisma.user.update({
      where: { id: operatorId },
      data: {
        operatorMfaSecret: sealed,
        operatorMfaEnrolledAt: null,
      },
    });
    return {
      secret,
      otpauthUri: buildOtpauthUri({
        secret,
        label: user.email,
        issuer:
          this.configService.get<string>("OPERATOR_MFA_ISSUER") ??
          "Staylayer Operator",
      }),
    };
  }

  /**
   * Confirm enrollment by submitting a valid TOTP code for the pending
   * secret. Issues a fresh set of recovery codes (returned once).
   */
  async confirmMfaEnrollment(
    operatorId: string,
    code: string,
  ): Promise<OperatorEnrollmentConfirmation> {
    const user = await this.usersService.findAuthUserById(operatorId);
    if (!user || !user.platformRole || !user.operatorMfaSecret) {
      throw new ForbiddenException({
        code: "OPERATOR_MFA_NOT_INITIATED",
        message: "Begin MFA enrollment first",
      });
    }
    const secret = decryptMfaSecret(
      user.operatorMfaSecret,
      this.mfaEncryptionKey(),
    );
    if (!verifyTotpCode(secret, (code ?? "").trim())) {
      throw new UnauthorizedException({
        code: "OPERATOR_MFA_CODE_INVALID",
        message: "MFA code invalid",
      });
    }
    const codes = generateRecoveryCodes();
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: operatorId },
        data: { operatorMfaEnrolledAt: now },
      });
      await tx.operatorMfaRecoveryCode.deleteMany({
        where: { userId: operatorId },
      });
      await tx.operatorMfaRecoveryCode.createMany({
        data: codes.map((c) => ({
          userId: operatorId,
          codeHash: hashRecoveryCode(c),
        })),
      });
    });
    this.logger.log(
      `[operator-auth] mfa enrolled ${this.maskEmail(user.email)}`,
    );
    return { enrolledAt: now.toISOString(), recoveryCodes: codes };
  }

  /**
   * Regenerate the recovery codes for an already-enrolled operator. The
   * caller must submit a fresh TOTP code from their authenticator app —
   * this proves the second factor is still in their possession before we
   * invalidate the old set. The new plaintext codes are returned once
   * and only their scrypt hashes are persisted (same model as the
   * initial enrollment).
   *
   * On success the previous recovery-code rows are deleted and the
   * 10 new ones replace them atomically. Refresh sessions are
   * deliberately left alone — this is a self-service "rotate", not a
   * security-incident response. (The Platform-Owner `resetMfaForUser`
   * path remains for that.)
   */
  async regenerateRecoveryCodes(
    operatorId: string,
    code: string,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = await this.usersService.findAuthUserById(operatorId);
    if (
      !user ||
      !user.platformRole ||
      !user.operatorMfaSecret ||
      !user.operatorMfaEnrolledAt
    ) {
      throw new ForbiddenException({
        code: "OPERATOR_MFA_NOT_ENROLLED",
        message: "MFA is not enrolled for this account",
      });
    }
    const secret = decryptMfaSecret(
      user.operatorMfaSecret,
      this.mfaEncryptionKey(),
    );
    if (!verifyTotpCode(secret, (code ?? "").trim())) {
      throw new UnauthorizedException({
        code: "OPERATOR_MFA_CODE_INVALID",
        message: "MFA code invalid",
      });
    }
    const codes = generateRecoveryCodes();
    await this.prisma.$transaction(async (tx) => {
      await tx.operatorMfaRecoveryCode.deleteMany({
        where: { userId: operatorId },
      });
      await tx.operatorMfaRecoveryCode.createMany({
        data: codes.map((c) => ({
          userId: operatorId,
          codeHash: hashRecoveryCode(c),
        })),
      });
    });
    this.logger.log(
      `[operator-auth] mfa recovery codes regenerated ${this.maskEmail(user.email)}`,
    );
    return { recoveryCodes: codes };
  }

  /**
   * Reset MFA for an operator (Platform Owner only — gated at the
   * controller level). Clears the secret + recovery codes and revokes
   * all refresh sessions so the operator must re-authenticate and
   * re-enroll on next sign-in.
   */
  async resetMfaForUser(userId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { operatorMfaSecret: null, operatorMfaEnrolledAt: null },
      });
      await tx.operatorMfaRecoveryCode.deleteMany({ where: { userId } });
      await tx.operatorRefreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "mfa_reset" },
      });
    });
  }

  private mfaEncryptionKey(): string | undefined {
    return (
      this.configService.get<string>("OPERATOR_MFA_ENCRYPTION_KEY") ??
      this.configService.get<string>("JWT_SECRET")
    );
  }
}
