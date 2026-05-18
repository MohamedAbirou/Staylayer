import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Inbox, Send } from "lucide-react";
import {
  listOperatorFormSubmissions,
  listOperatorFormDeliveries,
  replayOperatorFormDelivery,
  type OperatorOpsFormSubmissionStatus,
  type OperatorOpsFormDeliveryStatus,
  type OperatorOpsFormDeliveryListItem,
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
  deliveryStatusTone,
  submissionStatusTone,
  formatRelative,
} from "../lib/operations";

const SUBMISSION_STATUSES: Array<{
  label: string;
  value: OperatorOpsFormSubmissionStatus | "";
}> = [
  { label: "All", value: "" },
  { label: "Processed", value: "PROCESSED" },
  { label: "Pending", value: "PENDING" },
  { label: "Quarantined", value: "QUARANTINED" },
  { label: "Failed", value: "FAILED" },
  { label: "Rejected", value: "REJECTED" },
];

const DELIVERY_STATUSES: Array<{
  label: string;
  value: OperatorOpsFormDeliveryStatus | "";
}> = [
  { label: "All", value: "" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Pending", value: "PENDING" },
  { label: "Retrying", value: "RETRYING" },
  { label: "Failed", value: "FAILED" },
  { label: "Skipped", value: "SKIPPED" },
];

const PAGE_SIZE = 25;

type Tab = "submissions" | "deliveries";

/**
 * Phase 9 — Operations / Forms.
 *
 * Two-tab view over the form submission queue and the delivery channel
 * pipeline. Replay is audited and triggers the standard FormsService
 * delivery worker (no shortcut path).
 */
export default function OperationsFormsPage() {
  const [tab, setTab] = useState<Tab>("submissions");
  const [submissionStatus, setSubmissionStatus] = useState<
    OperatorOpsFormSubmissionStatus | ""
  >("");
  const [deliveryStatus, setDeliveryStatus] = useState<
    OperatorOpsFormDeliveryStatus | ""
  >("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<OperatorOpsFormDeliveryListItem | null>(
    null,
  );
  const [modalError, setModalError] = useState<string | null>(null);

  const canReplay = useCan(OPERATOR_PERMISSIONS.FORM_DELIVERY_REPLAY_ALL);
  const queryClient = useQueryClient();

  const subParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(submissionStatus ? { status: submissionStatus } : {}),
    }),
    [page, submissionStatus],
  );
  const delParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(deliveryStatus ? { status: deliveryStatus } : {}),
    }),
    [page, deliveryStatus],
  );

  const submissionsQuery = useQuery({
    queryKey: ["operator-ops-form-submissions", subParams],
    queryFn: () => listOperatorFormSubmissions(subParams),
    placeholderData: keepPreviousData,
    enabled: tab === "submissions",
    staleTime: 10_000,
  });

  const deliveriesQuery = useQuery({
    queryKey: ["operator-ops-form-deliveries", delParams],
    queryFn: () => listOperatorFormDeliveries(delParams),
    placeholderData: keepPreviousData,
    enabled: tab === "deliveries",
    staleTime: 10_000,
  });

  const replayMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      replayOperatorFormDelivery(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["operator-ops-form-deliveries"],
      });
      queryClient.invalidateQueries({
        queryKey: ["operator-ops-form-submissions"],
      });
      setModal(null);
      setModalError(null);
    },
    onError: (err) => setModalError(extractErrorMessage(err)),
  });

  const activeQuery =
    tab === "submissions" ? submissionsQuery : deliveriesQuery;

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Inbox className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">
              Form submissions
            </h1>
            <p className="text-xs text-slate-400">
              Tenant lead submissions and the email/webhook delivery pipeline.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={activeQuery.data?.generatedAt ?? null} />
      </header>

      <div className="mt-6 flex items-center gap-2 border-b border-slate-800">
        {(["submissions", "deliveries"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setPage(1);
            }}
            className={[
              "px-4 py-2 text-xs font-semibold uppercase tracking-widest",
              tab === t
                ? "border-b-2 border-cyan-500 text-cyan-200"
                : "text-slate-500 hover:text-slate-300",
            ].join(" ")}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1">
        {(tab === "submissions" ? SUBMISSION_STATUSES : DELIVERY_STATUSES).map(
          (opt) => {
            const active =
              tab === "submissions"
                ? submissionStatus === opt.value
                : deliveryStatus === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium",
                  active
                    ? "border-cyan-500 bg-cyan-500/10 text-cyan-200"
                    : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800",
                ].join(" ")}
                onClick={() => {
                  if (tab === "submissions") {
                    setSubmissionStatus(
                      opt.value as OperatorOpsFormSubmissionStatus | "",
                    );
                  } else {
                    setDeliveryStatus(
                      opt.value as OperatorOpsFormDeliveryStatus | "",
                    );
                  }
                  setPage(1);
                }}
              >
                {opt.label}
              </button>
            );
          },
        )}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        {tab === "submissions" ? (
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-left text-[10px] uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Form</th>
                <th className="px-4 py-3 font-semibold">Site / tenant</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Spam</th>
                <th className="px-4 py-3 font-semibold">Deliveries</th>
                <th className="px-4 py-3 font-semibold">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(submissionsQuery.data?.data ?? []).map((row) => (
                <tr key={row.id} className="hover:bg-slate-900/60">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-100">
                        {row.formName ?? row.formKey ?? row.formType}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-slate-500">
                        {row.formType}
                      </span>
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
                      tone={submissionStatusTone(row.status)}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {row.spamScore == null ? "—" : row.spamScore.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.deliveries.length === 0 ? (
                        <span className="text-xs text-slate-500">—</span>
                      ) : (
                        row.deliveries.map((d) => (
                          <StatusBadge
                            key={d.id}
                            status={`${d.channel}:${d.status}`}
                            tone={deliveryStatusTone(d.status)}
                          />
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    <time title={row.createdAt}>
                      {formatRelative(row.createdAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-left text-[10px] uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Channel</th>
                <th className="px-4 py-3 font-semibold">Destination</th>
                <th className="px-4 py-3 font-semibold">Site / tenant</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Attempts</th>
                <th className="px-4 py-3 font-semibold">Last attempt</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(deliveriesQuery.data?.data ?? []).map((row) => (
                <tr key={row.id} className="hover:bg-slate-900/60">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-100">
                        {row.channel}
                      </span>
                      <span className="text-[10px] uppercase tracking-widest text-slate-500">
                        {row.purpose}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <span
                      className="block truncate font-mono text-xs text-slate-300"
                      title={row.destination}
                    >
                      {row.destination}
                    </span>
                    {row.errorMessage ? (
                      <span
                        className="block truncate text-[10px] text-rose-300"
                        title={row.errorMessage}
                      >
                        {row.errorMessage}
                      </span>
                    ) : null}
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
                      tone={deliveryStatusTone(row.status)}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {row.attempts}
                    {row.responseCode ? (
                      <span className="ml-1 text-slate-500">
                        ({row.responseCode})
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    <time title={row.lastAttemptAt ?? row.updatedAt}>
                      {formatRelative(row.lastAttemptAt ?? row.updatedAt)}
                    </time>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={
                        !canReplay ||
                        row.status === "DELIVERED" ||
                        row.status === "SKIPPED"
                      }
                      onClick={() => {
                        setModalError(null);
                        setModal(row);
                      }}
                      className="rounded-md border border-cyan-700 bg-cyan-900/30 px-2 py-1 text-[11px] text-cyan-100 hover:bg-cyan-900/60 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Send className="mr-1 inline h-3 w-3" />
                      Replay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!activeQuery.isLoading &&
        (activeQuery.data?.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No records found"
            description="Try clearing filters or switching tabs."
          />
        ) : null}
      </div>

      <Pagination
        page={activeQuery.data?.page ?? page}
        limit={activeQuery.data?.limit ?? PAGE_SIZE}
        total={activeQuery.data?.total ?? 0}
        onPageChange={setPage}
      />

      {modal ? (
        <ReasonModal
          open
          title={`Replay ${modal.channel} delivery`}
          description={`Re-queue delivery to ${modal.destination} for submission ${modal.submissionId}. The delivery worker will attempt sending again.`}
          confirmLabel="Replay delivery"
          minReasonLength={8}
          submitting={replayMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) =>
            replayMutation.mutateAsync({ id: modal.id, reason })
          }
        />
      ) : null}
    </div>
  );
}
