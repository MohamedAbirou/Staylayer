import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly usersService: UsersService,
    private readonly customerAccessService: CustomerAccessService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listSites(tenantId: string): Promise<TenantSiteSummary[]> {
    const sites = await this.prisma.site.findMany({
      where: { tenantId },
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
