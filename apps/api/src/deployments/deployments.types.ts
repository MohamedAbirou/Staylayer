import { DeploymentStatus, Prisma } from "@prisma/client";

export const ACTIVE_PROVISIONING_STATUSES: DeploymentStatus[] = [
  DeploymentStatus.PENDING,
  DeploymentStatus.CREATING_PROJECT,
  DeploymentStatus.SYNCING_ENV,
  DeploymentStatus.DEPLOYING,
  DeploymentStatus.RETRYING,
];

export const TRACKABLE_DEPLOYMENT_STATUSES: DeploymentStatus[] = [
  DeploymentStatus.DEPLOYING,
  DeploymentStatus.RETRYING,
];

export type DeploymentMetadata = Record<string, unknown>;

export type SiteRevalidationTarget = {
  deploymentId: string;
  provider: string | null;
  deploymentUrl: string;
  revalidationUrl: string;
};

export function asDeploymentMetadata(
  value: Prisma.JsonValue | null | undefined,
): DeploymentMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Prisma.JsonObject) };
}
