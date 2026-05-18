import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  NotificationCategory,
  PlatformRole,
  SiteStatus,
  TenantMembershipRole,
  TenantStatus,
} from "@prisma/client";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";

export interface ProfileMembershipSummary {
  membershipId: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantStatus: TenantStatus;
  role: TenantMembershipRole;
  isDefault: boolean;
  joinedAt: string;
  isFinalOwner: boolean;
  memberCount: number;
  ownerCount: number;
  activeSiteCount: number;
}

export interface ProfilePendingInvitationSummary {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: TenantMembershipRole;
  createdAt: string;
  expiresAt: string;
  invitedByEmail: string | null;
}

export interface ProfileOverview {
  id: string;
  email: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  platformRole: PlatformRole | null;
  createdAt: string;
  memberships: ProfileMembershipSummary[];
  pendingInvitations: ProfilePendingInvitationSummary[];
}

export interface DeletionImpactWorkspaceEntry {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: TenantMembershipRole;
  isFinalOwner: boolean;
  ownerCount: number;
  memberCount: number;
}

export interface AccountDeletionImpact {
  email: string;
  blocked: boolean;
  blockingReasons: string[];
  workspaces: DeletionImpactWorkspaceEntry[];
  finalOwnerWorkspaces: DeletionImpactWorkspaceEntry[];
  pendingSentInvitations: number;
  assignedSeoAuditTasks: number;
  hasPlatformRole: boolean;
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getOverview(userId: string): Promise<ProfileOverview> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        platformRole: true,
        createdAt: true,
        memberships: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          select: {
            id: true,
            tenantId: true,
            role: true,
            isDefault: true,
            createdAt: true,
            tenant: {
              select: {
                id: true,
                slug: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const tenantIds = user.memberships.map((m) => m.tenantId);
    const stats = await this.loadTenantStats(tenantIds);

    const memberships: ProfileMembershipSummary[] = user.memberships.map(
      (m) => {
        const stat = stats[m.tenantId] ?? {
          ownerCount: 0,
          memberCount: 0,
          activeSiteCount: 0,
        };
        return {
          membershipId: m.id,
          tenantId: m.tenantId,
          tenantSlug: m.tenant.slug,
          tenantName: m.tenant.name,
          tenantStatus: m.tenant.status,
          role: m.role,
          isDefault: m.isDefault,
          joinedAt: m.createdAt.toISOString(),
          isFinalOwner:
            m.role === TenantMembershipRole.OWNER && stat.ownerCount <= 1,
          memberCount: stat.memberCount,
          ownerCount: stat.ownerCount,
          activeSiteCount: stat.activeSiteCount,
        };
      },
    );

    const pendingInvitations = await this.listPendingInvitationsForEmail(
      user.email,
    );

    return {
      id: user.id,
      email: user.email,
      emailVerified: Boolean(user.emailVerifiedAt),
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      platformRole: user.platformRole,
      createdAt: user.createdAt.toISOString(),
      memberships,
      pendingInvitations,
    };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ changedAt: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true },
    });

    if (!user) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException({
        code: "SAME_PASSWORD",
        message: "New password must be different from the current one.",
      });
    }

    const valid = await this.usersService.verifyPassword(
      user.passwordHash,
      currentPassword,
    );

    if (!valid) {
      throw new UnauthorizedException({
        code: "INVALID_PASSWORD",
        message: "Current password is incorrect.",
      });
    }

    const passwordHash = await this.usersService.hashPassword(newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          failedAttempts: 0,
          lockedUntil: null,
        },
      }),
      // Invalidate any outstanding password reset tokens — the password has
      // now been rotated explicitly by the authenticated user.
      this.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
    ]);

    // Notify the user across every workspace they belong to. We intentionally
    // do not broadcast a password change to other members.
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { userId: user.id },
      select: { tenantId: true },
    });

    await Promise.all(
      memberships.map((m) =>
        this.notificationsService.create({
          tenantId: m.tenantId,
          userId: user.id,
          category: NotificationCategory.SYSTEM,
          title: "Password updated",
          body: "Your StayLayer account password was changed. If this wasn't you, reset your password immediately.",
          actionUrl: "/profile",
        }),
      ),
    );

    return { changedAt: new Date().toISOString() };
  }

  async setDefaultMembership(
    userId: string,
    tenantId: string,
  ): Promise<ProfileMembershipSummary> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId, tenantId },
      select: { id: true },
    });

    if (!membership) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "You are not a member of this workspace.",
      });
    }

    await this.prisma.$transaction([
      this.prisma.tenantMembership.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.tenantMembership.update({
        where: { id: membership.id },
        data: { isDefault: true },
      }),
    ]);

    const overview = await this.getOverview(userId);
    const updated = overview.memberships.find((m) => m.tenantId === tenantId);

    if (!updated) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Membership not found after update.",
      });
    }

    return updated;
  }

  async leaveWorkspace(
    userId: string,
    tenantId: string,
    confirmTenantSlug: string,
    auditWriter: (params: {
      tenantId: string;
      actorUserId: string;
      action: string;
      targetType: string;
      targetId: string;
      metadata: Record<string, unknown>;
    }) => Promise<void>,
  ): Promise<{ tenantId: string; tenantName: string }> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { userId, tenantId },
      select: {
        id: true,
        role: true,
        isDefault: true,
        tenant: {
          select: { id: true, slug: true, name: true },
        },
        user: {
          select: { id: true, email: true },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "You are not a member of this workspace.",
      });
    }

    if (
      confirmTenantSlug.trim().toLowerCase() !==
      membership.tenant.slug.toLowerCase()
    ) {
      throw new BadRequestException({
        code: "SLUG_CONFIRMATION_MISMATCH",
        message:
          "Workspace slug does not match. Type the slug exactly to confirm.",
      });
    }

    if (membership.role === TenantMembershipRole.OWNER) {
      const ownerCount = await this.prisma.tenantMembership.count({
        where: { tenantId, role: TenantMembershipRole.OWNER },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: "LAST_OWNER_BLOCKED",
          message:
            "You are the final owner of this workspace. Transfer ownership or permanently delete the workspace before leaving.",
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantMembership.delete({ where: { id: membership.id } });

      if (!membership.isDefault) return;

      const nextDefault = await tx.tenantMembership.findFirst({
        where: { userId },
        orderBy: [{ createdAt: "asc" }],
        select: { id: true },
      });

      if (nextDefault) {
        await tx.tenantMembership.update({
          where: { id: nextDefault.id },
          data: { isDefault: true },
        });
      }
    });

    await auditWriter({
      tenantId,
      actorUserId: userId,
      action: "tenant.member_self_left",
      targetType: "tenant_membership",
      targetId: membership.id,
      metadata: {
        email: membership.user.email,
        role: membership.role,
        userId: membership.user.id,
      },
    });

    await this.notificationsService.createForTenantRoles({
      tenantId,
      roles: [TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN],
      category: NotificationCategory.SYSTEM,
      title: `Team member left: ${membership.user.email}`,
      body: `${membership.user.email} left this workspace from their account settings.`,
      actionUrl: "/workspace",
      metadata: {
        membershipId: membership.id,
        userId: membership.user.id,
        email: membership.user.email,
        role: membership.role,
      },
    });

    return {
      tenantId: membership.tenant.id,
      tenantName: membership.tenant.name,
    };
  }

  async getAccountDeletionImpact(
    userId: string,
  ): Promise<AccountDeletionImpact> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        platformRole: true,
        memberships: {
          select: {
            tenantId: true,
            role: true,
            tenant: {
              select: { id: true, slug: true, name: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const tenantIds = user.memberships.map((m) => m.tenantId);
    const stats = await this.loadTenantStats(tenantIds);

    const workspaces: DeletionImpactWorkspaceEntry[] = user.memberships.map(
      (m) => {
        const stat = stats[m.tenantId] ?? { ownerCount: 0, memberCount: 0 };
        return {
          tenantId: m.tenantId,
          tenantSlug: m.tenant.slug,
          tenantName: m.tenant.name,
          role: m.role,
          isFinalOwner:
            m.role === TenantMembershipRole.OWNER && stat.ownerCount <= 1,
          ownerCount: stat.ownerCount,
          memberCount: stat.memberCount,
        };
      },
    );

    const finalOwnerWorkspaces = workspaces.filter((w) => w.isFinalOwner);

    const [pendingSentInvitations, assignedSeoAuditTasks] = await Promise.all([
      this.prisma.workspaceInvitation.count({
        where: {
          invitedByUserId: userId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      }),
      this.prisma.seoAuditTask.count({
        where: { assigneeUserId: userId },
      }),
    ]);

    const blockingReasons: string[] = [];
    if (finalOwnerWorkspaces.length > 0) {
      blockingReasons.push("FINAL_OWNER_OF_WORKSPACES");
    }

    return {
      email: user.email,
      blocked: blockingReasons.length > 0,
      blockingReasons,
      workspaces,
      finalOwnerWorkspaces,
      pendingSentInvitations,
      assignedSeoAuditTasks,
      hasPlatformRole: Boolean(user.platformRole),
    };
  }

  async deleteAccount(
    userId: string,
    confirmEmail: string,
    currentPassword: string,
    auditWriter: (params: {
      tenantId: string;
      actorUserId: string;
      action: string;
      targetType: string;
      targetId: string;
      metadata: Record<string, unknown>;
    }) => Promise<void>,
  ): Promise<{ deletedUserId: string; email: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    if (confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
      throw new BadRequestException({
        code: "EMAIL_CONFIRMATION_MISMATCH",
        message: "Type your email address exactly to confirm account deletion.",
      });
    }

    const valid = await this.usersService.verifyPassword(
      user.passwordHash,
      currentPassword,
    );

    if (!valid) {
      throw new UnauthorizedException({
        code: "INVALID_PASSWORD",
        message: "Password is incorrect. Account deletion blocked.",
      });
    }

    const impact = await this.getAccountDeletionImpact(userId);

    if (impact.blocked) {
      throw new ForbiddenException({
        code: "ACCOUNT_DELETION_BLOCKED",
        message:
          "You are the final owner of one or more workspaces. Transfer ownership or permanently delete those workspaces first.",
        details: {
          finalOwnerWorkspaces: impact.finalOwnerWorkspaces,
        },
      });
    }

    // Write tenant-level audit BEFORE deletion so each workspace retains a
    // permanent record. AuditLog.actorUserId is a plain String (no FK), so
    // historical entries by this user across all tenants are preserved.
    for (const workspace of impact.workspaces) {
      try {
        await auditWriter({
          tenantId: workspace.tenantId,
          actorUserId: userId,
          action: "account.self_deleted",
          targetType: "user",
          targetId: userId,
          metadata: {
            email: user.email,
            role: workspace.role,
          },
        });
      } catch (error) {
        this.logger.warn(
          `Failed to write self-delete audit log for tenant ${workspace.tenantId}: ${
            (error as Error).message
          }`,
        );
      }
    }

    // Notify remaining OWNER+ADMIN per workspace before tearing down the user.
    await Promise.all(
      impact.workspaces.map((workspace) =>
        this.notificationsService
          .createForTenantRoles({
            tenantId: workspace.tenantId,
            roles: [TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN],
            category: NotificationCategory.SYSTEM,
            title: `Team member account deleted: ${user.email}`,
            body: `${user.email} deleted their StayLayer account. Their access has been revoked.`,
            actionUrl: "/workspace",
            excludeUserIds: [userId],
            metadata: {
              userId,
              email: user.email,
              role: workspace.role,
            },
          })
          .catch((error) =>
            this.logger.warn(
              `Failed to notify tenant ${workspace.tenantId} about self-deletion: ${(error as Error).message}`,
            ),
          ),
      ),
    );

    // Manually clear non-FK personal references before the hard delete:
    //  - Notifications addressed to this user
    //  - NotificationPreferences belonging to this user
    // AuditLog.actorUserId & Notification (broadcast) intentionally stay.
    await this.prisma.$transaction([
      this.prisma.notification.deleteMany({ where: { userId } }),
      this.prisma.notificationPreference.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);

    return { deletedUserId: userId, email: user.email };
  }

  private async listPendingInvitationsForEmail(
    email: string,
  ): Promise<ProfilePendingInvitationSummary[]> {
    const normalizedEmail = email.trim().toLowerCase();
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: {
        email: normalizedEmail,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        role: true,
        createdAt: true,
        expiresAt: true,
        tenant: { select: { id: true, name: true, slug: true } },
        invitedByUser: { select: { email: true } },
      },
    });

    return invitations.map((invitation) => ({
      id: invitation.id,
      tenantId: invitation.tenant.id,
      tenantName: invitation.tenant.name,
      tenantSlug: invitation.tenant.slug,
      role: invitation.role,
      createdAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString(),
      invitedByEmail: invitation.invitedByUser?.email ?? null,
    }));
  }

  private async loadTenantStats(
    tenantIds: string[],
  ): Promise<
    Record<
      string,
      { ownerCount: number; memberCount: number; activeSiteCount: number }
    >
  > {
    if (tenantIds.length === 0) return {};

    const [groupedMembers, owners, sites] = await Promise.all([
      this.prisma.tenantMembership.groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: tenantIds } },
        _count: { _all: true },
      }),
      this.prisma.tenantMembership.groupBy({
        by: ["tenantId"],
        where: {
          tenantId: { in: tenantIds },
          role: TenantMembershipRole.OWNER,
        },
        _count: { _all: true },
      }),
      this.prisma.site.groupBy({
        by: ["tenantId"],
        where: {
          tenantId: { in: tenantIds },
          status: { not: SiteStatus.ARCHIVED },
        },
        _count: { _all: true },
      }),
    ]);

    const result: Record<
      string,
      { ownerCount: number; memberCount: number; activeSiteCount: number }
    > = {};

    for (const tenantId of tenantIds) {
      result[tenantId] = {
        ownerCount: 0,
        memberCount: 0,
        activeSiteCount: 0,
      };
    }
    for (const row of groupedMembers) {
      result[row.tenantId]!.memberCount = row._count._all;
    }
    for (const row of owners) {
      result[row.tenantId]!.ownerCount = row._count._all;
    }
    for (const row of sites) {
      result[row.tenantId]!.activeSiteCount = row._count._all;
    }
    return result;
  }
}
