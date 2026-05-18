import type {
  SupportCaseCategory,
  SupportCasePriority,
  SupportCaseStatus,
  SupportHandoffStatus,
  SupportHandoffTarget,
} from "../api/operator";

export function supportStatusTone(
  status: SupportCaseStatus,
): "ok" | "warn" | "muted" | "info" | "danger" {
  switch (status) {
    case "OPEN":
      return "info";
    case "PENDING_CUSTOMER":
      return "warn";
    case "PENDING_INTERNAL":
      return "warn";
    case "RESOLVED":
      return "ok";
    case "CLOSED":
    default:
      return "muted";
  }
}

export function supportPriorityTone(
  priority: SupportCasePriority,
): "ok" | "warn" | "muted" | "info" | "danger" {
  switch (priority) {
    case "URGENT":
      return "danger";
    case "HIGH":
      return "warn";
    case "NORMAL":
      return "info";
    case "LOW":
    default:
      return "muted";
  }
}

export function supportHandoffStatusTone(
  status: SupportHandoffStatus,
): "ok" | "warn" | "muted" | "info" {
  switch (status) {
    case "OPEN":
      return "warn";
    case "ACKNOWLEDGED":
      return "info";
    case "CLOSED":
    default:
      return "muted";
  }
}

export function supportHandoffTargetLabel(
  target: SupportHandoffTarget,
): string {
  switch (target) {
    case "BILLING":
      return "Billing";
    case "PLATFORM_OWNER":
      return "Platform Owner";
    case "SUPPORT":
      return "Support";
  }
}

export const SUPPORT_STATUS_LABELS: Record<SupportCaseStatus, string> = {
  OPEN: "Open",
  PENDING_CUSTOMER: "Pending customer",
  PENDING_INTERNAL: "Pending internal",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const SUPPORT_PRIORITY_LABELS: Record<SupportCasePriority, string> = {
  URGENT: "Urgent",
  HIGH: "High",
  NORMAL: "Normal",
  LOW: "Low",
};

export const SUPPORT_CATEGORY_LABELS: Record<SupportCaseCategory, string> = {
  BILLING: "Billing",
  DEPLOYMENT: "Deployment",
  DOMAIN: "Domain",
  FORMS: "Forms",
  SEO: "SEO",
  TRANSLATION: "Translation",
  ACCESS: "Access",
  CONTENT: "Content",
  ACCOUNT: "Account",
  OTHER: "Other",
};

export const SUPPORT_STATUS_VALUES: readonly SupportCaseStatus[] = [
  "OPEN",
  "PENDING_CUSTOMER",
  "PENDING_INTERNAL",
  "RESOLVED",
  "CLOSED",
];

export const SUPPORT_PRIORITY_VALUES: readonly SupportCasePriority[] = [
  "URGENT",
  "HIGH",
  "NORMAL",
  "LOW",
];

export const SUPPORT_CATEGORY_VALUES: readonly SupportCaseCategory[] = [
  "BILLING",
  "DEPLOYMENT",
  "DOMAIN",
  "FORMS",
  "SEO",
  "TRANSLATION",
  "ACCESS",
  "CONTENT",
  "ACCOUNT",
  "OTHER",
];

/**
 * Format an SLA deadline (or `null`) as a compact relative string. Negative
 * deltas render as "overdue Xh" so the queue UI can lean on the same
 * presentation for breached cases.
 */
export function formatSlaDeadline(
  iso: string | null,
  now: number = Date.now(),
): {
  label: string;
  tone: "muted" | "warn" | "danger" | "info";
  overdue: boolean;
} {
  if (!iso) return { label: "—", tone: "muted", overdue: false };
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return { label: "—", tone: "muted", overdue: false };
  const delta = t - now;
  const abs = Math.abs(delta);
  const overdue = delta < 0;
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  let label: string;
  if (abs < 60_000) label = "<1m";
  else if (minutes < 60) label = `${minutes}m`;
  else if (hours < 48) label = `${hours}h`;
  else label = `${days}d`;
  if (overdue) {
    return { label: `overdue ${label}`, tone: "danger", overdue: true };
  }
  if (abs < 60 * 60_000)
    return { label: `due ${label}`, tone: "warn", overdue: false };
  return { label: `due ${label}`, tone: "info", overdue: false };
}

export function formatRelativeTime(
  iso: string,
  now: number = Date.now(),
): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const delta = now - t;
  if (delta < 60_000) return "just now";
  const minutes = Math.round(delta / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(delta / 3_600_000);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(delta / 86_400_000);
  return `${days}d ago`;
}
