import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NotificationCategory, TenantMembershipRole } from "@prisma/client";
import { randomBytes, createHash } from "crypto";
import { BillingService } from "../billing/billing.service";
import { TransactionalEmailService } from "../mail/transactional-email.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";

const VERIFICATION_TTL_HOURS = 48;
const RESET_TTL_HOURS = 2;
const INVITATION_TTL_DAYS = 7;

export interface WorkspaceInvitationPreview {
  email: string;
  role: TenantMembershipRole;
  tenantName: string;
  tenantSlug: string;
  existingAccount: boolean;
  expiresAt: string;
}

export interface SentWorkspaceInvitationSummary {
  id: string;
  email: string;
  role: TenantMembershipRole;
  status: "pending";
  createdAt: string;
  expiresAt: string;
}

export interface PendingWorkspaceInvitationSummary {
  id: string;
  email: string;
  role: TenantMembershipRole;
  status: "pending";
  createdAt: string;
  expiresAt: string;
  invitedByUserId: string | null;
  invitedByEmail: string | null;
}

export interface AcceptedWorkspaceInvitationResult {
  userId: string;
  email: string;
  tenantId: string;
}

@Injectable()
export class CustomerAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly billingService: BillingService,
    private readonly transactionalEmailService: TransactionalEmailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async sendVerificationEmailForUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
      },
    });

    if (!user || user.emailVerifiedAt) {
      return;
    }

    const token = this.issueToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = this.addHours(VERIFICATION_TTL_HOURS);

    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.updateMany({
        where: {
          userId: user.id,
          consumedAt: null,
        },
        data: {
          consumedAt: new Date(),
        },
      }),
      this.prisma.emailVerificationToken.create({
        data: {
          userId: user.id,
          email: user.email,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    const url = `${this.getMarketingBaseUrl()}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
    await this.transactionalEmailService.send({
      to: user.email,
      subject: "Verify your StayLayer email",
      text: this.buildVerificationText(url),
      html: this.buildEmailHtml({
        eyebrow: "Verify email",
        title: "Confirm your StayLayer sign-in",
        body: "Verify your email to activate customer access and continue into your workspace.",
        ctaLabel: "Verify email",
        ctaUrl: url,
        fallbackLabel:
          "If the button does not open, copy this link into your browser:",
      }),
    });
  }

  async resendVerificationEmail(email: string): Promise<{ accepted: true }> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        emailVerifiedAt: true,
      },
    });

    if (!user || user.emailVerifiedAt) {
      return { accepted: true };
    }

    await this.sendVerificationEmailForUser(user.id);
    return { accepted: true };
  }

  async verifyEmailToken(
    token: string,
  ): Promise<{ userId: string; email: string }> {
    const verification = await this.findActiveVerificationToken(token);

    await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.update({
        where: { id: verification.id },
        data: { consumedAt: new Date() },
      });

      await tx.user.update({
        where: { id: verification.userId },
        data: {
          emailVerifiedAt: verification.user.emailVerifiedAt ?? new Date(),
        },
      });
    });

    return {
      userId: verification.userId,
      email: verification.email,
    };
  }

  async requestPasswordReset(email: string): Promise<{ accepted: true }> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      return { accepted: true };
    }

    const token = this.issueToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = this.addHours(RESET_TTL_HOURS);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          consumedAt: null,
        },
        data: {
          consumedAt: new Date(),
        },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          email: user.email,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    const url = `${this.getMarketingBaseUrl()}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
    await this.transactionalEmailService.send({
      to: user.email,
      subject: "Reset your StayLayer password",
      text: this.buildPasswordResetText(url),
      html: this.buildEmailHtml({
        eyebrow: "Password reset",
        title: "Choose a new password",
        body: "Use the secure link below to reset your password and regain access to your workspace.",
        ctaLabel: "Reset password",
        ctaUrl: url,
        fallbackLabel:
          "If the button does not open, copy this link into your browser:",
      }),
    });

    return { accepted: true };
  }

  async sendWorkspaceAccountSetupEmail(input: {
    userId: string;
    email: string;
    tenantName: string;
    role: TenantMembershipRole;
  }): Promise<{ accepted: true }> {
    const normalizedEmail = this.normalizeEmail(input.email);
    const token = this.issueToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = this.addHours(RESET_TTL_HOURS);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: input.userId,
          consumedAt: null,
        },
        data: {
          consumedAt: new Date(),
        },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: input.userId,
          email: normalizedEmail,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    const url = `${this.getMarketingBaseUrl()}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(normalizedEmail)}`;
    await this.transactionalEmailService.send({
      to: normalizedEmail,
      subject: `Set up your ${input.tenantName} StayLayer account`,
      text: this.buildWorkspaceAccountSetupText({
        tenantName: input.tenantName,
        role: input.role,
        url,
      }),
      html: this.buildEmailHtml({
        eyebrow: "Workspace access",
        title: `Set up your ${input.tenantName} account`,
        body: `Your ${this.describeRole(input.role)} access is ready. Choose your own password with the secure link below, then sign in to the workspace.`,
        ctaLabel: "Choose password",
        ctaUrl: url,
        fallbackLabel:
          "If the button does not open, copy this link into your browser:",
      }),
    });

    return { accepted: true };
  }

  async resetPassword(
    token: string,
    password: string,
  ): Promise<{ accepted: true }> {
    const resetToken = await this.findActivePasswordResetToken(token);
    const passwordHash = await this.usersService.hashPassword(password);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { consumedAt: new Date() },
      });

      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          failedAttempts: 0,
          lockedUntil: null,
        },
      });
    });

    return { accepted: true };
  }

  async createWorkspaceInvitation(input: {
    tenantId: string;
    email: string;
    role: TenantMembershipRole;
    invitedByUserId: string | null;
  }): Promise<SentWorkspaceInvitationSummary> {
    const normalizedEmail = this.normalizeEmail(input.email);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Workspace not found",
      });
    }

    const existingMembership = await this.prisma.tenantMembership.findFirst({
      where: {
        tenantId: input.tenantId,
        user: {
          email: normalizedEmail,
        },
      },
      select: { id: true },
    });

    if (existingMembership) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "This user is already a member of the active workspace.",
      });
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        platformRole: true,
      },
    });

    if (existingUser?.platformRole) {
      throw new ConflictException({
        code: "CONFLICT",
        message:
          "This email belongs to an internal operator account and cannot be invited through the customer workspace flow.",
      });
    }

    const token = this.issueToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = this.addDays(INVITATION_TTL_DAYS);

    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.workspaceInvitation.updateMany({
        where: {
          tenantId: tenant.id,
          email: normalizedEmail,
          acceptedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return tx.workspaceInvitation.create({
        data: {
          tenantId: tenant.id,
          email: normalizedEmail,
          role: input.role,
          invitedByUserId: input.invitedByUserId,
          tokenHash,
          expiresAt,
        },
        select: {
          id: true,
          createdAt: true,
        },
      });
    });

    const url = `${this.getMarketingBaseUrl()}/accept-invite?token=${encodeURIComponent(token)}`;
    await this.transactionalEmailService.send({
      to: normalizedEmail,
      subject: `You're invited to ${tenant.name} on StayLayer`,
      text: this.buildInvitationText({
        tenantName: tenant.name,
        role: input.role,
        url,
      }),
      html: this.buildEmailHtml({
        eyebrow: "Workspace invitation",
        title: `Join ${tenant.name} on StayLayer`,
        body: `You were invited as ${this.describeRole(input.role)}. Accept the invitation to access this customer workspace.`,
        ctaLabel: "Accept invitation",
        ctaUrl: url,
        fallbackLabel:
          "If the button does not open, copy this link into your browser:",
      }),
    });

    await this.notificationsService.createForTenantRoles({
      tenantId: tenant.id,
      roles: [TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN],
      category: NotificationCategory.SYSTEM,
      title: `Invitation sent to ${normalizedEmail}`,
      body: `${normalizedEmail} was invited as ${this.describeRole(input.role)}. The invite stays active until ${expiresAt.toISOString().slice(0, 10)}.`,
      actionUrl: "/workspace#pending-invitations",
      metadata: {
        invitationId: invitation.id,
        email: normalizedEmail,
        role: input.role,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return {
      id: invitation.id,
      email: normalizedEmail,
      role: input.role,
      status: "pending",
      createdAt: invitation.createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async listPendingWorkspaceInvitations(
    tenantId: string,
  ): Promise<PendingWorkspaceInvitationSummary[]> {
    const invitations = await this.prisma.workspaceInvitation.findMany({
      where: {
        tenantId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        expiresAt: true,
        invitedByUserId: true,
        invitedByUser: {
          select: {
            email: true,
          },
        },
      },
    });

    return invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: "pending",
      createdAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString(),
      invitedByUserId: invitation.invitedByUserId,
      invitedByEmail: invitation.invitedByUser?.email ?? null,
    }));
  }

  async getWorkspaceInvitationPreview(
    token: string,
  ): Promise<WorkspaceInvitationPreview> {
    const invitation = await this.findActiveWorkspaceInvitation(token);
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    });

    return {
      email: invitation.email,
      role: invitation.role,
      tenantName: invitation.tenant.name,
      tenantSlug: invitation.tenant.slug,
      existingAccount: Boolean(existingUser),
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async acceptWorkspaceInvitation(input: {
    token: string;
    password: string;
    name?: string;
  }): Promise<AcceptedWorkspaceInvitationResult> {
    const invitation = await this.findActiveWorkspaceInvitation(input.token);
    const existingUser = await this.prisma.user.findUnique({
      where: { email: invitation.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        platformRole: true,
        emailVerifiedAt: true,
        failedAttempts: true,
        lockedUntil: true,
      },
    });

    if (existingUser?.platformRole) {
      throw new ForbiddenException({
        code: "INVITATION_NOT_ALLOWED",
        message:
          "Internal operator accounts cannot accept customer workspace invitations through this flow.",
      });
    }

    if (existingUser?.lockedUntil && existingUser.lockedUntil > new Date()) {
      throw new ForbiddenException({
        code: "ACCOUNT_LOCKED",
        message: `Account locked. Try again after ${existingUser.lockedUntil.toISOString()}`,
      });
    }

    let resolvedUserId = existingUser?.id ?? null;

    if (existingUser) {
      const validPassword = await this.usersService.verifyPassword(
        existingUser.passwordHash,
        input.password,
      );

      if (!validPassword) {
        await this.usersService.incrementFailedAttempts(existingUser.id);
        throw new UnauthorizedException({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      await this.usersService.resetFailedAttempts(existingUser.id);
    } else {
      const name = input.name?.trim();
      if (!name) {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "Name is required to accept this invitation",
        });
      }

      if (input.password.trim().length < 8) {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "Password must be at least 8 characters",
        });
      }
    }

    const existingMembership = existingUser
      ? await this.prisma.tenantMembership.findUnique({
          where: {
            tenantId_userId: {
              tenantId: invitation.tenantId,
              userId: existingUser.id,
            },
          },
          select: { id: true },
        })
      : null;

    if (!existingMembership) {
      await this.billingService.assertCanAddSeat(invitation.tenantId);
    }

    const passwordHash = existingUser
      ? null
      : await this.usersService.hashPassword(input.password);

    const result = await this.prisma.$transaction(async (tx) => {
      if (!resolvedUserId) {
        const createdUser = await tx.user.create({
          data: {
            email: invitation.email,
            passwordHash: passwordHash!,
            emailVerifiedAt: new Date(),
            platformRole: null,
          },
          select: { id: true },
        });
        resolvedUserId = createdUser.id;
      } else if (!existingUser?.emailVerifiedAt) {
        await tx.user.update({
          where: { id: resolvedUserId },
          data: { emailVerifiedAt: new Date() },
        });
      }

      if (!existingMembership) {
        const membershipCount = await tx.tenantMembership.count({
          where: { userId: resolvedUserId! },
        });

        await tx.tenantMembership.create({
          data: {
            tenantId: invitation.tenantId,
            userId: resolvedUserId!,
            role: invitation.role,
            isDefault: membershipCount === 0,
          },
        });
      }

      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          acceptedAt: new Date(),
        },
      });

      await tx.workspaceInvitation.updateMany({
        where: {
          tenantId: invitation.tenantId,
          email: invitation.email,
          id: { not: invitation.id },
          acceptedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      return {
        userId: resolvedUserId!,
        email: invitation.email,
        tenantId: invitation.tenantId,
      };
    });

    await Promise.all([
      this.notificationsService.createForTenantRoles({
        tenantId: invitation.tenantId,
        roles: [TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN],
        category: NotificationCategory.SYSTEM,
        title: `${invitation.email} joined ${invitation.tenant.name}`,
        body: `The ${this.describeRole(invitation.role)} invitation was accepted and workspace access is now active.`,
        actionUrl: "/workspace",
        metadata: {
          email: invitation.email,
          role: invitation.role,
          tenantSlug: invitation.tenant.slug,
        },
      }),
      this.notificationsService.create({
        tenantId: invitation.tenantId,
        userId: result.userId,
        category: NotificationCategory.SYSTEM,
        title: `Welcome to ${invitation.tenant.name}`,
        body: `Your ${this.describeRole(invitation.role)} access is active. You can start working in the workspace now.`,
        actionUrl: "/",
        metadata: {
          tenantSlug: invitation.tenant.slug,
          role: invitation.role,
        },
      }),
    ]);

    return result;
  }

  private async findActiveVerificationToken(token: string) {
    const tokenHash = this.hashToken(token);
    const verification = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        email: true,
        expiresAt: true,
        consumedAt: true,
        user: {
          select: {
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (
      !verification ||
      verification.consumedAt ||
      verification.expiresAt <= new Date()
    ) {
      throw new BadRequestException({
        code: "INVALID_OR_EXPIRED_TOKEN",
        message: "This verification link is invalid or has expired",
      });
    }

    return verification;
  }

  private async findActivePasswordResetToken(token: string) {
    const tokenHash = this.hashToken(token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        consumedAt: true,
      },
    });

    if (
      !resetToken ||
      resetToken.consumedAt ||
      resetToken.expiresAt <= new Date()
    ) {
      throw new BadRequestException({
        code: "INVALID_OR_EXPIRED_TOKEN",
        message: "This password reset link is invalid or has expired",
      });
    }

    return resetToken;
  }

  private async findActiveWorkspaceInvitation(token: string) {
    const tokenHash = this.hashToken(token);
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        tenantId: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        tenant: {
          select: {
            name: true,
            slug: true,
          },
        },
      },
    });

    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date()
    ) {
      throw new BadRequestException({
        code: "INVALID_OR_EXPIRED_TOKEN",
        message: "This invitation link is invalid or has expired",
      });
    }

    return invitation;
  }

  private buildVerificationText(url: string): string {
    return [
      "Verify your StayLayer email",
      "",
      "Use this link to activate customer access:",
      url,
      "",
      `This link expires in ${VERIFICATION_TTL_HOURS} hours.`,
    ].join("\n");
  }

  private buildPasswordResetText(url: string): string {
    return [
      "Reset your StayLayer password",
      "",
      "Use this link to choose a new password:",
      url,
      "",
      `This link expires in ${RESET_TTL_HOURS} hours.`,
    ].join("\n");
  }

  private buildInvitationText(input: {
    tenantName: string;
    role: TenantMembershipRole;
    url: string;
  }): string {
    return [
      `Join ${input.tenantName} on StayLayer`,
      "",
      `You were invited as ${this.describeRole(input.role)}.`,
      "Accept the invitation here:",
      input.url,
      "",
      `This link expires in ${INVITATION_TTL_DAYS} days.`,
    ].join("\n");
  }

  private buildWorkspaceAccountSetupText(input: {
    tenantName: string;
    role: TenantMembershipRole;
    url: string;
  }): string {
    return [
      `Your ${input.tenantName} StayLayer account is ready`,
      "",
      `You were added as ${this.describeRole(input.role)}.`,
      "Choose your password here:",
      input.url,
      "",
      `This secure link expires in ${RESET_TTL_HOURS} hours.`,
    ].join("\n");
  }

  private buildEmailHtml(input: {
    eyebrow: string;
    title: string;
    body: string;
    ctaLabel: string;
    ctaUrl: string;
    fallbackLabel: string;
  }): string {
    return [
      "<!doctype html>",
      '<html><body style="margin:0;padding:24px;background:#f7f2eb;font-family:Arial,sans-serif;color:#102a36;">',
      '<div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px;border:1px solid rgba(26,72,112,0.12);">',
      `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#E07038;">${this.escapeHtml(input.eyebrow)}</p>`,
      `<h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#0D2840;">${this.escapeHtml(input.title)}</h1>`,
      `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#102a36;">${this.escapeHtml(input.body)}</p>`,
      `<a href="${this.escapeHtml(input.ctaUrl)}" style="display:inline-block;border-radius:999px;background:#0D2840;color:#ffffff;padding:14px 22px;text-decoration:none;font-weight:700;">${this.escapeHtml(input.ctaLabel)}</a>`,
      `<p style="margin:24px 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1A4870;">${this.escapeHtml(input.fallbackLabel)}</p>`,
      `<p style="margin:0;font-size:13px;line-height:1.7;color:#102a36;word-break:break-all;">${this.escapeHtml(input.ctaUrl)}</p>`,
      "</div></body></html>",
    ].join("");
  }

  private describeRole(role: TenantMembershipRole): string {
    switch (role) {
      case TenantMembershipRole.OWNER:
        return "owner";
      case TenantMembershipRole.ADMIN:
        return "admin";
      case TenantMembershipRole.EDITOR:
        return "editor";
      case TenantMembershipRole.BILLING:
        return "billing contact";
      default:
        return "member";
    }
  }

  private getMarketingBaseUrl(): string {
    return (
      this.configService
        .get<string>("MARKETING_APP_URL")
        ?.trim()
        .replace(/\/$/, "") || "http://localhost:3002"
    );
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private issueToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private addHours(hours: number): Date {
    const value = new Date();
    value.setHours(value.getHours() + hours);
    return value;
  }

  private addDays(days: number): Date {
    const value = new Date();
    value.setDate(value.getDate() + days);
    return value;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
