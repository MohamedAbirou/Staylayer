import { DeploymentStatus, Prisma } from "@prisma/client";
import {
  DeploymentLogEntry,
  DeploymentTimelinePhase,
  DeploymentTimelinePhaseStatus,
} from "./deployment-provider.port";

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

const DEPLOYMENT_TIMELINE_PHASE_STATUSES =
  new Set<DeploymentTimelinePhaseStatus>([
    "pending",
    "active",
    "completed",
    "failed",
  ]);

const DEPLOYMENT_LOG_LEVELS = new Set<DeploymentLogEntry["level"]>([
  "info",
  "warning",
  "error",
]);

export function asDeploymentMetadata(
  value: Prisma.JsonValue | null | undefined,
): DeploymentMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Prisma.JsonObject) };
}

export function asDeploymentTimeline(
  value: unknown,
): DeploymentTimelinePhase[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const key = typeof entry.key === "string" ? entry.key : null;
    const label = typeof entry.label === "string" ? entry.label : null;
    const status =
      typeof entry.status === "string" &&
      DEPLOYMENT_TIMELINE_PHASE_STATUSES.has(
        entry.status as DeploymentTimelinePhaseStatus,
      )
        ? (entry.status as DeploymentTimelinePhaseStatus)
        : null;

    if (!key || !label || !status) {
      return [];
    }

    return [
      {
        key,
        label,
        status,
        startedAt: typeof entry.startedAt === "string" ? entry.startedAt : null,
        completedAt:
          typeof entry.completedAt === "string" ? entry.completedAt : null,
        summary: typeof entry.summary === "string" ? entry.summary : null,
      },
    ];
  });
}

export function asDeploymentLogs(value: unknown): DeploymentLogEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return [];
    }

    const id = typeof entry.id === "string" ? entry.id : null;
    const createdAt =
      typeof entry.createdAt === "string" ? entry.createdAt : null;
    const text = typeof entry.text === "string" ? entry.text : null;
    const level =
      typeof entry.level === "string" &&
      DEPLOYMENT_LOG_LEVELS.has(entry.level as DeploymentLogEntry["level"])
        ? (entry.level as DeploymentLogEntry["level"])
        : null;

    if (!id || !createdAt || !text || !level) {
      return [];
    }

    return [
      {
        id,
        createdAt,
        text,
        phaseKey: typeof entry.phaseKey === "string" ? entry.phaseKey : null,
        level,
      },
    ];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
