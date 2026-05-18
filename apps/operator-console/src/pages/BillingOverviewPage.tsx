import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CreditCard,
  Inbox,
  LayoutGrid,
  ListChecks,
  ServerCrash,
} from "lucide-react";
import { fetchBillingOverview } from "../api/operator";
import type { BillingOverviewResponse } from "../api/operator";
import { OPERATOR_PERMISSIONS, usePermissions } from "../permissions";
import { DataFreshness } from "../components/DataFreshness";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge } from "../components/StatusBadge";
import {
  BILLING_ACTION_STATUS_LABELS,
  BILLING_ACTION_TYPE_LABELS,
  billingActionStatusTone,
  formatDateTime,
} from "../lib/billing";

/**
 * Phase 8 billing command center. Surfaces the highest-priority signals
 * (tenants in past_due/canceled, mismatched local↔Stripe state, pending
 * approval queue depth, webhook backlog, and the most recent action
 * requests) plus deep links into the rest of the billing surface.
 */
export default function BillingOverviewPage() {
  const permissions = usePermissions();
  const canSeeApprovals = permissions.can(
    OPERATOR_PERMISSIONS.BILLING_ACTION_APPROVE_ALL,
  );
  const canSeeWebhooks = permissions.can(
    OPERATOR_PERMISSIONS.BILLING_STRIPE_REPLAY_ALL,
  );

  const query = useQuery({
    queryKey: ["operator-billing-overview"],
    queryFn: fetchBillingOverview,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const data = query.data;

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <CreditCard className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Billing</h1>
            <p className="text-xs text-slate-400">
              Subscription health, approval queue, and webhook ingest signals.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={new Date().toISOString()} />
      </header>

      {query.isError ? (
        <div className="mt-6 rounded-xl border border-rose-700 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">
          Failed to load billing overview. The backend may be unavailable or
          your session expired.
        </div>
      ) : null}

      <Scorecards data={data} loading={query.isLoading} />

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <QueueCard
          icon={<ListChecks className="h-4 w-4 text-amber-300" />}
          title="Pending approvals"
          value={data?.pendingApprovals}
          loading={query.isLoading}
          to="/billing/approvals"
          linkLabel="Review queue"
          disabledMessage={
            canSeeApprovals
              ? null
              : "Only Platform Owners can approve or reject billing actions."
          }
        />
        <QueueCard
          icon={<Inbox className="h-4 w-4 text-cyan-300" />}
          title="Unprocessed webhooks"
          value={data?.unprocessedWebhooks}
          loading={query.isLoading}
          to="/billing/webhooks?unprocessed=true"
          linkLabel="Open webhook log"
          disabledMessage={
            canSeeWebhooks
              ? null
              : "Requires billing.stripe.replay.all to access webhook ingest."
          }
        />
        <QueueCard
          icon={<ServerCrash className="h-4 w-4 text-rose-300" />}
          title="Failed webhooks"
          value={data?.failedWebhooks}
          loading={query.isLoading}
          to="/billing/webhooks?failed=true"
          linkLabel="Investigate failures"
          tone={data?.failedWebhooks ? "danger" : "muted"}
          disabledMessage={
            canSeeWebhooks
              ? null
              : "Requires billing.stripe.replay.all to access webhook ingest."
          }
        />
        <QueueCard
          icon={<AlertTriangle className="h-4 w-4 text-amber-300" />}
          title="Stripe ↔ local mismatch"
          value={data?.counts.mismatched}
          loading={query.isLoading}
          to="/billing/accounts?mismatch=true"
          linkLabel="View affected tenants"
          tone={data?.counts.mismatched ? "warn" : "muted"}
        />
      </section>

      <section className="mt-8">
        <RecentActionsCard
          data={data}
          loading={query.isLoading}
          canSeeApprovals={canSeeApprovals}
        />
      </section>
    </div>
  );
}

function Scorecards({
  data,
  loading,
}: {
  data: BillingOverviewResponse | undefined;
  loading: boolean;
}) {
  const cards = [
    { label: "Active", value: data?.counts.active, tone: "ok" as const },
    { label: "Trialing", value: data?.counts.trialing, tone: "info" as const },
    { label: "Past due", value: data?.counts.pastDue, tone: "warn" as const },
    {
      label: "Canceled",
      value: data?.counts.canceled,
      tone: "muted" as const,
    },
    {
      label: "Mismatch",
      value: data?.counts.mismatched,
      tone: data?.counts.mismatched ? ("danger" as const) : ("muted" as const),
    },
  ];

  return (
    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
        >
          <p className="text-[11px] uppercase tracking-widest text-slate-500">
            {card.label}
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-semibold text-white">
              {loading ? (
                <Skeleton className="inline-block h-6 w-12" />
              ) : (
                (card.value ?? 0).toLocaleString()
              )}
            </span>
            <StatusBadge status={card.label.toLowerCase()} tone={card.tone} />
          </div>
        </div>
      ))}
    </section>
  );
}

function QueueCard({
  icon,
  title,
  value,
  loading,
  to,
  linkLabel,
  tone,
  disabledMessage,
}: {
  icon: React.ReactNode;
  title: string;
  value: number | undefined;
  loading: boolean;
  to: string;
  linkLabel: string;
  tone?: "warn" | "danger" | "muted" | "ok" | "info";
  disabledMessage?: string | null;
}) {
  const disabled = Boolean(disabledMessage);
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          {icon}
          {title}
        </div>
        {tone ? <StatusBadge status={tone} tone={tone} /> : null}
      </header>
      <div className="mt-3 text-3xl font-semibold text-white">
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          (value ?? 0).toLocaleString()
        )}
      </div>
      <div className="mt-3">
        {disabled ? (
          <span
            title={disabledMessage ?? undefined}
            className="text-xs text-slate-500"
          >
            {linkLabel} →
          </span>
        ) : (
          <Link
            to={to}
            className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
          >
            {linkLabel} →
          </Link>
        )}
      </div>
    </article>
  );
}

function RecentActionsCard({
  data,
  loading,
  canSeeApprovals,
}: {
  data: BillingOverviewResponse | undefined;
  loading: boolean;
  canSeeApprovals: boolean;
}) {
  const rows = data?.recentActions ?? [];
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <LayoutGrid className="h-4 w-4 text-cyan-300" />
          Recent action requests
        </div>
        {canSeeApprovals ? (
          <Link
            to="/billing/approvals"
            className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
          >
            View approval queue →
          </Link>
        ) : null}
      </header>
      {loading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-6 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No recent activity"
          description="Operator-initiated billing actions will appear here."
        />
      ) : (
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="text-left text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-5 py-2 font-semibold">Action</th>
              <th className="px-5 py-2 font-semibold">Tenant</th>
              <th className="px-5 py-2 font-semibold">Status</th>
              <th className="px-5 py-2 font-semibold">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/40">
                <td className="px-5 py-2 text-slate-200">
                  {BILLING_ACTION_TYPE_LABELS[row.type] ?? row.type}
                </td>
                <td className="px-5 py-2">
                  <Link
                    to={`/billing/accounts/${row.tenantId}`}
                    className="text-cyan-300 hover:text-cyan-200"
                  >
                    {row.tenantId}
                  </Link>
                </td>
                <td className="px-5 py-2">
                  <StatusBadge
                    status={BILLING_ACTION_STATUS_LABELS[row.status]}
                    tone={billingActionStatusTone(row.status)}
                  />
                </td>
                <td className="px-5 py-2 text-[11px] text-slate-500">
                  {formatDateTime(
                    row.executedAt ?? row.approvedAt ?? row.createdAt,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}
