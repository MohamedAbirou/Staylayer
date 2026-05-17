import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DomainDnsConfigSnapshot,
  DeploymentLogEntry,
  DomainAttachmentSnapshot,
  DeploymentProject,
  DeploymentProjectSettings,
  DeploymentProvider,
  DeploymentProviderError,
  DeploymentStatusSnapshot,
  DeploymentTimelinePhase,
  EnsureDomainAttachmentInput,
  EnsureDeploymentProjectInput,
  GetDomainAttachmentStatusInput,
  GetDeploymentStatusInput,
  RollbackDeploymentInput,
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
  name?: string;
  readyState?: string;
  readyStateReason?: string;
  status?: string;
  errorMessage?: string;
  alias?: unknown[];
  aliasFinal?: string;
  target?: string | null;
  url?: string;
};

type VercelDeploymentEventResponse = Array<{
  type?: string;
  created?: number | string;
  id?: string;
  text?: string;
  date?: number | string;
  statusCode?: number | string;
  info?: {
    type?: string;
    name?: string;
    entrypoint?: string;
    path?: string;
    step?: string;
    readyState?: string;
  };
  payload?: {
    text?: string;
    id?: string;
    created?: number | string;
    date?: number | string;
    statusCode?: number | string;
    info?: {
      type?: string;
      name?: string;
      entrypoint?: string;
      path?: string;
      step?: string;
      readyState?: string;
    };
  };
}>;

type VercelProjectDomainResponse = {
  id?: string;
  name?: string;
  verified?: boolean;
  apexName?: string;
  redirect?: string | null;
  redirectStatusCode?: number | null;
  gitBranch?: string | null;
  serviceType?: string | null;
  verification?: VercelDomainVerificationRecord[];
  misconfigured?: boolean;
  error?: {
    code?: string;
    message?: string;
  } | null;
};

type VercelDomainVerificationRecord = {
  type?: unknown;
  domain?: unknown;
  value?: unknown;
  reason?: unknown;
};

type VercelDomainConfigResponse = {
  configuredBy?: string | null;
  acceptedChallenges?: unknown[];
  recommendedIPv4?: Array<{
    rank?: number;
    value?: unknown[];
  }>;
  recommendedCNAME?: Array<{
    rank?: number;
    value?: string;
  }>;
  misconfigured?: boolean;
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
    const [deployment, events] = await Promise.all([
      this.request<VercelDeploymentResponse>(
        `/v13/deployments/${encodeURIComponent(input.providerDeployId)}`,
        {
          method: "GET",
        },
      ),
      this.getDeploymentEvents(input.providerDeployId).catch(
        () => [] as VercelDeploymentEventResponse,
      ),
    ]);

    return this.toDeploymentSnapshot(deployment, events);
  }

  async rollbackDeployment(input: RollbackDeploymentInput): Promise<void> {
    await this.request(
      `/v1/projects/${encodeURIComponent(input.projectId)}/rollback/${encodeURIComponent(input.providerDeployId)}`,
      {
        method: "POST",
      },
    );
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
      const config = await this.getDomainConfig(input).catch(() => null);

      return this.toDomainAttachmentSnapshot(input.domain, domain, config);
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
    const [domain, config] = await Promise.all([
      this.request<VercelProjectDomainResponse>(
        `/v9/projects/${encodeURIComponent(input.projectId)}/domains/${encodeURIComponent(input.domain)}`,
        {
          method: "GET",
        },
      ),
      this.getDomainConfig(input).catch(() => null),
    ]);

    return this.toDomainAttachmentSnapshot(input.domain, domain, config);
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

  private async getDeploymentEvents(
    providerDeployId: string,
  ): Promise<VercelDeploymentEventResponse> {
    return this.request<VercelDeploymentEventResponse>(
      `/v3/deployments/${encodeURIComponent(providerDeployId)}/events`,
      {
        method: "GET",
      },
      {
        builds: "1",
        direction: "forward",
        limit: "-1",
      },
    );
  }

  private async getDomainConfig(
    input: EnsureDomainAttachmentInput,
  ): Promise<VercelDomainConfigResponse> {
    return this.request<VercelDomainConfigResponse>(
      `/v6/domains/${encodeURIComponent(input.domain)}/config`,
      {
        method: "GET",
      },
      {
        projectIdOrName: input.projectId,
      },
    );
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
    events: VercelDeploymentEventResponse = [],
  ): DeploymentStatusSnapshot {
    const readyState = deployment.readyState ?? null;
    const rawStatus = deployment.status ?? null;
    const errorMessage =
      deployment.errorMessage ?? deployment.readyStateReason ?? null;
    const providerUrl = this.normalizeUrl(deployment.url);
    const telemetry = this.toDeploymentTelemetry(events, {
      readyState,
      rawStatus,
      errorMessage,
    });

    return {
      providerDeployId: deployment.id,
      url: this.resolvePublicDeploymentUrl(deployment, providerUrl),
      providerUrl,
      readyState,
      rawStatus,
      errorMessage,
      timeline: telemetry.timeline,
      logs: telemetry.logs,
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

  private resolvePublicDeploymentUrl(
    deployment: VercelDeploymentResponse,
    providerUrl: string | null,
  ): string | null {
    const aliasFinal = this.normalizeUrl(deployment.aliasFinal);

    if (aliasFinal) {
      return aliasFinal;
    }

    const aliases = Array.isArray(deployment.alias)
      ? deployment.alias
          .filter((value): value is string => typeof value === "string")
          .map((value) => this.normalizeUrl(value))
          .filter((value): value is string => Boolean(value))
      : [];

    if (aliases.length > 0) {
      return aliases[0];
    }

    if (deployment.target === "production") {
      const projectDomain = this.normalizeUrl(
        deployment.name ? `${deployment.name}.vercel.app` : undefined,
      );

      if (projectDomain) {
        return projectDomain;
      }
    }

    return providerUrl;
  }

  private toDeploymentTelemetry(
    events: VercelDeploymentEventResponse,
    status: {
      readyState: string | null;
      rawStatus: string | null;
      errorMessage: string | null;
    },
  ): {
    timeline: DeploymentTimelinePhase[];
    logs: DeploymentLogEntry[];
  } {
    const normalizedEvents = events
      .map((event, index) => this.normalizeDeploymentEvent(event, index))
      .filter(
        (
          event,
        ): event is {
          id: string;
          createdAt: string;
          phaseKey: string;
          label: string;
          summary: string | null;
          text: string | null;
          level: DeploymentLogEntry["level"];
        } => Boolean(event),
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    if (normalizedEvents.length === 0) {
      return {
        timeline: [this.buildFallbackDeploymentPhase(status)],
        logs: [],
      };
    }

    const timelineMap = new Map<string, DeploymentTimelinePhase>();
    let lastPhaseKey: string | null = null;

    for (const event of normalizedEvents) {
      if (lastPhaseKey && lastPhaseKey !== event.phaseKey) {
        const previous = timelineMap.get(lastPhaseKey);
        if (previous && previous.status === "active") {
          previous.status = "completed";
          previous.completedAt = event.createdAt;
        }
      }

      const phase = timelineMap.get(event.phaseKey);

      if (!phase) {
        timelineMap.set(event.phaseKey, {
          key: event.phaseKey,
          label: event.label,
          status: "active",
          startedAt: event.createdAt,
          completedAt: null,
          summary: event.summary,
        });
      } else {
        phase.summary = event.summary ?? phase.summary ?? null;
      }

      lastPhaseKey = event.phaseKey;
    }

    const timeline = Array.from(timelineMap.values());
    const lastPhase = timeline[timeline.length - 1];
    const lastEventTimestamp =
      normalizedEvents[normalizedEvents.length - 1]?.createdAt ?? null;

    if (lastPhase) {
      if (this.isReady(status)) {
        lastPhase.status = "completed";
        lastPhase.completedAt ??= lastEventTimestamp;
      } else if (this.isFailed(status)) {
        lastPhase.status = "failed";
        lastPhase.completedAt ??= lastEventTimestamp;
        lastPhase.summary = status.errorMessage ?? lastPhase.summary ?? null;
      }
    }

    if (
      this.isReady(status) &&
      !timeline.some((phase) => phase.key === "provider:ready")
    ) {
      const completedAt = lastEventTimestamp ?? new Date().toISOString();
      timeline.push({
        key: "provider:ready",
        label: "Ready",
        status: "completed",
        startedAt: completedAt,
        completedAt,
        summary: "The deployment is live at the provider.",
      });
    }

    return {
      timeline,
      logs: normalizedEvents
        .filter((event) => Boolean(event.text))
        .slice(-30)
        .map((event) => ({
          id: event.id,
          createdAt: event.createdAt,
          text: event.text ?? "",
          phaseKey: event.phaseKey,
          level: event.level,
        })),
    };
  }

  private normalizeDeploymentEvent(
    event: VercelDeploymentEventResponse[number],
    index: number,
  ): {
    id: string;
    createdAt: string;
    phaseKey: string;
    label: string;
    summary: string | null;
    text: string | null;
    level: DeploymentLogEntry["level"];
  } | null {
    const payload = this.getDeploymentEventPayload(event);
    const info = payload?.info ?? event.info;
    const phaseSource =
      info?.step ??
      info?.name ??
      info?.path ??
      info?.type ??
      event.type ??
      "deployment";
    const createdAt = this.toIsoTimestamp(
      payload?.created ?? payload?.date ?? event.created ?? event.date,
    );

    if (!createdAt) {
      return null;
    }

    const text = this.normalizeText(payload?.text ?? event.text);
    const derivedSummary = [info?.readyState, info?.entrypoint]
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      )
      .join(" ");
    const phaseLabel = this.toPhaseLabel(phaseSource);
    const summary =
      text ??
      (derivedSummary.length > 0
        ? derivedSummary
        : `${phaseLabel} in progress`);

    return {
      id: payload?.id ?? event.id ?? `${phaseSource}-${index}`,
      createdAt,
      phaseKey: `provider:${this.toIdentifier(phaseSource)}`,
      label: phaseLabel,
      summary,
      text: text ?? summary,
      level: this.toLogLevel(text, payload?.statusCode ?? event.statusCode),
    };
  }

  private getDeploymentEventPayload(
    event: VercelDeploymentEventResponse[number],
  ): {
    text?: string;
    id?: string;
    created?: number | string;
    date?: number | string;
    statusCode?: number | string;
    info?: {
      type?: string;
      name?: string;
      entrypoint?: string;
      path?: string;
      step?: string;
      readyState?: string;
    };
  } | null {
    if (!event.payload || typeof event.payload !== "object") {
      return null;
    }

    return event.payload;
  }

  private buildFallbackDeploymentPhase(status: {
    readyState: string | null;
    rawStatus: string | null;
    errorMessage: string | null;
  }): DeploymentTimelinePhase {
    return {
      key: "provider:deployment",
      label: this.toPhaseLabel(
        status.readyState ?? status.rawStatus ?? "deployment",
      ),
      status: this.isReady(status)
        ? "completed"
        : this.isFailed(status)
          ? "failed"
          : "active",
      startedAt: null,
      completedAt: null,
      summary:
        status.errorMessage ??
        this.normalizeText(
          status.readyState ?? status.rawStatus ?? "Deployment in progress",
        ),
    };
  }

  private toLogLevel(
    text: string | null,
    statusCode?: number | string,
  ): DeploymentLogEntry["level"] {
    if (typeof statusCode === "number" && statusCode >= 400) {
      return "error";
    }

    if (typeof statusCode === "string" && Number(statusCode) >= 400) {
      return "error";
    }

    const normalizedText = text?.toLowerCase() ?? "";

    if (
      normalizedText.includes("error") ||
      normalizedText.includes("failed") ||
      normalizedText.includes("fatal")
    ) {
      return "error";
    }

    if (normalizedText.includes("warn")) {
      return "warning";
    }

    return "info";
  }

  private toIsoTimestamp(value: number | string | undefined): string | null {
    if (typeof value === "number") {
      return new Date(value).toISOString();
    }

    if (typeof value === "string" && value.length > 0) {
      const numericValue = Number(value);
      if (!Number.isNaN(numericValue)) {
        return new Date(numericValue).toISOString();
      }

      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }

    return null;
  }

  private toPhaseLabel(value: string): string {
    return value
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (match) => match.toUpperCase());
  }

  private toIdentifier(value: string): string {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return normalized || "deployment";
  }

  private normalizeText(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private isReady(status: {
    readyState: string | null;
    rawStatus: string | null;
  }): boolean {
    return status.readyState === "READY" || status.rawStatus === "READY";
  }

  private isFailed(status: {
    readyState: string | null;
    rawStatus: string | null;
  }): boolean {
    return (
      status.readyState === "ERROR" ||
      status.readyState === "CANCELED" ||
      status.rawStatus === "ERROR" ||
      status.rawStatus === "CANCELED"
    );
  }

  private toDomainAttachmentSnapshot(
    requestedDomain: string,
    payload: VercelProjectDomainResponse,
    dnsConfig: VercelDomainConfigResponse | null = null,
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
      dnsConfig: this.toDomainDnsConfig(
        payload.name ?? requestedDomain,
        payload.apexName ?? null,
        dnsConfig,
        verification,
      ),
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

  private toDomainDnsConfig(
    requestedDomain: string,
    apexName: string | null,
    dnsConfig: VercelDomainConfigResponse | null,
    verification: VercelDomainVerificationRecord[] = [],
  ): DomainDnsConfigSnapshot | null {
    const verificationRecords = this.toVerificationRecommendedRecords(
      requestedDomain,
      apexName,
      verification,
    );

    if (!dnsConfig && verificationRecords.length === 0) {
      return null;
    }

    const recordName = this.toRecordName(requestedDomain, apexName);
    const recommendedA = Array.isArray(dnsConfig?.recommendedIPv4)
      ? dnsConfig.recommendedIPv4.flatMap((entry) => {
          const acceptedValues = Array.isArray(entry.value)
            ? entry.value.filter(
                (value): value is string => typeof value === "string",
              )
            : [];

          if (acceptedValues.length === 0) {
            return [];
          }

          return [
            {
              type: "A" as const,
              name: recordName,
              host: requestedDomain,
              value: acceptedValues[0],
              acceptedValues,
              rank: typeof entry.rank === "number" ? entry.rank : null,
            },
          ];
        })
      : [];
    const recommendedCname = Array.isArray(dnsConfig?.recommendedCNAME)
      ? dnsConfig.recommendedCNAME.flatMap((entry) => {
          if (typeof entry.value !== "string" || entry.value.length === 0) {
            return [];
          }

          return [
            {
              type: "CNAME" as const,
              name: recordName,
              host: requestedDomain,
              value: entry.value,
              acceptedValues: [entry.value],
              rank: typeof entry.rank === "number" ? entry.rank : null,
            },
          ];
        })
      : [];
    const recommendedRecords =
      verificationRecords.length > 0
        ? verificationRecords
        : [...recommendedA, ...recommendedCname];

    return {
      configuredBy:
        typeof dnsConfig?.configuredBy === "string"
          ? dnsConfig.configuredBy
          : (recommendedRecords[0]?.type ?? null),
      acceptedChallenges: Array.isArray(dnsConfig?.acceptedChallenges)
        ? dnsConfig.acceptedChallenges.filter(
            (value): value is string => typeof value === "string",
          )
        : [],
      misconfigured:
        dnsConfig?.misconfigured === true || verificationRecords.length > 0,
      recommendedRecords,
    };
  }

  private toVerificationRecommendedRecords(
    requestedDomain: string,
    apexName: string | null,
    verification: VercelDomainVerificationRecord[],
  ): DomainDnsConfigSnapshot["recommendedRecords"] {
    return verification.flatMap((entry) => {
      const type =
        typeof entry.type === "string" ? entry.type.toUpperCase() : null;
      const value = typeof entry.value === "string" ? entry.value.trim() : null;

      if ((type !== "A" && type !== "CNAME") || !value) {
        return [];
      }

      const recordDomain =
        typeof entry.domain === "string" && entry.domain.trim().length > 0
          ? entry.domain.trim()
          : requestedDomain;
      const name = this.toVerificationRecordName(
        recordDomain,
        requestedDomain,
        apexName,
      );

      return [
        {
          type,
          name,
          host: this.toVerificationRecordHost(recordDomain, name, apexName),
          value,
          acceptedValues: [value],
          rank: 0,
        },
      ];
    });
  }

  private toVerificationRecordName(
    recordDomain: string,
    requestedDomain: string,
    apexName: string | null,
  ): string {
    if (recordDomain === "@") {
      return "@";
    }

    if (!recordDomain.includes(".")) {
      return recordDomain;
    }

    return this.toRecordName(recordDomain || requestedDomain, apexName);
  }

  private toVerificationRecordHost(
    recordDomain: string,
    name: string,
    apexName: string | null,
  ): string {
    if (recordDomain.includes(".")) {
      return recordDomain;
    }

    if (name === "@" && apexName) {
      return apexName;
    }

    if (apexName) {
      return `${name}.${apexName}`;
    }

    return recordDomain;
  }

  private toRecordName(
    requestedDomain: string,
    apexName: string | null,
  ): string {
    if (!apexName) {
      return requestedDomain;
    }

    if (requestedDomain === apexName) {
      return "@";
    }

    const suffix = `.${apexName}`;

    if (requestedDomain.endsWith(suffix)) {
      return requestedDomain.slice(0, -suffix.length);
    }

    return requestedDomain;
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
