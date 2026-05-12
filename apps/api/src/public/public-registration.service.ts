import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import {
  OnboardingMilestoneKey,
  Prisma,
  SiteStatus,
  SiteType,
  TenantMembershipRole,
} from "@prisma/client";
import { BILLING_DEFAULT_PLAN_KEY } from "../billing/billing-plans";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { RegisterCustomerDto } from "./dto/register-customer.dto";
import {
  PublicLegalDocumentSummary,
  getRequiredSignupLegalDocuments,
} from "./legal-documents.registry";

const SUPPORTED_PUBLIC_LOCALES = new Set(["en", "es", "fr", "de"]);

export interface AcceptedLegalDocumentRecord {
  documentKey: string;
  title: string;
  version: string;
  effectiveAt: string;
}

export interface PublicRegistrationResult {
  userId: string;
  email: string;
  tenantId: string;
  siteId: string;
  provisionedPlanKey: typeof BILLING_DEFAULT_PLAN_KEY;
  acceptedLegalDocuments: AcceptedLegalDocumentRecord[];
}

@Injectable()
export class PublicRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async registerCustomer(
    dto: RegisterCustomerDto,
  ): Promise<PublicRegistrationResult> {
    const registrantName = this.normalizeRequiredValue(dto.name, "name");
    const companyName = this.normalizeRequiredValue(
      dto.companyName,
      "companyName",
    );
    const propertyName = this.normalizeRequiredValue(
      dto.propertyName,
      "propertyName",
    );
    const email = this.normalizeEmail(dto.workEmail);
    const primaryLocale = this.normalizeLocale(dto.primaryLocale);
    const acceptedLegalDocuments = this.resolveAcceptedLegalDocuments(
      dto.legalAcceptances,
    );

    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "A customer account with this email already exists",
      });
    }

    const passwordHash = await this.usersService.hashPassword(dto.password);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const tenantSlug = await this.generateUniqueTenantSlug(companyName);
      const siteSlug = this.normalizeSlug(propertyName, "propertyName");
      const templateKey = this.resolveTemplateKey(dto.hospitalityType);

      try {
        return await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email,
              passwordHash,
              platformRole: null,
            },
            select: {
              id: true,
              email: true,
            },
          });

          const tenant = await tx.tenant.create({
            data: {
              slug: tenantSlug,
              name: companyName,
            },
            select: {
              id: true,
            },
          });

          await tx.tenantMembership.create({
            data: {
              tenantId: tenant.id,
              userId: user.id,
              role: TenantMembershipRole.OWNER,
              isDefault: true,
            },
          });

          const site = await tx.site.create({
            data: {
              tenantId: tenant.id,
              name: propertyName,
              slug: siteSlug,
              status: SiteStatus.ACTIVE,
              templateKey,
              primaryLocale,
              enabledLocales: [primaryLocale],
              siteType: dto.hospitalityType,
            },
            select: {
              id: true,
            },
          });

          await tx.siteSettings.create({
            data: {
              siteId: site.id,
              siteName: propertyName,
              supportEmail: email,
              defaultInquiryRoutingEmail: email,
              primaryCtaLabel: this.resolvePrimaryCtaLabel(dto.hospitalityType),
              defaultLocale: primaryLocale,
              activeLocales: [primaryLocale],
              updatedBy: user.id,
            },
          });

          const onboarding = await tx.tenantOnboarding.create({
            data: {
              tenantId: tenant.id,
            },
            select: {
              id: true,
            },
          });

          await tx.tenantOnboardingMilestone.create({
            data: {
              onboardingId: onboarding.id,
              milestone: OnboardingMilestoneKey.SITE_CREATED,
              metadata: {
                source: "public_signup",
                siteId: site.id,
              } as Prisma.InputJsonValue,
            },
          });

          await tx.auditLog.create({
            data: {
              tenantId: tenant.id,
              actorUserId: user.id,
              action: "legal.accepted_at_signup",
              targetType: "legal_documents",
              targetId: tenant.id,
              metadata: {
                acceptedLegalDocuments,
                acceptanceSource: "public_signup",
              } as unknown as Prisma.InputJsonValue,
            },
          });

          await tx.auditLog.create({
            data: {
              tenantId: tenant.id,
              siteId: site.id,
              actorUserId: user.id,
              action: "public_registration.provisioned",
              targetType: "tenant",
              targetId: tenant.id,
              metadata: {
                registrantName,
                companyName,
                propertyName,
                hospitalityType: dto.hospitalityType,
                primaryLocale,
                provisionedPlanKey: BILLING_DEFAULT_PLAN_KEY,
                templateKey,
              } as Prisma.InputJsonValue,
            },
          });

          return {
            userId: user.id,
            email: user.email,
            tenantId: tenant.id,
            siteId: site.id,
            provisionedPlanKey: BILLING_DEFAULT_PLAN_KEY,
            acceptedLegalDocuments,
          };
        });
      } catch (error) {
        if (this.isTenantSlugConflict(error)) {
          continue;
        }

        if (this.isUserEmailConflict(error)) {
          throw new ConflictException({
            code: "CONFLICT",
            message: "A customer account with this email already exists",
          });
        }

        throw error;
      }
    }

    throw new ConflictException({
      code: "CONFLICT",
      message:
        "Unable to reserve a unique workspace slug for this company name",
    });
  }

  private resolveAcceptedLegalDocuments(
    acceptances: Array<{ documentKey: string; version: string }>,
  ): AcceptedLegalDocumentRecord[] {
    const requiredDocuments = getRequiredSignupLegalDocuments();
    const providedMap = new Map(
      acceptances.map((acceptance) => [
        this.normalizeRequiredValue(acceptance.documentKey, "documentKey"),
        this.normalizeRequiredValue(acceptance.version, "version"),
      ]),
    );

    return requiredDocuments.map((document) => {
      const providedVersion = providedMap.get(document.key);
      if (!providedVersion) {
        throw new BadRequestException({
          code: "LEGAL_ACCEPTANCE_REQUIRED",
          message: `Acceptance is required for ${document.title}`,
          documentKey: document.key,
        });
      }

      if (providedVersion !== document.version) {
        throw new BadRequestException({
          code: "LEGAL_VERSION_MISMATCH",
          message: `Acceptance version is stale for ${document.title}`,
          documentKey: document.key,
          expectedVersion: document.version,
          providedVersion,
        });
      }

      return this.serializeAcceptedDocument(document);
    });
  }

  private serializeAcceptedDocument(
    document: PublicLegalDocumentSummary,
  ): AcceptedLegalDocumentRecord {
    return {
      documentKey: document.key,
      title: document.title,
      version: document.version,
      effectiveAt: document.effectiveAt,
    };
  }

  private async generateUniqueTenantSlug(companyName: string): Promise<string> {
    const baseSlug = this.normalizeSlug(companyName, "companyName");

    for (let suffix = 1; suffix <= 20; suffix += 1) {
      const candidate = suffix === 1 ? baseSlug : `${baseSlug}-${suffix}`;
      const existing = await this.prisma.tenant.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new ConflictException({
      code: "CONFLICT",
      message: "Could not find an available tenant slug",
    });
  }

  private normalizeEmail(value: string): string {
    return this.normalizeRequiredValue(value, "workEmail").toLowerCase();
  }

  private normalizeLocale(value: string): string {
    const locale = this.normalizeRequiredValue(
      value,
      "primaryLocale",
    ).toLowerCase();

    if (!SUPPORTED_PUBLIC_LOCALES.has(locale)) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: `Unsupported primary locale '${locale}'`,
      });
    }

    return locale;
  }

  private normalizeSlug(value: string, fieldName: string): string {
    const normalized = this.normalizeRequiredValue(value, fieldName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");

    if (!normalized) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: `${fieldName} must contain at least one letter or number`,
      });
    }

    return normalized;
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

  private resolveTemplateKey(siteType: SiteType): string | null {
    switch (siteType) {
      case SiteType.VACATION_RENTAL:
        return "vacation-rental-signature";
      case SiteType.GLAMPING:
        return "glamping-retreat";
      default:
        return null;
    }
  }

  private resolvePrimaryCtaLabel(siteType: SiteType): string {
    switch (siteType) {
      case SiteType.GLAMPING:
        return "Check availability";
      default:
        return "Send inquiry";
    }
  }

  private isTenantSlugConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      Array.isArray(error.meta?.target) &&
      error.meta?.target.includes("slug")
    );
  }

  private isUserEmailConflict(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      Array.isArray(error.meta?.target) &&
      error.meta?.target.includes("email")
    );
  }
}
