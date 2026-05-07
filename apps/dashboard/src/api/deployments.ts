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

export interface SiteDeployment {
  id: string;
  siteId: string;
  status: SiteDeploymentStatus;
  url: string | null;
  providerUrl: string | null;
  errorMessage: string | null;
  providerDeployId: string | null;
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
