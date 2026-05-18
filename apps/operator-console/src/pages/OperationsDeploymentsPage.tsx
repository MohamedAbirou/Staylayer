import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Rocket, RefreshCw, Search } from "lucide-react";
import {
  listOperatorDeployments,
  retryOperatorDeployment,
  type OperatorDeploymentStatus,
  type OperatorOpsDeploymentListItem,
} from "../api/operator";
import { Pagination } from "../components/Pagination";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { DataFreshness } from "../components/DataFreshness";
import { ReasonModal } from "../components/ReasonModal";
import { useCan } from "../permissions";
import { OPERATOR_PERMISSIONS } from "../permissions/registry";
import { extractErrorMessage } from "../lib/errors";
import {
  deploymentStatusTone,
  formatDateTime,
  formatRelative,
} from "../lib/operations";

const STATUS_OPTIONS: Array<{
  label: string;
  value: OperatorDeploymentStatus | "";
}> = [
  { label: "All", value: "" },
  { label: "Live", value: "LIVE" },
  { label: "Deploying", value: "DEPLOYING" },
  { label: "Retrying", value: "RETRYING" },
  { label: "Failed", value: "FAILED" },
  { label: "Pending", value: "PENDING" },
];

const PAGE_SIZE = 25;

/**
 * Phase 9 — Operations / Deployments.
 *
 * Cross-tenant deployment list with permission-checked retry. The retry
 * call goes through the customer-facing `DeploymentsService` (so the
 * Vercel provider runs the exact same code path as the dashboard), but
 * is wrapped by the operator audit interceptor and requires a reason.
 */
export default function OperationsDeploymentsPage() {
  const [status, setStatus] = useState<OperatorDeploymentStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<OperatorOpsDeploymentListItem | null>(
    null,
  );
  const [modalError, setModalError] = useState<string | null>(null);

  const canRetry = useCan(OPERATOR_PERMISSIONS.DEPLOYMENT_RETRY_ALL);
  const queryClient = useQueryClient();

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(status ? { status } : {}),
      ...(search.trim().length >= 2 ? { q: search.trim() } : {}),
    }),
    [page, status, search],
  );

  const query = useQuery({
    queryKey: ["operator-ops-deployments", params],
    queryFn: () => listOperatorDeployments(params),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });

  const retryMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      retryOperatorDeployment(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-ops-deployments"] });
      setModal(null);
      setModalError(null);
    },
    onError: (err) => setModalError(extractErrorMessage(err)),
  });

  const rows = query.data?.data ?? [];

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Rocket className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Deployments</h1>
            <p className="text-xs text-slate-400">
              Cross-tenant build pipeline. Retries are audited and require a
              reason.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={query.data?.generatedAt ?? null} />
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={[
                "rounded-full border px-3 py-1 text-xs font-medium",
                status === opt.value
                  ? "border-cyan-500 bg-cyan-500/10 text-cyan-200"
                  : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800",
              ].join(" ")}
              onClick={() => {
                setStatus(opt.value);
                setPage(1);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="ml-auto relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Site, tenant, provider id…"
            className="w-80 rounded-md border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-left text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Site / tenant</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Provider</th>
              <th className="px-4 py-3 font-semibold">Error</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-900/60">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <Link
                      to={`/sites/${row.siteId}`}
                      className="text-sm font-medium text-slate-100 hover:text-cyan-300"
                    >
                      {row.siteName}
                    </Link>
                    <Link
                      to={`/tenants/${row.tenantId}`}
                      className="text-xs text-slate-500 hover:text-slate-300"
                    >
                      {row.tenantName}
                    </Link>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={row.status}
                    tone={deploymentStatusTone(row.status)}
                  />
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {row.providerProjectId ?? "—"}
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <span
                    className="text-xs text-rose-300 line-clamp-2"
                    title={row.errorMessage ?? undefined}
                  >
                    {row.errorMessage ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  <time title={row.updatedAt}>
                    {formatRelative(row.updatedAt)}
                  </time>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={!canRetry}
                    onClick={() => {
                      setModalError(null);
                      setModal(row);
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
        {!query.isLoading && rows.length === 0 ? (
          <EmptyState
            title="No deployments match the filters"
            description="Adjust filters or check back once a new build is triggered."
          />
        ) : null}
      </div>

      <Pagination
        page={query.data?.page ?? page}
        limit={query.data?.limit ?? PAGE_SIZE}
        total={query.data?.total ?? 0}
        onPageChange={setPage}
      />

      {modal ? (
        <ReasonModal
          open
          title={`Retry deployment for ${modal.siteName}`}
          description={`This will re-trigger the Vercel deploy pipeline for ${modal.siteName} (${modal.tenantName}). Status: ${modal.status}.`}
          confirmLabel="Retry deployment"
          minReasonLength={8}
          submitting={retryMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) =>
            retryMutation.mutateAsync({ id: modal.id, reason })
          }
        />
      ) : null}
    </div>
  );
}

// Helper used by detail view in TenantDetailPage timeline link
export function formatDeploymentTimestamp(value: string) {
  return formatDateTime(value);
}
