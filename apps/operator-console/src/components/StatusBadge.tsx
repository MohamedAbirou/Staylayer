import type { ReactNode } from "react";

/**
 * Compact coloured status pill. Centralised here so every page renders
 * statuses consistently and a single palette change updates the whole
 * operator console.
 */
export function StatusBadge({
  status,
  tone,
}: {
  status: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "info" | "muted";
}) {
  const palette: Record<string, string> = {
    neutral: "bg-slate-800 text-slate-300 border-slate-700",
    ok: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    warn: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    danger: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    info: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    muted: "bg-slate-900 text-slate-500 border-slate-800",
  };
  const cls = palette[tone ?? "neutral"];
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest",
        cls,
      ].join(" ")}
    >
      {status}
    </span>
  );
}

export function tenantStatusTone(status: string): "ok" | "warn" | "muted" {
  switch (status) {
    case "ACTIVE":
      return "ok";
    case "SUSPENDED":
      return "warn";
    case "ARCHIVED":
    default:
      return "muted";
  }
}

export function siteStatusTone(
  status: string,
): "ok" | "warn" | "muted" | "info" | "danger" {
  switch (status) {
    case "PUBLISHED":
      return "ok";
    case "DRAFT":
      return "info";
    case "SUSPENDED":
      return "warn";
    case "DELETING":
      return "danger";
    case "ARCHIVED":
    default:
      return "muted";
  }
}

export function deploymentStatusTone(
  status: string,
): "ok" | "warn" | "muted" | "info" | "danger" {
  switch (status) {
    case "READY":
      return "ok";
    case "BUILDING":
      return "info";
    case "PENDING":
      return "warn";
    case "FAILED":
      return "danger";
    case "CANCELED":
    default:
      return "muted";
  }
}

export function domainStatusTone(
  status: string,
): "ok" | "warn" | "muted" | "info" | "danger" {
  switch (status) {
    case "ACTIVE":
      return "ok";
    case "PENDING_VERIFICATION":
      return "info";
    case "SSL_PROVISIONING":
      return "warn";
    case "FAILED":
      return "danger";
    case "INACTIVE":
    default:
      return "muted";
  }
}

export function billingStatusTone(
  status: string,
): "ok" | "warn" | "muted" | "info" | "danger" {
  switch (status) {
    case "active":
      return "ok";
    case "trialing":
      return "info";
    case "past_due":
      return "danger";
    case "canceled":
      return "warn";
    case "inactive":
    default:
      return "muted";
  }
}

export function alertSeverityTone(
  severity: string,
): "ok" | "warn" | "danger" | "info" {
  switch (severity) {
    case "CRITICAL":
      return "danger";
    case "WARNING":
      return "warn";
    case "INFO":
    default:
      return "info";
  }
}
