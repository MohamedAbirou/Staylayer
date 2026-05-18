import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Languages, RefreshCw, BookOpen } from "lucide-react";
import {
  listOperatorTranslationJobs,
  listOperatorGlossaries,
  retryOperatorTranslationJob,
  type OperatorOpsTranslationJobStatus,
  type OperatorOpsTranslationJobListItem,
} from "../api/operator";
import { Pagination } from "../components/Pagination";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { DataFreshness } from "../components/DataFreshness";
import { ReasonModal } from "../components/ReasonModal";
import { useCan } from "../permissions";
import { OPERATOR_PERMISSIONS } from "../permissions/registry";
import { extractErrorMessage } from "../lib/errors";
import { translationJobTone, formatRelative } from "../lib/operations";

const STATUS_OPTIONS: Array<{
  label: string;
  value: OperatorOpsTranslationJobStatus | "";
}> = [
  { label: "All", value: "" },
  { label: "Running", value: "RUNNING" },
  { label: "Pending", value: "PENDING" },
  { label: "Completed", value: "COMPLETED" },
  { label: "With errors", value: "COMPLETED_WITH_ERRORS" },
  { label: "Failed", value: "FAILED" },
  { label: "Canceled", value: "CANCELED" },
];

const PAGE_SIZE = 25;

type Tab = "jobs" | "glossaries";

/**
 * Phase 9 — Operations / Translations.
 *
 * DeepL job queue plus tenant glossaries. Retrying a job re-runs the
 * existing translation pipeline with the same input — useful for
 * intermittent DeepL outages or character-budget hiccups.
 */
export default function OperationsTranslationsPage() {
  const [tab, setTab] = useState<Tab>("jobs");
  const [status, setStatus] = useState<OperatorOpsTranslationJobStatus | "">(
    "",
  );
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<OperatorOpsTranslationJobListItem | null>(
    null,
  );
  const [modalError, setModalError] = useState<string | null>(null);

  const canRetry = useCan(OPERATOR_PERMISSIONS.TRANSLATION_JOB_RETRY_ALL);
  const canReadGlossaries = useCan(
    OPERATOR_PERMISSIONS.TRANSLATION_GLOSSARY_READ_ALL,
  );
  const queryClient = useQueryClient();

  const jobsParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(status ? { status } : {}),
    }),
    [page, status],
  );

  const jobsQuery = useQuery({
    queryKey: ["operator-ops-translation-jobs", jobsParams],
    queryFn: () => listOperatorTranslationJobs(jobsParams),
    placeholderData: keepPreviousData,
    enabled: tab === "jobs",
    staleTime: 10_000,
  });

  const glossariesQuery = useQuery({
    queryKey: ["operator-ops-translation-glossaries", page],
    queryFn: () => listOperatorGlossaries({ page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    enabled: tab === "glossaries" && canReadGlossaries,
    staleTime: 30_000,
  });

  const retryMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      retryOperatorTranslationJob(id, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["operator-ops-translation-jobs"],
      });
      setModal(null);
      setModalError(null);
    },
    onError: (err) => setModalError(extractErrorMessage(err)),
  });

  const activeQuery = tab === "jobs" ? jobsQuery : glossariesQuery;

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Languages className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Translations</h1>
            <p className="text-xs text-slate-400">
              DeepL job queue and tenant glossaries. Retries are audited and
              consume DeepL character budget on the owning tenant.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={activeQuery.data?.generatedAt ?? null} />
      </header>

      <div className="mt-6 flex items-center gap-2 border-b border-slate-800">
        {(["jobs", "glossaries"] as const).map((t) => {
          const disabled = t === "glossaries" && !canReadGlossaries;
          return (
            <button
              key={t}
              type="button"
              disabled={disabled}
              onClick={() => {
                setTab(t);
                setPage(1);
              }}
              className={[
                "px-4 py-2 text-xs font-semibold uppercase tracking-widest disabled:cursor-not-allowed disabled:opacity-40",
                tab === t
                  ? "border-b-2 border-cyan-500 text-cyan-200"
                  : "text-slate-500 hover:text-slate-300",
              ].join(" ")}
            >
              {t}
            </button>
          );
        })}
      </div>

      {tab === "jobs" ? (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-1">
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

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/80 text-left text-[10px] uppercase tracking-widest text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Site / tenant</th>
                  <th className="px-4 py-3 font-semibold">Locales</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Progress</th>
                  <th className="px-4 py-3 font-semibold">Characters</th>
                  <th className="px-4 py-3 font-semibold">Started</th>
                  <th className="px-4 py-3 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(jobsQuery.data?.data ?? []).map((row) => {
                  const total = Math.max(1, row.totalPages);
                  const completedPct = Math.round(
                    (row.completedPages / total) * 100,
                  );
                  return (
                    <tr key={row.id} className="hover:bg-slate-900/60">
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
                      <td className="px-4 py-3 text-xs text-slate-300">
                        <span className="font-mono">
                          {row.sourceLocale} → {row.targetLocale}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={row.status}
                          tone={translationJobTone(row.status)}
                        />
                        {row.error ? (
                          <div
                            className="mt-1 max-w-xs truncate text-[10px] text-rose-300"
                            title={row.error}
                          >
                            {row.error}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {row.completedPages}/{row.totalPages}
                        {row.failedPages > 0 ? (
                          <span className="ml-1 text-rose-300">
                            ({row.failedPages} failed)
                          </span>
                        ) : null}
                        <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full bg-cyan-500"
                            style={{ width: `${completedPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {row.charactersUsed.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        <time title={row.startedAt ?? row.createdAt}>
                          {formatRelative(row.startedAt ?? row.createdAt)}
                        </time>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={
                            !canRetry ||
                            row.status === "RUNNING" ||
                            row.status === "COMPLETED"
                          }
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
                  );
                })}
              </tbody>
            </table>
            {!jobsQuery.isLoading &&
            (jobsQuery.data?.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="No translation jobs"
                description="Jobs appear here once a tenant triggers translation."
              />
            ) : null}
          </div>
        </>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
          <table className="min-w-full divide-y divide-slate-800 text-sm">
            <thead className="bg-slate-900/80 text-left text-[10px] uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Glossary</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Scope</th>
                <th className="px-4 py-3 font-semibold">Terms</th>
                <th className="px-4 py-3 font-semibold">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(glossariesQuery.data?.data ?? []).map((row) => (
                <tr key={row.id} className="hover:bg-slate-900/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3 w-3 text-cyan-400" />
                      <span className="text-sm text-slate-100">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/tenants/${row.tenantId}`}
                      className="text-xs text-slate-300 hover:text-cyan-300"
                    >
                      {row.tenantName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {row.siteName ? (
                      <Link
                        to={`/sites/${row.siteId}`}
                        className="hover:text-cyan-300"
                      >
                        {row.siteName}
                      </Link>
                    ) : (
                      <span className="text-slate-500">Tenant-wide</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-300">
                    {row.termCount}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    <time title={row.updatedAt}>
                      {formatRelative(row.updatedAt)}
                    </time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!glossariesQuery.isLoading &&
          (glossariesQuery.data?.data?.length ?? 0) === 0 ? (
            <EmptyState
              title="No glossaries"
              description="Tenants will appear here once they create a glossary."
            />
          ) : null}
        </div>
      )}

      <Pagination
        page={activeQuery.data?.page ?? page}
        limit={activeQuery.data?.limit ?? PAGE_SIZE}
        total={activeQuery.data?.total ?? 0}
        onPageChange={setPage}
      />

      {modal ? (
        <ReasonModal
          open
          title={`Retry translation: ${modal.sourceLocale} → ${modal.targetLocale}`}
          description={`This will re-run the translation job for ${modal.siteName}. DeepL character usage will be billed to the tenant.`}
          confirmLabel="Retry job"
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
