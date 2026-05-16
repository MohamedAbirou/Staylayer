import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Trash2,
  Unlink,
  Upload,
} from "lucide-react";

import {
  completeSearchConsoleOAuth,
  deleteSearchConsoleSitemap,
  disconnectSearchConsole,
  getSearchConsoleOverview,
  getSearchConsoleStatus,
  inspectSearchConsoleUrl,
  listSearchConsoleSitemaps,
  listSearchConsoleSyncJobs,
  startSearchConsoleOAuth,
  submitSearchConsoleSitemap,
  triggerSearchConsoleSync,
  type SearchConsoleStatus,
} from "../../api/searchConsole";

interface Props {
  siteId: string;
}

const PENDING_STATE_KEY = "staylayer.gsc.pending";

interface PendingState {
  siteId: string;
  state: string;
  startedAt: number;
}

function loadPending(): PendingState | null {
  try {
    const raw = sessionStorage.getItem(PENDING_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingState;
  } catch {
    return null;
  }
}

function savePending(state: PendingState | null) {
  if (state === null) {
    sessionStorage.removeItem(PENDING_STATE_KEY);
  } else {
    sessionStorage.setItem(PENDING_STATE_KEY, JSON.stringify(state));
  }
}

export function SearchConsolePanel({ siteId }: Props) {
  const queryClient = useQueryClient();
  const statusKey = ["seo", "search-console", "status", siteId] as const;
  const overviewKey = ["seo", "search-console", "overview", siteId] as const;

  const statusQuery = useQuery({
    queryKey: statusKey,
    queryFn: () => getSearchConsoleStatus(siteId),
    enabled: Boolean(siteId),
  });

  const status: SearchConsoleStatus | undefined = statusQuery.data;
  const connected = Boolean(status?.connected);

  const overviewQuery = useQuery({
    queryKey: overviewKey,
    queryFn: () => getSearchConsoleOverview(siteId, 28),
    enabled: connected,
  });

  const sitemapsQuery = useQuery({
    queryKey: ["seo", "search-console", "sitemaps", siteId],
    queryFn: () => listSearchConsoleSitemaps(siteId),
    enabled: connected,
  });

  const syncJobsQuery = useQuery({
    queryKey: ["seo", "search-console", "sync-jobs", siteId],
    queryFn: () => listSearchConsoleSyncJobs(siteId, 10),
    enabled: connected,
    refetchInterval: (q) => {
      const jobs = q.state.data;
      if (!jobs) return false;
      return jobs.some((j) => j.status === "RUNNING") ? 5_000 : false;
    },
  });

  const startOAuth = useMutation({
    mutationFn: async () => {
      const { authUrl, state } = await startSearchConsoleOAuth(siteId);
      savePending({ siteId, state, startedAt: Date.now() });
      window.location.assign(authUrl);
    },
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectSearchConsole(siteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: statusKey }),
  });

  const triggerSync = useMutation({
    mutationFn: () => triggerSearchConsoleSync(siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seo", "search-console"] });
    },
  });

  const submitSitemap = useMutation({
    mutationFn: (sitemapUrl: string) =>
      submitSearchConsoleSitemap(siteId, sitemapUrl),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["seo", "search-console", "sitemaps", siteId],
      }),
  });

  const deleteSitemap = useMutation({
    mutationFn: (sitemapUrl: string) =>
      deleteSearchConsoleSitemap(siteId, sitemapUrl),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["seo", "search-console", "sitemaps", siteId],
      }),
  });

  const [sitemapInput, setSitemapInput] = useState("");
  const [inspectUrl, setInspectUrl] = useState("");
  const [inspectionResult, setInspectionResult] = useState<unknown>(null);
  const inspect = useMutation({
    mutationFn: (url: string) => inspectSearchConsoleUrl(siteId, url),
    onSuccess: (data) => setInspectionResult(data),
  });

  const overview = overviewQuery.data;
  const overviewError = overviewQuery.error as
    | { response?: { data?: { code?: string; message?: string } } }
    | undefined;
  const overviewErrorMessage = useMemo(() => {
    if (!overviewQuery.isError) return null;
    return (
      overviewError?.response?.data?.message ??
      (overviewQuery.error instanceof Error
        ? overviewQuery.error.message
        : "Failed to load Search Console performance")
    );
  }, [overviewError, overviewQuery.error, overviewQuery.isError]);

  if (statusQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Search Console status…
        </div>
      </div>
    );
  }

  if (statusQuery.isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Failed to load Search Console status.
      </div>
    );
  }

  if (!status?.config.oauthConfigured || !status?.config.encryptionConfigured) {
    return (
      <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6">
        <h3 className="text-base font-semibold text-yellow-900">
          Google Search Console not configured
        </h3>
        <p className="mt-2 text-sm text-yellow-800">
          The platform administrator must set the following environment
          variables on the API:
        </p>
        <ul className="mt-2 list-disc pl-6 text-sm text-yellow-800">
          {!status?.config.oauthConfigured && (
            <>
              <li>
                <code>GOOGLE_OAUTH_CLIENT_ID</code>
              </li>
              <li>
                <code>GOOGLE_OAUTH_CLIENT_SECRET</code>
              </li>
              <li>
                <code>SEARCH_CONSOLE_OAUTH_REDIRECT_URI</code>
              </li>
            </>
          )}
          {!status?.config.encryptionConfigured && (
            <li>
              <code>SEO_TOKEN_ENCRYPTION_KEY</code> (32-byte base64)
            </li>
          )}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Search className="h-4 w-4" />
              Google Search Console
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Connect Google Search Console to sync impressions, clicks, top
              queries, sitemaps and URL inspection data for this site.
            </p>
          </div>
          {connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
              <Unlink className="h-3.5 w-3.5" />
              Not connected
            </span>
          )}
        </div>

        {connected && (
          <div className="mt-4 grid gap-4 text-sm md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Property
              </div>
              <div className="mt-1 font-mono text-xs text-gray-900">
                {status?.propertyUrl}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Google account
              </div>
              <div className="mt-1 text-gray-900">
                {status?.googleAccountEmail ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Last sync
              </div>
              <div className="mt-1 text-gray-900">
                {status?.lastSuccessfulSyncAt
                  ? new Date(status.lastSuccessfulSyncAt).toLocaleString()
                  : "Never"}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Status
              </div>
              <div className="mt-1 text-gray-900">{status?.status}</div>
            </div>
            {status?.lastError && (
              <div className="md:col-span-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="mr-1 inline h-4 w-4" />
                {status.lastError}
                {status.consecutiveFailures > 0 && (
                  <span className="ml-1 text-xs">
                    ({status.consecutiveFailures} consecutive failure
                    {status.consecutiveFailures > 1 ? "s" : ""})
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {!connected && (
            <button
              type="button"
              onClick={() => startOAuth.mutate()}
              disabled={startOAuth.isPending}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {startOAuth.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Connect with Google
            </button>
          )}
          {connected && (
            <>
              <button
                type="button"
                onClick={() => triggerSync.mutate()}
                disabled={triggerSync.isPending}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {triggerSync.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync now
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Disconnect Google Search Console for this site? Stored performance history will be removed.",
                    )
                  ) {
                    disconnect.mutate();
                  }
                }}
                disabled={disconnect.isPending}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {/* Performance overview */}
      {connected && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">
            Performance — last 28 days
          </h3>
          {overviewQuery.isLoading && (
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}
          {overviewErrorMessage && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {overviewErrorMessage}
            </div>
          )}
          {overview && (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <MetricCard label="Clicks" value={overview.totals.clicks} />
                <MetricCard
                  label="Impressions"
                  value={overview.totals.impressions}
                />
                <MetricCard
                  label="CTR"
                  value={`${(overview.totals.ctr * 100).toFixed(2)}%`}
                />
                <MetricCard
                  label="Avg position"
                  value={overview.totals.position.toFixed(1)}
                />
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <PerformanceTable
                  title="Top pages"
                  rows={overview.topPages.slice(0, 10).map((r) => ({
                    label: r.page,
                    clicks: r.clicks,
                    impressions: r.impressions,
                    ctr: r.ctr,
                    position: r.position,
                  }))}
                />
                <PerformanceTable
                  title="Top queries"
                  rows={overview.topQueries.slice(0, 10).map((r) => ({
                    label: r.query,
                    clicks: r.clicks,
                    impressions: r.impressions,
                    ctr: r.ctr,
                    position: r.position,
                  }))}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Sitemaps */}
      {connected && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Sitemaps</h3>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={sitemapInput}
              onChange={(e) => setSitemapInput(e.target.value)}
              placeholder="https://example.com/sitemap.xml"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (!sitemapInput.trim()) return;
                submitSitemap.mutate(sitemapInput.trim(), {
                  onSuccess: () => setSitemapInput(""),
                });
              }}
              disabled={submitSitemap.isPending || !sitemapInput.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitSitemap.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Submit
            </button>
          </div>
          {submitSitemap.isError && (
            <div className="mt-2 text-sm text-red-700">
              {(submitSitemap.error as Error).message}
            </div>
          )}
          <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">URL</th>
                  <th className="px-3 py-2">Last submitted</th>
                  <th className="px-3 py-2">Errors</th>
                  <th className="px-3 py-2">Warnings</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sitemapsQuery.data?.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-4 text-center text-sm text-gray-500"
                    >
                      No sitemaps submitted yet.
                    </td>
                  </tr>
                )}
                {sitemapsQuery.data?.map((sm) => (
                  <tr key={sm.sitemapUrl} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-xs text-gray-900">
                      <a
                        href={sm.sitemapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:text-blue-600"
                      >
                        {sm.sitemapUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {sm.lastSubmitted
                        ? new Date(sm.lastSubmitted).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {sm.errors > 0 ? (
                        <span className="text-red-600">{sm.errors}</span>
                      ) : (
                        sm.errors
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {sm.warnings > 0 ? (
                        <span className="text-amber-600">{sm.warnings}</span>
                      ) : (
                        sm.warnings
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove ${sm.sitemapUrl}?`)) {
                            deleteSitemap.mutate(sm.sitemapUrl);
                          }
                        }}
                        className="text-gray-400 hover:text-red-600"
                        title="Remove sitemap"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* URL Inspector */}
      {connected && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">
            URL Inspection
          </h3>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={inspectUrl}
              onChange={(e) => setInspectUrl(e.target.value)}
              placeholder="https://example.com/some-page"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (!inspectUrl.trim()) return;
                inspect.mutate(inspectUrl.trim());
              }}
              disabled={inspect.isPending || !inspectUrl.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {inspect.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Inspect
            </button>
          </div>
          {inspect.isError && (
            <div className="mt-2 text-sm text-red-700">
              {(inspect.error as Error).message}
            </div>
          )}
          {inspectionResult !== null && (
            <pre className="mt-4 max-h-96 overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
              {JSON.stringify(inspectionResult, null, 2)}
            </pre>
          )}
        </div>
      )}

      {/* Sync jobs */}
      {connected && syncJobsQuery.data && syncJobsQuery.data.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">
            Recent sync jobs
          </h3>
          <div className="mt-3 overflow-hidden rounded-md border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Pages</th>
                  <th className="px-3 py-2">Queries</th>
                  <th className="px-3 py-2">Started</th>
                  <th className="px-3 py-2">Trigger</th>
                </tr>
              </thead>
              <tbody>
                {syncJobsQuery.data.map((job) => (
                  <tr key={job.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-xs">{job.type}</td>
                    <td className="px-3 py-2 text-xs">
                      {job.status === "FAILED" ? (
                        <span className="text-red-600">{job.status}</span>
                      ) : job.status === "RUNNING" ? (
                        <span className="text-blue-600">{job.status}</span>
                      ) : (
                        <span className="text-emerald-600">{job.status}</span>
                      )}
                      {job.failureReason && (
                        <div className="mt-0.5 text-[11px] text-red-600">
                          {job.failureReason}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{job.pagesSynced}</td>
                    <td className="px-3 py-2 text-xs">{job.queriesSynced}</td>
                    <td className="px-3 py-2 text-xs">
                      {job.startedAt
                        ? new Date(job.startedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {job.triggeredBy ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function PerformanceTable({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    label: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      <div className="mt-2 overflow-hidden rounded-md border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-left uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-2 py-1.5">Label</th>
              <th className="px-2 py-1.5 text-right">Clicks</th>
              <th className="px-2 py-1.5 text-right">Impr.</th>
              <th className="px-2 py-1.5 text-right">CTR</th>
              <th className="px-2 py-1.5 text-right">Pos.</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-2 py-3 text-center text-gray-500">
                  No data yet — first sync may still be running.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-gray-100">
                <td
                  className="px-2 py-1.5 font-mono text-[11px] text-gray-800"
                  title={r.label}
                >
                  <div className="max-w-[260px] truncate">{r.label}</div>
                </td>
                <td className="px-2 py-1.5 text-right">{r.clicks}</td>
                <td className="px-2 py-1.5 text-right">{r.impressions}</td>
                <td className="px-2 py-1.5 text-right">
                  {(r.ctr * 100).toFixed(2)}%
                </td>
                <td className="px-2 py-1.5 text-right">
                  {r.position.toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export {
  loadPending as loadPendingSearchConsoleOAuth,
  savePending as savePendingSearchConsoleOAuth,
  PENDING_STATE_KEY,
};
export { completeSearchConsoleOAuth };
