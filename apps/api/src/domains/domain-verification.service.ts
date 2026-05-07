import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeploymentStatus,
  DomainStatus,
  OperationalAlertSeverity,
  OperationalAlertStatus,
  OperationalAlertType,
  Prisma,
} from "@prisma/client";
import { promises as dns } from "node:dns";
import {
  DEPLOYMENT_PROVIDER,
  DeploymentProvider,
} from "../deployments/deployment-provider.port";
import { PrismaService } from "../prisma/prisma.service";

type VerificationTrigger = "created" | "manual" | "scheduled";

type VerifiableDomain = {
  id: string;
  siteId: string;
  host: string;
  status: DomainStatus;
  createdAt: Date;
  verificationRequestedAt: Date | null;
  verifiedAt: Date | null;
  site: {
    deployments: Array<{
      providerProjectId: string | null;
      url: string | null;
    }>;
  };
};

interface DomainVerificationDetails {
  checkedAt: string;
  trigger: VerificationTrigger;
  providerProjectId: string | null;
  expectedTarget: string | null;
  providerAttachmentStatus: string | null;
  providerVerificationStatus: string | null;
  providerAttached: boolean;
  providerVerified: boolean;
  observedCname: string | null;
  observedAddresses: string[];
  dnsConfigured: boolean;
  dnsMatchesExpected: boolean | null;
  sslStatus: string | null;
  sslActive: boolean;
  httpStatus: number | null;
  providerError: string | null;
  sslError: string | null;
}

const DEFAULT_PENDING_RECHECK_MS = 5 * 60_000;
const DEFAULT_ACTIVE_RECHECK_MS = 60 * 60_000;
const DEFAULT_SSL_GRACE_MS = 30 * 60_000;
const DEFAULT_HTTP_TIMEOUT_MS = 5_000;
const DEFAULT_BATCH_SIZE = 25;

@Injectable()
export class DomainVerificationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DomainVerificationService.name);
  private timer: NodeJS.Timeout | null = null;
  private batchRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(DEPLOYMENT_PROVIDER)
    private readonly deploymentProvider: DeploymentProvider,
  ) {}

  onModuleInit() {
    if (!this.isEnabled()) {
      return;
    }

    this.timer = setInterval(() => {
      this.runScheduledBatch();
    }, this.getPendingRecheckMs());
    this.timer.unref?.();

    queueMicrotask(() => {
      this.runScheduledBatch();
    });
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async requestVerification(
    domainId: string,
    trigger: Exclude<VerificationTrigger, "scheduled">,
  ): Promise<void> {
    await this.prisma.domain.update({
      where: { id: domainId },
      data: {
        status: DomainStatus.VERIFYING,
        verificationRequestedAt: new Date(),
        lastError: null,
      },
    });

    await this.verifyDomain(domainId, trigger);
  }

  async verifyDomain(
    domainId: string,
    trigger: VerificationTrigger,
  ): Promise<void> {
    const domain = await this.prisma.domain.findUnique({
      where: { id: domainId },
      include: {
        site: {
          select: {
            deployments: {
              where: {
                status: DeploymentStatus.LIVE,
                url: { not: null },
              },
              orderBy: { updatedAt: "desc" },
              take: 1,
              select: { providerProjectId: true, url: true },
            },
          },
        },
      },
    });

    if (!domain) {
      return;
    }

    const now = new Date();
    const latestDeployment = domain.site.deployments[0] ?? null;
    const providerProjectId = latestDeployment?.providerProjectId ?? null;
    const expectedTarget = this.extractHostname(latestDeployment?.url ?? null);

    const details: DomainVerificationDetails = {
      checkedAt: now.toISOString(),
      trigger,
      providerProjectId,
      expectedTarget,
      providerAttachmentStatus: null,
      providerVerificationStatus: null,
      providerAttached: false,
      providerVerified: false,
      observedCname: null,
      observedAddresses: [],
      dnsConfigured: false,
      dnsMatchesExpected: expectedTarget ? false : null,
      sslStatus: null,
      sslActive: false,
      httpStatus: null,
      providerError: null,
      sslError: null,
    };

    let nextStatus: DomainStatus = DomainStatus.PENDING;
    let lastError: string | null = null;
    let verifiedAt = domain.verifiedAt;

    if (!expectedTarget || !providerProjectId) {
      lastError = "No live deployment project is available for this site";
    } else {
      const providerDomain =
        await this.deploymentProvider.ensureDomainAttachment({
          projectId: providerProjectId,
          domain: domain.host,
        });

      details.providerAttachmentStatus =
        providerDomain.providerStatus ??
        (providerDomain.isAssigned ? "attached" : "pending");
      details.providerVerificationStatus =
        providerDomain.verificationStatus ?? null;
      details.providerAttached = providerDomain.isAssigned;
      details.providerVerified = providerDomain.isVerified;
      details.providerError = providerDomain.errorMessage ?? null;

      if (providerDomain.isFailed) {
        nextStatus = DomainStatus.FAILED;
        lastError =
          providerDomain.errorMessage ??
          `Provider attachment failed for ${domain.host}`;
      }

      const dnsState = await this.resolveDnsState(domain.host);
      details.observedCname = dnsState.cname;
      details.observedAddresses = dnsState.addresses;
      details.dnsConfigured = !!dnsState.cname || dnsState.addresses.length > 0;
      details.dnsMatchesExpected = dnsState.cname
        ? this.normalizeHost(dnsState.cname) === expectedTarget
        : null;

      if (!details.dnsConfigured) {
        nextStatus = DomainStatus.DNS_REQUIRED;
        lastError = `No DNS record found for ${domain.host}`;
      } else if (
        dnsState.cname &&
        this.normalizeHost(dnsState.cname) !== expectedTarget
      ) {
        nextStatus = DomainStatus.DNS_REQUIRED;
        lastError = `CNAME points to ${dnsState.cname}; expected ${expectedTarget}`;
      } else if (!providerDomain.isAssigned || !providerDomain.isVerified) {
        nextStatus = DomainStatus.PROVIDER_ATTACH_PENDING;
        lastError =
          providerDomain.errorMessage ??
          `Provider attachment is still pending for ${domain.host}`;
      } else {
        const sslState = await this.probeHttps(domain.host);
        details.sslActive = sslState.active;
        details.httpStatus = sslState.httpStatus;
        details.sslError = sslState.errorMessage;

        if (sslState.active) {
          details.sslStatus = "active";
          nextStatus = DomainStatus.ACTIVE;
          verifiedAt = now;
          lastError = null;
        } else {
          details.sslStatus = "provisioning";
          lastError =
            sslState.errorMessage ??
            `HTTPS is not yet reachable for ${domain.host}`;
          nextStatus = this.isWithinGraceWindow(domain, now)
            ? DomainStatus.SSL_PROVISIONING
            : DomainStatus.FAILED;
        }
      }
    }

    await this.prisma.domain.update({
      where: { id: domain.id },
      data: {
        status: nextStatus,
        lastCheckedAt: now,
        lastError,
        verificationDetails: details as unknown as Prisma.InputJsonValue,
        verifiedAt,
      },
    });

    await this.syncFailureAlert(domain, nextStatus, lastError, details, now);
  }

  private runScheduledBatch(): void {
    void this.processScheduledBatch().catch((error: unknown) => {
      this.logger.error(
        `Scheduled domain verification batch failed: ${this.formatError(error)}`,
      );
    });
  }

  private async processScheduledBatch(): Promise<void> {
    if (this.batchRunning || !this.isEnabled()) {
      return;
    }

    this.batchRunning = true;

    try {
      const now = new Date();
      const pendingCutoff = new Date(
        now.getTime() - this.getPendingRecheckMs(),
      );
      const activeCutoff = new Date(now.getTime() - this.getActiveRecheckMs());

      const domains = await this.prisma.domain.findMany({
        where: {
          OR: [
            {
              status: {
                in: [
                  DomainStatus.PENDING,
                  DomainStatus.DNS_REQUIRED,
                  DomainStatus.VERIFYING,
                  DomainStatus.FAILED,
                ],
              },
              OR: [
                { lastCheckedAt: null },
                { lastCheckedAt: { lte: pendingCutoff } },
              ],
            },
            {
              status: DomainStatus.ACTIVE,
              OR: [
                { lastCheckedAt: null },
                { lastCheckedAt: { lte: activeCutoff } },
              ],
            },
          ],
        },
        orderBy: { updatedAt: "asc" },
        take: this.getBatchSize(),
        select: { id: true },
      });

      for (const domain of domains) {
        try {
          await this.verifyDomain(domain.id, "scheduled");
        } catch (error) {
          this.logger.warn(
            `Scheduled verification failed for domain ${domain.id}: ${this.formatError(error)}`,
          );
        }
      }
    } finally {
      this.batchRunning = false;
    }
  }

  private async resolveDnsState(host: string): Promise<{
    cname: string | null;
    addresses: string[];
  }> {
    const addresses = new Set<string>();
    let cname: string | null = null;

    try {
      const result = await dns.resolveCname(host);
      cname = result[0] ?? null;
    } catch (error) {
      if (!this.isIgnorableDnsError(error)) {
        this.logger.warn(
          `CNAME lookup failed for ${host}: ${this.formatError(error)}`,
        );
      }
    }

    try {
      for (const address of await dns.resolve4(host)) {
        addresses.add(address);
      }
    } catch (error) {
      if (!this.isIgnorableDnsError(error)) {
        this.logger.warn(
          `A lookup failed for ${host}: ${this.formatError(error)}`,
        );
      }
    }

    try {
      for (const address of await dns.resolve6(host)) {
        addresses.add(address);
      }
    } catch (error) {
      if (!this.isIgnorableDnsError(error)) {
        this.logger.warn(
          `AAAA lookup failed for ${host}: ${this.formatError(error)}`,
        );
      }
    }

    return {
      cname,
      addresses: Array.from(addresses),
    };
  }

  private async probeHttps(host: string): Promise<{
    active: boolean;
    httpStatus: number | null;
    errorMessage: string | null;
  }> {
    try {
      const response = await fetch(`https://${host}`, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(this.getHttpTimeoutMs()),
        headers: {
          "user-agent": "myallocator-domain-verifier/1.0",
        },
      });

      return {
        active: true,
        httpStatus: response.status,
        errorMessage: null,
      };
    } catch (error) {
      return {
        active: false,
        httpStatus: null,
        errorMessage: this.formatError(error),
      };
    }
  }

  private async syncFailureAlert(
    domain: VerifiableDomain,
    status: DomainStatus,
    lastError: string | null,
    details: DomainVerificationDetails,
    now: Date,
  ) {
    const fingerprint = `domain:${domain.id}`;

    if (status === DomainStatus.FAILED) {
      await this.prisma.operationalAlert.upsert({
        where: {
          siteId_type_fingerprint: {
            siteId: domain.siteId,
            type: OperationalAlertType.DOMAIN_FAILURE,
            fingerprint,
          },
        },
        create: {
          siteId: domain.siteId,
          type: OperationalAlertType.DOMAIN_FAILURE,
          fingerprint,
          severity: OperationalAlertSeverity.WARNING,
          status: OperationalAlertStatus.OPEN,
          message: lastError ?? `Domain verification failed for ${domain.host}`,
          metadata: {
            domain: domain.host,
            ...details,
          } as unknown as Prisma.InputJsonValue,
          firstTriggeredAt: now,
          lastTriggeredAt: now,
        },
        update: {
          severity: OperationalAlertSeverity.WARNING,
          status: OperationalAlertStatus.OPEN,
          message: lastError ?? `Domain verification failed for ${domain.host}`,
          metadata: {
            domain: domain.host,
            ...details,
          } as unknown as Prisma.InputJsonValue,
          lastTriggeredAt: now,
          resolvedAt: null,
        },
      });

      return;
    }

    await this.prisma.operationalAlert.updateMany({
      where: {
        siteId: domain.siteId,
        type: OperationalAlertType.DOMAIN_FAILURE,
        fingerprint,
        status: OperationalAlertStatus.OPEN,
      },
      data: {
        status: OperationalAlertStatus.RESOLVED,
        resolvedAt: now,
        lastTriggeredAt: now,
      },
    });
  }

  private isWithinGraceWindow(domain: VerifiableDomain, now: Date): boolean {
    const reference = domain.verificationRequestedAt ?? domain.createdAt;
    return now.getTime() - reference.getTime() <= this.getSslGraceMs();
  }

  private extractHostname(url: string | null): string | null {
    if (!url) {
      return null;
    }

    try {
      return new URL(url.startsWith("http") ? url : `https://${url}`).host;
    } catch {
      return this.normalizeHost(url);
    }
  }

  private normalizeHost(value: string): string {
    return value.toLowerCase().trim().replace(/\.$/, "");
  }

  private isIgnorableDnsError(error: unknown): boolean {
    const code = (error as { code?: string })?.code;
    return ["ENODATA", "ENOTFOUND", "EAI_AGAIN", "ESERVFAIL"].includes(
      code ?? "",
    );
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private isEnabled(): boolean {
    return (
      this.configService.get<string>("DOMAIN_VERIFICATION_ENABLED") !== "false"
    );
  }

  private getPendingRecheckMs(): number {
    return this.getNumber(
      "DOMAIN_VERIFICATION_INTERVAL_MS",
      DEFAULT_PENDING_RECHECK_MS,
    );
  }

  private getActiveRecheckMs(): number {
    return this.getNumber(
      "DOMAIN_ACTIVE_RECHECK_INTERVAL_MS",
      DEFAULT_ACTIVE_RECHECK_MS,
    );
  }

  private getSslGraceMs(): number {
    return this.getNumber("DOMAIN_SSL_GRACE_PERIOD_MS", DEFAULT_SSL_GRACE_MS);
  }

  private getHttpTimeoutMs(): number {
    return this.getNumber("DOMAIN_HTTP_TIMEOUT_MS", DEFAULT_HTTP_TIMEOUT_MS);
  }

  private getBatchSize(): number {
    return this.getNumber("DOMAIN_VERIFICATION_BATCH_SIZE", DEFAULT_BATCH_SIZE);
  }

  private getNumber(key: string, fallback: number): number {
    const value = Number(this.configService.get<string>(key) ?? "");
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
