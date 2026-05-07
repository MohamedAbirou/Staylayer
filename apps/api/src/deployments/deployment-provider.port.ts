export const DEPLOYMENT_PROVIDER = "DEPLOYMENT_PROVIDER";

export type DeploymentProviderEnvironment = {
  key: string;
  value: string;
  type?: "plain" | "encrypted";
  target?: string[];
  comment?: string;
};

export type DeploymentProjectSettings = {
  framework: string;
  rootDirectory: string;
  buildCommand?: string;
  outputDirectory?: string;
  installCommand?: string;
  nodeVersion?: string;
};

export type SiteDeploymentContext = {
  siteId: string;
  siteSlug: string;
  siteName: string;
  tenantId: string;
  primaryLocale: string;
  enabledLocales: string[];
  primaryDomain?: string | null;
};

export type EnsureDeploymentProjectInput = {
  projectName: string;
  existingProjectId?: string | null;
  site: SiteDeploymentContext;
  projectSettings: DeploymentProjectSettings;
};

export type DeploymentProject = {
  projectId: string;
  projectName: string;
  created: boolean;
  metadata?: Record<string, unknown>;
};

export type SyncDeploymentEnvironmentInput = {
  projectId: string;
  projectName: string;
  environment: DeploymentProviderEnvironment[];
};

export type TriggerDeploymentInput = {
  projectId: string;
  projectName: string;
  previousDeploymentId?: string | null;
  site: SiteDeploymentContext;
  projectSettings: DeploymentProjectSettings;
  meta?: Record<string, string>;
};

export type DeploymentStatusSnapshot = {
  providerDeployId: string;
  url?: string | null;
  readyState?: string | null;
  rawStatus?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  isLive: boolean;
  isFailed: boolean;
};

export type GetDeploymentStatusInput = {
  providerDeployId: string;
  projectId?: string | null;
};

export type EnsureDomainAttachmentInput = {
  projectId: string;
  domain: string;
};

export type GetDomainAttachmentStatusInput = EnsureDomainAttachmentInput;

export type DomainAttachmentSnapshot = {
  domain: string;
  providerDomainId?: string | null;
  providerStatus?: string | null;
  verificationStatus?: string | null;
  isAssigned: boolean;
  isVerified: boolean;
  isFailed: boolean;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export interface DeploymentProvider {
  readonly name: string;

  ensureProject(
    input: EnsureDeploymentProjectInput,
  ): Promise<DeploymentProject>;

  syncEnvironmentVariables(
    input: SyncDeploymentEnvironmentInput,
  ): Promise<void>;

  triggerDeployment(
    input: TriggerDeploymentInput,
  ): Promise<DeploymentStatusSnapshot>;

  getDeploymentStatus(
    input: GetDeploymentStatusInput,
  ): Promise<DeploymentStatusSnapshot>;

  ensureDomainAttachment(
    input: EnsureDomainAttachmentInput,
  ): Promise<DomainAttachmentSnapshot>;

  getDomainAttachmentStatus(
    input: GetDomainAttachmentStatusInput,
  ): Promise<DomainAttachmentSnapshot>;
}

export class DeploymentProviderError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "DeploymentProviderError";
  }
}
