import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  Deployment,
  DeploymentStatus,
  DomainStatus,
  HostVariant,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { stripWww } from "../public-runtime/public-runtime.util";
import {
  getConfiguredPlatformRootDomain,
  isUsablePlatformRootDomain,
} from "../public-runtime/platform-root-domain";
import { SitePublishedRevisionsService } from "../site-published-revisions/site-published-revisions.service";
import {
  DEPLOYMENT_PROVIDER,
  DeploymentLogEntry,
  DeploymentProjectSettings,
  DeploymentProvider,
  DeploymentProviderEnvironment,
  DeploymentProviderError,
  DeploymentStatusSnapshot,
  DeploymentTimelinePhase,
  DeploymentTimelinePhaseStatus,
  SiteDeploymentContext,
} from "./deployment-provider.port";
import {
  ACTIVE_PROVISIONING_STATUSES,
  asDeploymentMetadata,
  asDeploymentLogs,
  asDeploymentTimeline,
  SiteRevalidationTarget,
  TRACKABLE_DEPLOYMENT_STATUSES,
} from "./deployments.types";
import { buildOperatorManagedEnvironmentContract } from "./deployment-environment.contract";
import { DeploymentEnvironmentService } from "./deployment-environment.service";

type SiteProvisioningRecord = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  primaryLocale: string;
  enabledLocales: string[];
  settings: {
    siteName: string;
  } | null;
  domains: Array<{
    host: string;
  }>;
  deployments: Array<{
    id: string;
    providerProjectId: string | null;
    providerDeployId: string | null;
    status: DeploymentStatus;
  }>;
};

type ProvisioningSeed = {
  existingProjectId?: string | null;
  previousDeploymentId?: string | null;
};

type SharedRuntimeSiteRecord = {
  id: string;
  publicSubdomain: string | null;
  preferredHostVariant: HostVariant;
  domains: Array<{
    host: string;
    isPrimary: boolean;
  }>;
};

export type CustomerSiteDeployment = {
  id: string;
  siteId: string;
  status: DeploymentStatus;
  url: string | null;
  providerUrl: string | null;
  errorMessage: string | null;
  providerDeployId: string | null;
  timeline: DeploymentTimelinePhase[];
  recentLogs: DeploymentLogEntry[];
  createdAt: Date;
  updatedAt: Date;
  sharedRuntime: boolean;
  publishedRevision: number | null;
  publishedAt: string | null;
};

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly deploymentEnvironmentService: DeploymentEnvironmentService,
    @Inject(DEPLOYMENT_PROVIDER)
    private readonly deploymentProvider: DeploymentProvider,
    private readonly sitePublishedRevisionsService: SitePublishedRevisionsService,
  ) {}

  async provisionSite(siteId: string): Promise<Deployment> {
    if (this.isSharedRuntimeModeEnabled()) {
      return this.runSharedRuntimePublish(siteId);
    }

    const activeDeployment = await this.prisma.deployment.findFirst({
      where: {
        siteId,
        status: { in: ACTIVE_PROVISIONING_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activeDeployment) {
      return activeDeployment;
    }

    const site = await this.getSiteProvisioningRecord(siteId);
    const latestDeployment = site.deployments[0];
    const createdDeployment = await this.prisma.deployment.create({
      data: {
        siteId,
        status: DeploymentStatus.PENDING,
        provider: this.deploymentProvider.name,
        providerProjectId: latestDeployment?.providerProjectId ?? null,
        metadata: this.buildInitialMetadata(site),
      },
    });

    return this.runProvisioning(createdDeployment, site, {
      existingProjectId: latestDeployment?.providerProjectId ?? null,
      previousDeploymentId: latestDeployment?.providerDeployId ?? null,
    });
  }

  async rollbackSiteDeployment(
    siteId: string,
    targetDeploymentId: string,
  ): Promise<Deployment> {
    const target = await this.prisma.deployment.findUnique({
      where: { id: targetDeploymentId },
    });

    if (!target || target.siteId !== siteId) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Target deployment not found",
      });
    }

    const currentActive = await this.prisma.deployment.findFirst({
      where: {
        siteId,
        status: { in: ACTIVE_PROVISIONING_STATUSES },
      },
    });

    if (currentActive) {
      throw new ConflictException({
        code: "DEPLOYMENT_IN_PROGRESS",
        message: "A deployment is already in progress for this site",
      });
    }

    if (this.isSharedRuntimeDeployment(target)) {
      return this.runSharedRuntimeRollback(siteId, target);
    }

    if (target.status !== DeploymentStatus.LIVE) {
      throw new ConflictException({
        code: "DEPLOYMENT_NOT_ROLLBACK_TARGET",
        message:
          "Only previously-live deployments can be used as rollback targets",
      });
    }

    if (!target.providerDeployId) {
      throw new ConflictException({
        code: "DEPLOYMENT_NO_PROVIDER_DEPLOY",
        message:
          "Target deployment has no provider deploy reference for rollback",
      });
    }

    if (!target.providerProjectId) {
      throw new ConflictException({
        code: "DEPLOYMENT_NO_PROVIDER_PROJECT",
        message:
          "Target deployment has no provider project reference for rollback",
      });
    }

    const site = await this.getSiteProvisioningRecord(siteId);
    const rollbackDeployment = await this.prisma.deployment.create({
      data: {
        siteId,
        status: DeploymentStatus.DEPLOYING,
        provider: target.provider ?? this.deploymentProvider.name,
        providerProjectId: target.providerProjectId,
        providerDeployId: target.providerDeployId,
        url: target.url,
        metadata: this.mergeMetadata(null, {
          ...this.buildInitialMetadata(site),
          rollbackOfDeploymentId: targetDeploymentId,
          rollbackRequestedAt: new Date().toISOString(),
          rollbackProviderDeployId: target.providerDeployId,
        }),
      },
    });

    try {
      await this.deploymentProvider.rollbackDeployment({
        projectId: target.providerProjectId,
        providerDeployId: target.providerDeployId,
      });

      return this.updateDeployment(rollbackDeployment.id, {
        status: DeploymentStatus.LIVE,
        url: target.url,
        providerDeployId: target.providerDeployId,
        providerProjectId: target.providerProjectId,
        errorMessage: null,
        metadata: this.mergeMetadata(rollbackDeployment.metadata, {
          rollbackCompletedAt: new Date().toISOString(),
          rollbackProviderDeployId: target.providerDeployId,
        }),
      });
    } catch (error) {
      return this.failDeployment(
        rollbackDeployment.id,
        rollbackDeployment.metadata,
        error,
      );
    }
  }

  async retryDeployment(deploymentId: string): Promise<Deployment> {
    const failedDeployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!failedDeployment) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Deployment not found",
      });
    }

    if (failedDeployment.status !== DeploymentStatus.FAILED) {
      throw new ConflictException({
        code: "DEPLOYMENT_NOT_RETRYABLE",
        message: "Only failed deployments can be retried",
      });
    }

    if (this.isSharedRuntimeDeployment(failedDeployment)) {
      return this.runSharedRuntimePublish(failedDeployment.siteId, {
        initialStatus: DeploymentStatus.RETRYING,
        retryOfDeploymentId: failedDeployment.id,
      });
    }

    const site = await this.getSiteProvisioningRecord(failedDeployment.siteId);
    const retryDeployment = await this.prisma.deployment.create({
      data: {
        siteId: failedDeployment.siteId,
        status: DeploymentStatus.RETRYING,
        provider: failedDeployment.provider ?? this.deploymentProvider.name,
        providerProjectId: failedDeployment.providerProjectId,
        metadata: this.mergeMetadata(failedDeployment.metadata, {
          ...this.buildInitialMetadata(site),
          retryOfDeploymentId: failedDeployment.id,
          retryRequestedAt: new Date().toISOString(),
        }),
      },
    });

    return this.runProvisioning(retryDeployment, site, {
      existingProjectId:
        failedDeployment.providerProjectId ??
        site.deployments[0]?.providerProjectId ??
        null,
      previousDeploymentId:
        failedDeployment.providerDeployId ??
        site.deployments[0]?.providerDeployId ??
        null,
    });
  }

  async retrySiteDeployment(
    siteId: string,
    deploymentId: string,
  ): Promise<Deployment> {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { id: true, siteId: true },
    });

    if (!deployment || deployment.siteId !== siteId) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Deployment not found",
      });
    }

    return this.retryDeployment(deploymentId);
  }

  async getDeploymentById(deploymentId: string): Promise<Deployment> {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Deployment not found",
      });
    }

    return this.syncDeploymentIfTrackable(deployment);
  }

  async listAdminDeployments(params: {
    status?: "PENDING" | "BUILDING" | "DEPLOYED" | "FAILED";
    page?: number;
    limit?: number;
  }): Promise<{
    data: Array<{
      id: string;
      siteId: string;
      siteName: string;
      tenantName: string;
      status: "PENDING" | "BUILDING" | "DEPLOYED" | "FAILED";
      providerProjectId: string | null;
      errorMessage: string | null;
      deployedAt: string | null;
      createdAt: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.max(1, Math.min(100, params.limit ?? 20));
    const skip = (page - 1) * limit;
    const where = this.toAdminDeploymentWhere(params.status);

    const [rows, total] = await Promise.all([
      this.prisma.deployment.findMany({
        where,
        include: {
          site: {
            select: {
              name: true,
              tenant: { select: { name: true } },
            },
          },
        },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      this.prisma.deployment.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        siteId: row.siteId,
        siteName: row.site.name,
        tenantName: row.site.tenant.name,
        status: this.toAdminDeploymentStatus(row.status),
        providerProjectId: row.providerProjectId,
        errorMessage: row.errorMessage,
        deployedAt:
          row.status === DeploymentStatus.LIVE
            ? row.updatedAt.toISOString()
            : null,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
    };
  }

  async getLatestSiteDeployment(siteId: string): Promise<Deployment | null> {
    const latestDeployment = await this.prisma.deployment.findFirst({
      where: { siteId },
      orderBy: { createdAt: "desc" },
    });

    if (!latestDeployment) {
      return null;
    }

    return this.syncDeploymentIfTrackable(latestDeployment);
  }

  async listSiteDeployments(siteId: string, take = 10): Promise<Deployment[]> {
    const deployments = await this.prisma.deployment.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take,
    });

    const syncedDeployments: Deployment[] = [];
    for (const deployment of deployments) {
      syncedDeployments.push(await this.syncDeploymentIfTrackable(deployment));
    }

    return syncedDeployments;
  }

  async resolveCustomerSiteDeployment(
    siteId: string,
    deployment: Deployment,
  ): Promise<CustomerSiteDeployment> {
    const primaryDomain = await this.getPrimaryActiveDomain(siteId);

    return this.buildCustomerSiteDeployment(deployment, primaryDomain);
  }

  async resolveCustomerSiteDeployments(
    siteId: string,
    deployments: Deployment[],
  ): Promise<CustomerSiteDeployment[]> {
    const primaryDomain = await this.getPrimaryActiveDomain(siteId);

    return deployments.map((deployment) =>
      this.buildCustomerSiteDeployment(deployment, primaryDomain),
    );
  }

  async getSiteRevalidationTarget(
    siteId: string,
  ): Promise<SiteRevalidationTarget | null> {
    const latestTrackable = await this.prisma.deployment.findFirst({
      where: {
        siteId,
        status: { in: TRACKABLE_DEPLOYMENT_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    });

    if (latestTrackable) {
      await this.syncDeploymentIfTrackable(latestTrackable);
    }

    const liveDeployment = await this.prisma.deployment.findFirst({
      where: {
        siteId,
        status: DeploymentStatus.LIVE,
        url: { not: null },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!liveDeployment?.url) {
      return null;
    }

    const deploymentUrl = this.normalizeUrl(liveDeployment.url);
    return {
      deploymentId: liveDeployment.id,
      provider: liveDeployment.provider,
      deploymentUrl,
      revalidationUrl: new URL("/api/revalidate", deploymentUrl).toString(),
    };
  }

  private async runProvisioning(
    deployment: Deployment,
    site: SiteProvisioningRecord,
    seed: ProvisioningSeed,
  ): Promise<Deployment> {
    const siteContext = this.toSiteContext(site);
    const projectName = this.buildProjectName(site);
    const environment = await this.buildEnvironmentContract(siteContext);
    const projectSettings = this.buildProjectSettings();
    let currentMetadata = deployment.metadata;

    try {
      const creatingProjectDeployment = await this.updateDeployment(
        deployment.id,
        {
          status: DeploymentStatus.CREATING_PROJECT,
          provider: this.deploymentProvider.name,
          errorMessage: null,
          metadata: this.mergeMetadata(currentMetadata, {
            projectName,
            primaryDomain: siteContext.primaryDomain ?? null,
          }),
        },
      );
      currentMetadata = creatingProjectDeployment.metadata;

      const project = await this.deploymentProvider.ensureProject({
        projectName,
        existingProjectId:
          seed.existingProjectId ?? deployment.providerProjectId,
        site: siteContext,
        projectSettings,
      });

      const syncingEnvDeployment = await this.updateDeployment(deployment.id, {
        status: DeploymentStatus.SYNCING_ENV,
        providerProjectId: project.projectId,
        metadata: this.mergeMetadata(currentMetadata, {
          projectName: project.projectName,
          providerProjectCreated: project.created,
          providerProjectMetadata: project.metadata ?? null,
        }),
      });
      currentMetadata = syncingEnvDeployment.metadata;

      await this.deploymentProvider.syncEnvironmentVariables({
        projectId: project.projectId,
        projectName: project.projectName,
        environment,
      });

      const deployingRecord = await this.updateDeployment(deployment.id, {
        status: DeploymentStatus.DEPLOYING,
        providerProjectId: project.projectId,
        metadata: this.mergeMetadata(currentMetadata, {
          projectName: project.projectName,
          environmentKeys: environment.map((entry) => entry.key),
        }),
      });
      currentMetadata = deployingRecord.metadata;

      const snapshot = await this.deploymentProvider.triggerDeployment({
        projectId: project.projectId,
        projectName: project.projectName,
        previousDeploymentId: seed.previousDeploymentId,
        site: siteContext,
        projectSettings,
        meta: {
          siteId: site.id,
          deploymentId: deployment.id,
        },
      });

      return this.persistDeploymentSnapshot(deployment.id, snapshot, {
        providerProjectId: project.projectId,
        projectName: project.projectName,
        currentMetadata,
      });
    } catch (error) {
      return this.failDeployment(deployment.id, currentMetadata, error);
    }
  }

  private async runSharedRuntimePublish(
    siteId: string,
    input: {
      initialStatus?: DeploymentStatus;
      retryOfDeploymentId?: string;
    } = {},
  ): Promise<Deployment> {
    const activeDeployment = await this.prisma.deployment.findFirst({
      where: {
        siteId,
        status: { in: ACTIVE_PROVISIONING_STATUSES },
      },
      orderBy: { createdAt: "desc" },
    });

    if (activeDeployment) {
      return activeDeployment;
    }

    const site = await this.getSharedRuntimeSiteRecord(siteId);
    const providerProjectId = this.getSharedRuntimeProjectId();
    const providerUrl = this.getSharedRuntimeProviderUrl();
    const revalidationUrl = this.getSharedRuntimeRevalidationUrl();
    const runtimeSecret = this.getSharedRuntimeSecret();

    const deployment = await this.prisma.deployment.create({
      data: {
        siteId,
        status: input.initialStatus ?? DeploymentStatus.PENDING,
        provider: this.deploymentProvider.name,
        providerProjectId,
        metadata: this.mergeMetadata(null, {
          sharedRuntime: true,
          providerUrl,
          retryOfDeploymentId: input.retryOfDeploymentId ?? null,
        }),
      },
    });

    try {
      const hosts = this.listSharedRuntimeHosts(site);

      if (hosts.length === 0) {
        throw new ConflictException({
          code: "RUNTIME_HOST_UNAVAILABLE",
          message:
            "No shared-runtime host is available for this site yet. Assign a public subdomain or verify a custom domain first.",
        });
      }

      if (!revalidationUrl || !runtimeSecret) {
        throw new ConflictException({
          code: "RUNTIME_REVALIDATION_NOT_CONFIGURED",
          message:
            "Shared website runtime revalidation is not configured. Set WEBSITE_APP_ORIGIN or REVALIDATION_URL and WEBSITE_RUNTIME_SECRET.",
        });
      }

      const response = await fetch(revalidationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-website-runtime-secret": runtimeSecret,
        },
        body: JSON.stringify({
          siteId,
          hosts,
          paths: [],
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Shared runtime publish failed: ${response.status} ${response.statusText}`,
        );
      }

      const snapshot = await this.sitePublishedRevisionsService.captureSnapshot(
        siteId,
        { deploymentId: deployment.id },
      );

      const publishedAt = snapshot.createdAt.toISOString();

      return this.updateDeployment(deployment.id, {
        status: DeploymentStatus.LIVE,
        providerProjectId,
        url: `https://${hosts[0]}`,
        errorMessage: null,
        metadata: this.mergeMetadata(deployment.metadata, {
          sharedRuntime: true,
          providerUrl,
          sharedRuntimeHosts: hosts,
          publishedAt,
          publishedRevision: snapshot.revision,
          publishedRevisionId: snapshot.id,
        }),
      });
    } catch (error) {
      return this.failDeployment(deployment.id, deployment.metadata, error);
    }
  }

  private async runSharedRuntimeRollback(
    siteId: string,
    target: Deployment,
  ): Promise<Deployment> {
    const targetMetadata = asDeploymentMetadata(target.metadata);
    const targetRevision =
      typeof targetMetadata.publishedRevision === "number"
        ? targetMetadata.publishedRevision
        : null;

    if (targetRevision === null) {
      // Backfill: a snapshot may exist linked by deployment id even if the
      // metadata predates the publishedRevision field.
      const linked =
        await this.sitePublishedRevisionsService.getSnapshotByDeploymentId(
          siteId,
          target.id,
        );
      if (!linked) {
        throw new ConflictException({
          code: "ROLLBACK_TARGET_HAS_NO_SNAPSHOT",
          message:
            "This publish event predates content snapshots and cannot be used as a rollback target. Republish to create a new restore point.",
        });
      }
      return this.executeSharedRuntimeRollback(siteId, target, linked.revision);
    }

    return this.executeSharedRuntimeRollback(siteId, target, targetRevision);
  }

  private async executeSharedRuntimeRollback(
    siteId: string,
    target: Deployment,
    targetRevision: number,
  ): Promise<Deployment> {
    const site = await this.getSharedRuntimeSiteRecord(siteId);
    const providerProjectId = this.getSharedRuntimeProjectId();
    const providerUrl = this.getSharedRuntimeProviderUrl();
    const revalidationUrl = this.getSharedRuntimeRevalidationUrl();
    const runtimeSecret = this.getSharedRuntimeSecret();

    const deployment = await this.prisma.deployment.create({
      data: {
        siteId,
        status: DeploymentStatus.DEPLOYING,
        provider: this.deploymentProvider.name,
        providerProjectId,
        metadata: this.mergeMetadata(null, {
          sharedRuntime: true,
          providerUrl,
          rollbackOfDeploymentId: target.id,
          rollbackOfRevision: targetRevision,
          rollbackRequestedAt: new Date().toISOString(),
        }),
      },
    });

    try {
      const hosts = this.listSharedRuntimeHosts(site);

      if (hosts.length === 0) {
        throw new ConflictException({
          code: "RUNTIME_HOST_UNAVAILABLE",
          message:
            "No shared-runtime host is available for this site. Assign a public subdomain or verify a custom domain before rolling back.",
        });
      }

      if (!revalidationUrl || !runtimeSecret) {
        throw new ConflictException({
          code: "RUNTIME_REVALIDATION_NOT_CONFIGURED",
          message:
            "Shared website runtime revalidation is not configured. Set WEBSITE_APP_ORIGIN or REVALIDATION_URL and WEBSITE_RUNTIME_SECRET.",
        });
      }

      // Restore content first so the cache invalidation that follows serves
      // the restored revision rather than the prior live state.
      const snapshot =
        await this.sitePublishedRevisionsService.restoreToRevision(
          siteId,
          targetRevision,
          { deploymentId: deployment.id },
        );

      const response = await fetch(revalidationUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-website-runtime-secret": runtimeSecret,
        },
        body: JSON.stringify({
          siteId,
          hosts,
          paths: [],
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Shared runtime rollback revalidation failed: ${response.status} ${response.statusText}`,
        );
      }

      const publishedAt = snapshot.createdAt.toISOString();

      return this.updateDeployment(deployment.id, {
        status: DeploymentStatus.LIVE,
        providerProjectId,
        url: `https://${hosts[0]}`,
        errorMessage: null,
        metadata: this.mergeMetadata(deployment.metadata, {
          sharedRuntime: true,
          providerUrl,
          sharedRuntimeHosts: hosts,
          publishedAt,
          publishedRevision: snapshot.revision,
          publishedRevisionId: snapshot.id,
          rollbackOfDeploymentId: target.id,
          rollbackOfRevision: targetRevision,
          rollbackCompletedAt: publishedAt,
        }),
      });
    } catch (error) {
      return this.failDeployment(deployment.id, deployment.metadata, error);
    }
  }

  private async syncDeploymentIfTrackable(
    deployment: Deployment,
  ): Promise<Deployment> {
    if (
      !TRACKABLE_DEPLOYMENT_STATUSES.includes(deployment.status) ||
      !deployment.providerDeployId
    ) {
      return deployment;
    }

    try {
      const snapshot = await this.deploymentProvider.getDeploymentStatus({
        providerDeployId: deployment.providerDeployId,
        projectId: deployment.providerProjectId,
      });

      return this.persistDeploymentSnapshot(deployment.id, snapshot, {
        providerProjectId: deployment.providerProjectId,
      });
    } catch {
      return deployment;
    }
  }

  private async persistDeploymentSnapshot(
    deploymentId: string,
    snapshot: DeploymentStatusSnapshot,
    context: {
      providerProjectId?: string | null;
      projectName?: string;
      currentMetadata?: Prisma.JsonValue | null;
    },
  ): Promise<Deployment> {
    const status = this.toDeploymentStatus(snapshot);

    return this.updateDeployment(deploymentId, {
      status,
      providerProjectId: context.providerProjectId ?? undefined,
      providerDeployId: snapshot.providerDeployId,
      url: snapshot.url ?? undefined,
      errorMessage:
        status === DeploymentStatus.FAILED ? snapshot.errorMessage : null,
      metadata: this.mergeMetadata(context.currentMetadata, {
        projectName: context.projectName,
        providerUrl: snapshot.providerUrl ?? null,
        providerReadyState: snapshot.readyState ?? null,
        providerStatus: snapshot.rawStatus ?? null,
        providerMetadata: snapshot.metadata ?? null,
        providerTimeline: snapshot.timeline ?? null,
        providerLogs: snapshot.logs ?? null,
        providerTimelineUpdatedAt: new Date().toISOString(),
      }),
    });
  }

  private toAdminDeploymentWhere(
    status?: "PENDING" | "BUILDING" | "DEPLOYED" | "FAILED",
  ): Prisma.DeploymentWhereInput {
    if (!status) {
      return {};
    }

    if (status === "PENDING") {
      return { status: DeploymentStatus.PENDING };
    }

    if (status === "DEPLOYED") {
      return { status: DeploymentStatus.LIVE };
    }

    if (status === "FAILED") {
      return { status: DeploymentStatus.FAILED };
    }

    return {
      status: {
        in: [
          DeploymentStatus.CREATING_PROJECT,
          DeploymentStatus.SYNCING_ENV,
          DeploymentStatus.DEPLOYING,
          DeploymentStatus.RETRYING,
        ],
      },
    };
  }

  private toAdminDeploymentStatus(
    status: DeploymentStatus,
  ): "PENDING" | "BUILDING" | "DEPLOYED" | "FAILED" {
    if (status === DeploymentStatus.PENDING) {
      return "PENDING";
    }

    if (status === DeploymentStatus.LIVE) {
      return "DEPLOYED";
    }

    if (status === DeploymentStatus.FAILED) {
      return "FAILED";
    }

    return "BUILDING";
  }

  private async failDeployment(
    deploymentId: string,
    currentMetadata: Prisma.JsonValue | null | undefined,
    error: unknown,
  ): Promise<Deployment> {
    const errorMessage = this.describeProvisioningError(error);

    return this.updateDeployment(deploymentId, {
      status: DeploymentStatus.FAILED,
      errorMessage,
      metadata: this.mergeMetadata(currentMetadata, {
        lastFailureAt: new Date().toISOString(),
        lastFailureMessage: errorMessage,
      }),
    });
  }

  private async getSiteProvisioningRecord(
    siteId: string,
  ): Promise<SiteProvisioningRecord> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        slug: true,
        primaryLocale: true,
        enabledLocales: true,
        settings: {
          select: {
            siteName: true,
          },
        },
        domains: {
          where: {
            isPrimary: true,
            status: DomainStatus.ACTIVE,
          },
          select: {
            host: true,
          },
          take: 1,
        },
        deployments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            providerProjectId: true,
            providerDeployId: true,
            status: true,
          },
        },
      },
    });

    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found",
      });
    }

    return site;
  }

  private async getPrimaryActiveDomain(siteId: string): Promise<string | null> {
    const primaryDomain = await this.prisma.domain.findFirst({
      where: {
        siteId,
        isPrimary: true,
        status: DomainStatus.ACTIVE,
      },
      select: {
        host: true,
      },
    });

    return primaryDomain?.host ?? null;
  }

  private async getSharedRuntimeSiteRecord(
    siteId: string,
  ): Promise<SharedRuntimeSiteRecord> {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        publicSubdomain: true,
        preferredHostVariant: true,
        domains: {
          where: {
            status: DomainStatus.ACTIVE,
          },
          select: {
            host: true,
            isPrimary: true,
          },
        },
      },
    });

    if (!site) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Site not found",
      });
    }

    return site;
  }

  private buildCustomerSiteDeployment(
    deployment: Deployment,
    primaryDomain: string | null,
  ): CustomerSiteDeployment {
    const metadata = asDeploymentMetadata(deployment.metadata);
    const providerTimeline = asDeploymentTimeline(metadata.providerTimeline);
    const deploymentUrl = deployment.url
      ? this.normalizeUrl(deployment.url)
      : null;
    const metadataProviderUrl =
      typeof metadata.providerUrl === "string"
        ? this.normalizeUrl(metadata.providerUrl)
        : null;
    const providerUrl = metadataProviderUrl ?? deploymentUrl;
    const publicUrl =
      primaryDomain && deployment.status === DeploymentStatus.LIVE
        ? `https://${primaryDomain}`
        : deploymentUrl;

    const sharedRuntime = metadata.sharedRuntime === true;
    const storedLogs = asDeploymentLogs(metadata.providerLogs);
    const recentLogs =
      storedLogs.length > 0
        ? storedLogs
        : sharedRuntime
          ? this.buildSharedRuntimeLogs(deployment, metadata)
          : storedLogs;
    const publishedRevision =
      typeof metadata.publishedRevision === "number"
        ? metadata.publishedRevision
        : null;
    const publishedAt =
      typeof metadata.publishedAt === "string" ? metadata.publishedAt : null;

    return {
      id: deployment.id,
      siteId: deployment.siteId,
      status: deployment.status,
      url: publicUrl,
      providerUrl,
      errorMessage: deployment.errorMessage,
      providerDeployId: deployment.providerDeployId,
      timeline: this.buildCustomerDeploymentTimeline(
        deployment,
        providerTimeline,
      ),
      recentLogs,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
      sharedRuntime,
      publishedRevision,
      publishedAt,
    };
  }

  private listSharedRuntimeHosts(site: SharedRuntimeSiteRecord): string[] {
    const hosts = new Set<string>();
    const primaryDomain =
      site.domains.find((domain) => domain.isPrimary) ?? site.domains[0];

    if (primaryDomain) {
      const baseDomain = stripWww(primaryDomain.host);
      const apexDomain = site.domains.find(
        (domain) =>
          stripWww(domain.host) === baseDomain &&
          !domain.host.startsWith("www."),
      );
      const wwwDomain = site.domains.find(
        (domain) =>
          stripWww(domain.host) === baseDomain &&
          domain.host.startsWith("www."),
      );
      const canonicalDomain =
        site.preferredHostVariant === HostVariant.WWW
          ? (wwwDomain?.host ?? primaryDomain.host)
          : (apexDomain?.host ?? primaryDomain.host);

      hosts.add(canonicalDomain);
      site.domains.forEach((domain) => hosts.add(domain.host));
    }

    const platformRootDomain = getConfiguredPlatformRootDomain(
      this.configService,
    );

    if (
      site.publicSubdomain &&
      isUsablePlatformRootDomain(platformRootDomain)
    ) {
      hosts.add(`${site.publicSubdomain}.${platformRootDomain}`);
    }

    return Array.from(hosts);
  }

  private buildSharedRuntimeLogs(
    deployment: Deployment,
    metadata: Record<string, unknown>,
  ): DeploymentLogEntry[] {
    const createdAt = deployment.createdAt.toISOString();
    const updatedAt = deployment.updatedAt.toISOString();
    const publishedAt =
      typeof metadata.publishedAt === "string"
        ? metadata.publishedAt
        : updatedAt;
    const revision =
      typeof metadata.publishedRevision === "number"
        ? metadata.publishedRevision
        : null;
    const hosts = Array.isArray(metadata.sharedRuntimeHosts)
      ? metadata.sharedRuntimeHosts.filter(
          (host): host is string => typeof host === "string" && host.length > 0,
        )
      : [];
    const logs: DeploymentLogEntry[] = [
      {
        id: `${deployment.id}:runtime:publish-requested`,
        createdAt,
        text: "Shared runtime publish requested.",
        phaseKey: "system:publish",
        level: "info",
      },
    ];

    if (deployment.status === DeploymentStatus.FAILED) {
      logs.push({
        id: `${deployment.id}:runtime:failed`,
        createdAt: updatedAt,
        text:
          deployment.errorMessage ??
          "Shared runtime publish failed before it reached the live route.",
        phaseKey: "system:publish",
        level: "error",
      });

      return logs;
    }

    if (deployment.status === DeploymentStatus.LIVE) {
      logs.push(
        {
          id: `${deployment.id}:runtime:revalidated`,
          createdAt: publishedAt,
          text: "Website runtime cache invalidation completed.",
          phaseKey: "system:revalidate",
          level: "info",
        },
        {
          id: `${deployment.id}:runtime:snapshot`,
          createdAt: publishedAt,
          text:
            revision === null
              ? "Published content snapshot captured."
              : `Published content snapshot captured at revision ${revision}.`,
          phaseKey: "system:snapshot",
          level: "info",
        },
        {
          id: `${deployment.id}:runtime:live`,
          createdAt: updatedAt,
          text:
            hosts.length > 0
              ? `Live routing active for ${hosts.join(", ")}.`
              : "Live routing is active for the shared Website runtime.",
          phaseKey: "system:live",
          level: "info",
        },
      );
    }

    return logs;
  }

  private buildCustomerDeploymentTimeline(
    deployment: Deployment,
    providerTimeline: DeploymentTimelinePhase[],
  ): DeploymentTimelinePhase[] {
    const phases: DeploymentTimelinePhase[] = [
      {
        key: "system:project",
        label: "Project setup",
        status: this.getProjectPhaseStatus(deployment),
        summary: "Preparing or reusing the hosting project.",
      },
      {
        key: "system:environment",
        label: "Environment sync",
        status: this.getEnvironmentPhaseStatus(deployment),
        summary: "Syncing the deployment environment contract.",
      },
    ];

    if (providerTimeline.length > 0) {
      phases.push(...providerTimeline);
    } else {
      phases.push({
        key: "provider:build",
        label: "Build and deploy",
        status: this.getBuildPhaseStatus(deployment),
        summary: this.getBuildPhaseSummary(deployment),
      });
    }

    phases.push({
      key: "system:live",
      label: "Live routing",
      status:
        deployment.status === DeploymentStatus.LIVE ? "completed" : "pending",
      summary:
        deployment.status === DeploymentStatus.LIVE
          ? "Customer traffic is serving from the live target."
          : "Waiting for the deployment to become live.",
    });

    return phases;
  }

  private getProjectPhaseStatus(
    deployment: Deployment,
  ): DeploymentTimelinePhaseStatus {
    if (deployment.status === DeploymentStatus.CREATING_PROJECT) {
      return "active";
    }

    if (deployment.status === DeploymentStatus.FAILED) {
      return deployment.providerProjectId ? "completed" : "failed";
    }

    if (
      deployment.providerProjectId ||
      deployment.status === DeploymentStatus.SYNCING_ENV ||
      deployment.status === DeploymentStatus.DEPLOYING ||
      deployment.status === DeploymentStatus.RETRYING ||
      deployment.status === DeploymentStatus.LIVE
    ) {
      return "completed";
    }

    return deployment.status === DeploymentStatus.PENDING
      ? "pending"
      : "active";
  }

  private getEnvironmentPhaseStatus(
    deployment: Deployment,
  ): DeploymentTimelinePhaseStatus {
    if (deployment.status === DeploymentStatus.SYNCING_ENV) {
      return "active";
    }

    if (deployment.status === DeploymentStatus.FAILED) {
      if (deployment.providerDeployId) {
        return "completed";
      }

      return deployment.providerProjectId ? "failed" : "pending";
    }

    if (
      deployment.providerDeployId ||
      deployment.status === DeploymentStatus.DEPLOYING ||
      deployment.status === DeploymentStatus.RETRYING ||
      deployment.status === DeploymentStatus.LIVE
    ) {
      return "completed";
    }

    if (deployment.status === DeploymentStatus.CREATING_PROJECT) {
      return "pending";
    }

    return deployment.status === DeploymentStatus.PENDING
      ? "pending"
      : "active";
  }

  private getBuildPhaseStatus(
    deployment: Deployment,
  ): DeploymentTimelinePhaseStatus {
    if (deployment.status === DeploymentStatus.LIVE) {
      return "completed";
    }

    if (deployment.status === DeploymentStatus.FAILED) {
      return deployment.providerDeployId ? "failed" : "pending";
    }

    if (
      deployment.status === DeploymentStatus.DEPLOYING ||
      deployment.status === DeploymentStatus.RETRYING ||
      deployment.providerDeployId
    ) {
      return "active";
    }

    return "pending";
  }

  private getBuildPhaseSummary(deployment: Deployment): string {
    if (deployment.status === DeploymentStatus.LIVE) {
      return "The provider build completed successfully.";
    }

    if (deployment.status === DeploymentStatus.FAILED) {
      return deployment.errorMessage ?? "The provider build failed.";
    }

    if (
      deployment.status === DeploymentStatus.DEPLOYING ||
      deployment.status === DeploymentStatus.RETRYING
    ) {
      return "The provider is currently building and promoting the deployment.";
    }

    return "Waiting for the provider build to start.";
  }

  private async buildEnvironmentContract(
    site: SiteDeploymentContext,
  ): Promise<DeploymentProviderEnvironment[]> {
    const operatorManaged = buildOperatorManagedEnvironmentContract({
      site,
      cmsApiUrl: this.getRequiredRuntimeConfig("DEPLOYMENTS_CMS_API_URL"),
      revalidateSecret: this.getRequiredRuntimeConfig(
        "DEPLOYMENTS_REVALIDATE_SECRET",
      ),
    });
    const customerManaged =
      await this.deploymentEnvironmentService.listCustomerEnvironmentEntries(
        site.siteId,
      );

    return [...operatorManaged, ...customerManaged];
  }

  private buildProjectSettings(): DeploymentProjectSettings {
    const defaultBuildCommand =
      "cd ../.. && corepack prepare pnpm@10.33.4 --activate && pnpm --filter @myallocator/website build";
    const defaultInstallCommand =
      "cd ../.. && corepack prepare pnpm@10.33.4 --activate && pnpm install --registry https://registry.npmjs.org --fetch-timeout=60000 --fetch-retries=3 --no-frozen-lockfile";
    const buildCommand = this.normalizeBuildCommand(
      this.getOptionalConfig("DEPLOYMENTS_WEBSITE_BUILD_COMMAND") ??
        defaultBuildCommand,
      defaultBuildCommand,
    );
    const installCommand = this.normalizeInstallCommand(
      this.getOptionalConfig("DEPLOYMENTS_WEBSITE_INSTALL_COMMAND") ??
        defaultInstallCommand,
      defaultInstallCommand,
    );

    return {
      framework:
        this.getOptionalConfig("DEPLOYMENTS_WEBSITE_FRAMEWORK") ?? "nextjs",
      rootDirectory:
        this.getOptionalConfig("DEPLOYMENTS_WEBSITE_ROOT_DIRECTORY") ??
        "apps/website",
      buildCommand,
      outputDirectory:
        this.getOptionalConfig("DEPLOYMENTS_WEBSITE_OUTPUT_DIRECTORY") ??
        ".next",
      installCommand,
      nodeVersion:
        this.getOptionalConfig("DEPLOYMENTS_WEBSITE_NODE_VERSION") ?? "20.x",
    };
  }

  private getOptionalConfig(key: string): string | undefined {
    const value = this.configService.get<string>(key);
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmedValue = value.trim();

    return trimmedValue.length > 0 ? trimmedValue : undefined;
  }

  private isSharedRuntimeModeEnabled(): boolean {
    return Boolean(
      this.getSharedRuntimeProjectId() || this.getSharedRuntimeProviderUrl(),
    );
  }

  private getSharedRuntimeProjectId(): string | null {
    return this.getOptionalConfig("WEBSITE_VERCEL_PROJECT_ID") ?? null;
  }

  private getSharedRuntimeProviderUrl(): string | null {
    const configuredProjectName =
      this.getOptionalConfig("WEBSITE_VERCEL_PROJECT_NAME") ?? null;

    if (!configuredProjectName) {
      return null;
    }

    if (configuredProjectName.includes(".")) {
      return this.normalizeUrl(
        configuredProjectName.startsWith("http")
          ? configuredProjectName
          : `https://${configuredProjectName}`,
      );
    }

    return this.normalizeUrl(`https://${configuredProjectName}.vercel.app`);
  }

  private getSharedRuntimeRevalidationUrl(): string | null {
    const websiteOrigin = this.getOptionalConfig("WEBSITE_APP_ORIGIN");

    if (websiteOrigin) {
      try {
        return new URL("/api/revalidate", websiteOrigin).toString();
      } catch {
        return null;
      }
    }

    return this.getOptionalConfig("REVALIDATION_URL") ?? null;
  }

  private getSharedRuntimeSecret(): string | null {
    return (
      this.getOptionalConfig("WEBSITE_RUNTIME_SECRET") ??
      this.getOptionalConfig("REVALIDATE_SECRET") ??
      null
    );
  }

  private normalizeBuildCommand(
    buildCommand: string,
    defaultBuildCommand: string,
  ): string {
    const normalizedBuildCommand = buildCommand.trim();

    if (
      normalizedBuildCommand ===
        "cd ../.. && pnpm install && pnpm --filter @myallocator/website build" ||
      normalizedBuildCommand ===
        "cd ../.. && pnpm --filter @myallocator/website build"
    ) {
      return defaultBuildCommand;
    }

    return normalizedBuildCommand;
  }

  private normalizeInstallCommand(
    installCommand: string,
    defaultInstallCommand: string,
  ): string {
    const normalizedInstallCommand = installCommand.trim();

    if (
      normalizedInstallCommand ===
        "cd ../.. && pnpm install --no-frozen-lockfile" ||
      normalizedInstallCommand === "cd ../.. && pnpm install" ||
      normalizedInstallCommand === "cd ../.. && pnpm install --frozen-lockfile"
    ) {
      return defaultInstallCommand;
    }

    return normalizedInstallCommand;
  }

  private buildProjectName(site: SiteProvisioningRecord): string {
    const prefix =
      this.configService.get<string>("DEPLOYMENTS_PROJECT_NAME_PREFIX") ??
      "myallocator-site";
    const suffix = site.id.slice(-8);
    const siteSlug = this.normalizeSiteSlug(site.slug, site.name);
    const candidate = `${prefix}-${siteSlug}-${suffix}`.toLowerCase();

    return candidate
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 100);
  }

  private normalizeSiteSlug(slug: string, fallbackName: string): string {
    const normalized = `${slug || fallbackName}`
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return normalized || "site";
  }

  private buildInitialMetadata(
    site: SiteProvisioningRecord,
  ): Prisma.InputJsonObject {
    return this.mergeMetadata(null, {
      projectName: this.buildProjectName(site),
      primaryDomain: site.domains[0]?.host ?? null,
    });
  }

  private toSiteContext(site: SiteProvisioningRecord): SiteDeploymentContext {
    return {
      siteId: site.id,
      siteSlug: this.normalizeSiteSlug(site.slug, site.name),
      siteName: site.settings?.siteName || site.name,
      tenantId: site.tenantId,
      primaryLocale: site.primaryLocale,
      enabledLocales: this.normalizeLocales(
        site.enabledLocales,
        site.primaryLocale,
      ),
      primaryDomain: site.domains[0]?.host ?? null,
    };
  }

  private normalizeLocales(locales: string[], primaryLocale: string): string[] {
    const normalized = Array.from(
      new Set([primaryLocale, ...locales].filter((value) => !!value)),
    );

    return normalized.length > 0 ? normalized : [primaryLocale];
  }

  private toDeploymentStatus(
    snapshot: DeploymentStatusSnapshot,
  ): DeploymentStatus {
    if (snapshot.isLive) {
      return DeploymentStatus.LIVE;
    }

    if (snapshot.isFailed) {
      return DeploymentStatus.FAILED;
    }

    return DeploymentStatus.DEPLOYING;
  }

  private describeProvisioningError(error: unknown): string {
    if (error instanceof DeploymentProviderError) {
      if (error.statusCode === 409) {
        return `${error.message}. Manual provider project mapping is required before retrying.`;
      }

      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return "Dedicated site provisioning failed";
  }

  private async updateDeployment(
    deploymentId: string,
    data: Prisma.DeploymentUpdateInput,
  ): Promise<Deployment> {
    return this.prisma.deployment.update({
      where: { id: deploymentId },
      data,
    });
  }

  private mergeMetadata(
    current: Prisma.JsonValue | null | undefined,
    patch: Record<string, unknown>,
  ): Prisma.InputJsonObject {
    const merged = {
      ...asDeploymentMetadata(current),
      ...patch,
    };
    const nextMetadata: Record<string, Prisma.InputJsonValue> = {};

    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined) {
        nextMetadata[key] = value as Prisma.InputJsonValue;
      }
    }

    return nextMetadata as Prisma.InputJsonObject;
  }

  private isSharedRuntimeDeployment(deployment: Deployment): boolean {
    const metadata = asDeploymentMetadata(deployment.metadata);
    return metadata.sharedRuntime === true;
  }

  private getRequiredRuntimeConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new Error(
        `${key} must be configured for dedicated site deployments`,
      );
    }

    return value;
  }

  private normalizeUrl(url: string): string {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    return `https://${url}`;
  }
}
