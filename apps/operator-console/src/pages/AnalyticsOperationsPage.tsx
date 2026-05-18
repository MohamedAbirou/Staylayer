import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Activity,
  Rocket,
  Globe2,
  Inbox,
  AlertTriangle,
  Search,
  Languages,
} from "lucide-react";
import {
  fetchOperationsAnalytics,
  type AnalyticsRangeDays,
} from "../api/operator";
import { DataFreshness } from "../components/DataFreshness";
import { MetricCard } from "../components/MetricCard";
import { BarChart } from "../components/BarChart";
import {
  ANALYTICS_RANGE_OPTIONS,
  formatDurationMs,
  formatNumber,
  formatPercent,
} from "../lib/analytics";

/**
 * Phase 10 — Operations analytics. Deployment success, domain
 * verification, submission/delivery, alert flow, SEO, and translation
 * volume across the platform.
 */
export default function AnalyticsOperationsPage() {
  const [range, setRange] = useState<AnalyticsRangeDays>(30);
  const query = useQuery({
    queryKey: ["operator-analytics-operations", range],
    queryFn: () => fetchOperationsAnalytics(range),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const data = query.data;

  const deploySuccess = data?.deployments.successRate ?? null;
  const deployIntent: "success" | "warn" | "critical" | "default" =
    deploySuccess == null
      ? "default"
      : deploySuccess >= 0.95
        ? "success"
        : deploySuccess >= 0.8
          ? "warn"
          : "critical";

  const deliverySuccess = data?.forms.deliverySuccessRate ?? null;
  const deliveryIntent: "success" | "warn" | "critical" | "default" =
    deliverySuccess == null
      ? "default"
      : deliverySuccess >= 0.98
        ? "success"
        : deliverySuccess >= 0.9
          ? "warn"
          : "critical";

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">
              Operations analytics
            </h1>
            <p className="text-xs text-slate-400">
              Cross-tenant deployment, domain, submission, alert and SEO
              metrics.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RangePicker value={range} onChange={setRange} />
          <DataFreshness generatedAt={data?.generatedAt} />
        </div>
      </header>

      {query.isError ? (
        <div className="mt-6 rounded-xl border border-rose-900/60 bg-rose-950/40 p-4 text-sm text-rose-200">
          Failed to load operations analytics.{" "}
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
          label="Deployment success"
          icon={<Rocket className="h-4 w-4" />}
          intent={deployIntent}
          value={formatPercent(deploySuccess, { fromFraction: true })}
          helper={`${formatNumber(data?.deployments.successCount ?? 0)} succeeded · ${formatNumber(data?.deployments.failureCount ?? 0)} failed of ${formatNumber(data?.deployments.totalInRange ?? 0)} builds`}
        />
        <MetricCard
          label="Deploy duration · p50 / p95"
          value={
            <span>
              {formatDurationMs(data?.deployments.durationMs.p50Ms)} ·{" "}
              <span className="text-base font-medium text-slate-300">
                {formatDurationMs(data?.deployments.durationMs.p95Ms)}
              </span>
            </span>
          }
          helper={`Sample size ${formatNumber(data?.deployments.durationMs.sample ?? 0)} · avg ${formatDurationMs(data?.deployments.durationMs.averageMs)}`}
        />
        <MetricCard
          label="Domains"
          icon={<Globe2 className="h-4 w-4" />}
          value={formatNumber(data?.domains.total)}
          helper={`${formatNumber(data?.domains.active ?? 0)} live · ${formatNumber(data?.domains.sslProvisioning ?? 0)} SSL · ${formatNumber(data?.domains.pending ?? 0)} pending`}
          delta={`Verification ${formatPercent(data?.domains.verificationSuccessRate, { fromFraction: true })} · ${formatNumber(data?.domains.failed ?? 0)} failed`}
          deltaTone={(data?.domains.failed ?? 0) > 0 ? "negative" : "neutral"}
          intent={(data?.domains.failed ?? 0) > 0 ? "warn" : "default"}
        />
        <MetricCard
          label="Form delivery"
          icon={<Inbox className="h-4 w-4" />}
          intent={deliveryIntent}
          value={formatPercent(deliverySuccess, { fromFraction: true })}
          helper={`${formatNumber(data?.forms.totalSubmissionsInRange ?? 0)} submissions · ${formatNumber(data?.forms.spamCount ?? 0)} spam (${formatPercent(data?.forms.spamRatio, { fromFraction: true })}) · ${formatNumber(data?.forms.failedDeliveries ?? 0)} failed deliveries`}
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Open alerts"
          icon={<AlertTriangle className="h-4 w-4" />}
          intent={
            (data?.alerts.openCritical ?? 0) > 0
              ? "critical"
              : (data?.alerts.openWarning ?? 0) > 0
                ? "warn"
                : "default"
          }
          value={formatNumber(
            (data?.alerts.openCritical ?? 0) + (data?.alerts.openWarning ?? 0),
          )}
          helper={`${formatNumber(data?.alerts.openCritical ?? 0)} critical · ${formatNumber(data?.alerts.openWarning ?? 0)} warning`}
        />
        <MetricCard
          label="SEO audits · range"
          icon={<Search className="h-4 w-4" />}
          value={formatNumber(data?.seo.runsInRange ?? 0)}
          helper={`Success ${formatPercent(data?.seo.successRate, { fromFraction: true })} · avg score ${formatNumber(data?.seo.averageScore)}`}
          delta={`${formatNumber(data?.seo.criticalIssuesInRange ?? 0)} critical issues · ${formatNumber(data?.seo.alertsCreatedInRange ?? 0)} alerts created`}
          deltaTone={
            (data?.seo.criticalIssuesInRange ?? 0) > 0 ? "negative" : "neutral"
          }
        />
        <MetricCard
          label="Translation jobs"
          icon={<Languages className="h-4 w-4" />}
          value={formatNumber(data?.translations.jobsInRange ?? 0)}
          helper={`${formatNumber(data?.translations.completed ?? 0)} completed · ${formatNumber(data?.translations.failed ?? 0)} failed`}
          delta={`Avg ${formatNumber(data?.translations.averageCharactersPerJob)} chars / job`}
          deltaTone="neutral"
          intent={(data?.translations.failed ?? 0) > 0 ? "warn" : "default"}
        />
        <MetricCard
          label="Submission spam ratio"
          value={formatPercent(data?.forms.spamRatio, { fromFraction: true })}
          helper={`${formatNumber(data?.forms.spamCount ?? 0)} flagged of ${formatNumber(data?.forms.totalSubmissionsInRange ?? 0)} submissions`}
          intent={(data?.forms.spamRatio ?? 0) > 0.4 ? "warn" : "default"}
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="Deployments — success vs failure"
          helper="Daily deployment outcomes across the range"
        >
          <BarChart
            labels={(data?.deployments.series ?? []).map((p) =>
              p.date.slice(0, 10),
            )}
            series={[
              {
                label: "Success",
                color: "#34d399",
                values: (data?.deployments.series ?? []).map((p) => p.success),
              },
              {
                label: "Failure",
                color: "#f43f5e",
                values: (data?.deployments.series ?? []).map((p) => p.failure),
              },
            ]}
            height={150}
          />
          <div className="mt-2 flex gap-4 text-[10px] uppercase tracking-widest text-slate-400">
            <Legend color="#34d399" label="Success" />
            <Legend color="#f43f5e" label="Failure" />
          </div>
        </Panel>

        <Panel
          title="Submissions — received vs spam"
          helper="Daily form submission volume across the range"
        >
          <BarChart
            labels={(data?.forms.submissionSeries ?? []).map((p) =>
              p.date.slice(0, 10),
            )}
            series={[
              {
                label: "Received",
                color: "#06b6d4",
                values: (data?.forms.submissionSeries ?? []).map(
                  (p) => p.received,
                ),
              },
              {
                label: "Spam",
                color: "#f59e0b",
                values: (data?.forms.submissionSeries ?? []).map((p) => p.spam),
              },
            ]}
            height={150}
          />
          <div className="mt-2 flex gap-4 text-[10px] uppercase tracking-widest text-slate-400">
            <Legend color="#06b6d4" label="Received" />
            <Legend color="#f59e0b" label="Spam" />
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="Form deliveries — delivered vs failed"
          helper="Email + webhook fan-out outcomes"
        >
          <BarChart
            labels={(data?.forms.deliverySeries ?? []).map((p) =>
              p.date.slice(0, 10),
            )}
            series={[
              {
                label: "Delivered",
                color: "#34d399",
                values: (data?.forms.deliverySeries ?? []).map(
                  (p) => p.delivered,
                ),
              },
              {
                label: "Failed",
                color: "#f43f5e",
                values: (data?.forms.deliverySeries ?? []).map((p) => p.failed),
              },
            ]}
            height={150}
          />
          <div className="mt-2 flex gap-4 text-[10px] uppercase tracking-widest text-slate-400">
            <Legend color="#34d399" label="Delivered" />
            <Legend color="#f43f5e" label="Failed" />
          </div>
        </Panel>

        <Panel
          title="Open alerts by type"
          helper="Currently open operational alerts grouped by type"
        >
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
                <th className="py-2">Type</th>
                <th className="py-2 text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {(data?.alerts.openByType ?? []).map((row) => (
                <tr
                  key={row.type}
                  className="border-b border-slate-900/80 last:border-none"
                >
                  <td className="py-2 font-medium text-white">{row.type}</td>
                  <td className="py-2 text-right">{formatNumber(row.count)}</td>
                </tr>
              ))}
              {(data?.alerts.openByType ?? []).length === 0 ? (
                <tr>
                  <td colSpan={2} className="py-6 text-center text-slate-500">
                    No open alerts.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Panel>
      </section>
    </div>
  );
}

function RangePicker({
  value,
  onChange,
}: {
  value: AnalyticsRangeDays;
  onChange: (next: AnalyticsRangeDays) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-1 text-xs">
      {ANALYTICS_RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-md transition ${
            value === opt.value
              ? "bg-cyan-500/15 text-cyan-300"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Panel({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {helper ? (
          <p className="text-[10px] uppercase tracking-widest text-slate-500">
            {helper}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-2 w-2 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
