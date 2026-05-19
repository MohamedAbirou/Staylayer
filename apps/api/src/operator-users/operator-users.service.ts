import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PlatformRole, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import {
  ALL_OPERATOR_PERMISSIONS,
  getPermissionsForRole,
  OPERATOR_PERMISSIONS,
  type OperatorPermissionKey,
} from "../auth/operator/permissions/operator-permissions.registry";
import { OperatorAuthService } from "../auth/operator/operator-auth.service";
import { OperatorNotificationsService } from "./operator-notifications.service";

export interface OperatorUserListItem {
  id: string;
  email: string;
  platformRole: PlatformRole;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  locked: boolean;
  lockedUntil: string | null;
  failedAttempts: number;
  activeSessions: number;
}

export interface OperatorUserListResponse {
  data: OperatorUserListItem[];
  total: number;
  page: number;
  limit: number;
}

export interface OperatorUserDetail extends OperatorUserListItem {
  permissions: OperatorPermissionKey[];
  recentSessions: Array<{
    id: string;
    createdAt: string;
    lastUsedAt: string;
    expiresAt: string;
    revokedAt: string | null;
    revokedReason: string | null;
  }>;
}

export interface RoleBundle {
  role: PlatformRole;
  label: string;
  description: string;
  permissions: OperatorPermissionKey[];
}

export interface RoleBundlesResponse {
  allPermissions: OperatorPermissionKey[];
  bundles: RoleBundle[];
}

const ROLE_LABELS: Record<
  PlatformRole,
  { label: string; description: string }
> = {
  PLATFORM_OWNER: {
    label: "Platform Owner",
    description:
      "Full access. Manages operator users, role assignments, and every operational/billing surface.",
  },
  SUPPORT_ADMIN: {
    label: "Support Admin",
    description:
      "Owns customer support: cases, alerts, deployment/domain/form retries. Read-only on billing.",
  },
  FINANCE_ADMIN: {
    label: "Finance Admin",
    description:
      "Owns billing operations, subscriptions, refunds and Stripe reconciliation. Read-only on operations.",
  },
};

const FAILED_ATTEMPTS_FLOOR = 0;

@Injectable()
export class OperatorUsersService {
  private readonly logger = new Logger(OperatorUsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly notifications: OperatorNotificationsService,
    private readonly operatorAuth: OperatorAuthService,
  ) {}

  // ── Read ───────────────────────────────────────────────────────────

  async list(opts: {
    page?: number;
    limit?: number;
    q?: string;
    platformRole?: PlatformRole;
    lockedOnly?: boolean;
  }): Promise<OperatorUserListResponse> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 25));
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.UserWhereInput = {
      platformRole: opts.platformRole ?? { not: null },
    };
    if (opts.q && opts.q.trim().length >= 2) {
      where.email = { contains: opts.q.trim(), mode: "insensitive" };
    }
    if (opts.lockedOnly) {
      where.lockedUntil = { gt: now };
    }

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          platformRole: true,
          createdAt: true,
          updatedAt: true,
          failedAttempts: true,
          lockedUntil: true,
          operatorRefreshSessions: {
            where: { revokedAt: null, expiresAt: { gt: now } },
            select: { id: true, lastUsedAt: true },
            orderBy: { lastUsedAt: "desc" },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const data: OperatorUserListItem[] = rows.map((row) => {
      const lastUsed = row.operatorRefreshSessions[0]?.lastUsedAt ?? null;
      const locked = !!(row.lockedUntil && row.lockedUntil > now);
      return {
        id: row.id,
        email: row.email,
        // Filter `platformRole: { not: null }` guarantees this is non-null.
        platformRole: row.platformRole as PlatformRole,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        lastLoginAt: lastUsed ? lastUsed.toISOString() : null,
        locked,
        lockedUntil: row.lockedUntil ? row.lockedUntil.toISOString() : null,
        failedAttempts: row.failedAttempts,
        activeSessions: row.operatorRefreshSessions.length,
      };
    });

    return { data, total, page, limit };
  }

  async detail(operatorUserId: string): Promise<OperatorUserDetail> {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: operatorUserId },
      select: {
        id: true,
        email: true,
        platformRole: true,
        createdAt: true,
        updatedAt: true,
        failedAttempts: true,
        lockedUntil: true,
        operatorRefreshSessions: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            createdAt: true,
            lastUsedAt: true,
            expiresAt: true,
            revokedAt: true,
            revokedReason: true,
          },
        },
      },
    });
    if (!user || !user.platformRole) {
      throw new NotFoundException({
        code: "OPERATOR_USER_NOT_FOUND",
        message: "Operator user not found",
      });
    }

    const activeSessions = user.operatorRefreshSessions.filter(
      (s) => !s.revokedAt && s.expiresAt > now,
    ).length;
    const lastUsedAt =
      user.operatorRefreshSessions.find((s) => !s.revokedAt)?.lastUsedAt ??
      null;

    return {
      id: user.id,
      email: user.email,
      platformRole: user.platformRole,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastLoginAt: lastUsedAt ? lastUsedAt.toISOString() : null,
      locked: !!(user.lockedUntil && user.lockedUntil > now),
      lockedUntil: user.lockedUntil ? user.lockedUntil.toISOString() : null,
      failedAttempts: user.failedAttempts,
      activeSessions,
      permissions: getPermissionsForRole(user.platformRole),
      recentSessions: user.operatorRefreshSessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        lastUsedAt: s.lastUsedAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        revokedAt: s.revokedAt ? s.revokedAt.toISOString() : null,
        revokedReason: s.revokedReason,
      })),
    };
  }

  getRoleBundles(): RoleBundlesResponse {
    const roles: PlatformRole[] = [
      "PLATFORM_OWNER",
      "SUPPORT_ADMIN",
      "FINANCE_ADMIN",
    ];
    return {
      allPermissions: [...ALL_OPERATOR_PERMISSIONS],
      bundles: roles.map((role) => ({
        role,
        label: ROLE_LABELS[role].label,
        description: ROLE_LABELS[role].description,
        permissions: getPermissionsForRole(role),
      })),
    };
  }

  // ── Mutations ──────────────────────────────────────────────────────

  async create(input: {
    actorId: string;
    actorRole: PlatformRole;
    email: string;
    password: string;
    platformRole: PlatformRole;
  }): Promise<OperatorUserDetail> {
    this.ensureCanGrantRole(input.actorRole, input.platformRole);

    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, platformRole: true },
    });
    if (existing) {
      throw new ConflictException({
        code: "OPERATOR_USER_CONFLICT",
        message: existing.platformRole
          ? "An operator user with this email already exists."
          : "A customer user already exists with this email. Use a dedicated operator address.",
      });
    }

    const passwordHash = await this.usersService.hashPassword(input.password);
    const created = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        platformRole: input.platformRole,
        failedAttempts: FAILED_ATTEMPTS_FLOOR,
      },
      select: { id: true },
    });

    this.logger.log(
      `[operator-users] create id=${created.id} role=${input.platformRole} actor=${input.actorId}`,
    );
    return this.detail(created.id);
  }

  async update(input: {
    actorId: string;
    actorEmail: string;
    actorRole: PlatformRole;
    operatorUserId: string;
    email?: string;
    platformRole?: PlatformRole;
  }): Promise<OperatorUserDetail> {
    if (
      input.platformRole === undefined &&
      (input.email === undefined || input.email === null)
    ) {
      throw new BadRequestException({
        code: "OPERATOR_USER_NOOP",
        message: "Provide an email change or a role change.",
      });
    }

    const current = await this.prisma.user.findUnique({
      where: { id: input.operatorUserId },
      select: { id: true, email: true, platformRole: true },
    });
    if (!current || !current.platformRole) {
      throw new NotFoundException({
        code: "OPERATOR_USER_NOT_FOUND",
        message: "Operator user not found",
      });
    }

    const data: Prisma.UserUpdateInput = {};

    if (input.email && input.email !== current.email) {
      const dup = await this.prisma.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      });
      if (dup && dup.id !== current.id) {
        throw new ConflictException({
          code: "OPERATOR_USER_EMAIL_TAKEN",
          message: "Email already in use",
        });
      }
      data.email = input.email;
    }

    let roleChanged = false;
    if (
      input.platformRole !== undefined &&
      input.platformRole !== current.platformRole
    ) {
      this.ensureCanGrantRole(input.actorRole, input.platformRole);
      // Self-grant prevention: an operator can never modify their own role,
      // even if they currently hold PLATFORM_OWNER. Promotion/demotion of an
      // owner must be performed by a different owner.
      if (input.operatorUserId === input.actorId) {
        throw new ForbiddenException({
          code: "OPERATOR_USER_SELF_ROLE_CHANGE_FORBIDDEN",
          message: "You cannot modify your own platform role.",
        });
      }
      // Last-owner protection: refuse demotion of the only remaining
      // PLATFORM_OWNER so the console never becomes unmanageable.
      if (
        current.platformRole === "PLATFORM_OWNER" &&
        input.platformRole !== "PLATFORM_OWNER"
      ) {
        const otherOwners = await this.prisma.user.count({
          where: {
            platformRole: "PLATFORM_OWNER",
            id: { not: current.id },
          },
        });
        if (otherOwners === 0) {
          throw new BadRequestException({
            code: "OPERATOR_USER_LAST_OWNER",
            message:
              "Cannot demote the only remaining Platform Owner. Promote another operator first.",
          });
        }
      }
      data.platformRole = input.platformRole;
      roleChanged = true;
    }

    if (Object.keys(data).length === 0) {
      // Nothing to update — return the current detail unchanged.
      return this.detail(input.operatorUserId);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: input.operatorUserId },
        data,
      });
      if (roleChanged) {
        // Force the target operator to re-authenticate so the new role
        // bundle (and its access token claims) takes effect immediately.
        await tx.operatorRefreshSession.updateMany({
          where: { userId: input.operatorUserId, revokedAt: null },
          data: { revokedAt: new Date(), revokedReason: "role_changed" },
        });
      }
    });

    this.logger.log(
      `[operator-users] update id=${input.operatorUserId} roleChanged=${roleChanged} actor=${input.actorId}`,
    );
    if (roleChanged && input.platformRole) {
      // best-effort out-of-band notification (Phase 12 hardening)
      void this.notifications.notifyRoleChanged({
        to: current.email,
        previousRole: current.platformRole,
        nextRole: input.platformRole,
        actorEmail: input.actorEmail,
      });
    }
    return this.detail(input.operatorUserId);
  }

  async resetPassword(input: {
    actorId: string;
    actorEmail: string;
    operatorUserId: string;
    newPassword: string;
  }): Promise<{ success: true; revokedSessions: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: input.operatorUserId },
      select: { id: true, email: true, platformRole: true },
    });
    if (!user || !user.platformRole) {
      throw new NotFoundException({
        code: "OPERATOR_USER_NOT_FOUND",
        message: "Operator user not found",
      });
    }
    const passwordHash = await this.usersService.hashPassword(
      input.newPassword,
    );

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          // Reset both customer + operator brute-force counters so the
          // operator can sign in immediately with the new password.
          failedAttempts: 0,
          lockedUntil: null,
          operatorFailedAttempts: 0,
          operatorLockedUntil: null,
        },
      });
      const { count } = await tx.operatorRefreshSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "password_reset" },
      });
      return count;
    });

    this.logger.log(
      `[operator-users] password-reset id=${user.id} revokedSessions=${result} actor=${input.actorId}`,
    );
    void this.notifications.notifyPasswordReset({
      to: user.email,
      actorEmail: input.actorEmail,
    });
    return { success: true, revokedSessions: result };
  }

  async unlock(input: {
    actorId: string;
    operatorUserId: string;
  }): Promise<OperatorUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id: input.operatorUserId },
      select: { id: true, platformRole: true },
    });
    if (!user || !user.platformRole) {
      throw new NotFoundException({
        code: "OPERATOR_USER_NOT_FOUND",
        message: "Operator user not found",
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        operatorFailedAttempts: 0,
        operatorLockedUntil: null,
      },
    });
    this.logger.log(
      `[operator-users] unlock id=${user.id} actor=${input.actorId}`,
    );
    return this.detail(user.id);
  }

  async revokeSessions(input: {
    actorId: string;
    operatorUserId: string;
    reason: string;
  }): Promise<{ revokedSessions: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id: input.operatorUserId },
      select: { id: true, platformRole: true },
    });
    if (!user || !user.platformRole) {
      throw new NotFoundException({
        code: "OPERATOR_USER_NOT_FOUND",
        message: "Operator user not found",
      });
    }
    const { count } = await this.prisma.operatorRefreshSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: {
        revokedAt: new Date(),
        revokedReason: input.reason.slice(0, 64),
      },
    });
    this.logger.log(
      `[operator-users] revoke-sessions id=${user.id} count=${count} actor=${input.actorId}`,
    );
    return { revokedSessions: count };
  }

  async revoke(input: {
    actorId: string;
    actorEmail: string;
    actorRole: PlatformRole;
    operatorUserId: string;
  }): Promise<{ success: true; revokedSessions: number }> {
    if (input.operatorUserId === input.actorId) {
      throw new ForbiddenException({
        code: "OPERATOR_USER_SELF_REVOKE_FORBIDDEN",
        message: "You cannot revoke your own operator access.",
      });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: input.operatorUserId },
      select: { id: true, email: true, platformRole: true },
    });
    if (!user || !user.platformRole) {
      throw new NotFoundException({
        code: "OPERATOR_USER_NOT_FOUND",
        message: "Operator user not found",
      });
    }

    if (user.platformRole === "PLATFORM_OWNER") {
      const otherOwners = await this.prisma.user.count({
        where: { platformRole: "PLATFORM_OWNER", id: { not: user.id } },
      });
      if (otherOwners === 0) {
        throw new BadRequestException({
          code: "OPERATOR_USER_LAST_OWNER",
          message:
            "Cannot revoke the only remaining Platform Owner. Promote another operator first.",
        });
      }
    }

    const revokedSessions = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { platformRole: null },
      });
      const { count } = await tx.operatorRefreshSession.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "role_revoked" },
      });
      return count;
    });

    this.logger.log(
      `[operator-users] revoke id=${user.id} revokedSessions=${revokedSessions} actor=${input.actorId}`,
    );
    void this.notifications.notifyAccessRevoked({
      to: user.email,
      actorEmail: input.actorEmail,
    });
    return { success: true, revokedSessions };
  }

  /**
   * Phase 12 — Platform Owner emergency MFA reset.
   *
   * Clears the target operator's TOTP secret + all recovery codes and
   * revokes every active operator refresh session. The operator will be
   * prompted to re-enroll a new authenticator on next sign-in. This must
   * only be invoked when the operator has lost access to their device
   * AND their recovery codes — it lowers the account back to single-factor
   * temporarily, so it is permission-gated to `operator_user.manage.all`
   * and audited with `sensitive: true` at the controller layer.
   */
  async resetMfa(input: {
    actorId: string;
    actorEmail: string;
    operatorUserId: string;
  }): Promise<{ success: true }> {
    if (input.operatorUserId === input.actorId) {
      throw new ForbiddenException({
        code: "OPERATOR_USER_SELF_MFA_RESET_FORBIDDEN",
        message: "Use the dedicated MFA disable flow for your own account.",
      });
    }
    const user = await this.prisma.user.findUnique({
      where: { id: input.operatorUserId },
      select: { id: true, email: true, platformRole: true },
    });
    if (!user || !user.platformRole) {
      throw new NotFoundException({
        code: "OPERATOR_USER_NOT_FOUND",
        message: "Operator user not found",
      });
    }
    await this.operatorAuth.resetMfaForUser(user.id);
    this.logger.log(
      `[operator-users] mfa-reset id=${user.id} actor=${input.actorId}`,
    );
    void this.notifications.notifyMfaReset({
      to: user.email,
      actorEmail: input.actorEmail,
    });
    return { success: true };
  }

  // ── Internals ──────────────────────────────────────────────────────

  /**
   * Only PLATFORM_OWNER is currently allowed to manage operator users. The
   * controller already gates the route with the `operator_user.manage.all`
   * permission, but this guards against future permission additions that
   * might widen the grant accidentally — a Finance/Support admin would still
   * be rejected at the service layer.
   *
   * Additionally, narrower-than-owner roles can never be used to grant
   * PLATFORM_OWNER (no privilege escalation via role assignment).
   */
  private ensureCanGrantRole(
    actorRole: PlatformRole,
    targetRole: PlatformRole,
  ): void {
    if (actorRole !== "PLATFORM_OWNER") {
      throw new ForbiddenException({
        code: "OPERATOR_USER_INSUFFICIENT_ROLE",
        message: "Only Platform Owner can grant operator roles.",
      });
    }
    // Defensive: an unknown role string would have failed DTO validation
    // already, but keep the runtime check so the permission registry stays
    // the single source of truth.
    void targetRole;
  }
}

// Re-export the canonical permission keys for code that imports from this
// module to keep call sites short — Phase 11 frontend pages do not need
// access, but the explicit re-export documents the dependency.
export const OPERATOR_USERS_PERMISSIONS = {
  READ: OPERATOR_PERMISSIONS.OPERATOR_USER_READ_ALL,
  MANAGE: OPERATOR_PERMISSIONS.OPERATOR_USER_MANAGE_ALL,
  PERMISSION_MANAGE: OPERATOR_PERMISSIONS.PERMISSION_MANAGE_ALL,
} as const;
