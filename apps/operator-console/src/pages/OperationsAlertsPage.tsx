import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  listOperatorAlerts,
  resolveOperatorAlert,
  type OperatorOpsAlertSeverity,
  type OperatorOpsAlertStatus,
  type OperatorOpsAlertListItem,
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
  alertSeverityTone,
  alertStatusTone,
  formatRelative,
} from "../lib/operations";

const STATUS_OPTIONS: Array<{
  label: string;
  value: OperatorOpsAlertStatus | "";
}> = [
  { label: "All", value: "" },
  { label: "Open", value: "OPEN" },
  { label: "Acknowledged", value: "ACKNOWLEDGED" },
  { label: "Resolved", value: "RESOLVED" },
];

const SEVERITY_OPTIONS: Array<{
  label: string;
  value: OperatorOpsAlertSeverity | "";
}> = [
  { label: "All severities", value: "" },
  { label: "Critical", value: "CRITICAL" },
  { label: "Warning", value: "WARNING" },
  { label: "Info", value: "INFO" },
];

const PAGE_SIZE = 25;

/**
 * Phase 9 — Operations / Alerts.
 *
 * Read view of the cross-tenant operational alert log with audited
 * resolution. Acknowledge is not exposed yet — alerts are either open
 * (auto-generated) or closed by an operator with a documented reason.
 */
export default function OperationsAlertsPage() {
  const [status, setStatus] = useState<OperatorOpsAlertStatus | "">("OPEN");
  const [severity, setSeverity] = useState<OperatorOpsAlertSeverity | "">("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<OperatorOpsAlertListItem | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const canResolve = useCan(OPERATOR_PERMISSIONS.OPERATIONAL_ALERT_RESOLVE_ALL);
  const queryClient = useQueryClient();

  const params = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(status ? { status } : {}),
      ...(severity ? { severity } : {}),
      ...(type.trim().length >= 2 ? { type: type.trim() } : {}),
    }),
    [page, status, severity, type],
  );

  const query = useQuery({
    queryKey: ["operator-ops-alerts", params],
    queryFn: () => listOperatorAlerts(params),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      resolveOperatorAlert(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["operator-ops-alerts"] });
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
          <AlertTriangle className="h-5 w-5 text-amber-300" />
          <div>
            <h1 className="text-xl font-semibold text-white">
              Operational alerts
            </h1>
            <p className="text-xs text-slate-400">
              Cross-tenant alert log. Resolving an alert is audited and requires
              a reason.
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
        <select
          value={severity}
          onChange={(e) => {
            setSeverity(e.target.value as OperatorOpsAlertSeverity | "");
            setPage(1);
          }}
          className="rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
        >
          {SEVERITY_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by alert type…"
          className="ml-auto w-64 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        />
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-left text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Severity</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Site / tenant</th>
              <th className="px-4 py-3 font-semibold">Message</th>
              <th className="px-4 py-3 font-semibold">Last triggered</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-900/60">
                <td className="px-4 py-3 font-mono text-xs text-slate-200">
                  {row.type}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={row.severity}
                    tone={alertSeverityTone(row.severity)}
                  />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={row.status}
                    tone={alertStatusTone(row.status)}
                  />
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
                <td className="px-4 py-3 max-w-md">
                  <span
                    className="block truncate text-xs text-slate-300"
                    title={row.message}
                  >
                    {row.message}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  <time title={row.lastTriggeredAt}>
                    {formatRelative(row.lastTriggeredAt)}
                  </time>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={!canResolve || row.status === "RESOLVED"}
                    onClick={() => {
                      setModalError(null);
                      setModal(row);
                    }}
                    className="rounded-md border border-emerald-700 bg-emerald-900/30 px-2 py-1 text-[11px] text-emerald-100 hover:bg-emerald-900/60 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CheckCircle2 className="mr-1 inline h-3 w-3" />
                    Resolve
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!query.isLoading && rows.length === 0 ? (
          <EmptyState
            title="No alerts match the filters"
            description="Try changing the status filter or severity."
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
          title={`Resolve alert: ${modal.type}`}
          description={`Mark alert "${modal.message}" on ${modal.siteName} as resolved. This will not re-trigger automatically unless the underlying condition reoccurs.`}
          confirmLabel="Resolve alert"
          confirmTone="primary"
          minReasonLength={8}
          submitting={resolveMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) =>
            resolveMutation.mutateAsync({ id: modal.id, reason })
          }
        />
      ) : null}
    </div>
  );
}
