import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DomainAttachmentSnapshot,
  DeploymentProject,
  DeploymentProjectSettings,
  DeploymentProvider,
  DeploymentProviderError,
  DeploymentStatusSnapshot,
  EnsureDomainAttachmentInput,
  EnsureDeploymentProjectInput,
  GetDomainAttachmentStatusInput,
  GetDeploymentStatusInput,
  SyncDeploymentEnvironmentInput,
  TriggerDeploymentInput,
} from "./deployment-provider.port";

type VercelProjectResponse = {
  id: string;
  name: string;
  latestDeployments?: Array<{
    id?: string;
    readyState?: string;
    status?: string;
    url?: string;
  }>;
};

type VercelDeploymentResponse = {
  id: string;
  readyState?: string;
  readyStateReason?: string;
  status?: string;
  errorMessage?: string;
  url?: string;
};

type VercelProjectDomainResponse = {
  id?: string;
  name?: string;
  verified?: boolean;
  apexName?: string;
  redirect?: string | null;
  redirectStatusCode?: number | null;
  gitBranch?: string | null;
  serviceType?: string | null;
  verification?: Array<Record<string, unknown>>;
  misconfigured?: boolean;
  error?: {
    code?: string;
    message?: string;
  } | null;
};

@Injectable()
export class VercelDeploymentProvider implements DeploymentProvider {
  readonly name = "vercel";

  constructor(private readonly configService: ConfigService) {}

  async ensureProject(
    input: EnsureDeploymentProjectInput,
  ): Promise<DeploymentProject> {
    if (input.existingProjectId) {
      const project = await this.request<VercelProjectResponse>(
        `/v9/projects/${encodeURIComponent(input.existingProjectId)}`,
        {
          method: "PATCH",
          body: this.toProjectConfigurationPayload(
            input.projectSettings,
            false,
          ),
        },
      );

      return {
        projectId: project.id,
        projectName: project.name,
        created: false,
        metadata: {
          latestDeploymentId: project.latestDeployments?.[0]?.id ?? null,
        },
      };
    }

    const project = await this.request<VercelProjectResponse>("/v11/projects", {
      method: "POST",
      body: {
        name: input.projectName,
        ...this.toProjectConfigurationPayload(input.projectSettings, true),
        gitRepository: {
          repo: this.getRequiredConfig("DEPLOYMENTS_VERCEL_GIT_REPO"),
          type: this.getGitProvider(),
          productionBranch: this.getProductionBranch(),
        },
      },
    });

    return {
      projectId: project.id,
      projectName: project.name,
      created: true,
      metadata: {
        latestDeploymentId: project.latestDeployments?.[0]?.id ?? null,
      },
    };
  }

  async syncEnvironmentVariables(
    input: SyncDeploymentEnvironmentInput,
  ): Promise<void> {
    for (const variable of input.environment) {
      await this.request(
        `/v10/projects/${encodeURIComponent(input.projectId)}/env`,
        {
          method: "POST",
          body: {
            key: variable.key,
            value: variable.value,
            type: variable.type ?? "plain",
            target: variable.target ?? ["production"],
            comment: variable.comment,
          },
        },
        { upsert: "true" },
      );
    }
  }

  async triggerDeployment(
    input: TriggerDeploymentInput,
  ): Promise<DeploymentStatusSnapshot> {
    const body: Record<string, unknown> = {
      name: input.projectName,
      project: input.projectId,
      target: "production",
      meta: input.meta,
      projectSettings: this.toDeploymentProjectSettingsPayload(
        input.projectSettings,
      ),
    };

    if (input.previousDeploymentId) {
      body.deploymentId = input.previousDeploymentId;
      body.withLatestCommit = true;
    } else {
      body.gitSource = {
        type: this.getGitProvider(),
        repoId: this.getRequiredConfig("DEPLOYMENTS_VERCEL_GIT_REPO_ID"),
        ref: this.getProductionBranch(),
      };
    }

    const deployment = await this.request<VercelDeploymentResponse>(
      "/v13/deployments",
      {
        method: "POST",
        body,
      },
      {
        forceNew: "1",
        skipAutoDetectionConfirmation: "1",
      },
    );

    return this.toDeploymentSnapshot(deployment);
  }

  async getDeploymentStatus(
    input: GetDeploymentStatusInput,
  ): Promise<DeploymentStatusSnapshot> {
    const deployment = await this.request<VercelDeploymentResponse>(
      `/v13/deployments/${encodeURIComponent(input.providerDeployId)}`,
      {
        method: "GET",
      },
    );

    return this.toDeploymentSnapshot(deployment);
  }

  async ensureDomainAttachment(
    input: EnsureDomainAttachmentInput,
  ): Promise<DomainAttachmentSnapshot> {
    try {
      const domain = await this.request<VercelProjectDomainResponse>(
        `/v10/projects/${encodeURIComponent(input.projectId)}/domains`,
        {
          method: "POST",
          body: {
            name: input.domain,
          },
        },
      );

      return this.toDomainAttachmentSnapshot(input.domain, domain);
    } catch (error) {
      if (
        error instanceof DeploymentProviderError &&
        error.statusCode === 409
      ) {
        return this.getDomainAttachmentStatus(input);
      }

      throw error;
    }
  }

  async getDomainAttachmentStatus(
    input: GetDomainAttachmentStatusInput,
  ): Promise<DomainAttachmentSnapshot> {
    const domain = await this.request<VercelProjectDomainResponse>(
      `/v9/projects/${encodeURIComponent(input.projectId)}/domains/${encodeURIComponent(input.domain)}`,
      {
        method: "GET",
      },
    );

    return this.toDomainAttachmentSnapshot(input.domain, domain);
  }

  private async request<T>(
    path: string,
    init: { method: string; body?: unknown },
    query: Record<string, string> = {},
  ): Promise<T> {
    const token = this.getRequiredConfig("DEPLOYMENTS_VERCEL_ACCESS_TOKEN");
    const url = new URL(`https://api.vercel.com${path}`);

    for (const [key, value] of Object.entries({
      ...query,
      ...this.getTeamQuery(),
    })) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    const text = await response.text();
    const payload = this.parseJson(text);

    if (!response.ok) {
      throw new DeploymentProviderError(
        this.toErrorMessage(response.status, payload),
        response.status,
        payload,
      );
    }

    return payload as T;
  }

  private parseJson(text: string): unknown {
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private toErrorMessage(statusCode: number, payload: unknown): string {
    if (payload && typeof payload === "object") {
      const objectPayload = payload as Record<string, unknown>;
      const error = objectPayload.error;
      if (error && typeof error === "object") {
        const errorPayload = error as Record<string, unknown>;
        const message = errorPayload.message;
        if (typeof message === "string" && message.length > 0) {
          return message;
        }
      }

      const message = objectPayload.message;
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
    }

    return `Vercel API request failed with status ${statusCode}`;
  }

  private toProjectConfigurationPayload(
    settings: DeploymentProjectSettings,
    isCreate = false, // add this flag
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      framework: settings.framework,
      rootDirectory: settings.rootDirectory,
      buildCommand: settings.buildCommand,
      outputDirectory: settings.outputDirectory,
      installCommand: settings.installCommand,
    };

    // nodeVersion is only allowed on PATCH (update), not on POST (create)
    if (!isCreate && settings.nodeVersion) {
      payload.nodeVersion = settings.nodeVersion;
    }

    return payload;
  }

  private toDeploymentProjectSettingsPayload(
    settings: DeploymentProjectSettings,
  ): Record<string, unknown> {
    return {
      framework: settings.framework,
      rootDirectory: settings.rootDirectory,
      buildCommand: settings.buildCommand,
      outputDirectory: settings.outputDirectory,
      installCommand: settings.installCommand,
    };
  }

  private toDeploymentSnapshot(
    deployment: VercelDeploymentResponse,
  ): DeploymentStatusSnapshot {
    const readyState = deployment.readyState ?? null;
    const rawStatus = deployment.status ?? null;

    return {
      providerDeployId: deployment.id,
      url: this.normalizeUrl(deployment.url),
      readyState,
      rawStatus,
      errorMessage:
        deployment.errorMessage ?? deployment.readyStateReason ?? null,
      metadata: {
        providerReadyState: readyState,
        providerStatus: rawStatus,
      },
      isLive: readyState === "READY" || rawStatus === "READY",
      isFailed:
        readyState === "ERROR" ||
        readyState === "CANCELED" ||
        rawStatus === "ERROR" ||
        rawStatus === "CANCELED",
    };
  }

  private toDomainAttachmentSnapshot(
    requestedDomain: string,
    payload: VercelProjectDomainResponse,
  ): DomainAttachmentSnapshot {
    const verification = Array.isArray(payload.verification)
      ? payload.verification
      : [];
    const verificationType = verification
      .map((entry) => {
        const type = entry.type;
        return typeof type === "string" ? type : null;
      })
      .filter((value): value is string => Boolean(value))
      .join(", ");
    const errorMessage =
      payload.error?.message ??
      (payload.misconfigured
        ? "The deployment provider reports this domain as misconfigured"
        : null);

    return {
      domain: payload.name ?? requestedDomain,
      providerDomainId: payload.id ?? null,
      providerStatus: payload.serviceType ?? null,
      verificationStatus:
        payload.verified === true ? "verified" : verificationType || "pending",
      isAssigned: Boolean(payload.id || payload.name),
      isVerified: payload.verified === true,
      isFailed: Boolean(payload.misconfigured || payload.error?.code),
      errorMessage,
      metadata: {
        verified: payload.verified === true,
        apexName: payload.apexName ?? null,
        redirect: payload.redirect ?? null,
        redirectStatusCode: payload.redirectStatusCode ?? null,
        gitBranch: payload.gitBranch ?? null,
        verification,
      },
    };
  }

  private normalizeUrl(url: string | undefined): string | null {
    if (!url) {
      return null;
    }

    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    return `https://${url}`;
  }

  private getGitProvider(): string {
    return (
      this.configService.get<string>("DEPLOYMENTS_VERCEL_GIT_PROVIDER") ??
      "github"
    );
  }

  private getProductionBranch(): string {
    return (
      this.configService.get<string>("DEPLOYMENTS_VERCEL_PRODUCTION_BRANCH") ??
      "main"
    );
  }

  private getTeamQuery(): Record<string, string> {
    const teamId = this.configService.get<string>("DEPLOYMENTS_VERCEL_TEAM_ID");
    const slug = this.configService.get<string>("DEPLOYMENTS_VERCEL_TEAM_SLUG");

    return {
      teamId: teamId ?? "",
      slug: slug ?? "",
    };
  }

  private getRequiredConfig(key: string): string {
    const value = this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new DeploymentProviderError(
        `${key} must be configured for dedicated site deployments`,
      );
    }

    return value;
  }
}
