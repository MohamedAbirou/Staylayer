import client from "./client";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SiteDeploymentStatus =
  | "PENDING"
  | "CREATING_PROJECT"
  | "SYNCING_ENV"
  | "DEPLOYING"
  | "LIVE"
  | "FAILED"
  | "RETRYING";

export interface SiteDeploymentTimelinePhase {
  key: string;
  label: string;
  status: "pending" | "active" | "completed" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  summary: string | null;
}

export interface SiteDeploymentLogEntry {
  id: string;
  createdAt: string;
  text: string;
  phaseKey: string | null;
  level: "info" | "warning" | "error";
}

export interface SiteDeploymentEnvironmentVariable {
  id: string;
  key: string;
  type: "plain" | "encrypted";
  description: string | null;
  targets: string[];
  editable: boolean;
  source: "customer" | "operator";
  isValueSet: boolean;
  value: string | null;
  valuePreview: string | null;
  updatedAt: string | null;
}

export interface SiteDeploymentEnvironmentCatalog {
  customerEditable: SiteDeploymentEnvironmentVariable[];
  operatorManaged: SiteDeploymentEnvironmentVariable[];
}

export interface SiteDeployment {
  id: string;
  siteId: string;
  status: SiteDeploymentStatus;
  url: string | null;
  providerUrl: string | null;
  errorMessage: string | null;
  providerDeployId: string | null;
  timeline: SiteDeploymentTimelinePhase[];
  recentLogs: SiteDeploymentLogEntry[];
  createdAt: string;
  updatedAt: string;
}

// ─── Customer endpoints ─────────────────────────────────────────────────────────

// GET /deployments/latest?siteId=:siteId
export async function getLatestDeployment(
  siteId: string,
): Promise<SiteDeployment | null> {
  const { data } = await client.get<SiteDeployment | null>(
    "/deployments/latest",
    { params: { siteId } },
  );
  return data;
}

export async function getDeployments(
  siteId: string,
): Promise<SiteDeployment[]> {
  const { data } = await client.get<SiteDeployment[]>("/deployments", {
    params: { siteId },
  });
  return data;
}

export async function provisionDeployment(
  siteId: string,
): Promise<SiteDeployment> {
  const { data } = await client.post<SiteDeployment>(
    "/deployments/provision",
    {},
    { params: { siteId } },
  );
  return data;
}

export async function retryDeployment(
  siteId: string,
  deploymentId: string,
): Promise<SiteDeployment> {
  const { data } = await client.post<SiteDeployment>(
    `/deployments/${deploymentId}/retry`,
    {},
    { params: { siteId } },
  );
  return data;
}

export async function rollbackDeployment(
  siteId: string,
  deploymentId: string,
): Promise<SiteDeployment> {
  const { data } = await client.post<SiteDeployment>(
    `/deployments/${deploymentId}/rollback`,
    {},
    { params: { siteId } },
  );
  return data;
}

export async function getDeploymentEnvironment(
  siteId: string,
): Promise<SiteDeploymentEnvironmentCatalog> {
  const { data } = await client.get<SiteDeploymentEnvironmentCatalog>(
    "/deployments/environment",
    {
      params: { siteId },
    },
  );

  return data;
}

export async function upsertDeploymentEnvironmentVariable(
  siteId: string,
  payload: {
    key: string;
    value: string;
    type: "plain" | "encrypted";
    description?: string;
  },
): Promise<SiteDeploymentEnvironmentVariable> {
  const { data } = await client.put<SiteDeploymentEnvironmentVariable>(
    "/deployments/environment",
    payload,
    {
      params: { siteId },
    },
  );

  return data;
}

export async function deleteDeploymentEnvironmentVariable(
  siteId: string,
  variableId: string,
): Promise<void> {
  await client.delete(`/deployments/environment/${variableId}`, {
    params: { siteId },
  });
}
