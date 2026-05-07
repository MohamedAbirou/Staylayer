import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  Role,
  SiteStatus,
  SiteType,
  TenantMembershipRole,
} from "@prisma/client";
import { BillingService } from "../billing/billing.service";
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

@Injectable()
export class TenantWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
    private readonly usersService: UsersService,
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

  async createSite(
    tenantId: string,
    dto: CreateSiteDto,
  ): Promise<TenantSiteSummary> {
    const name = this.normalizeRequiredValue(dto.name, "name");
    const slug = this.normalizeSlug(dto.slug ?? name);
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

      return this.serializeSite(site);
    } catch (error) {
      this.rethrowSiteConflict(error);
      throw error;
    }
  }

  async inviteMember(
    tenantId: string,
    dto: InviteTenantMemberDto,
  ): Promise<TenantMemberSummary> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message:
          "No account exists for this email. Create the member account before inviting it to the workspace.",
      });
    }

    return this.addMembership(tenantId, user.id, dto.role);
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

    await this.billingService.assertCanAddSeat(tenantId);

    const passwordHash = await this.usersService.hashPassword(dto.password);
    const membership = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          platformRole: null,
          role: Role.EDITOR,
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

    return this.serializeMember(membership);
  }

  private async addMembership(
    tenantId: string,
    userId: string,
    role: TenantMembershipRole,
  ): Promise<TenantMemberSummary> {
    const existingMembership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId,
          userId,
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

    await this.billingService.assertCanAddSeat(tenantId);

    const existingMembershipCount = await this.prisma.tenantMembership.count({
      where: { userId },
    });

    const membership = await this.prisma.tenantMembership.create({
      data: {
        tenantId,
        userId,
        role,
        isDefault: existingMembershipCount === 0,
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

    return this.serializeMember(membership);
  }

  private serializeSite(site: {
    id: string;
    tenantId: string;
    name: string;
    slug: string;
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
      throw new ConflictException({
        code: "CONFLICT",
        message:
          "A site with this slug already exists in the active workspace.",
      });
    }
  }
}
