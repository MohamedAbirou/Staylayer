import { useState, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { CheckCircle2, Gavel, XCircle } from "lucide-react";
import {
  approveBillingAction,
  fetchBillingActionRequests,
  rejectBillingAction,
  type BillingActionRequest,
  type BillingActionStatus,
  type FetchBillingActionRequestsParams,
} from "../api/operator";
import { OPERATOR_PERMISSIONS, usePermissions } from "../permissions";
import { useOperatorAuth } from "../auth/useOperatorAuth";
import { Pagination } from "../components/Pagination";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { DataFreshness } from "../components/DataFreshness";
import { StatusBadge } from "../components/StatusBadge";
import { ReasonModal } from "../components/ReasonModal";
import {
  BILLING_ACTION_STATUS_LABELS,
  BILLING_ACTION_TYPE_LABELS,
  billingActionStatusTone,
  formatDateTime,
} from "../lib/billing";
import { extractErrorMessage } from "../lib/errors";

const STATUS_FILTERS: Array<{
  label: string;
  value: BillingActionStatus | "";
}> = [
  { label: "Pending", value: "PENDING_APPROVAL" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Executed", value: "EXECUTED" },
  { label: "Failed", value: "FAILED" },
  { label: "Canceled", value: "CANCELED" },
  { label: "All", value: "" },
];

const PAGE_SIZE = 25;

/**
 * Phase 8 — Billing approval queue. Surfaces every BillingActionRequest
 * (filtered by status). Approve/Reject buttons are visible only to
 * operators with BILLING_ACTION_APPROVE_ALL (Platform Owner). The
 * requester cannot self-approve their own request: the UI disables the
 * action and the backend enforces it.
 */
export default function BillingActionRequestsPage() {
  const { session } = useOperatorAuth();
  const permissions = usePermissions();
  const canApprove = permissions.can(
    OPERATOR_PERMISSIONS.BILLING_ACTION_APPROVE_ALL,
  );

  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<BillingActionStatus | "">(
    (searchParams.get("status") as BillingActionStatus | null) ??
      "PENDING_APPROVAL",
  );
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<
    | null
    | { kind: "approve"; request: BillingActionRequest }
    | { kind: "reject"; request: BillingActionRequest }
  >(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const params: FetchBillingActionRequestsParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(status ? { status } : {}),
    }),
    [page, status],
  );

  const query = useQuery({
    queryKey: ["operator-billing-action-requests", params],
    queryFn: () => fetchBillingActionRequests(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["operator-billing-action-requests"],
    });
    queryClient.invalidateQueries({
      queryKey: ["operator-billing-overview"],
    });
  };

  const approveMutation = useMutation({
    mutationFn: (vars: { requestId: string; reason: string }) =>
      approveBillingAction(vars.requestId, { reason: vars.reason }),
    onSuccess: () => {
      invalidate();
      setModal(null);
      setModalError(null);
    },
    onError: (err) => setModalError(extractErrorMessage(err)),
  });

  const rejectMutation = useMutation({
    mutationFn: (vars: { requestId: string; reason: string }) =>
      rejectBillingAction(vars.requestId, { reason: vars.reason }),
    onSuccess: () => {
      invalidate();
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
          <Gavel className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">
              Billing approvals
            </h1>
            <p className="text-xs text-slate-400">
              Refunds, credits, and entitlement overrides queued for review.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={new Date().toISOString()} />
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-1">
        {STATUS_FILTERS.map((opt) => (
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
              const params = new URLSearchParams(searchParams);
              if (opt.value) params.set("status", opt.value);
              else params.delete("status");
              setSearchParams(params, { replace: true });
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-left text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Tenant</th>
              <th className="px-4 py-3 font-semibold">Requested by</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold">Submitted</th>
              <th className="px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {query.isLoading && rows.length === 0
              ? Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3" colSpan={7}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => {
                  const isOwn = row.actorUserId === session?.user.id;
                  const isPending = row.status === "PENDING_APPROVAL";
                  return (
                    <tr key={row.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-200">
                        {BILLING_ACTION_TYPE_LABELS[row.type] ?? row.type}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/billing/accounts/${row.tenantId}`}
                          className="font-mono text-[11px] text-cyan-300 hover:text-cyan-200"
                        >
                          {row.tenantId.slice(0, 14)}…
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                        {row.actorUserId.slice(0, 14)}…
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={BILLING_ACTION_STATUS_LABELS[row.status]}
                          tone={billingActionStatusTone(row.status)}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300 max-w-md truncate">
                        {row.reason}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500">
                        {formatDateTime(row.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canApprove && isPending ? (
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              disabled={isOwn}
                              title={
                                isOwn
                                  ? "You cannot approve your own request."
                                  : "Approve"
                              }
                              onClick={() =>
                                setModal({ kind: "approve", request: row })
                              }
                              className="rounded-md border border-emerald-700 bg-emerald-900/30 px-2 py-1 text-[11px] text-emerald-100 hover:bg-emerald-900/60 disabled:opacity-40"
                            >
                              <CheckCircle2 className="inline h-3 w-3 mr-1" />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setModal({ kind: "reject", request: row })
                              }
                              className="rounded-md border border-rose-700 bg-rose-900/30 px-2 py-1 text-[11px] text-rose-100 hover:bg-rose-900/60"
                            >
                              <XCircle className="inline h-3 w-3 mr-1" />
                              Reject
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!query.isLoading && rows.length === 0 ? (
          <EmptyState
            title="No action requests"
            description="Refunds, credits, and overrides will appear here once an operator submits one."
          />
        ) : null}
      </div>

      <Pagination
        page={query.data?.page ?? page}
        limit={query.data?.limit ?? PAGE_SIZE}
        total={query.data?.total ?? 0}
        onPageChange={setPage}
      />

      {modal?.kind === "approve" ? (
        <ReasonModal
          open
          title={`Approve: ${BILLING_ACTION_TYPE_LABELS[modal.request.type]}`}
          description="Approving this request will execute the action immediately."
          confirmLabel="Approve & execute"
          minReasonLength={8}
          submitting={approveMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) =>
            approveMutation.mutateAsync({
              requestId: modal.request.id,
              reason,
            })
          }
        />
      ) : null}

      {modal?.kind === "reject" ? (
        <ReasonModal
          open
          title={`Reject: ${BILLING_ACTION_TYPE_LABELS[modal.request.type]}`}
          description="The request will be marked rejected and not executed."
          confirmLabel="Reject request"
          confirmTone="danger"
          minReasonLength={8}
          submitting={rejectMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) =>
            rejectMutation.mutateAsync({
              requestId: modal.request.id,
              reason,
            })
          }
        />
      ) : null}
    </div>
  );
}
