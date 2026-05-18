import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Search,
  RefreshCw,
  Gauge,
  FileText,
  Languages,
  Database,
} from "lucide-react";
import {
  getOperatorSeoSiteSummary,
  retryOperatorSitemapSubmission,
} from "../api/operator";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { DataFreshness } from "../components/DataFreshness";
import { ReasonModal } from "../components/ReasonModal";
import { useCan } from "../permissions";
import { OPERATOR_PERMISSIONS } from "../permissions/registry";
import { extractErrorMessage } from "../lib/errors";
import { formatRelative } from "../lib/operations";

function sitemapStatusTone(
  status: string,
): "ok" | "warn" | "danger" | "info" | "muted" {
  if (status === "SUCCESS" || status === "ACCEPTED") return "ok";
  if (status === "FAILED" || status === "ERROR") return "danger";
  if (status === "PENDING" || status === "RETRYING") return "info";
  return "muted";
}

/**
 * Phase 9 — Operations / SEO.
 *
 * Operator entry into per-site SEO state. The summary endpoint
 * intentionally returns a snapshot — there is no list view because
 * SEO state is meaningful per-site. Operators paste or pass-through a
 * siteId (typically arriving from the site detail page) and can retry
 * a stuck sitemap submission with an audited reason.
 */
export default function OperationsSeoPage() {
  const [siteIdInput, setSiteIdInput] = useState("");
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ logId: string; target: string } | null>(
    null,
  );
  const [modalError, setModalError] = useState<string | null>(null);

  const canRetry = useCan(OPERATOR_PERMISSIONS.SEO_RESUBMIT_ALL);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["operator-ops-seo", activeSiteId],
    queryFn: () => getOperatorSeoSiteSummary(activeSiteId!),
    enabled: !!activeSiteId,
    staleTime: 15_000,
  });

  const retryMutation = useMutation({
    mutationFn: ({ logId, reason }: { logId: string; reason: string }) =>
      retryOperatorSitemapSubmission(activeSiteId!, logId, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["operator-ops-seo", activeSiteId],
      });
      setModal(null);
      setModalError(null);
    },
    onError: (err) => setModalError(extractErrorMessage(err)),
  });

  const data = query.data;
  const enabledSchemas = useMemo(
    () => data?.structuredData?.enabledSchemas ?? [],
    [data],
  );

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">SEO operations</h1>
            <p className="text-xs text-slate-400">
              Per-site SEO snapshot. Sitemap re-submissions are audited.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={data?.generatedAt ?? null} />
      </header>

      <form
        className="mt-6 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = siteIdInput.trim();
          setActiveSiteId(trimmed.length > 0 ? trimmed : null);
        }}
      >
        <input
          type="text"
          value={siteIdInput}
          onChange={(e) => setSiteIdInput(e.target.value)}
          placeholder="Site ID (cuid)"
          className="w-96 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md border border-cyan-700 bg-cyan-900/30 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-900/60"
        >
          Load snapshot
        </button>
      </form>

      {query.isError ? (
        <p className="mt-4 rounded-md border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-200">
          {extractErrorMessage(query.error)}
        </p>
      ) : null}

      {!activeSiteId ? (
        <EmptyState
          title="Enter a site ID to load SEO state"
          description="Tip: open the site detail page and copy its ID from the URL bar."
        />
      ) : query.isLoading ? (
        <p className="mt-6 text-xs text-slate-500">Loading SEO snapshot…</p>
      ) : data ? (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel icon={<Database className="h-4 w-4" />} title="Site">
            <dl className="grid grid-cols-2 gap-y-1 text-xs">
              <dt className="text-slate-500">Name</dt>
              <dd className="text-slate-200">
                <Link
                  to={`/sites/${data.site.id}`}
                  className="hover:text-cyan-300"
                >
                  {data.site.name}
                </Link>
              </dd>
              <dt className="text-slate-500">Tenant</dt>
              <dd className="text-slate-200">
                <Link
                  to={`/tenants/${data.site.tenantId}`}
                  className="hover:text-cyan-300"
                >
                  {data.site.tenantName}
                </Link>
              </dd>
              <dt className="text-slate-500">Redirects</dt>
              <dd className="text-slate-200">{data.redirects.total}</dd>
            </dl>
          </Panel>

          <Panel
            icon={<FileText className="h-4 w-4" />}
            title="Structured data"
          >
            {data.structuredData ? (
              <dl className="grid grid-cols-2 gap-y-1 text-xs">
                <dt className="text-slate-500">Business type</dt>
                <dd className="text-slate-200">
                  {data.structuredData.businessType}
                </dd>
                <dt className="text-slate-500">Updated</dt>
                <dd className="text-slate-200">
                  {formatRelative(data.structuredData.updatedAt)}
                </dd>
                <dt className="col-span-2 text-slate-500">Enabled schemas</dt>
                <dd className="col-span-2">
                  <div className="flex flex-wrap gap-1">
                    {enabledSchemas.length === 0 ? (
                      <span className="text-slate-500">none</span>
                    ) : (
                      enabledSchemas.map((s) => (
                        <StatusBadge key={s} status={s} tone="info" />
                      ))
                    )}
                  </div>
                </dd>
              </dl>
            ) : (
              <p className="text-xs text-slate-500">Not configured.</p>
            )}
          </Panel>

          <Panel
            icon={<Gauge className="h-4 w-4" />}
            title="PageSpeed Insights"
          >
            {data.psi ? (
              <dl className="grid grid-cols-2 gap-y-1 text-xs">
                <dt className="text-slate-500">Status</dt>
                <dd className="text-slate-200">{data.psi.status}</dd>
                <dt className="text-slate-500">Strategy</dt>
                <dd className="text-slate-200">{data.psi.strategy}</dd>
                <dt className="text-slate-500">Started</dt>
                <dd className="text-slate-200">
                  {formatRelative(data.psi.createdAt)}
                </dd>
              </dl>
            ) : (
              <p className="text-xs text-slate-500">No recent PSI run.</p>
            )}
          </Panel>

          <Panel
            icon={<Languages className="h-4 w-4" />}
            title="Hreflang audit"
          >
            {data.hreflang ? (
              <dl className="grid grid-cols-2 gap-y-1 text-xs">
                <dt className="text-slate-500">Status</dt>
                <dd className="text-slate-200">{data.hreflang.status}</dd>
                <dt className="text-slate-500">Errors</dt>
                <dd
                  className={
                    data.hreflang.errorCount > 0
                      ? "text-rose-300"
                      : "text-slate-200"
                  }
                >
                  {data.hreflang.errorCount}
                </dd>
                <dt className="text-slate-500">Warnings</dt>
                <dd
                  className={
                    data.hreflang.warningCount > 0
                      ? "text-amber-300"
                      : "text-slate-200"
                  }
                >
                  {data.hreflang.warningCount}
                </dd>
                <dt className="text-slate-500">Generated</dt>
                <dd className="text-slate-200">
                  {formatRelative(data.hreflang.createdAt)}
                </dd>
              </dl>
            ) : (
              <p className="text-xs text-slate-500">No hreflang audit yet.</p>
            )}
          </Panel>

          <div className="lg:col-span-2">
            <Panel
              icon={<RefreshCw className="h-4 w-4" />}
              title="Sitemap submissions"
            >
              {data.sitemapSubmissions.length === 0 ? (
                <p className="text-xs text-slate-500">No submissions logged.</p>
              ) : (
                <table className="min-w-full divide-y divide-slate-800 text-xs">
                  <thead className="text-left text-[10px] uppercase tracking-widest text-slate-500">
                    <tr>
                      <th className="py-2 pr-3 font-semibold">Target</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 pr-3 font-semibold">URLs</th>
                      <th className="py-2 pr-3 font-semibold">Attempts</th>
                      <th className="py-2 pr-3 font-semibold">Last attempt</th>
                      <th className="py-2 pr-3 font-semibold text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {data.sitemapSubmissions.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2 pr-3 text-slate-200">
                          {row.target}
                        </td>
                        <td className="py-2 pr-3">
                          <StatusBadge
                            status={row.status}
                            tone={sitemapStatusTone(row.status)}
                          />
                          {row.responseStatus ? (
                            <span className="ml-2 text-slate-500">
                              ({row.responseStatus})
                            </span>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 text-slate-300">
                          {row.urlCount}
                        </td>
                        <td className="py-2 pr-3 text-slate-300">
                          {row.attempts}
                        </td>
                        <td className="py-2 pr-3 text-slate-400">
                          <time title={row.lastAttemptAt ?? row.createdAt}>
                            {formatRelative(row.lastAttemptAt ?? row.createdAt)}
                          </time>
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <button
                            type="button"
                            disabled={!canRetry}
                            onClick={() => {
                              setModalError(null);
                              setModal({ logId: row.id, target: row.target });
                            }}
                            className="rounded-md border border-cyan-700 bg-cyan-900/30 px-2 py-1 text-[11px] text-cyan-100 hover:bg-cyan-900/60 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <RefreshCw className="mr-1 inline h-3 w-3" />
                            Retry
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>
        </div>
      ) : null}

      {modal && activeSiteId ? (
        <ReasonModal
          open
          title={`Retry sitemap submission to ${modal.target}`}
          description="This will re-issue the sitemap ping. Search engines may rate-limit repeated submissions, so use sparingly."
          confirmLabel="Retry submission"
          minReasonLength={8}
          submitting={retryMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) =>
            retryMutation.mutateAsync({ logId: modal.logId, reason })
          }
        />
      ) : null}
    </div>
  );
}

function Panel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
