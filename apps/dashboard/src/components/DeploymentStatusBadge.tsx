import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import type { SiteDeploymentStatus } from "../api/deployments";

// Labels map exactly to the backend DeploymentStatus enum values.
const STATUS_LABELS: Record<SiteDeploymentStatus, string> = {
  PENDING: "Pending",
  CREATING_PROJECT: "Creating project",
  SYNCING_ENV: "Syncing environment",
  DEPLOYING: "Deploying",
  LIVE: "Live",
  FAILED: "Failed",
  RETRYING: "Retrying",
};

const STATUS_COLORS: Record<SiteDeploymentStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700",
  CREATING_PROJECT: "bg-blue-100 text-blue-700",
  SYNCING_ENV: "bg-blue-100 text-blue-700",
  DEPLOYING: "bg-yellow-100 text-yellow-800",
  LIVE: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  RETRYING: "bg-yellow-100 text-yellow-800",
};

const IN_PROGRESS_STATUSES: SiteDeploymentStatus[] = [
  "CREATING_PROJECT",
  "SYNCING_ENV",
  "DEPLOYING",
  "RETRYING",
];

interface DeploymentStatusBadgeProps {
  status: SiteDeploymentStatus;
}

export function DeploymentStatusBadge({ status }: DeploymentStatusBadgeProps) {
  const isSpinning = IN_PROGRESS_STATUSES.includes(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {status === "LIVE" ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : status === "FAILED" ? (
        <XCircle className="h-3 w-3" />
      ) : isSpinning ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}
