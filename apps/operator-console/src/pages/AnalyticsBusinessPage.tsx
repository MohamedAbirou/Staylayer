import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  LineChart,
  Users,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import {
  fetchBusinessAnalytics,
  type AnalyticsRangeDays,
} from "../api/operator";
import { DataFreshness } from "../components/DataFreshness";
import { MetricCard } from "../components/MetricCard";
import { Sparkline } from "../components/Sparkline";
import { BarChart } from "../components/BarChart";
import {
  ANALYTICS_RANGE_OPTIONS,
  formatCurrencyMinor,
  formatNumber,
} from "../lib/analytics";

/**
 * Phase 10 — Business analytics. Read-only view of platform commercial
 * metrics. All values are live; the API clamps the requested range to a
 * maximum of 90 days.
 */
export default function AnalyticsBusinessPage() {
  const [range, setRange] = useState<AnalyticsRangeDays>(30);
  const query = useQuery({
    queryKey: ["operator-analytics-business", range],
    queryFn: () => fetchBusinessAnalytics(range),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const data = query.data;

  const newTenantValues = data?.tenants.newSeries.map((p) => p.count) ?? [];
  const failuresValues = data?.paymentFailures.series.map((p) => p.count) ?? [];
  const revenueValues = data?.revenue.series.map((p) => p.amount) ?? [];

  const previousRevenue = data?.revenue.paidPreviousRange ?? 0;
  const currentRevenue = data?.revenue.paidLast30Days ?? 0;
  const revenueDelta =
    previousRevenue > 0
      ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
      : null;

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LineChart className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">
              Business analytics
            </h1>
            <p className="text-xs text-slate-400">
              Tenant growth, plan mix, revenue trend, and conversion funnel.
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
          Failed to load business analytics.{" "}
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
          label="Tenants"
          icon={<Users className="h-4 w-4" />}
          value={formatNumber(data?.tenants.total)}
          helper={`${formatNumber(data?.tenants.active ?? 0)} active · ${formatNumber(data?.tenants.suspended ?? 0)} suspended · ${formatNumber(data?.tenants.archived ?? 0)} archived`}
          delta={`+${formatNumber(data?.tenants.newInRange ?? 0)} new in range`}
          deltaTone="positive"
        >
          <Sparkline values={newTenantValues} width={220} height={36} />
        </MetricCard>

        <MetricCard
          label={`Paid revenue · last ${range}d`}
          icon={<CreditCard className="h-4 w-4" />}
          value={formatCurrencyMinor(
            data?.revenue.paidLast30Days,
            data?.revenue.currency,
          )}
          helper={`Previous ${range}d: ${formatCurrencyMinor(previousRevenue, data?.revenue.currency)}`}
          delta={
            revenueDelta == null
              ? "No prior-period revenue"
              : `${revenueDelta >= 0 ? "+" : ""}${revenueDelta.toFixed(0)}% vs prior period`
          }
          deltaTone={
            revenueDelta == null
              ? "neutral"
              : revenueDelta >= 0
                ? "positive"
                : "negative"
          }
        >
          <Sparkline
            values={revenueValues}
            width={220}
            height={36}
            stroke="#34d399"
            fill="rgba(52, 211, 153, 0.18)"
          />
        </MetricCard>

        <MetricCard
          label="Outstanding"
          icon={<AlertTriangle className="h-4 w-4" />}
          value={formatCurrencyMinor(
            data?.revenue.outstanding,
            data?.revenue.currency,
          )}
          helper={`${formatNumber(data?.revenue.atRisk ?? 0)} tenant(s) past-due or inactive`}
          intent={(data?.revenue.outstanding ?? 0) > 0 ? "warn" : "default"}
        />

        <MetricCard
          label="Trial → paid conversion"
          icon={<TrendingUp className="h-4 w-4" />}
          value={
            data?.trialFunnel.conversionRate != null
              ? `${data.trialFunnel.conversionRate}%`
              : "—"
          }
          helper={`${formatNumber(data?.trialFunnel.currentlyTrialing ?? 0)} currently trialing · ${formatNumber(data?.trialFunnel.convertedInRange ?? 0)} converted in range`}
          delta={`${formatNumber(data?.trialFunnel.canceledInRange ?? 0)} canceled · ${formatNumber(data?.trialFunnel.expiredInRange ?? 0)} expired`}
          deltaTone="neutral"
        />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="Plan mix"
          helper="Distribution of tenants by current plan"
        >
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
                <th className="py-2">Plan</th>
                <th className="py-2 text-right">Tenants</th>
                <th className="py-2 text-right">Active</th>
                <th className="py-2 text-right">Trial</th>
                <th className="py-2 text-right">Attention</th>
              </tr>
            </thead>
            <tbody>
              {(data?.planMix ?? []).map((row) => (
                <tr
                  key={row.planKey}
                  className="border-b border-slate-900/80 last:border-none"
                >
                  <td className="py-2 font-medium text-white">
                    {row.planName}
                  </td>
                  <td className="py-2 text-right">
                    {formatNumber(row.tenantCount)}
                  </td>
                  <td className="py-2 text-right">
                    {formatNumber(row.activeCount)}
                  </td>
                  <td className="py-2 text-right">
                    {formatNumber(row.trialCount)}
                  </td>
                  <td className="py-2 text-right">
                    {row.attentionCount > 0 ? (
                      <span className="font-semibold text-amber-400">
                        {formatNumber(row.attentionCount)}
                      </span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>
                </tr>
              ))}
              {(data?.planMix ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    No plan data.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="Subscription movement"
          helper="Executed plan changes vs cancellations across the range"
        >
          <BarChart
            labels={(data?.churnSeries ?? []).map((p) => p.date.slice(0, 10))}
            series={[
              {
                label: "Expansions",
                color: "#34d399",
                values: (data?.churnSeries ?? []).map((p) => p.expansions),
              },
              {
                label: "Downgrades",
                color: "#f59e0b",
                values: (data?.churnSeries ?? []).map((p) => p.downgrades),
              },
              {
                label: "Canceled",
                color: "#f43f5e",
                values: (data?.churnSeries ?? []).map((p) => p.canceled),
              },
            ]}
            height={150}
          />
          <div className="mt-2 flex gap-4 text-[10px] uppercase tracking-widest text-slate-400">
            <Legend color="#34d399" label="Expansions" />
            <Legend color="#f59e0b" label="Downgrades" />
            <Legend color="#f43f5e" label="Canceled" />
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Panel
          title="Payment failures"
          helper="failed_payment / requires_action events from Stripe"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              <span className="text-2xl font-semibold text-white">
                {formatNumber(data?.paymentFailures.totalFailedInRange ?? 0)}
              </span>{" "}
              in last {range}d
            </span>
            <Link
              to="/billing/webhooks"
              className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
            >
              Open billing webhooks <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-3">
            <Sparkline
              values={failuresValues}
              width={420}
              height={64}
              stroke="#f43f5e"
              fill="rgba(244, 63, 94, 0.16)"
            />
          </div>
        </Panel>

        <Panel
          title="Support volume by plan"
          helper="Support cases created in range, grouped by tenant plan"
        >
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
                <th className="py-2">Plan</th>
                <th className="py-2 text-right">Cases</th>
                <th className="py-2 text-right">Still open</th>
              </tr>
            </thead>
            <tbody>
              {(data?.supportVolumeByPlan ?? []).map((row) => (
                <tr
                  key={row.planKey}
                  className="border-b border-slate-900/80 last:border-none"
                >
                  <td className="py-2 font-medium text-white">
                    {row.planName}
                  </td>
                  <td className="py-2 text-right">
                    {formatNumber(row.caseCount)}
                  </td>
                  <td className="py-2 text-right">
                    {row.openCases > 0 ? (
                      <span className="font-semibold text-amber-400">
                        {formatNumber(row.openCases)}
                      </span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>
                </tr>
              ))}
              {(data?.supportVolumeByPlan ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-500">
                    No support cases created in the range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Panel>
      </section>

      <p className="mt-8 flex items-center gap-2 text-[10px] uppercase tracking-widest text-slate-500">
        <ArrowDownRight className="h-3 w-3" /> All values are live queries
        clamped to ≤90 days. Revenue is derived from paid invoice snapshots.
      </p>
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
