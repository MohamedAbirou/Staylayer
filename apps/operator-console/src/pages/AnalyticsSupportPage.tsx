import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  LifeBuoy,
  AlertOctagon,
  Repeat,
  Bell,
  ArrowRightLeft,
} from "lucide-react";
import {
  fetchSupportAnalytics,
  type AnalyticsRangeDays,
  type SupportCasePriorityKey,
} from "../api/operator";
import { DataFreshness } from "../components/DataFreshness";
import { MetricCard } from "../components/MetricCard";
import { BarChart } from "../components/BarChart";
import {
  ANALYTICS_RANGE_OPTIONS,
  formatMinutes,
  formatNumber,
  formatPercent,
} from "../lib/analytics";

const PRIORITY_COLOR: Record<SupportCasePriorityKey, string> = {
  LOW: "#64748b",
  NORMAL: "#06b6d4",
  HIGH: "#f59e0b",
  URGENT: "#f43f5e",
};

/**
 * Phase 10 — Support analytics. Volumes, SLA breaches, resolution times,
 * and operator workload. All values are live queries; the API clamps the
 * range to ≤90 days.
 */
export default function AnalyticsSupportPage() {
  const [range, setRange] = useState<AnalyticsRangeDays>(30);
  const query = useQuery({
    queryKey: ["operator-analytics-support", range],
    queryFn: () => fetchSupportAnalytics(range),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const data = query.data;

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LifeBuoy className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">
              Support analytics
            </h1>
            <p className="text-xs text-slate-400">
              Case volume, response/resolution percentiles, and operator
              workload across all tenants.
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
          Failed to load support analytics.{" "}
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
          label="First response · p50 / p95"
          value={
            <span>
              {formatMinutes(data?.firstResponse.p50Minutes)} ·{" "}
              <span className="text-base font-medium text-slate-300">
                {formatMinutes(data?.firstResponse.p95Minutes)}
              </span>
            </span>
          }
          helper={`Avg ${formatMinutes(data?.firstResponse.averageMinutes)} over ${formatNumber(data?.firstResponse.sample ?? 0)} cases`}
        />
        <MetricCard
          label="Resolution · p50 / p95"
          value={
            <span>
              {formatMinutes(data?.resolution.p50Minutes)} ·{" "}
              <span className="text-base font-medium text-slate-300">
                {formatMinutes(data?.resolution.p95Minutes)}
              </span>
            </span>
          }
          helper={`Avg ${formatMinutes(data?.resolution.averageMinutes)} over ${formatNumber(data?.resolution.sample ?? 0)} cases`}
        />
        <MetricCard
          label="SLA breaches"
          icon={<AlertOctagon className="h-4 w-4" />}
          intent={
            (data?.slaBreaches.firstResponse ?? 0) +
              (data?.slaBreaches.resolution ?? 0) >
            0
              ? "critical"
              : "default"
          }
          value={formatNumber(
            (data?.slaBreaches.firstResponse ?? 0) +
              (data?.slaBreaches.resolution ?? 0),
          )}
          helper={`${formatNumber(data?.slaBreaches.firstResponse ?? 0)} response · ${formatNumber(data?.slaBreaches.resolution ?? 0)} resolution`}
          delta={`Breach rate ${formatPercent(data?.slaBreaches.breachRate, { fromFraction: true })} of ${formatNumber(data?.slaBreaches.totalCreatedInRange ?? 0)} created`}
        />
        <MetricCard
          label="Reopen rate"
          icon={<Repeat className="h-4 w-4" />}
          value={formatPercent(data?.reopen.reopenRate, { fromFraction: true })}
          helper={`${formatNumber(data?.reopen.reopenedInRange ?? 0)} reopened of ${formatNumber(data?.reopen.resolvedInRange ?? 0)} resolved`}
          intent={(data?.reopen.reopenRate ?? 0) > 0.1 ? "warn" : "default"}
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <MetricCard
          label="Cases from alerts"
          icon={<Bell className="h-4 w-4" />}
          value={formatNumber(data?.createdFromAlerts ?? 0)}
          helper="Auto-generated from operational alerts"
        />
        <MetricCard
          label="Billing handoffs"
          icon={<ArrowRightLeft className="h-4 w-4" />}
          value={formatNumber(data?.handoffsToBilling ?? 0)}
          helper="Support cases re-categorised to billing or with billing actions"
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="Open cases by priority"
          helper="Currently OPEN / IN_PROGRESS / WAITING_ON_CUSTOMER"
        >
          <BarChart
            labels={(data?.openByPriority ?? []).map((row) => row.priority)}
            series={[
              {
                label: "Open",
                color: "#06b6d4",
                values: (data?.openByPriority ?? []).map((row) => row.count),
              },
            ]}
            height={130}
          />
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] uppercase tracking-widest text-slate-400">
            {(data?.openByPriority ?? []).map((row) => (
              <span
                key={row.priority}
                className="inline-flex items-center gap-1"
              >
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: PRIORITY_COLOR[row.priority] }}
                />
                {row.priority}: {formatNumber(row.count)}
              </span>
            ))}
          </div>
        </Panel>

        <Panel
          title="Open cases by category"
          helper="Distribution across BILLING / DEPLOYMENT / DOMAIN / FORMS / SEO / TRANSLATION / etc."
        >
          <BarChart
            labels={(data?.byCategory ?? []).map((row) => row.category)}
            series={[
              {
                label: "Open",
                color: "#06b6d4",
                values: (data?.byCategory ?? []).map((row) => row.count),
              },
            ]}
            height={130}
          />
        </Panel>
      </section>

      <section className="mt-6">
        <Panel
          title="Volume — created vs resolved"
          helper="Cases created per day and resolved per day across the range"
        >
          <BarChart
            labels={(data?.volumeSeries ?? []).map((p) => p.date.slice(0, 10))}
            series={[
              {
                label: "Created",
                color: "#06b6d4",
                values: (data?.volumeSeries ?? []).map((p) => p.created),
              },
              {
                label: "Resolved",
                color: "#34d399",
                values: (data?.volumeSeries ?? []).map((p) => p.resolved),
              },
            ]}
            height={150}
          />
          <div className="mt-2 flex gap-4 text-[10px] uppercase tracking-widest text-slate-400">
            <Legend color="#06b6d4" label="Created" />
            <Legend color="#34d399" label="Resolved" />
          </div>
        </Panel>
      </section>

      <section className="mt-6">
        <Panel
          title="Operator workload"
          helper="Top 20 assignees ranked by open + resolved volume in range"
        >
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
                <th className="py-2">Operator</th>
                <th className="py-2 text-right">Open</th>
                <th className="py-2 text-right">Resolved in range</th>
                <th className="py-2 text-right">Avg resolution</th>
              </tr>
            </thead>
            <tbody>
              {(data?.operatorWorkload ?? []).map((row) => (
                <tr
                  key={row.operatorId ?? "unassigned"}
                  className="border-b border-slate-900/80 last:border-none"
                >
                  <td className="py-2 font-medium text-white">
                    {row.operatorEmail ?? (
                      <span className="text-slate-500">Unassigned</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {row.openCount > 0 ? (
                      <span className="font-semibold text-amber-400">
                        {formatNumber(row.openCount)}
                      </span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {formatNumber(row.resolvedInRange)}
                  </td>
                  <td className="py-2 text-right">
                    {formatMinutes(row.averageResolutionMinutes)}
                  </td>
                </tr>
              ))}
              {(data?.operatorWorkload ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No active support workload.
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
