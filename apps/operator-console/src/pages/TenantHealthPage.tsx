import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { HeartPulse, ArrowUpRight } from "lucide-react";
import {
  fetchTenantHealth,
  type TenantHealthBucket,
  type TenantHealthQueryParams,
} from "../api/operator";
import { DataFreshness } from "../components/DataFreshness";
import { Pagination } from "../components/Pagination";
import { formatNumber } from "../lib/analytics";

const PAGE_SIZE = 25;

const BUCKET_LABEL: Record<TenantHealthBucket, string> = {
  healthy: "Healthy",
  watch: "Watch",
  needs_support: "Needs support",
  critical: "Critical",
};

const BUCKET_TONE: Record<TenantHealthBucket, string> = {
  healthy: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  watch: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
  needs_support: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  critical: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
};

/**
 * Phase 10 — Tenant Health table. Aggregates suspension status,
 * subscription health, failed deploys, missing domains, open alerts, and
 * support load into a single score. Drill-down links lead to Tenant 360
 * and the operational queues.
 */
export default function TenantHealthPage() {
  const [page, setPage] = useState(1);
  const [minScore, setMinScore] = useState<number | "">("");
  const [maxScore, setMaxScore] = useState<number | "">("");
  const [sort, setSort] = useState<"score" | "name">("score");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");

  const params = useMemo<TenantHealthQueryParams>(
    () => ({
      page,
      limit: PAGE_SIZE,
      sort,
      direction,
      ...(typeof minScore === "number" ? { minScore } : {}),
      ...(typeof maxScore === "number" ? { maxScore } : {}),
    }),
    [page, sort, direction, minScore, maxScore],
  );

  const query = useQuery({
    queryKey: ["operator-analytics-tenant-health", params],
    queryFn: () => fetchTenantHealth(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const data = query.data;
  const rows = data?.data ?? [];

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <HeartPulse className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Tenant health</h1>
            <p className="text-xs text-slate-400">
              Composite score (0–100) blending subscription health, deploys,
              domains, alerts and open support load. Lower scores need
              attention.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={data?.generatedAt} />
      </header>

      <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-4">
        {(
          [
            "healthy",
            "watch",
            "needs_support",
            "critical",
          ] as TenantHealthBucket[]
        ).map((bucket) => {
          const distKey = bucket === "needs_support" ? "needsSupport" : bucket;
          const count =
            (data?.distribution as Record<string, number> | undefined)?.[
              distKey
            ] ?? 0;
          return (
            <div
              key={bucket}
              className={`rounded-2xl border border-slate-800 bg-slate-900 p-4`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                  {BUCKET_LABEL[bucket]}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ring-1 ${BUCKET_TONE[bucket]}`}
                >
                  {bucket === "healthy"
                    ? "≥ 90"
                    : bucket === "watch"
                      ? "70–89"
                      : bucket === "needs_support"
                        ? "40–69"
                        : "< 40"}
                </span>
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">
                {formatNumber(count)}
              </div>
              <div className="text-xs text-slate-500">tenants</div>
            </div>
          );
        })}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Min score">
            <input
              type="number"
              min={0}
              max={100}
              value={minScore === "" ? "" : minScore}
              onChange={(e) => {
                const v = e.target.value;
                setMinScore(
                  v === "" ? "" : Math.max(0, Math.min(100, Number(v))),
                );
                setPage(1);
              }}
              className="w-20 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-white"
            />
          </Field>
          <Field label="Max score">
            <input
              type="number"
              min={0}
              max={100}
              value={maxScore === "" ? "" : maxScore}
              onChange={(e) => {
                const v = e.target.value;
                setMaxScore(
                  v === "" ? "" : Math.max(0, Math.min(100, Number(v))),
                );
                setPage(1);
              }}
              className="w-20 rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-white"
            />
          </Field>
          <Field label="Sort by">
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as "score" | "name");
                setPage(1);
              }}
              className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-white"
            >
              <option value="score">Score</option>
              <option value="name">Name</option>
            </select>
          </Field>
          <Field label="Direction">
            <select
              value={direction}
              onChange={(e) => {
                setDirection(e.target.value as "asc" | "desc");
                setPage(1);
              }}
              className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-white"
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </Field>
          <div className="ml-auto text-[10px] uppercase tracking-widest text-slate-500">
            Showing {rows.length} of {formatNumber(data?.total ?? 0)}
          </div>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/40 text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-2">Tenant</th>
              <th className="px-4 py-2">Plan</th>
              <th className="px-4 py-2">Score</th>
              <th className="px-4 py-2">Sites</th>
              <th className="px-4 py-2">Alerts</th>
              <th className="px-4 py-2">Support</th>
              <th className="px-4 py-2">Reasons</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.tenantId}
                className="border-t border-slate-800/80 hover:bg-slate-900/60"
              >
                <td className="px-4 py-3">
                  <Link
                    to={`/tenants/${row.tenantId}`}
                    className="inline-flex items-center gap-1 font-medium text-white hover:text-cyan-300"
                  >
                    {row.tenantName}
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">
                    {row.tenantStatus}
                    {row.pastDue ? (
                      <span className="ml-2 inline-flex items-center rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-rose-300 ring-1 ring-rose-500/30">
                        Past due
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-200">{row.planName}</div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">
                    {row.subscriptionStatus}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest ring-1 ${BUCKET_TONE[row.bucket]}`}
                  >
                    {row.healthScore} · {BUCKET_LABEL[row.bucket]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-slate-200">
                    {formatNumber(row.liveSites)} live /{" "}
                    {formatNumber(row.siteCount)}
                  </div>
                  {row.failedSites > 0 ? (
                    <div className="text-[10px] uppercase tracking-widest text-rose-300">
                      {formatNumber(row.failedSites)} failed
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  {row.openAlerts > 0 ? (
                    <Link
                      to={`/operations/alerts?tenantId=${row.tenantId}`}
                      className="inline-flex items-center gap-1 font-semibold text-amber-300 hover:text-amber-200"
                    >
                      {formatNumber(row.openAlerts)} open
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-slate-500">0</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.openSupportCases > 0 ? (
                    <Link
                      to={`/support/inbox?tenantId=${row.tenantId}`}
                      className="inline-flex items-center gap-1 font-semibold text-cyan-300 hover:text-cyan-200"
                    >
                      {formatNumber(row.openSupportCases)} open
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="text-slate-500">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[11px] text-slate-400">
                  {row.reasons.length === 0 ? (
                    <span className="text-slate-500">—</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {row.reasons.slice(0, 3).map((reason, idx) => (
                        <li key={idx}>• {reason}</li>
                      ))}
                      {row.reasons.length > 3 ? (
                        <li className="text-slate-500">
                          +{row.reasons.length - 3} more
                        </li>
                      ) : null}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !query.isLoading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No tenants match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {data ? (
        <div className="px-2">
          <Pagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPageChange={setPage}
          />
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
