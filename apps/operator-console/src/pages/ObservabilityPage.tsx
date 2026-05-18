import { useQuery } from "@tanstack/react-query";
import {
  HeartPulse,
  Database,
  Webhook,
  Receipt,
  Rocket,
  Inbox,
  Bell,
  History,
} from "lucide-react";
import { fetchObservability } from "../api/operator";
import { DataFreshness } from "../components/DataFreshness";
import { MetricCard } from "../components/MetricCard";
import {
  formatDurationMs,
  formatMinutes,
  formatNumber,
} from "../lib/analytics";
import { formatDateTime, formatRelative } from "../lib/operations";

/**
 * Phase 10 — Observability dashboard. Live snapshot of dependency health
 * (database reachability, billing webhooks, invoice sync, deploy provider,
 * form delivery, operational alerts, audit-log activity). Auto-refreshes
 * every 30s.
 */
export default function ObservabilityPage() {
  const query = useQuery({
    queryKey: ["operator-observability"],
    queryFn: () => fetchObservability(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  const data = query.data;

  const invoiceStale = data?.invoiceSync.lastSyncStaleMinutes ?? null;
  const invoiceIntent: "default" | "warn" | "critical" =
    invoiceStale == null
      ? "default"
      : invoiceStale > 360
        ? "critical"
        : invoiceStale > 60
          ? "warn"
          : "default";

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <HeartPulse className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Observability</h1>
            <p className="text-xs text-slate-400">
              Live dependency health. Auto-refreshes every 30s.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={data?.generatedAt} />
      </header>

      {query.isError ? (
        <div className="mt-6 rounded-xl border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-200">
          Failed to load observability snapshot.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => query.refetch()}
          >
            Retry
          </button>
        </div>
      ) : null}

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Database"
          icon={<Database className="h-4 w-4" />}
          intent={
            data?.database.reachable === false
              ? "critical"
              : (data?.database.latencyMs ?? 0) > 250
                ? "warn"
                : "success"
          }
          value={
            data?.database.reachable === false
              ? "Unreachable"
              : formatDurationMs(data?.database.latencyMs)
          }
          helper={
            data?.database.reachable === false
              ? "SELECT 1 probe failed"
              : "SELECT 1 round-trip latency"
          }
        />
        <MetricCard
          label="Billing webhooks · 24h"
          icon={<Webhook className="h-4 w-4" />}
          intent={
            (data?.billingWebhooks.failedLast24h ?? 0) > 0 ? "warn" : "default"
          }
          value={formatNumber(data?.billingWebhooks.processedLast24h ?? 0)}
          helper={`${formatNumber(data?.billingWebhooks.pendingLast24h ?? 0)} pending · ${formatNumber(data?.billingWebhooks.failedLast24h ?? 0)} failed · last ${formatRelative(data?.billingWebhooks.lastProcessedAt)}`}
          delta={
            data?.billingWebhooks.lastFailureType
              ? `Last failure: ${data.billingWebhooks.lastFailureType} (${formatRelative(data.billingWebhooks.lastFailureAt)})`
              : "No recent failures"
          }
          deltaTone={
            data?.billingWebhooks.lastFailureType ? "negative" : "neutral"
          }
        />
        <MetricCard
          label="Invoice sync"
          icon={<Receipt className="h-4 w-4" />}
          intent={invoiceIntent}
          value={
            invoiceStale == null
              ? "Never"
              : `${formatMinutes(invoiceStale)} ago`
          }
          helper={
            data?.invoiceSync.lastSyncAt
              ? `Last sync ${formatDateTime(data.invoiceSync.lastSyncAt)}`
              : "No invoice snapshot synced yet"
          }
        />
        <MetricCard
          label="Operational alerts"
          icon={<Bell className="h-4 w-4" />}
          intent={
            (data?.operationalAlerts.openCritical ?? 0) > 0
              ? "critical"
              : (data?.operationalAlerts.openWarning ?? 0) > 0
                ? "warn"
                : "default"
          }
          value={formatNumber(
            (data?.operationalAlerts.openCritical ?? 0) +
              (data?.operationalAlerts.openWarning ?? 0),
          )}
          helper={`${formatNumber(data?.operationalAlerts.openCritical ?? 0)} critical · ${formatNumber(data?.operationalAlerts.openWarning ?? 0)} warning`}
          delta={
            data?.operationalAlerts.oldestOpenAt
              ? `Oldest open ${formatRelative(data.operationalAlerts.oldestOpenAt)}`
              : "No open alerts"
          }
          deltaTone={
            data?.operationalAlerts.oldestOpenAt ? "negative" : "neutral"
          }
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <MetricCard
          label="Form delivery · 24h"
          icon={<Inbox className="h-4 w-4" />}
          intent={
            (data?.formDelivery.failedLast24h ?? 0) > 0 ? "warn" : "default"
          }
          value={formatNumber(data?.formDelivery.successLast24h ?? 0)}
          helper={`${formatNumber(data?.formDelivery.failedLast24h ?? 0)} failed · ${formatNumber(data?.formDelivery.pendingTotal ?? 0)} pending overall`}
        />
        <MetricCard
          label="Audit log · 24h"
          icon={<History className="h-4 w-4" />}
          value={formatNumber(data?.auditLog.eventsLast24h ?? 0)}
          helper={
            data?.auditLog.lastEventAt
              ? `Last event ${formatRelative(data.auditLog.lastEventAt)}`
              : "No recent audit events"
          }
        />
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Rocket className="h-4 w-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">
            Deployment providers
          </h2>
        </div>
        <table className="w-full text-left text-xs text-slate-300">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
              <th className="py-2">Provider</th>
              <th className="py-2 text-right">Live sites</th>
              <th className="py-2 text-right">Failed · 24h</th>
              <th className="py-2 text-right">Last failure</th>
            </tr>
          </thead>
          <tbody>
            {(data?.deploymentProvider.providers ?? []).map((row) => (
              <tr
                key={row.provider}
                className="border-b border-slate-900/80 last:border-none"
              >
                <td className="py-2 font-medium text-white">{row.provider}</td>
                <td className="py-2 text-right">
                  {formatNumber(row.liveCount)}
                </td>
                <td className="py-2 text-right">
                  {row.failedLast24h > 0 ? (
                    <span className="font-semibold text-rose-400">
                      {formatNumber(row.failedLast24h)}
                    </span>
                  ) : (
                    <span className="text-slate-500">0</span>
                  )}
                </td>
                <td className="py-2 text-right text-slate-400">
                  {row.lastFailureAt ? formatRelative(row.lastFailureAt) : "—"}
                </td>
              </tr>
            ))}
            {(data?.deploymentProvider.providers ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-slate-500">
                  No deployment providers configured.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
