import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { Inbox, RotateCcw, Search } from "lucide-react";
import {
  fetchBillingWebhooks,
  replayBillingWebhook,
  type FetchBillingWebhooksParams,
} from "../api/operator";
import { OPERATOR_PERMISSIONS, PermissionButton } from "../permissions";
import { Pagination } from "../components/Pagination";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { DataFreshness } from "../components/DataFreshness";
import { StatusBadge } from "../components/StatusBadge";
import { ReasonModal } from "../components/ReasonModal";
import { formatDateTime } from "../lib/billing";
import { extractErrorMessage } from "../lib/errors";

const PAGE_SIZE = 25;

/**
 * Phase 8 — Stripe webhook ingest log. Operators with
 * BILLING_STRIPE_REPLAY_ALL can replay a webhook event row (re-runs the
 * idempotent handler against the stored raw payload).
 */
export default function BillingWebhooksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tenantId, setTenantId] = useState(searchParams.get("tenantId") ?? "");
  const [eventType, setEventType] = useState(
    searchParams.get("eventType") ?? "",
  );
  const [failed, setFailed] = useState(searchParams.get("failed") === "true");
  const [unprocessed, setUnprocessed] = useState(
    searchParams.get("unprocessed") === "true",
  );
  const [page, setPage] = useState(1);

  const [replayTarget, setReplayTarget] = useState<{
    id: string;
    eventType: string;
  } | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);

  const params: FetchBillingWebhooksParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(tenantId.trim() ? { tenantId: tenantId.trim() } : {}),
      ...(eventType.trim() ? { eventType: eventType.trim() } : {}),
      ...(failed ? { failed: true } : {}),
      ...(unprocessed ? { unprocessed: true } : {}),
    }),
    [page, tenantId, eventType, failed, unprocessed],
  );

  const query = useQuery({
    queryKey: ["operator-billing-webhooks", params],
    queryFn: () => fetchBillingWebhooks(params),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const queryClient = useQueryClient();
  const replayMutation = useMutation({
    mutationFn: (vars: { id: string; reason: string }) =>
      replayBillingWebhook(vars.id, { reason: vars.reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["operator-billing-webhooks"],
      });
      setReplayTarget(null);
      setReplayError(null);
    },
    onError: (err) => setReplayError(extractErrorMessage(err)),
  });

  const rows = query.data?.data ?? [];

  const updateUrl = (next: {
    tenantId: string;
    eventType: string;
    failed: boolean;
    unprocessed: boolean;
  }) => {
    const params = new URLSearchParams();
    if (next.tenantId.trim()) params.set("tenantId", next.tenantId.trim());
    if (next.eventType.trim()) params.set("eventType", next.eventType.trim());
    if (next.failed) params.set("failed", "true");
    if (next.unprocessed) params.set("unprocessed", "true");
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Inbox className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">
              Stripe webhook log
            </h1>
            <p className="text-xs text-slate-400">
              Every Stripe event received by the API, with replay for failed or
              unprocessed entries.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={new Date().toISOString()} />
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={tenantId}
            onChange={(e) => {
              setTenantId(e.target.value);
              setPage(1);
              updateUrl({
                tenantId: e.target.value,
                eventType,
                failed,
                unprocessed,
              });
            }}
            placeholder="Tenant ID…"
            className="w-64 rounded-md border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm text-slate-100"
          />
        </div>
        <input
          type="search"
          value={eventType}
          onChange={(e) => {
            setEventType(e.target.value);
            setPage(1);
            updateUrl({
              tenantId,
              eventType: e.target.value,
              failed,
              unprocessed,
            });
          }}
          placeholder="Event type (e.g. invoice.paid)…"
          className="w-72 rounded-md border border-slate-800 bg-slate-900 py-2 px-3 text-sm text-slate-100"
        />
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={failed}
            onChange={(e) => {
              setFailed(e.target.checked);
              setPage(1);
              updateUrl({
                tenantId,
                eventType,
                failed: e.target.checked,
                unprocessed,
              });
            }}
            className="accent-cyan-500"
          />
          Failed only
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={unprocessed}
            onChange={(e) => {
              setUnprocessed(e.target.checked);
              setPage(1);
              updateUrl({
                tenantId,
                eventType,
                failed,
                unprocessed: e.target.checked,
              });
            }}
            className="accent-cyan-500"
          />
          Unprocessed only
        </label>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/80 text-left text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Event</th>
              <th className="px-4 py-3 font-semibold">Tenant</th>
              <th className="px-4 py-3 font-semibold">Received</th>
              <th className="px-4 py-3 font-semibold">Processed</th>
              <th className="px-4 py-3 font-semibold">Outcome</th>
              <th className="px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {query.isLoading && rows.length === 0
              ? Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3" colSpan={6}>
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              : rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-mono text-[11px] text-slate-100">
                        {row.eventType}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {row.providerEventId}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.tenantId ? (
                        <Link
                          to={`/billing/accounts/${row.tenantId}`}
                          className="font-mono text-[11px] text-cyan-300 hover:text-cyan-200"
                        >
                          {row.tenantId.slice(0, 14)}…
                        </Link>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400">
                      {formatDateTime(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400">
                      {formatDateTime(row.processedAt)}
                    </td>
                    <td className="px-4 py-3">
                      {row.errorMessage ? (
                        <StatusBadge status="failed" tone="danger" />
                      ) : row.processedAt ? (
                        <StatusBadge status="processed" tone="ok" />
                      ) : (
                        <StatusBadge status="unprocessed" tone="warn" />
                      )}
                      {row.errorMessage ? (
                        <p
                          className="mt-1 max-w-sm truncate text-[10px] text-rose-300"
                          title={row.errorMessage}
                        >
                          {row.errorMessage}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <PermissionButton
                        permission={
                          OPERATOR_PERMISSIONS.BILLING_STRIPE_REPLAY_ALL
                        }
                        onClick={() =>
                          setReplayTarget({
                            id: row.id,
                            eventType: row.eventType,
                          })
                        }
                        className="rounded-md border border-slate-700 bg-slate-800/40 px-2 py-1 text-[11px] text-slate-100 hover:bg-slate-800 disabled:opacity-40"
                      >
                        <RotateCcw className="inline h-3 w-3 mr-1" />
                        Replay
                      </PermissionButton>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!query.isLoading && rows.length === 0 ? (
          <EmptyState
            title="No webhook events"
            description="Stripe webhook events for this filter will appear here."
          />
        ) : null}
      </div>

      <Pagination
        page={query.data?.page ?? page}
        limit={query.data?.limit ?? PAGE_SIZE}
        total={query.data?.total ?? 0}
        onPageChange={setPage}
      />

      {replayTarget ? (
        <ReasonModal
          open
          title={`Replay webhook: ${replayTarget.eventType}`}
          description="Re-runs the idempotent webhook handler against the stored raw Stripe payload."
          confirmLabel="Replay"
          minReasonLength={8}
          submitting={replayMutation.isPending}
          error={replayError}
          onCancel={() => {
            setReplayTarget(null);
            setReplayError(null);
          }}
          onConfirm={(reason) =>
            replayMutation.mutateAsync({
              id: replayTarget.id,
              reason,
            })
          }
        />
      ) : null}
    </div>
  );
}
