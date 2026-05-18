import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "node:crypto";
import {
  NotificationCategory,
  Prisma,
  SiteStatus,
  SiteType,
  TenantMembershipRole,
} from "@prisma/client";
import { CustomerAccessService } from "../auth/customer-access.service";
import { BillingService } from "../billing/billing.service";
import {
  buildPublicSubdomainCandidate,
  normalizePublicSubdomainLabel,
  RESERVED_PUBLIC_SUBDOMAINS,
} from "../common/public-subdomain.util";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  getConfiguredPlatformRootDomain,
  isUsablePlatformRootDomain,
} from "../public-runtime/platform-root-domain";
import { PublicRuntimeCacheService } from "../public-runtime/public-runtime.cache.service";
import {
  companionHost,
  normalizeHostname,
} from "../public-runtime/public-runtime.util";
import { UsersService } from "../users/users.service";
import { CreateSiteDto } from "./dto/create-site.dto";
import { CreateTenantMemberDto } from "./dto/create-tenant-member.dto";
import { InviteTenantMemberDto } from "./dto/invite-tenant-member.dto";

type TenantSiteSummary = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  publicSubdomain: string | null;
  status: SiteStatus;
  primaryLocale: string;
  enabledLocales: string[];
  siteType: SiteType;
  createdAt: string;
};

type TenantMemberSummary = {
  id: string;
  tenantId: string;
  userId: string;
  email: string;
  role: TenantMembershipRole;
  isDefault: boolean;
  createdAt: string;
};

type TenantInvitationSummary = {
  id: string;
  email: string;
  role: TenantMembershipRole;
  status: "pending";
  createdAt: string;
  expiresAt: string;
};

type PendingTenantInvitationSummary = {
  id: string;
  email: string;
  role: TenantMembershipRole;
  status: "pending";
  createdAt: string;
  expiresAt: string;
  invitedByUserId: string | null;
  invitedByEmail: string | null;
};

@Injectable()
export class TenantWorkspaceService {
  private readonly logger = new Logger(TenantWorkspaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly usersService: UsersService,
    private readonly customerAccessService: CustomerAccessService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
    @Optional()
    private readonly publicRuntimeCacheService?: PublicRuntimeCacheService,
  ) {}

  async listSites(tenantId: string): Promise<TenantSiteSummary[]> {
    const sites = await this.prisma.site.findMany({
      where: { tenantId, status: { not: SiteStatus.ARCHIVED } },
      orderBy: [{ status: "asc" }, { name: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        tenantId: true,
        name: true,
        slug: true,
        publicSubdomain: true,
        status: true,
        primaryLocale: true,
        enabledLocales: true,
        siteType: true,
        createdAt: true,
      },
    });

    return sites.map((site) => this.serializeSite(site));
  }

  async listMembers(tenantId: string): Promise<TenantMemberSummary[]> {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        tenantId: true,
        role: true,
        isDefault: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return memberships.map((membership) => this.serializeMember(membership));
  }

  async listPendingInvitations(
    tenantId: string,
  ): Promise<PendingTenantInvitationSummary[]> {
    return this.customerAccessService.listPendingWorkspaceInvitations(tenantId);
  }

  async createSite(
    tenantId: string,
    dto: CreateSiteDto,
  ): Promise<TenantSiteSummary> {
    const name = this.normalizeRequiredValue(dto.name, "name");
    const slug = this.normalizeSlug(dto.slug ?? name);
    const publicSubdomain = await this.resolvePublicSubdomain(
      dto.publicSubdomain,
      slug,
    );
    const primaryLocale = this.normalizeRequiredValue(
      dto.primaryLocale ?? "en",
      "primaryLocale",
    );
    const enabledLocales = this.normalizeLocales(
      dto.enabledLocales,
      primaryLocale,
    );

    await this.billingService.assertCanProvisionSite(tenantId);

    try {
      const site = await this.prisma.$transaction(async (tx) => {
        const createdSite = await tx.site.create({
          data: {
            tenantId,
            name,
            slug,
            publicSubdomain,
            status: SiteStatus.ACTIVE,
            templateKey: this.normalizeOptionalValue(dto.templateKey),
            primaryLocale,
            enabledLocales,
            siteType: dto.siteType ?? SiteType.VACATION_RENTAL,
          },
          select: {
            id: true,
            tenantId: true,
            name: true,
            slug: true,
            publicSubdomain: true,
            status: true,
            primaryLocale: true,
            enabledLocales: true,
            siteType: true,
            createdAt: true,
          },
        });

        await tx.siteSettings.create({
          data: {
            siteId: createdSite.id,
            siteName: name,
            defaultLocale: primaryLocale,
            activeLocales: enabledLocales,
          },
        });

        return createdSite;
      });

      await this.notificationsService.createForTenantRoles({
        tenantId,
        roles: [
          TenantMembershipRole.OWNER,
          TenantMembershipRole.ADMIN,
          TenantMembershipRole.EDITOR,
        ],
        category: NotificationCategory.SYSTEM,
        title: `${site.name} is ready in Workspace Studio`,
        body: `A new ${this.describeSiteType(site.siteType)} site was provisioned and can now be assigned, edited, and launched.`,
        actionUrl: "/workspace",
        metadata: {
          siteId: site.id,
          siteSlug: site.slug,
          siteType: site.siteType,
        },
      });

      return this.serializeSite(site);
    } catch (error) {
      this.rethrowSiteConflict(error);
      throw error;
    }
  }

  async deleteSite(
    tenantId: string,
    siteId: string,
  ): Promise<TenantSiteSummary> {
    const site = await this.prisma.site.findFirst({
      where: {
        id: siteId,
        tenantId,
        status: { not: SiteStatus.ARCHIVED },
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        slug: true,
        publicSubdomain: true,
        status: true,
        primaryLocale: true,
        enabledLocales: true,
        siteType: true,
        createdAt: true,
        domains: {
          select: {
            host: true,
          },
        },
      },
    });

    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found in this workspace",
      });
    }

    const cacheHosts = this.collectSiteHostnames(site);
    const archivedSite = await this.prisma.$transaction(async (tx) => {
      await tx.domain.deleteMany({ where: { siteId: site.id } });

      return tx.site.update({
        where: { id: site.id },
        data: {
          status: SiteStatus.ARCHIVED,
          slug: this.buildArchivedSlug(site.slug, site.id),
          publicSubdomain: null,
        },
        select: {
          id: true,
          tenantId: true,
          name: true,
          slug: true,
          publicSubdomain: true,
          status: true,
          primaryLocale: true,
          enabledLocales: true,
          siteType: true,
          createdAt: true,
        },
      });
    });

    await Promise.all([
      this.bustHostCache(cacheHosts),
      this.notificationsService.createForTenantRoles({
        tenantId,
        roles: [TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN],
        category: NotificationCategory.SYSTEM,
        title: `${site.name} was deleted from Workspace Studio`,
        body: `The site was archived, its default subdomain was released, and ${site.domains.length} custom domain${site.domains.length === 1 ? "" : "s"} were detached.`,
        actionUrl: "/workspace",
        metadata: {
          siteId: site.id,
          siteName: site.name,
          releasedSlug: site.slug,
          releasedPublicSubdomain: site.publicSubdomain,
          detachedDomains: site.domains.map((domain) => domain.host),
        },
      }),
    ]);

    return this.serializeSite(archivedSite);
  }

  async inviteMember(
    tenantId: string,
    dto: InviteTenantMemberDto,
    invitedByUserId: string | null,
  ): Promise<TenantInvitationSummary> {
    return this.customerAccessService.createWorkspaceInvitation({
      tenantId,
      email: dto.email,
      role: dto.role,
      invitedByUserId,
    });
  }

  async revokeInvitation(
    tenantId: string,
    invitationId: string,
  ): Promise<TenantInvitationSummary> {
    return this.customerAccessService.revokeWorkspaceInvitation({
      tenantId,
      invitationId,
    });
  }

  async resendInvitation(
    tenantId: string,
    invitationId: string,
    invitedByUserId: string | null,
  ): Promise<TenantInvitationSummary> {
    return this.customerAccessService.resendWorkspaceInvitation({
      tenantId,
      invitationId,
      invitedByUserId,
    });
  }

  async createMember(
    tenantId: string,
    dto: CreateTenantMemberDto,
  ): Promise<TenantMemberSummary> {
    const email = this.normalizeEmail(dto.email);
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException({
        code: "CONFLICT",
        message:
          "A user with this email already exists. Use the invite endpoint to add workspace access.",
      });
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Workspace not found",
      });
    }

    await this.billingService.assertCanAddSeat(tenantId);

    const initialPassword =
      dto.password?.trim() || randomBytes(32).toString("base64url");
    const passwordHash = await this.usersService.hashPassword(initialPassword);
    const membership = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          emailVerifiedAt: new Date(),
          platformRole: null,
        },
        select: {
          id: true,
          email: true,
        },
      });

      return tx.tenantMembership.create({
        data: {
          tenantId,
          userId: user.id,
          role: dto.role,
          isDefault: true,
        },
        select: {
          id: true,
          tenantId: true,
          role: true,
          isDefault: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });
    });

    await Promise.all([
      this.notificationsService.createForTenantRoles({
        tenantId,
        roles: [TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN],
        category: NotificationCategory.SYSTEM,
        title: `Team member added: ${membership.user.email}`,
        body: `${membership.user.email} was added as ${this.describeRole(membership.role)} and received a secure password setup email.`,
        actionUrl: "/workspace",
        metadata: {
          userId: membership.user.id,
          email: membership.user.email,
          role: membership.role,
        },
      }),
      this.notificationsService.create({
        tenantId,
        userId: membership.user.id,
        category: NotificationCategory.SYSTEM,
        title: "Your StayLayer workspace access is ready",
        body: `You were added as ${this.describeRole(membership.role)}. Check your email to choose your password.`,
        actionUrl: "/",
        metadata: {
          role: membership.role,
        },
      }),
      this.customerAccessService.sendWorkspaceAccountSetupEmail({
        userId: membership.user.id,
        email: membership.user.email,
        tenantName: tenant.name,
        role: membership.role,
      }),
    ]);

    return this.serializeMember(membership);
  }

  async updateMemberRole(
    tenantId: string,
    membershipId: string,
    nextRole: TenantMembershipRole,
    actorUserId: string,
  ): Promise<TenantMemberSummary> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { id: membershipId, tenantId },
      select: {
        id: true,
        tenantId: true,
        role: true,
        isDefault: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Workspace member not found",
      });
    }

    if (membership.user.id === actorUserId) {
      throw new BadRequestException({
        code: "SELF_ROLE_CHANGE_BLOCKED",
        message:
          "You cannot change your own role here. Use Transfer ownership or ask another owner.",
      });
    }

    if (membership.role === nextRole) {
      return this.serializeMember(membership);
    }

    const actorMembership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId: actorUserId },
      select: { role: true },
    });

    if (!actorMembership) {
      throw new BadRequestException({
        code: "ACTOR_NOT_MEMBER",
        message: "Only workspace members can change member roles.",
      });
    }

    const ownerInvolved =
      nextRole === TenantMembershipRole.OWNER ||
      membership.role === TenantMembershipRole.OWNER;

    if (ownerInvolved && actorMembership.role !== TenantMembershipRole.OWNER) {
      throw new BadRequestException({
        code: "OWNER_ROLE_CHANGE_REQUIRES_OWNER",
        message:
          "Only an Owner can grant or revoke the Owner role on a workspace.",
      });
    }

    if (
      membership.role === TenantMembershipRole.OWNER &&
      nextRole !== TenantMembershipRole.OWNER
    ) {
      const ownerCount = await this.prisma.tenantMembership.count({
        where: { tenantId, role: TenantMembershipRole.OWNER },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: "LAST_OWNER_BLOCKED",
          message:
            "A workspace must keep at least one owner. Promote another member to Owner first.",
        });
      }
    }

    const updated = await this.prisma.tenantMembership.update({
      where: { id: membership.id },
      data: { role: nextRole },
      select: {
        id: true,
        tenantId: true,
        role: true,
        isDefault: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    await Promise.all([
      this.notificationsService.createForTenantRoles({
        tenantId,
        roles: [TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN],
        category: NotificationCategory.SYSTEM,
        title: `Role updated: ${updated.user.email}`,
        body: `${updated.user.email} is now ${this.describeRole(updated.role)} (was ${this.describeRole(membership.role)}).`,
        actionUrl: "/workspace",
        metadata: {
          membershipId: updated.id,
          userId: updated.user.id,
          email: updated.user.email,
          previousRole: membership.role,
          role: updated.role,
        },
      }),
      this.notificationsService.create({
        tenantId,
        userId: updated.user.id,
        category: NotificationCategory.SYSTEM,
        title: "Your workspace role changed",
        body: `Your role in this workspace was updated to ${this.describeRole(updated.role)}. You may need to sign back in for permissions to refresh.`,
        actionUrl: "/",
        metadata: {
          previousRole: membership.role,
          role: updated.role,
        },
      }),
    ]);

    return this.serializeMember(updated);
  }

  async transferOwnership(
    tenantId: string,
    targetMembershipId: string,
    actorUserId: string,
    demoteSelfTo: TenantMembershipRole,
  ): Promise<{
    promoted: TenantMemberSummary;
    demoted: TenantMemberSummary;
  }> {
    if (demoteSelfTo === TenantMembershipRole.OWNER) {
      throw new BadRequestException({
        code: "INVALID_DEMOTE_ROLE",
        message:
          "Select a non-owner role for yourself. Use change role if you want to keep two owners.",
      });
    }

    const targetMembership = await this.prisma.tenantMembership.findFirst({
      where: { id: targetMembershipId, tenantId },
      select: {
        id: true,
        tenantId: true,
        role: true,
        isDefault: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!targetMembership) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Workspace member not found",
      });
    }

    if (targetMembership.user.id === actorUserId) {
      throw new BadRequestException({
        code: "TRANSFER_TO_SELF_BLOCKED",
        message: "You cannot transfer ownership to yourself.",
      });
    }

    if (targetMembership.role === TenantMembershipRole.OWNER) {
      throw new BadRequestException({
        code: "TARGET_ALREADY_OWNER",
        message: "This member is already an owner of the workspace.",
      });
    }

    const actorMembership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId: actorUserId },
      select: {
        id: true,
        tenantId: true,
        role: true,
        isDefault: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!actorMembership) {
      throw new BadRequestException({
        code: "ACTOR_NOT_MEMBER",
        message: "Only workspace members can transfer ownership.",
      });
    }

    if (actorMembership.role !== TenantMembershipRole.OWNER) {
      throw new BadRequestException({
        code: "ACTOR_NOT_OWNER",
        message: "Only an existing owner can transfer workspace ownership.",
      });
    }

    const { promoted, demoted } = await this.prisma.$transaction(async (tx) => {
      const promotedMembership = await tx.tenantMembership.update({
        where: { id: targetMembership.id },
        data: { role: TenantMembershipRole.OWNER },
        select: {
          id: true,
          tenantId: true,
          role: true,
          isDefault: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      const demotedMembership = await tx.tenantMembership.update({
        where: { id: actorMembership.id },
        data: { role: demoteSelfTo },
        select: {
          id: true,
          tenantId: true,
          role: true,
          isDefault: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      return { promoted: promotedMembership, demoted: demotedMembership };
    });

    await Promise.all([
      this.notificationsService.create({
        tenantId,
        userId: promoted.user.id,
        category: NotificationCategory.SYSTEM,
        title: "You are now the workspace owner",
        body: `${actorMembership.user.email} transferred workspace ownership to you. You may need to sign back in for permissions to refresh.`,
        actionUrl: "/workspace",
        metadata: {
          previousRole: targetMembership.role,
          role: promoted.role,
          fromUserId: actorMembership.user.id,
          fromEmail: actorMembership.user.email,
        },
      }),
      this.notificationsService.create({
        tenantId,
        userId: demoted.user.id,
        category: NotificationCategory.SYSTEM,
        title: "Workspace ownership transferred",
        body: `You transferred ownership to ${promoted.user.email}. Your role is now ${this.describeRole(demoted.role)}. You may need to sign back in for permissions to refresh.`,
        actionUrl: "/",
        metadata: {
          previousRole: actorMembership.role,
          role: demoted.role,
          toUserId: promoted.user.id,
          toEmail: promoted.user.email,
        },
      }),
      this.notificationsService.createForTenantRoles({
        tenantId,
        roles: [TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN],
        category: NotificationCategory.SYSTEM,
        title: `Workspace ownership transferred to ${promoted.user.email}`,
        body: `${actorMembership.user.email} handed workspace ownership to ${promoted.user.email} and is now ${this.describeRole(demoted.role)}.`,
        actionUrl: "/workspace",
        metadata: {
          fromMembershipId: demoted.id,
          fromUserId: demoted.user.id,
          fromEmail: demoted.user.email,
          fromRole: demoted.role,
          toMembershipId: promoted.id,
          toUserId: promoted.user.id,
          toEmail: promoted.user.email,
          toRole: promoted.role,
        },
      }),
    ]);

    return {
      promoted: this.serializeMember(promoted),
      demoted: this.serializeMember(demoted),
    };
  }

  async removeMember(
    tenantId: string,
    membershipId: string,
    actorUserId: string,
  ): Promise<TenantMemberSummary> {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { id: membershipId, tenantId },
      select: {
        id: true,
        tenantId: true,
        role: true,
        isDefault: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Workspace member not found",
      });
    }

    if (membership.user.id === actorUserId) {
      throw new BadRequestException({
        code: "SELF_REMOVAL_BLOCKED",
        message:
          "You cannot remove your own workspace access from Workspace Studio.",
      });
    }

    if (membership.role === TenantMembershipRole.OWNER) {
      const ownerCount = await this.prisma.tenantMembership.count({
        where: { tenantId, role: TenantMembershipRole.OWNER },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException({
          code: "LAST_OWNER_BLOCKED",
          message: "A workspace must keep at least one owner.",
        });
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantMembership.delete({ where: { id: membership.id } });

      if (!membership.isDefault) {
        return;
      }

      const nextDefaultMembership = await tx.tenantMembership.findFirst({
        where: { userId: membership.user.id },
        orderBy: [{ createdAt: "asc" }],
        select: { id: true },
      });

      if (nextDefaultMembership) {
        await tx.tenantMembership.update({
          where: { id: nextDefaultMembership.id },
          data: { isDefault: true },
        });
      }
    });

    await this.notificationsService.createForTenantRoles({
      tenantId,
      roles: [TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN],
      category: NotificationCategory.SYSTEM,
      title: `Team member removed: ${membership.user.email}`,
      body: `${membership.user.email} no longer has access to this workspace.`,
      actionUrl: "/workspace",
      metadata: {
        membershipId: membership.id,
        userId: membership.user.id,
        email: membership.user.email,
        role: membership.role,
      },
    });

    return this.serializeMember(membership);
  }

  private serializeSite(site: {
    id: string;
    tenantId: string;
    name: string;
    slug: string;
    publicSubdomain: string | null;
    status: SiteStatus;
    primaryLocale: string;
    enabledLocales: string[];
    siteType: SiteType;
    createdAt: Date;
  }): TenantSiteSummary {
    return {
      id: site.id,
      tenantId: site.tenantId,
      name: site.name,
      slug: site.slug,
      publicSubdomain: site.publicSubdomain,
      status: site.status,
      primaryLocale: site.primaryLocale,
      enabledLocales: site.enabledLocales,
      siteType: site.siteType,
      createdAt: site.createdAt.toISOString(),
    };
  }

  private serializeMember(membership: {
    id: string;
    tenantId: string;
    role: TenantMembershipRole;
    isDefault: boolean;
    createdAt: Date;
    user: {
      id: string;
      email: string;
    };
  }): TenantMemberSummary {
    return {
      id: membership.id,
      tenantId: membership.tenantId,
      userId: membership.user.id,
      email: membership.user.email,
      role: membership.role,
      isDefault: membership.isDefault,
      createdAt: membership.createdAt.toISOString(),
    };
  }

  private normalizeEmail(value: string): string {
    return this.normalizeRequiredValue(value, "email").toLowerCase();
  }

  private normalizeSlug(value: string): string {
    const normalized = this.normalizeRequiredValue(value, "slug")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!normalized) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Site slug must contain at least one letter or number",
      });
    }

    return normalized;
  }

  private async resolvePublicSubdomain(
    requestedValue: string | undefined,
    fallbackSlug: string,
  ): Promise<string> {
    const explicitValue = this.normalizeOptionalValue(requestedValue);
    const baseValue = explicitValue ?? fallbackSlug;
    let normalized = this.normalizePublicSubdomain(baseValue);

    if (RESERVED_PUBLIC_SUBDOMAINS.has(normalized)) {
      if (explicitValue) {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "This public subdomain is reserved",
        });
      }

      normalized = this.normalizePublicSubdomain(`${normalized}-site`);
    }

    if (explicitValue) {
      const existing = await this.prisma.site.findUnique({
        where: { publicSubdomain: normalized },
        select: { id: true },
      });

      if (existing) {
        throw new ConflictException({
          code: "CONFLICT",
          message: "This public subdomain is already taken.",
        });
      }

      return normalized;
    }

    return this.reserveGeneratedPublicSubdomain(normalized);
  }

  private async reserveGeneratedPublicSubdomain(
    baseValue: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const candidate = buildPublicSubdomainCandidate(baseValue, attempt);
      const existing = await this.prisma.site.findUnique({
        where: { publicSubdomain: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictException({
      code: "CONFLICT",
      message: "Unable to reserve a public subdomain for this site.",
    });
  }

  private normalizePublicSubdomain(value: string): string {
    const normalized = normalizePublicSubdomainLabel(
      this.normalizeRequiredValue(value, "publicSubdomain"),
    );

    if (!normalized) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Public subdomain must contain at least one letter or number",
      });
    }

    return normalized;
  }

  private normalizeLocales(
    values: string[] | undefined,
    primaryLocale: string,
  ): string[] {
    const normalizedLocales = Array.from(
      new Set(
        (values ?? [primaryLocale])
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );

    if (!normalizedLocales.includes(primaryLocale)) {
      normalizedLocales.unshift(primaryLocale);
    }

    if (normalizedLocales.length === 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "At least one locale must be configured for the site",
      });
    }

    return normalizedLocales;
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

  private describeSiteType(siteType: SiteType): string {
    switch (siteType) {
      case SiteType.VACATION_RENTAL:
        return "vacation rental";
      case SiteType.BOUTIQUE_HOTEL:
        return "boutique hotel";
      case SiteType.BNB:
        return "bed and breakfast";
      case SiteType.GLAMPING:
        return "glamping";
      case SiteType.GUEST_HOUSE:
        return "guest house";
      default:
        return "hospitality";
    }
  }

  private buildArchivedSlug(slug: string, siteId: string): string {
    return `${slug}-archived-${siteId.slice(-8)}`;
  }

  private collectSiteHostnames(site: {
    publicSubdomain: string | null;
    domains: { host: string }[];
  }): string[] {
    const hosts: string[] = [];
    const platformRootDomain = getConfiguredPlatformRootDomain(
      this.configService,
    );

    if (
      site.publicSubdomain &&
      isUsablePlatformRootDomain(platformRootDomain)
    ) {
      hosts.push(`${site.publicSubdomain}.${platformRootDomain}`);
    }

    for (const domain of site.domains) {
      hosts.push(domain.host, companionHost(domain.host));
    }

    return Array.from(new Set(hosts.map(normalizeHostname).filter(Boolean)));
  }

  private async bustHostCache(hosts: string[]): Promise<void> {
    if (!this.publicRuntimeCacheService || hosts.length === 0) {
      return;
    }

    try {
      await this.publicRuntimeCacheService.deleteKeys(
        hosts.map((host) => `runtime:host:${host}`),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to bust runtime host cache after site deletion: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private normalizeRequiredValue(value: string, fieldName: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: `${fieldName} is required`,
      });
    }

    return normalized;
  }

  private normalizeOptionalValue(value: string | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private rethrowSiteConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const rawTarget = error.meta?.target;
      const targets = Array.isArray(rawTarget)
        ? rawTarget.map((value) => String(value))
        : [String(rawTarget ?? "")];

      throw new ConflictException({
        code: "CONFLICT",
        message: targets.some((target) =>
          ["public_subdomain", "publicSubdomain"].includes(target),
        )
          ? "This public subdomain is already taken."
          : "A site with this slug already exists in the active workspace.",
      });
    }
  }
}
