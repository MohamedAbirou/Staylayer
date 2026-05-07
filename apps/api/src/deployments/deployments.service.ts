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
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  DEPLOYMENT_PROVIDER,
  DeploymentProjectSettings,
  DeploymentProvider,
  DeploymentProviderEnvironment,
  DeploymentProviderError,
  DeploymentStatusSnapshot,
  SiteDeploymentContext,
} from "./deployment-provider.port";
import {
  ACTIVE_PROVISIONING_STATUSES,
  asDeploymentMetadata,
  SiteRevalidationTarget,
  TRACKABLE_DEPLOYMENT_STATUSES,
} from "./deployments.types";

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

export type CustomerSiteDeployment = {
  id: string;
  siteId: string;
  status: DeploymentStatus;
  url: string | null;
  providerUrl: string | null;
  errorMessage: string | null;
  providerDeployId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(DEPLOYMENT_PROVIDER)
    private readonly deploymentProvider: DeploymentProvider,
  ) {}

  async provisionSite(siteId: string): Promise<Deployment> {
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
    const environment = this.buildEnvironmentContract(siteContext);
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
        providerReadyState: snapshot.readyState ?? null,
        providerStatus: snapshot.rawStatus ?? null,
        providerMetadata: snapshot.metadata ?? null,
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

  private buildCustomerSiteDeployment(
    deployment: Deployment,
    primaryDomain: string | null,
  ): CustomerSiteDeployment {
    const providerUrl = deployment.url
      ? this.normalizeUrl(deployment.url)
      : null;
    const publicUrl =
      primaryDomain && deployment.status === DeploymentStatus.LIVE
        ? `https://${primaryDomain}`
        : providerUrl;

    return {
      id: deployment.id,
      siteId: deployment.siteId,
      status: deployment.status,
      url: publicUrl,
      providerUrl,
      errorMessage: deployment.errorMessage,
      providerDeployId: deployment.providerDeployId,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
    };
  }

  private buildEnvironmentContract(
    site: SiteDeploymentContext,
  ): DeploymentProviderEnvironment[] {
    const cmsApiUrl = this.getRequiredRuntimeConfig("DEPLOYMENTS_CMS_API_URL");
    const revalidateSecret = this.getRequiredRuntimeConfig(
      "DEPLOYMENTS_REVALIDATE_SECRET",
    );

    const environment: DeploymentProviderEnvironment[] = [
      {
        key: "CMS_API_URL",
        value: cmsApiUrl,
      },
      {
        key: "NEXT_PUBLIC_CMS_API_URL",
        value: cmsApiUrl,
      },
      {
        key: "REQUIRE_CMS_DATA",
        value: "1",
      },
      {
        key: "SITE_ID",
        value: site.siteId,
      },
      {
        key: "NEXT_PUBLIC_SITE_ID",
        value: site.siteId,
      },
      {
        key: "SITE_SLUG",
        value: site.siteSlug,
      },
      {
        key: "REVALIDATE_SECRET",
        value: revalidateSecret,
        type: "encrypted",
      },
      {
        key: "REVALIDATION_SECRET",
        value: revalidateSecret,
        type: "encrypted",
      },
      {
        key: "PRIMARY_LOCALE",
        value: site.primaryLocale,
      },
      {
        key: "ENABLE_EXPERIMENTAL_COREPACK",
        value: "1",
      },
      {
        key: "ENABLED_LOCALES",
        value: this.normalizeLocales(
          site.enabledLocales,
          site.primaryLocale,
        ).join(","),
      },
      {
        key: "NEXT_PUBLIC_BRAND_NAME",
        value: site.siteName,
      },
    ];

    if (site.primaryDomain) {
      environment.push({
        key: "NEXT_PUBLIC_BRAND_URL",
        value: `https://${site.primaryDomain}`,
      });
    }

    return environment;
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
