import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Gauge,
  Globe,
  Loader2,
  Monitor,
  RefreshCw,
  Smartphone,
} from "lucide-react";

import {
  fetchCruxRecord,
  getLatestPsiAudits,
  getPsiConfig,
  getPsiQuota,
  listPsiAudits,
  runPsiAudit,
  type CruxFormFactor,
  type PsiAuditSummary,
  type PsiStrategy,
} from "../../api/psi";

interface PsiPanelProps {
  siteId: string;
}

const formatScore = (value: number | null): string =>
  value === null ? "—" : `${Math.round(value * 100)}`;

const scoreColor = (value: number | null): string => {
  if (value === null) return "text-gray-400";
  if (value >= 0.9) return "text-emerald-600";
  if (value >= 0.5) return "text-amber-600";
  return "text-rose-600";
};

const formatMs = (value: number | null): string =>
  value === null ? "—" : `${(value / 1000).toFixed(2)}s`;

const formatCls = (value: number | null): string =>
  value === null ? "—" : value.toFixed(3);

export function PsiPanel({ siteId }: PsiPanelProps) {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [strategy, setStrategy] = useState<PsiStrategy>("MOBILE");
  const [cruxTarget, setCruxTarget] = useState<"url" | "origin">("origin");
  const [cruxInput, setCruxInput] = useState("");
  const [cruxFormFactor, setCruxFormFactor] =
    useState<CruxFormFactor>("PHONE");

  const configQuery = useQuery({
    queryKey: ["psi-config", siteId],
    queryFn: () => getPsiConfig(siteId),
  });

  const quotaQuery = useQuery({
    queryKey: ["psi-quota", siteId],
    queryFn: () => getPsiQuota(siteId),
  });

  const latestQuery = useQuery({
    queryKey: ["psi-latest", siteId],
    queryFn: () => getLatestPsiAudits(siteId, 12),
  });

  const recentQuery = useQuery({
    queryKey: ["psi-recent", siteId],
    queryFn: () => listPsiAudits(siteId, { limit: 25 }),
  });

  const runAudit = useMutation({
    mutationFn: () =>
      runPsiAudit(siteId, { url: url.trim(), strategy, forceRefresh: false }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["psi-quota", siteId] });
      void queryClient.invalidateQueries({ queryKey: ["psi-latest", siteId] });
      void queryClient.invalidateQueries({ queryKey: ["psi-recent", siteId] });
    },
  });

  const cruxQuery = useMutation({
    mutationFn: () =>
      fetchCruxRecord(siteId, {
        ...(cruxTarget === "url"
          ? { url: cruxInput.trim() }
          : { origin: cruxInput.trim() }),
        formFactor: cruxFormFactor,
      }),
  });

  const configured = configQuery.data?.configured ?? false;
  const quotaText = useMemo(() => {
    const q = quotaQuery.data;
    if (!q) return "—";
    return `${q.used}/${q.limit}`;
  }, [quotaQuery.data]);

  const auditError = useMutationErrorMessage(runAudit.error);
  const cruxError = useMutationErrorMessage(cruxQuery.error);
  const cruxResult = cruxQuery.data;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Performance &amp; Core Web Vitals
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Run on-demand PageSpeed Insights audits and pull Chrome UX Report
              field data using a shared platform API key.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              This month
            </p>
            <p className="text-lg font-semibold text-gray-900">{quotaText}</p>
            <p className="text-xs text-gray-500">
              audits used on this plan
            </p>
          </div>
        </div>

        {configQuery.isLoading ? null : !configured ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div>
              PageSpeed Insights is not configured on this deployment. Add{" "}
              <code className="font-mono text-xs">PSI_API_KEY</code> to enable
              audits and CrUX field data.
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Run audit</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/page"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <div className="flex gap-1 rounded-md border border-gray-200 p-1">
            <button
              type="button"
              onClick={() => setStrategy("MOBILE")}
              className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${
                strategy === "MOBILE"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600"
              }`}
            >
              <Smartphone className="h-4 w-4" /> Mobile
            </button>
            <button
              type="button"
              onClick={() => setStrategy("DESKTOP")}
              className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${
                strategy === "DESKTOP"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600"
              }`}
            >
              <Monitor className="h-4 w-4" /> Desktop
            </button>
          </div>
          <button
            type="button"
            onClick={() => runAudit.mutate()}
            disabled={
              !configured || !url.trim() || runAudit.isPending
            }
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {runAudit.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Gauge className="h-4 w-4" />
            )}
            Run audit
          </button>
        </div>
        {auditError ? (
          <p className="mt-3 text-sm text-rose-600">{auditError}</p>
        ) : null}
        {runAudit.data?.cached ? (
          <p className="mt-3 text-xs text-gray-500">
            Returned a cached result (last run within{" "}
            {configQuery.data?.psiCacheMaxAgeHours ?? 6}h).
          </p>
        ) : null}
        {runAudit.data ? (
          <AuditCard audit={runAudit.data.audit} />
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Latest per URL</h3>
        {latestQuery.isLoading ? (
          <p className="mt-3 text-sm text-gray-500">Loading…</p>
        ) : !latestQuery.data || latestQuery.data.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">
            No audits yet. Run one above to see scores here.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-3">URL</th>
                  <th className="py-2 pr-3">Strategy</th>
                  <th className="py-2 pr-3">Perf</th>
                  <th className="py-2 pr-3">A11y</th>
                  <th className="py-2 pr-3">BP</th>
                  <th className="py-2 pr-3">SEO</th>
                  <th className="py-2 pr-3">LCP</th>
                  <th className="py-2 pr-3">CLS</th>
                  <th className="py-2 pr-3">INP</th>
                </tr>
              </thead>
              <tbody>
                {latestQuery.data.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="max-w-[24rem] truncate py-2 pr-3 text-gray-900">
                      {row.url}
                    </td>
                    <td className="py-2 pr-3 text-gray-500">{row.strategy}</td>
                    <td
                      className={`py-2 pr-3 font-semibold ${scoreColor(row.performanceScore)}`}
                    >
                      {formatScore(row.performanceScore)}
                    </td>
                    <td
                      className={`py-2 pr-3 ${scoreColor(row.accessibilityScore)}`}
                    >
                      {formatScore(row.accessibilityScore)}
                    </td>
                    <td
                      className={`py-2 pr-3 ${scoreColor(row.bestPracticesScore)}`}
                    >
                      {formatScore(row.bestPracticesScore)}
                    </td>
                    <td className={`py-2 pr-3 ${scoreColor(row.seoScore)}`}>
                      {formatScore(row.seoScore)}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">
                      {formatMs(row.largestContentfulPaintMs)}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">
                      {formatCls(row.cumulativeLayoutShift)}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">
                      {formatMs(row.interactionToNextPaintMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">
          Chrome UX Report (field data)
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Real-user p75 metrics from Google&rsquo;s 28-day rolling window.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[auto_1fr_auto_auto]">
          <div className="flex gap-1 rounded-md border border-gray-200 p-1">
            <button
              type="button"
              onClick={() => setCruxTarget("origin")}
              className={`flex items-center gap-1 rounded px-3 py-1.5 text-sm ${
                cruxTarget === "origin"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600"
              }`}
            >
              <Globe className="h-4 w-4" /> Origin
            </button>
            <button
              type="button"
              onClick={() => setCruxTarget("url")}
              className={`rounded px-3 py-1.5 text-sm ${
                cruxTarget === "url"
                  ? "bg-gray-900 text-white"
                  : "text-gray-600"
              }`}
            >
              URL
            </button>
          </div>
          <input
            value={cruxInput}
            onChange={(e) => setCruxInput(e.target.value)}
            placeholder={
              cruxTarget === "origin"
                ? "https://example.com"
                : "https://example.com/page"
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={cruxFormFactor}
            onChange={(e) =>
              setCruxFormFactor(e.target.value as CruxFormFactor)
            }
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="PHONE">Phone</option>
            <option value="DESKTOP">Desktop</option>
            <option value="TABLET">Tablet</option>
            <option value="ALL">All form factors</option>
          </select>
          <button
            type="button"
            onClick={() => cruxQuery.mutate()}
            disabled={
              !configured || !cruxInput.trim() || cruxQuery.isPending
            }
            className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cruxQuery.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Fetch
          </button>
        </div>
        {cruxError ? (
          <p className="mt-3 text-sm text-rose-600">{cruxError}</p>
        ) : null}
        {cruxResult ? (
          cruxResult.notFound || !cruxResult.record ? (
            <p className="mt-3 text-sm text-gray-500">
              CrUX has no public field data for that target / form factor.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Stat label="LCP (p75)" value={formatMs(cruxResult.record.lcpP75Ms)} />
              <Stat label="FCP (p75)" value={formatMs(cruxResult.record.fcpP75Ms)} />
              <Stat label="CLS (p75)" value={formatCls(cruxResult.record.clsP75)} />
              <Stat label="INP (p75)" value={formatMs(cruxResult.record.inpP75Ms)} />
              <Stat label="TTFB (p75)" value={formatMs(cruxResult.record.ttfbP75Ms)} />
              <Stat label="FID (p75)" value={formatMs(cruxResult.record.fidP75Ms)} />
            </div>
          )
        ) : null}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Recent audits</h3>
          <button
            type="button"
            onClick={() => recentQuery.refetch()}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className="inline h-3 w-3" /> Refresh
          </button>
        </div>
        {recentQuery.isLoading ? (
          <p className="mt-3 text-sm text-gray-500">Loading…</p>
        ) : !recentQuery.data || recentQuery.data.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No audit history yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {recentQuery.data.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Activity className="h-3 w-3 text-gray-400" />
                    <span className="truncate text-gray-900">{row.url}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                      {row.strategy}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(row.createdAt).toLocaleString()} •{" "}
                    <span
                      className={
                        row.status === "FAILED"
                          ? "text-rose-600"
                          : row.status === "COMPLETED"
                            ? "text-emerald-600"
                            : "text-amber-600"
                      }
                    >
                      {row.status}
                    </span>
                    {row.failureReason ? ` • ${row.failureReason}` : null}
                  </p>
                </div>
                <div
                  className={`text-base font-semibold ${scoreColor(row.performanceScore)}`}
                >
                  {formatScore(row.performanceScore)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AuditCard({ audit }: { audit: PsiAuditSummary }) {
  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">
            {audit.url}
          </p>
          <p className="text-xs text-gray-500">
            {audit.strategy} • {new Date(audit.createdAt).toLocaleString()}
          </p>
        </div>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            audit.status === "COMPLETED"
              ? "bg-emerald-100 text-emerald-800"
              : audit.status === "FAILED"
                ? "bg-rose-100 text-rose-700"
                : "bg-amber-100 text-amber-800"
          }`}
        >
          {audit.status}
        </span>
      </div>
      {audit.failureReason ? (
        <p className="mt-2 text-sm text-rose-600">{audit.failureReason}</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat
              label="Performance"
              value={formatScore(audit.performanceScore)}
              valueClass={scoreColor(audit.performanceScore)}
            />
            <Stat
              label="Accessibility"
              value={formatScore(audit.accessibilityScore)}
              valueClass={scoreColor(audit.accessibilityScore)}
            />
            <Stat
              label="Best Practices"
              value={formatScore(audit.bestPracticesScore)}
              valueClass={scoreColor(audit.bestPracticesScore)}
            />
            <Stat
              label="SEO"
              value={formatScore(audit.seoScore)}
              valueClass={scoreColor(audit.seoScore)}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6">
            <Stat label="LCP" value={formatMs(audit.largestContentfulPaintMs)} />
            <Stat label="FCP" value={formatMs(audit.firstContentfulPaintMs)} />
            <Stat label="CLS" value={formatCls(audit.cumulativeLayoutShift)} />
            <Stat label="TBT" value={formatMs(audit.totalBlockingTimeMs)} />
            <Stat label="INP" value={formatMs(audit.interactionToNextPaintMs)} />
            <Stat label="SI" value={formatMs(audit.speedIndexMs)} />
          </div>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-white bg-white px-3 py-2 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-base font-semibold ${valueClass ?? "text-gray-900"}`}>
        {value}
      </p>
    </div>
  );
}

function useMutationErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) {
    const anyError = error as { response?: { data?: { message?: unknown; code?: unknown } } };
    const data = anyError.response?.data;
    if (data && typeof data.message === "string") {
      return data.code ? `${data.code}: ${data.message}` : data.message;
    }
    return error.message;
  }
  return String(error);
}
