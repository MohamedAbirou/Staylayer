import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainStatus, HostVariant, Prisma } from "@prisma/client";
import { BillingService } from "../billing/billing.service";
import { PrismaService } from "../prisma/prisma.service";
import { PublicRuntimeCacheService } from "../public-runtime/public-runtime.cache.service";
import {
  classifyHostname,
  companionHost as deriveCompanionHost,
  normalizeHostname,
} from "../public-runtime/public-runtime.util";
import {
  getConfiguredPlatformRootDomain,
  getPlatformRootDomainIssue,
  isUsablePlatformRootDomain,
} from "../public-runtime/platform-root-domain";
import { RevalidationService } from "../revalidation/revalidation.service";
import { DomainVerificationService } from "./domain-verification.service";

const MAX_DOMAINS_PER_SITE = 10;

type DomainWithSite = Prisma.DomainGetPayload<{
  include: { site: { include: { tenant: { select: { name: true } } } } };
}>;

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly billingService: BillingService,
    private readonly domainVerificationService: DomainVerificationService,
    private readonly cacheService: PublicRuntimeCacheService,
    private readonly revalidationService: RevalidationService,
  ) {}

  // ─── Customer ────────────────────────────────────────────────────────────────

  async getRuntimeProfile(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        publicSubdomain: true,
        preferredHostVariant: true,
        publishedRevision: true,
      },
    });

    if (!site) {
      throw new NotFoundException({
        code: "SITE_NOT_FOUND",
        message: "Site not found",
      });
    }

    const platformRootDomain = getConfiguredPlatformRootDomain(
      this.configService,
    );
    const usablePlatformRootDomain = isUsablePlatformRootDomain(
      platformRootDomain,
    )
      ? platformRootDomain
      : null;
    const websiteProjectId =
      this.domainVerificationService.getConfiguredWebsiteProjectId();
    const websiteProjectTarget =
      this.domainVerificationService.getConfiguredWebsiteExpectedTarget();
    const defaultHostname =
      site.publicSubdomain && usablePlatformRootDomain
        ? `${site.publicSubdomain}.${usablePlatformRootDomain}`
        : null;

    const latestLivePublish = await this.prisma.deployment.findFirst({
      where: { siteId, status: "LIVE" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, updatedAt: true, metadata: true },
    });

    const latestMetadata =
      latestLivePublish &&
      latestLivePublish.metadata &&
      typeof latestLivePublish.metadata === "object" &&
      !Array.isArray(latestLivePublish.metadata)
        ? (latestLivePublish.metadata as Record<string, unknown>)
        : null;
    const lastPublishedAt =
      latestMetadata && typeof latestMetadata.publishedAt === "string"
        ? latestMetadata.publishedAt
        : (latestLivePublish?.updatedAt.toISOString() ?? null);
    const lastPublishedDeploymentId = latestLivePublish?.id ?? null;

    return {
      siteId: site.id,
      publicSubdomain: site.publicSubdomain,
      preferredHostVariant: site.preferredHostVariant,
      platformRootDomain,
      defaultHostname,
      defaultHostnameIssue: defaultHostname
        ? null
        : getPlatformRootDomainIssue(platformRootDomain),
      websiteProjectId,
      websiteProjectTarget,
      sharedRuntimeReady: Boolean(
        usablePlatformRootDomain && websiteProjectId && websiteProjectTarget,
      ),
      publishedRevision: site.publishedRevision,
      lastPublishedAt,
      lastPublishedDeploymentId,
    };
  }

  async setPreferredHostVariant(siteId: string, variant: HostVariant) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: { id: true, preferredHostVariant: true },
    });

    if (!site) {
      throw new NotFoundException({
        code: "SITE_NOT_FOUND",
        message: "Site not found",
      });
    }

    if (site.preferredHostVariant !== variant) {
      await this.prisma.site.update({
        where: { id: siteId },
        data: { preferredHostVariant: variant },
      });
    }

    await this.bustHostCache(siteId);

    try {
      await this.revalidationService.revalidateSite(siteId, { paths: ["/"] });
    } catch (error) {
      this.logger.warn(
        `Failed to revalidate runtime after canonical change for site ${siteId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return this.getRuntimeProfile(siteId);
  }

  async addCompanionForDomain(siteId: string, domainId: string) {
    const domain = await this.prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain || domain.siteId !== siteId) {
      throw new NotFoundException({
        code: "DOMAIN_NOT_FOUND",
        message: "Domain not found in this site",
      });
    }

    const platformRootDomain = this.getUsablePlatformRootDomain();
    const classification = classifyHostname(domain.host, platformRootDomain);

    if (!classification.companionHost) {
      throw new BadRequestException({
        code: "COMPANION_UNAVAILABLE",
        message:
          "This hostname does not have an apex/www companion (subdomains and platform hostnames are not eligible).",
      });
    }

    return this.add(siteId, classification.companionHost, {
      skipCompanionAlreadyPresent: true,
    });
  }

  async listForSite(siteId: string) {
    const rows = await this.prisma.domain.findMany({
      where: { siteId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    const platformRootDomain = this.getUsablePlatformRootDomain();
    const hostIndex = new Map(rows.map((row) => [row.host, row.id] as const));

    return rows.map((row) =>
      this.toCustomerDto(row, { platformRootDomain, hostIndex }),
    );
  }

  async add(
    siteId: string,
    hostname: string,
    options: { skipCompanionAlreadyPresent?: boolean } = {},
  ) {
    const normalized = normalizeHostname(hostname);

    const existing = await this.prisma.domain.findUnique({
      where: { host: normalized },
    });
    if (existing) {
      throw new ConflictException({
        code: "DOMAIN_TAKEN",
        message: "This hostname is already connected to a site",
      });
    }

    const companion = deriveCompanionHost(normalized);
    const companionRow = companion
      ? await this.prisma.domain.findFirst({
          where: { siteId, host: companion },
          select: { id: true },
        })
      : null;

    const isFreeCompanion = Boolean(companionRow);

    if (!isFreeCompanion) {
      await this.billingService.assertCanAddDomain(siteId);
    }

    const count = await this.prisma.domain.count({ where: { siteId } });
    if (count >= MAX_DOMAINS_PER_SITE) {
      throw new BadRequestException({
        code: "DOMAIN_LIMIT",
        message: `A site may have at most ${MAX_DOMAINS_PER_SITE} domains`,
      });
    }

    const isPrimary = count === 0;

    const domain = await this.prisma.domain.create({
      data: {
        siteId,
        host: normalized,
        status: DomainStatus.PENDING,
        isPrimary,
        verificationRequestedAt: new Date(),
      },
    });

    void this.domainVerificationService.requestVerification(
      domain.id,
      "created",
    );

    // Bust host cache so resolve-host immediately reflects the new pair.
    await this.bustHostCacheForHosts([
      normalized,
      ...(companion ? [companion] : []),
    ]);

    if (options.skipCompanionAlreadyPresent && companionRow) {
      this.logger.log(
        `Added companion ${normalized} to site ${siteId} alongside existing ${companion}`,
      );
    }

    return this.toCustomerDto(domain, {
      platformRootDomain: this.getUsablePlatformRootDomain(),
    });
  }

  async setPrimary(siteId: string, domainId: string) {
    const domain = await this.prisma.domain.findUnique({
      where: { id: domainId },
    });
    if (!domain || domain.siteId !== siteId) {
      throw new NotFoundException({
        code: "DOMAIN_NOT_FOUND",
        message: "Domain not found in this site",
      });
    }

    await this.prisma.$transaction([
      this.prisma.domain.updateMany({
        where: { siteId, isPrimary: true },
        data: { isPrimary: false },
      }),
      this.prisma.domain.update({
        where: { id: domainId },
        data: { isPrimary: true },
      }),
    ]);

    const updated = await this.prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });
    void this.domainVerificationService.requestVerification(
      updated.id,
      "manual",
    );
    await this.bustHostCache(siteId);
    return this.toCustomerDto(updated, {
      platformRootDomain: this.getUsablePlatformRootDomain(),
    });
  }

  async retryForSite(siteId: string, domainId: string) {
    const domain = await this.prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain || domain.siteId !== siteId) {
      throw new NotFoundException({
        code: "DOMAIN_NOT_FOUND",
        message: "Domain not found in this site",
      });
    }

    await this.domainVerificationService.requestVerification(
      domainId,
      "manual",
    );

    const refreshed = await this.prisma.domain.findUniqueOrThrow({
      where: { id: domainId },
    });

    return this.toCustomerDto(refreshed, {
      platformRootDomain: this.getUsablePlatformRootDomain(),
    });
  }

  async remove(siteId: string, domainId: string) {
    const domain = await this.prisma.domain.findUnique({
      where: { id: domainId },
    });
    if (!domain || domain.siteId !== siteId) {
      throw new NotFoundException({
        code: "DOMAIN_NOT_FOUND",
        message: "Domain not found in this site",
      });
    }
    await this.prisma.domain.delete({ where: { id: domainId } });
    await this.bustHostCacheForHosts([
      domain.host,
      deriveCompanionHost(domain.host),
    ]);
  }

  // ─── Admin ────────────────────────────────────────────────────────────────────

  async adminList(params: {
    statuses?: DomainStatus[];
    page?: number;
    limit?: number;
  }) {
    const { statuses, page = 1, limit = 50 } = params;
    const where: Prisma.DomainWhereInput =
      statuses && statuses.length > 0
        ? {
            status: statuses.length === 1 ? statuses[0] : { in: statuses },
          }
        : {};

    const [rows, total] = await Promise.all([
      this.prisma.domain.findMany({
        where,
        include: {
          site: {
            select: {
              name: true,
              tenant: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.domain.count({ where }),
    ]);

    return {
      data: rows.map((r) => this.toAdminDto(r as DomainWithSite)),
      total,
    };
  }

  async adminRetryVerification(domainId: string) {
    const domain = await this.prisma.domain.findUnique({
      where: { id: domainId },
      include: {
        site: {
          select: {
            name: true,
            tenant: { select: { name: true } },
          },
        },
      },
    });
    if (!domain) {
      throw new NotFoundException({
        code: "DOMAIN_NOT_FOUND",
        message: "Domain not found",
      });
    }
    if (domain.status === DomainStatus.ACTIVE) {
      throw new BadRequestException({
        code: "DOMAIN_ALREADY_ACTIVE",
        message: "Domain is already active and does not need re-verification",
      });
    }

    await this.domainVerificationService.requestVerification(
      domainId,
      "manual",
    );

    return this.getAdminDomainOrThrow(domainId);
  }

  private async getAdminDomainOrThrow(domainId: string) {
    const domain = await this.prisma.domain.findUnique({
      where: { id: domainId },
      include: {
        site: {
          select: {
            name: true,
            tenant: { select: { name: true } },
          },
        },
      },
    });

    if (!domain) {
      throw new NotFoundException({
        code: "DOMAIN_NOT_FOUND",
        message: "Domain not found",
      });
    }

    return this.toAdminDto(domain as DomainWithSite);
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private toCustomerDto(
    domain: {
      id: string;
      host: string;
      status: DomainStatus;
      isPrimary: boolean;
      lastCheckedAt?: Date | null;
      lastError?: string | null;
      verificationDetails?: Prisma.JsonValue | null;
      createdAt: Date;
    },
    context: {
      platformRootDomain?: string | null;
      hostIndex?: Map<string, string>;
    } = {},
  ) {
    const details = this.parseVerificationDetails(domain.verificationDetails);
    const classification = classifyHostname(
      domain.host,
      context.platformRootDomain ?? null,
    );
    const companionHost = classification.companionHost;
    const companionDomainId =
      companionHost && context.hostIndex
        ? (context.hostIndex.get(companionHost) ?? null)
        : null;

    return {
      id: domain.id,
      hostname: domain.host,
      status: domain.status,
      verificationStatus: this.mapCustomerStatus(domain.status),
      isPrimary: domain.isPrimary,
      kind: classification.kind,
      apexHost: classification.apexHost,
      companionHost,
      companionDomainId,
      dnsTarget: details.recommendedRecords[0]?.value ?? details.expectedTarget,
      dnsConfigured: details.dnsConfigured,
      dnsMatchesExpected: details.dnsMatchesExpected,
      providerAttachmentStatus: details.providerAttachmentStatus,
      providerVerificationStatus: details.providerVerificationStatus,
      providerAttached: details.providerAttached,
      providerVerified: details.providerVerified,
      providerError: details.providerError,
      providerConfiguredBy: details.providerConfiguredBy,
      providerMisconfigured: details.providerMisconfigured,
      providerAcceptedChallenges: details.providerAcceptedChallenges,
      recommendedRecords: details.recommendedRecords,
      observedCname: details.observedCname,
      observedAddresses: details.observedAddresses,
      sslStatus: details.sslStatus,
      sslActive: details.sslActive,
      nextAction: this.getCustomerNextAction(domain.status),
      lastCheckedAt: domain.lastCheckedAt?.toISOString() ?? null,
      lastError: domain.lastError ?? null,
      createdAt: domain.createdAt.toISOString(),
    };
  }

  private toAdminDto(domain: DomainWithSite) {
    const details = this.parseVerificationDetails(domain.verificationDetails);

    return {
      id: domain.id,
      domain: domain.host,
      siteId: domain.siteId,
      siteName: domain.site.name,
      tenantName: domain.site.tenant.name,
      status: domain.status,
      isPrimary: domain.isPrimary,
      verificationStatus: this.mapAdminStatus(domain.status),
      dnsConfigured: details.dnsConfigured,
      dnsMatchesExpected: details.dnsMatchesExpected,
      sslActive: details.sslActive || domain.status === DomainStatus.ACTIVE,
      expectedTarget: details.expectedTarget,
      providerAttachmentStatus: details.providerAttachmentStatus,
      providerVerificationStatus: details.providerVerificationStatus,
      providerAttached: details.providerAttached,
      providerVerified: details.providerVerified,
      providerError: details.providerError,
      providerConfiguredBy: details.providerConfiguredBy,
      providerMisconfigured: details.providerMisconfigured,
      providerAcceptedChallenges: details.providerAcceptedChallenges,
      recommendedRecords: details.recommendedRecords,
      observedCname: details.observedCname,
      observedAddresses: details.observedAddresses,
      sslStatus: details.sslStatus,
      nextAction: this.getCustomerNextAction(domain.status),
      lastError: domain.lastError ?? details.sslError,
      lastCheckedAt: domain.lastCheckedAt?.toISOString() ?? null,
      verifiedAt: domain.verifiedAt?.toISOString() ?? null,
    };
  }

  private parseVerificationDetails(value: Prisma.JsonValue | null | undefined) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {
        expectedTarget: null,
        providerAttachmentStatus: null,
        providerVerificationStatus: null,
        providerAttached: false,
        providerVerified: false,
        providerError: null,
        providerConfiguredBy: null,
        providerMisconfigured: null,
        providerAcceptedChallenges: [] as string[],
        recommendedRecords: [] as Array<{
          type: string;
          name: string;
          host: string;
          value: string;
          acceptedValues: string[];
          rank: number | null;
          isMatch: boolean | null;
        }>,
        observedCname: null,
        observedAddresses: [] as string[],
        dnsConfigured: false,
        dnsMatchesExpected: null as boolean | null,
        sslStatus: null,
        sslActive: false,
        sslError: null as string | null,
      };
    }

    const details = value as Record<string, unknown>;

    return {
      expectedTarget:
        typeof details.expectedTarget === "string"
          ? details.expectedTarget
          : null,
      providerAttachmentStatus:
        typeof details.providerAttachmentStatus === "string"
          ? details.providerAttachmentStatus
          : null,
      providerVerificationStatus:
        typeof details.providerVerificationStatus === "string"
          ? details.providerVerificationStatus
          : null,
      providerAttached:
        typeof details.providerAttached === "boolean"
          ? details.providerAttached
          : false,
      providerVerified:
        typeof details.providerVerified === "boolean"
          ? details.providerVerified
          : false,
      providerError:
        typeof details.providerError === "string"
          ? details.providerError
          : null,
      providerConfiguredBy:
        typeof details.providerConfiguredBy === "string"
          ? details.providerConfiguredBy
          : null,
      providerMisconfigured:
        typeof details.providerMisconfigured === "boolean"
          ? details.providerMisconfigured
          : null,
      providerAcceptedChallenges: Array.isArray(
        details.providerAcceptedChallenges,
      )
        ? details.providerAcceptedChallenges.filter(
            (entry): entry is string => typeof entry === "string",
          )
        : [],
      recommendedRecords: Array.isArray(details.recommendedRecords)
        ? details.recommendedRecords
            .filter(
              (entry): entry is Record<string, unknown> =>
                !!entry && typeof entry === "object" && !Array.isArray(entry),
            )
            .flatMap((entry) => {
              const type = typeof entry.type === "string" ? entry.type : null;
              const name = typeof entry.name === "string" ? entry.name : null;
              const host = typeof entry.host === "string" ? entry.host : null;
              const value =
                typeof entry.value === "string" ? entry.value : null;

              if (!type || !name || !host || !value) {
                return [];
              }

              return [
                {
                  type,
                  name,
                  host,
                  value,
                  acceptedValues: Array.isArray(entry.acceptedValues)
                    ? entry.acceptedValues.filter(
                        (value): value is string => typeof value === "string",
                      )
                    : [],
                  rank: typeof entry.rank === "number" ? entry.rank : null,
                  isMatch:
                    typeof entry.isMatch === "boolean" ? entry.isMatch : null,
                },
              ];
            })
        : [],
      observedCname:
        typeof details.observedCname === "string"
          ? details.observedCname
          : null,
      observedAddresses: Array.isArray(details.observedAddresses)
        ? details.observedAddresses.filter(
            (entry): entry is string => typeof entry === "string",
          )
        : [],
      dnsConfigured: Boolean(details.dnsConfigured),
      dnsMatchesExpected:
        typeof details.dnsMatchesExpected === "boolean"
          ? details.dnsMatchesExpected
          : null,
      sslStatus:
        typeof details.sslStatus === "string" ? details.sslStatus : null,
      sslActive: Boolean(details.sslActive),
      sslError: typeof details.sslError === "string" ? details.sslError : null,
    };
  }

  private mapCustomerStatus(
    status: DomainStatus,
  ):
    | "pending"
    | "dns_required"
    | "provider_attach_pending"
    | "ssl_provisioning"
    | "active"
    | "failed" {
    if (status === DomainStatus.ACTIVE) return "active";
    if (status === DomainStatus.DNS_REQUIRED) return "dns_required";
    if (status === DomainStatus.PROVIDER_ATTACH_PENDING) {
      return "provider_attach_pending";
    }
    if (status === DomainStatus.SSL_PROVISIONING) return "ssl_provisioning";
    if (status === DomainStatus.FAILED) return "failed";
    return "pending";
  }

  private mapAdminStatus(
    status: DomainStatus,
  ): "UNVERIFIED" | "PENDING" | "VERIFIED" | "FAILED" {
    if (status === DomainStatus.ACTIVE) return "VERIFIED";
    if (status === DomainStatus.FAILED) return "FAILED";
    if (status === DomainStatus.PENDING) return "UNVERIFIED";
    return "PENDING";
  }

  private getCustomerNextAction(status: DomainStatus): string {
    if (status === DomainStatus.DNS_REQUIRED) {
      return "Update your DNS records to point at the deployment target.";
    }

    if (status === DomainStatus.PROVIDER_ATTACH_PENDING) {
      return "Wait for the deployment provider to finish attaching the domain, then retry if it stalls.";
    }

    if (status === DomainStatus.SSL_PROVISIONING) {
      return "Wait for SSL issuance to complete before sending production traffic.";
    }

    if (status === DomainStatus.FAILED) {
      return "Review the error and retry verification after correcting the provider or DNS issue.";
    }

    if (status === DomainStatus.ACTIVE) {
      return "Domain is ready for production traffic.";
    }

    return "Complete provider attachment and DNS setup, then recheck verification.";
  }

  private getUsablePlatformRootDomain(): string | null {
    const platformRootDomain = getConfiguredPlatformRootDomain(
      this.configService,
    );

    return isUsablePlatformRootDomain(platformRootDomain)
      ? platformRootDomain
      : null;
  }

  private async bustHostCacheForHosts(hosts: string[]): Promise<void> {
    const unique = Array.from(
      new Set(hosts.map((h) => normalizeHostname(h)).filter(Boolean)),
    );
    if (unique.length === 0) {
      return;
    }
    try {
      await this.cacheService.deleteKeys(
        unique.map((h) => `runtime:host:${h}`),
      );
    } catch (error) {
      this.logger.warn(
        `Failed to bust runtime host cache for ${unique.join(", ")}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async bustHostCache(siteId: string): Promise<void> {
    const platformRootDomain = this.getUsablePlatformRootDomain();

    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        publicSubdomain: true,
        domains: { select: { host: true } },
      },
    });

    if (!site) {
      return;
    }

    const hosts: string[] = [];
    if (site.publicSubdomain && platformRootDomain) {
      hosts.push(`${site.publicSubdomain}.${platformRootDomain}`);
    }
    for (const d of site.domains) {
      hosts.push(d.host);
      const companion = deriveCompanionHost(d.host);
      if (companion) {
        hosts.push(companion);
      }
    }

    await this.bustHostCacheForHosts(hosts);
  }
}
