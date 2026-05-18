import type { ReactNode } from "react";

/**
 * Tone mappings for Phase 9 enums. Centralised here so badges stay
 * consistent across the Operations pages.
 */

export function deploymentStatusTone(
  status: string,
): "ok" | "warn" | "danger" | "muted" | "info" {
  switch (status) {
    case "LIVE":
      return "ok";
    case "DEPLOYING":
    case "CREATING_PROJECT":
    case "SYNCING_ENV":
    case "RETRYING":
      return "info";
    case "FAILED":
      return "danger";
    case "PENDING":
      return "warn";
    default:
      return "muted";
  }
}

export function domainStatusTone(
  status: string,
): "ok" | "warn" | "danger" | "muted" | "info" {
  switch (status) {
    case "ACTIVE":
      return "ok";
    case "VERIFYING":
    case "SSL_PROVISIONING":
    case "PROVIDER_ATTACH_PENDING":
      return "info";
    case "DNS_REQUIRED":
    case "PENDING":
      return "warn";
    case "FAILED":
      return "danger";
    default:
      return "muted";
  }
}

export function deliveryStatusTone(
  status: string,
): "ok" | "warn" | "danger" | "muted" | "info" {
  switch (status) {
    case "DELIVERED":
      return "ok";
    case "PENDING":
    case "RETRYING":
      return "info";
    case "FAILED":
      return "danger";
    case "SKIPPED":
      return "muted";
    default:
      return "warn";
  }
}

export function submissionStatusTone(
  status: string,
): "ok" | "warn" | "danger" | "muted" | "info" {
  switch (status) {
    case "PROCESSED":
      return "ok";
    case "PENDING":
      return "info";
    case "QUARANTINED":
      return "warn";
    case "FAILED":
    case "REJECTED":
      return "danger";
    default:
      return "muted";
  }
}

export function alertSeverityTone(
  severity: string,
): "ok" | "warn" | "danger" | "muted" | "info" {
  switch (severity) {
    case "CRITICAL":
      return "danger";
    case "WARNING":
      return "warn";
    case "INFO":
      return "info";
    default:
      return "muted";
  }
}

export function alertStatusTone(
  status: string,
): "ok" | "warn" | "danger" | "muted" | "info" {
  switch (status) {
    case "RESOLVED":
      return "ok";
    case "ACKNOWLEDGED":
      return "info";
    case "OPEN":
      return "warn";
    default:
      return "muted";
  }
}

export function translationJobTone(
  status: string,
): "ok" | "warn" | "danger" | "muted" | "info" {
  switch (status) {
    case "COMPLETED":
      return "ok";
    case "RUNNING":
    case "PENDING":
      return "info";
    case "COMPLETED_WITH_ERRORS":
      return "warn";
    case "FAILED":
      return "danger";
    case "CANCELED":
    default:
      return "muted";
  }
}

export function formatDateTime(value: string | null | undefined): ReactNode {
  if (!value) return <span className="text-slate-500">—</span>;
  try {
    const d = new Date(value);
    return d.toLocaleString();
  } catch {
    return value;
  }
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value).getTime();
    const diff = Date.now() - d;
    const sec = Math.round(diff / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    return `${day}d ago`;
  } catch {
    return value;
  }
}
