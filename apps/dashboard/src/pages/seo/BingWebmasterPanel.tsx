import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Globe2,
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
  connectBing,
  deleteBingSitemap,
  disconnectBing,
  getBingLinkSummary,
  getBingOverview,
  getBingStatus,
  listBingCrawlIssues,
  listBingSitemaps,
  listBingSyncJobs,
  submitBingSitemap,
  triggerBingSync,
  verifyBingApiKey,
  type BingWebmasterStatus,
} from "../../api/bingWebmaster";

interface Props {
  siteId: string;
}

export function BingWebmasterPanel({ siteId }: Props) {
  const queryClient = useQueryClient();
  const statusKey = ["seo", "bing-webmaster", "status", siteId] as const;
  const overviewKey = ["seo", "bing-webmaster", "overview", siteId] as const;

  const statusQuery = useQuery({
    queryKey: statusKey,
    queryFn: () => getBingStatus(siteId),
    enabled: Boolean(siteId),
  });

  const status: BingWebmasterStatus | undefined = statusQuery.data;
  const connected = Boolean(status?.connected);

  const overviewQuery = useQuery({
    queryKey: overviewKey,
    queryFn: () => getBingOverview(siteId, 28),
    enabled: connected,
  });

  const sitemapsQuery = useQuery({
    queryKey: ["seo", "bing-webmaster", "sitemaps", siteId],
    queryFn: () => listBingSitemaps(siteId),
    enabled: connected,
  });

  const crawlIssuesQuery = useQuery({
    queryKey: ["seo", "bing-webmaster", "crawl-issues", siteId],
    queryFn: () => listBingCrawlIssues(siteId, 100),
    enabled: connected,
  });

  const linkSummaryQuery = useQuery({
    queryKey: ["seo", "bing-webmaster", "links", siteId],
    queryFn: () => getBingLinkSummary(siteId),
    enabled: connected,
  });

  const syncJobsQuery = useQuery({
    queryKey: ["seo", "bing-webmaster", "sync-jobs", siteId],
    queryFn: () => listBingSyncJobs(siteId, 10),
    enabled: connected,
    refetchInterval: (q) => {
      const jobs = q.state.data;
      if (!jobs) return false;
      return jobs.some((j) => j.status === "RUNNING") ? 5_000 : false;
    },
  });

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [propertyInput, setPropertyInput] = useState("");
  const [verifyResult, setVerifyResult] = useState<Array<{
    url: string;
    isVerified: boolean;
  }> | null>(null);

  const verifyKey = useMutation({
    mutationFn: () => verifyBingApiKey(siteId, apiKeyInput.trim()),
    onSuccess: (data) => {
      setVerifyResult(data.properties);
      // Pre-fill property if exactly one verified property exists.
      const verified = data.properties.filter((p) => p.isVerified);
      if (verified.length === 1 && !propertyInput) {
        setPropertyInput(verified[0]!.url);
      }
    },
  });

  const connectMutation = useMutation({
    mutationFn: () =>
      connectBing(siteId, {
        apiKey: apiKeyInput.trim(),
        propertyUrl: propertyInput.trim(),
      }),
    onSuccess: () => {
      setApiKeyInput("");
      setPropertyInput("");
      setVerifyResult(null);
      queryClient.invalidateQueries({ queryKey: ["seo", "bing-webmaster"] });
    },
  });

  const disconnect = useMutation({
    mutationFn: () => disconnectBing(siteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: statusKey }),
  });

  const triggerSync = useMutation({
    mutationFn: () => triggerBingSync(siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seo", "bing-webmaster"] });
    },
  });

  const [sitemapInput, setSitemapInput] = useState("");
  const submitSitemap = useMutation({
    mutationFn: (sitemapUrl: string) => submitBingSitemap(siteId, sitemapUrl),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["seo", "bing-webmaster", "sitemaps", siteId],
      }),
  });
  const deleteSitemap = useMutation({
    mutationFn: (sitemapUrl: string) => deleteBingSitemap(siteId, sitemapUrl),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["seo", "bing-webmaster", "sitemaps", siteId],
      }),
  });

  const overview = overviewQuery.data;
  const overviewErrorMessage = useMemo(() => {
    if (!overviewQuery.isError) return null;
    const err = overviewQuery.error as
      | { response?: { data?: { message?: string } } }
      | undefined;
    return (
      err?.response?.data?.message ??
      (overviewQuery.error instanceof Error
        ? overviewQuery.error.message
        : "Failed to load Bing Webmaster performance")
    );
  }, [overviewQuery.error, overviewQuery.isError]);

  if (statusQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading Bing Webmaster status…
        </div>
      </div>
    );
  }

  if (statusQuery.isError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Failed to load Bing Webmaster status.
      </div>
    );
  }

  if (!status?.config.encryptionConfigured) {
    return (
      <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6">
        <h3 className="text-base font-semibold text-yellow-900">
          Bing Webmaster Tools not configured
        </h3>
        <p className="mt-2 text-sm text-yellow-800">
          The platform administrator must set the following environment variable
          on the API to enable API-key encryption:
        </p>
        <ul className="mt-2 list-disc pl-6 text-sm text-yellow-800">
          <li>
            <code>SEO_TOKEN_ENCRYPTION_KEY</code> (32-byte base64)
          </li>
        </ul>
      </div>
    );
  }

  const verifyError = verifyKey.error as
    | { response?: { data?: { message?: string } } }
    | undefined;
  const connectError = connectMutation.error as
    | { response?: { data?: { message?: string } } }
    | undefined;

  return (
    <div className="space-y-6">
      {/* Connection card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Globe2 className="h-4 w-4" />
              Bing Webmaster Tools
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Connect Bing Webmaster Tools using an API key to sync impressions,
              clicks, top queries, sitemaps, crawl issues, and backlinks for
              this site.
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
                API key
              </div>
              <div className="mt-1 font-mono text-xs text-gray-900">
                {status?.apiKeyFingerprint ?? "—"}
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

        {!connected && (
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500">
                Bing Webmaster API key
              </label>
              <p className="mb-1 mt-0.5 text-xs text-gray-500">
                Generate one in Bing Webmaster Tools › Settings › API Access. It
                is stored encrypted; only a short fingerprint is shown after.
              </p>
              <input
                type="password"
                autoComplete="off"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="•••••• Bing API key ••••••"
                className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => verifyKey.mutate()}
                disabled={verifyKey.isPending || apiKeyInput.trim().length < 16}
                className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-60"
              >
                {verifyKey.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Verify key & list properties
              </button>
            </div>
            {verifyKey.isError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {verifyError?.response?.data?.message ??
                  (verifyKey.error instanceof Error
                    ? verifyKey.error.message
                    : "Failed to verify API key")}
              </div>
            )}

            {verifyResult && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Properties accessible by this key
                </div>
                {verifyResult.length === 0 ? (
                  <div className="mt-2 text-sm text-gray-600">
                    No properties found for this API key.
                  </div>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {verifyResult.map((p) => (
                      <li
                        key={p.url}
                        className="flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => setPropertyInput(p.url)}
                          className="font-mono text-xs text-blue-700 hover:underline"
                        >
                          {p.url}
                        </button>
                        <span
                          className={
                            p.isVerified
                              ? "text-xs text-emerald-700"
                              : "text-xs text-amber-700"
                          }
                        >
                          {p.isVerified ? "verified" : "unverified"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500">
                Property URL
              </label>
              <input
                type="text"
                value={propertyInput}
                onChange={(e) => setPropertyInput(e.target.value)}
                placeholder="https://example.com/"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            {connectMutation.isError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {connectError?.response?.data?.message ??
                  (connectMutation.error instanceof Error
                    ? connectMutation.error.message
                    : "Failed to connect")}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => connectMutation.mutate()}
                disabled={
                  connectMutation.isPending ||
                  apiKeyInput.trim().length < 16 ||
                  propertyInput.trim().length === 0
                }
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {connectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Connect Bing Webmaster
              </button>
            </div>
          </div>
        )}

        {connected && (
          <div className="mt-5 flex flex-wrap gap-2">
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
                    "Disconnect Bing Webmaster for this site? Stored performance history will be removed.",
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
          </div>
        )}
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
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">URLs</th>
                  <th className="px-3 py-2">Errors</th>
                  <th className="px-3 py-2">Warnings</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sitemapsQuery.data?.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
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
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {sm.status ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-900">
                      {sm.urlCount}
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

      {/* Crawl issues */}
      {connected && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">
            Crawl issues
          </h3>
          {crawlIssuesQuery.isLoading ? (
            <div className="mt-2 text-sm text-gray-500">Loading…</div>
          ) : crawlIssuesQuery.data?.length === 0 ? (
            <div className="mt-2 text-sm text-emerald-700">
              No open crawl issues reported by Bing.
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-md border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">URL</th>
                    <th className="px-3 py-2">Issue</th>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">HTTP</th>
                    <th className="px-3 py-2">First detected</th>
                    <th className="px-3 py-2">Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {crawlIssuesQuery.data?.map((iss) => (
                    <tr key={iss.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs text-gray-900">
                        <a
                          href={iss.url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-blue-600"
                        >
                          {iss.url}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {iss.category ?? iss.issueCode}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {iss.severity === "ERROR" ? (
                          <span className="text-red-600">{iss.severity}</span>
                        ) : iss.severity === "WARNING" ? (
                          <span className="text-amber-600">{iss.severity}</span>
                        ) : (
                          <span className="text-gray-600">{iss.severity}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {iss.httpCode ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {new Date(iss.firstDetectedAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {new Date(iss.lastSeenAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Link summary */}
      {connected && linkSummaryQuery.data && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Backlinks</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <MetricCard
              label="Total inbound links"
              value={linkSummaryQuery.data.totalLinks}
            />
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-xs uppercase tracking-wide text-gray-500">
                Fetched
              </div>
              <div className="mt-1 text-sm text-gray-900">
                {linkSummaryQuery.data.fetchedAt
                  ? new Date(linkSummaryQuery.data.fetchedAt).toLocaleString()
                  : "Never"}
              </div>
            </div>
          </div>
          {linkSummaryQuery.data.topDomains.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Referring domain</th>
                    <th className="px-3 py-2 text-right">Links</th>
                  </tr>
                </thead>
                <tbody>
                  {linkSummaryQuery.data.topDomains.map((d) => (
                    <tr key={d.domain} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs text-gray-900">
                        {d.domain}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-gray-900">
                        {d.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                  <th className="px-3 py-2">Issues</th>
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
                      {job.crawlIssuesSynced}
                    </td>
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
