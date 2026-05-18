import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Globe2, RefreshCw, Search, ShieldCheck } from "lucide-react";
import {
  listOperatorDomains,
  retryOperatorDomainVerification,
  type OperatorOpsDomainStatus,
  type OperatorOpsDomainListItem,
} from "../api/operator";
import { Pagination } from "../components/Pagination";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { DataFreshness } from "../components/DataFreshness";
import { ReasonModal } from "../components/ReasonModal";
import { useCan } from "../permissions";
import { OPERATOR_PERMISSIONS } from "../permissions/registry";
import { extractErrorMessage } from "../lib/errors";
import { domainStatusTone, formatRelative } from "../lib/operations";

const STATUS_OPTIONS: Array<{
  label: string;
  value: OperatorOpsDomainStatus | "";
}> = [
  { label: "All", value: "" },
  { label: "Active", value: "ACTIVE" },
  { label: "Verifying", value: "VERIFYING" },
  { label: "SSL", value: "SSL_PROVISIONING" },
  { label: "Attach pending", value: "PROVIDER_ATTACH_PENDING" },
  { label: "DNS required", value: "DNS_REQUIRED" },
  { label: "Failed", value: "FAILED" },
  { label: "Pending", value: "PENDING" },
];

const PAGE_SIZE = 25;

/**
 * Phase 9 — Operations / Domains.
 *
 * Cross-tenant domain state with audited retry of the verification job.
 */
export default function OperationsDomainsPage() {
  const [status, setStatus] = useState<OperatorOpsDomainStatus | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<OperatorOpsDomainListItem | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const canRetry = useCan(OPERATOR_PERMISSIONS.DOMAIN_RETRY_VERIFICATION_ALL);
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
    queryKey: ["operator-ops-domains", params],
    queryFn: () => listOperatorDomains(params),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });

  const retryMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      retryOperatorDomainVerification(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-ops-domains"] });
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
          <Globe2 className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Domains</h1>
            <p className="text-xs text-slate-400">
              DNS, SSL, and provider attach status. Retries re-run verification
              against the live host.
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
            placeholder="Host, site, or tenant…"
            className="w-80 rounded-md border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-left text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Host</th>
              <th className="px-4 py-3 font-semibold">Site / tenant</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Last error</th>
              <th className="px-4 py-3 font-semibold">Verified</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-900/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-100">
                      {row.host}
                    </span>
                    {row.isPrimary ? (
                      <StatusBadge status="primary" tone="info" />
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <Link
                      to={`/sites/${row.siteId}`}
                      className="text-sm text-slate-100 hover:text-cyan-300"
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
                    tone={domainStatusTone(row.status)}
                  />
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <span
                    className="text-xs text-rose-300 line-clamp-2"
                    title={row.lastError ?? undefined}
                  >
                    {row.lastError ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {row.verifiedAt ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <ShieldCheck className="h-3 w-3" />
                      <time title={row.verifiedAt}>
                        {formatRelative(row.verifiedAt)}
                      </time>
                    </span>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={!canRetry || row.status === "ACTIVE"}
                    onClick={() => {
                      setModalError(null);
                      setModal(row);
                    }}
                    className="rounded-md border border-cyan-700 bg-cyan-900/30 px-2 py-1 text-[11px] text-cyan-100 hover:bg-cyan-900/60 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RefreshCw className="mr-1 inline h-3 w-3" />
                    Retry verify
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!query.isLoading && rows.length === 0 ? (
          <EmptyState
            title="No domains match the filters"
            description="Try clearing the status filter or searching by host."
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
          title={`Retry verification for ${modal.host}`}
          description={`This re-runs DNS verification and SSL provisioning for ${modal.host} on ${modal.siteName}. Current status: ${modal.status}.`}
          confirmLabel="Retry verification"
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
