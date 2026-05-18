import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ActivitySquare,
  AlertOctagon,
  AlertTriangle,
  Building2,
  CreditCard,
  Globe,
  Inbox,
  LayoutGrid,
  ListChecks,
  Server,
} from "lucide-react";
import { fetchOverview } from "../api/operator";
import type { OperatorOverviewResponse } from "../api/operator";
import { OPERATOR_PERMISSIONS, usePermissions } from "../permissions";
import { DataFreshness } from "../components/DataFreshness";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import {
  StatusBadge,
  billingStatusTone,
  deploymentStatusTone,
  domainStatusTone,
} from "../components/StatusBadge";

// Picks the appropriate `/operator/overview*` endpoint based on the held
// permissions so each role hits a route they can authorise against. We
// prefer the widest read the operator owns to mirror the original Phase 2
// command-center semantics.
function pickOverviewVariant(
  permissions: ReturnType<typeof usePermissions>,
): "all" | "support" | "billing" | null {
  if (permissions.can(OPERATOR_PERMISSIONS.OVERVIEW_READ_ALL)) return "all";
  if (permissions.can(OPERATOR_PERMISSIONS.OVERVIEW_READ_SUPPORT))
    return "support";
  if (permissions.can(OPERATOR_PERMISSIONS.OVERVIEW_READ_BILLING))
    return "billing";
  return null;
}

export default function CommandCenterPage() {
  const permissions = usePermissions();
  const variant = pickOverviewVariant(permissions);

  const query = useQuery({
    queryKey: ["operator-overview", variant],
    queryFn: () => fetchOverview({ variant: variant ?? undefined }),
    enabled: variant !== null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (variant === null) {
    return (
      <div className="px-8 py-8">
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="No overview access"
          description="Your operator role does not include any overview.read.* permission. Ask a Platform Owner if you believe this is wrong."
        />
      </div>
    );
  }

  const data = query.data;

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <ActivitySquare className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">Command Center</h1>
            <p className="text-xs text-slate-400">
              Live platform health, queues, and audit feed.
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={data?.generatedAt} />
      </header>

      {query.isError ? (
        <div className="mt-6 rounded-xl border border-rose-700 bg-rose-950/50 px-4 py-3 text-sm text-rose-200">
          Failed to load command-center overview. The API may be unavailable or
          your operator session may have expired.
        </div>
      ) : null}

      <Scorecards data={data} loading={query.isLoading} />

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        <TenantHealthCard data={data} loading={query.isLoading} />
        <PlanMixCard data={data} loading={query.isLoading} />
        <RecentAuditCard data={data} loading={query.isLoading} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <BillingAttentionCard data={data} loading={query.isLoading} />
        <DeploymentFailuresCard data={data} loading={query.isLoading} />
        <DomainIssuesCard data={data} loading={query.isLoading} />
        <FormAlertsCard data={data} loading={query.isLoading} />
      </section>
    </div>
  );
}

// ─── Scorecards ────────────────────────────────────────────────────────

function Scorecards({
  data,
  loading,
}: {
  data: OperatorOverviewResponse | undefined;
  loading: boolean;
}) {
  const cards = useMemo(
    () => [
      {
        label: "Tenants",
        icon: Building2,
        primary: data?.scorecards.tenants.total,
        helper: data
          ? `${data.scorecards.tenants.active} active · ${data.scorecards.tenants.suspended} suspended`
          : null,
      },
      {
        label: "Live sites",
        icon: Server,
        primary: data?.scorecards.deployments.liveSites,
        helper: data
          ? `${data.scorecards.deployments.liveRate}% live · ${data.scorecards.deployments.failedSites} failed`
          : null,
      },
      {
        label: "Domains",
        icon: Globe,
        primary: data?.scorecards.domains.activeDomains,
        helper: data
          ? `${data.scorecards.domains.failedDomains} failed · ${data.scorecards.domains.sslProvisioningDomains} SSL`
          : null,
      },
      {
        label: "Billing",
        icon: CreditCard,
        primary: data?.scorecards.billing.active,
        helper: data
          ? `${data.scorecards.billing.trialing} trial · ${data.scorecards.billing.pastDue} past-due`
          : null,
      },
      {
        label: "Open alerts",
        icon: AlertOctagon,
        primary: data?.scorecards.operations.openAlerts,
        helper: data
          ? `${data.scorecards.operations.criticalAlerts} critical · ${data.scorecards.operations.failedDeliveriesLast30Days} delivery fails (30d)`
          : null,
      },
    ],
    [data],
  );
  return (
    <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              <Icon className="h-3.5 w-3.5" />
              {card.label}
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">
              {loading ? (
                <Skeleton className="h-7 w-16" />
              ) : (
                (card.primary ?? "—")
              )}
            </p>
            <p className="mt-1 min-h-4 text-xs text-slate-500">
              {loading ? (
                <Skeleton className="h-3 w-32" />
              ) : (
                (card.helper ?? "No data yet")
              )}
            </p>
          </div>
        );
      })}
    </section>
  );
}

function TenantHealthCard({
  data,
  loading,
}: {
  data: OperatorOverviewResponse | undefined;
  loading: boolean;
}) {
  return (
    <Card
      title="Tenant health"
      icon={<LayoutGrid className="h-4 w-4 text-cyan-400" />}
      action={
        <Link to="/tenants" className="text-xs text-cyan-400 hover:underline">
          View all
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : !data || data.tenantHealth.length === 0 ? (
        <EmptyState
          title="No tenants"
          description="No tenants currently tracked."
        />
      ) : (
        <ul className="divide-y divide-slate-800">
          {data.tenantHealth.map((row) => (
            <li key={row.tenantId} className="flex items-center gap-3 py-2">
              <span
                className={[
                  "inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold",
                  row.healthScore >= 80
                    ? "bg-emerald-500/10 text-emerald-300"
                    : row.healthScore >= 50
                      ? "bg-amber-500/10 text-amber-300"
                      : "bg-rose-500/10 text-rose-300",
                ].join(" ")}
                title={`Health score ${row.healthScore}`}
              >
                {row.healthScore}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/tenants/${row.tenantId}`}
                  className="block truncate text-sm font-medium text-slate-100 hover:text-white"
                >
                  {row.tenantName}
                </Link>
                <p className="truncate text-[11px] text-slate-500">
                  {row.planName} · {row.siteCount} sites · {row.openAlerts}{" "}
                  alerts
                </p>
              </div>
              <StatusBadge
                status={row.billingStatus}
                tone={billingStatusTone(row.billingStatus)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function PlanMixCard({
  data,
  loading,
}: {
  data: OperatorOverviewResponse | undefined;
  loading: boolean;
}) {
  return (
    <Card
      title="Plan mix"
      icon={<CreditCard className="h-4 w-4 text-cyan-400" />}
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : !data || data.planMix.length === 0 ? (
        <EmptyState title="No subscriptions" />
      ) : (
        <ul className="divide-y divide-slate-800">
          {data.planMix.map((row) => (
            <li
              key={row.planKey}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="font-medium text-slate-200">{row.planName}</span>
              <span className="text-slate-400">
                {row.tenantCount}{" "}
                <span className="text-[10px] uppercase tracking-widest text-slate-500">
                  · {row.activeCount} active · {row.attentionCount} attn
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentAuditCard({
  data,
  loading,
}: {
  data: OperatorOverviewResponse | undefined;
  loading: boolean;
}) {
  return (
    <Card
      title="Recent audit"
      icon={<ListChecks className="h-4 w-4 text-cyan-400" />}
      action={
        <Link to="/audit" className="text-xs text-cyan-400 hover:underline">
          Open audit log
        </Link>
      }
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ) : !data || data.queues.recentAudit.length === 0 ? (
        <EmptyState title="No recent activity" />
      ) : (
        <ul className="divide-y divide-slate-800">
          {data.queues.recentAudit.slice(0, 6).map((row) => (
            <li key={row.id} className="py-2 text-xs">
              <p className="font-mono text-[11px] text-slate-300">
                {row.action}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {row.actorEmail} · {new Date(row.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function BillingAttentionCard({
  data,
  loading,
}: {
  data: OperatorOverviewResponse | undefined;
  loading: boolean;
}) {
  return (
    <Card
      title="Billing attention"
      icon={<CreditCard className="h-4 w-4 text-amber-400" />}
    >
      <QueueList
        loading={loading}
        rows={data?.queues.billingAttention ?? []}
        emptyTitle="No billing escalations"
        renderRow={(row) => (
          <>
            <div className="min-w-0">
              <Link
                to={`/tenants/${row.tenantId}`}
                className="block truncate text-sm font-medium text-slate-100 hover:text-white"
              >
                {row.tenantName}
              </Link>
              <p className="truncate text-[11px] text-slate-500">
                {row.reason}
              </p>
            </div>
            <StatusBadge
              status={row.billingStatus}
              tone={billingStatusTone(row.billingStatus)}
            />
          </>
        )}
        rowKey={(row) => `${row.tenantId}-${row.reason}`}
      />
    </Card>
  );
}

function DeploymentFailuresCard({
  data,
  loading,
}: {
  data: OperatorOverviewResponse | undefined;
  loading: boolean;
}) {
  return (
    <Card
      title="Deployment failures"
      icon={<Server className="h-4 w-4 text-rose-400" />}
    >
      <QueueList
        loading={loading}
        rows={data?.queues.deploymentFailures ?? []}
        emptyTitle="No failed deployments"
        renderRow={(row) => (
          <>
            <div className="min-w-0">
              <Link
                to={`/sites/${row.siteId}`}
                className="block truncate text-sm font-medium text-slate-100 hover:text-white"
              >
                {row.siteName}
              </Link>
              <p className="truncate text-[11px] text-slate-500">
                {row.tenantName} ·{" "}
                {row.errorMessage ?? "No error message captured"}
              </p>
            </div>
            <StatusBadge
              status={row.status}
              tone={deploymentStatusTone(row.status)}
            />
          </>
        )}
        rowKey={(row) => row.deploymentId}
      />
    </Card>
  );
}

function DomainIssuesCard({
  data,
  loading,
}: {
  data: OperatorOverviewResponse | undefined;
  loading: boolean;
}) {
  return (
    <Card
      title="Domain issues"
      icon={<Globe className="h-4 w-4 text-amber-400" />}
    >
      <QueueList
        loading={loading}
        rows={data?.queues.domainIssues ?? []}
        emptyTitle="No domain issues"
        renderRow={(row) => (
          <>
            <div className="min-w-0">
              <Link
                to={`/sites/${row.siteId}`}
                className="block truncate text-sm font-medium text-slate-100 hover:text-white"
              >
                {row.hostname}
              </Link>
              <p className="truncate text-[11px] text-slate-500">
                {row.tenantName} · {row.siteName}
                {row.lastError ? ` · ${row.lastError}` : ""}
              </p>
            </div>
            <StatusBadge
              status={row.status}
              tone={domainStatusTone(row.status)}
            />
          </>
        )}
        rowKey={(row) => row.domainId}
      />
    </Card>
  );
}

function FormAlertsCard({
  data,
  loading,
}: {
  data: OperatorOverviewResponse | undefined;
  loading: boolean;
}) {
  return (
    <Card
      title="Form delivery alerts"
      icon={<Inbox className="h-4 w-4 text-rose-400" />}
    >
      <QueueList
        loading={loading}
        rows={data?.queues.formAlerts ?? []}
        emptyTitle="No form alerts"
        renderRow={(row) => (
          <>
            <div className="min-w-0">
              <Link
                to={`/sites/${row.siteId}`}
                className="block truncate text-sm font-medium text-slate-100 hover:text-white"
              >
                {row.siteName}
              </Link>
              <p className="truncate text-[11px] text-slate-500">
                {row.tenantName} ·{" "}
                {row.messages[0] ?? row.alertTypes.join(", ")}
              </p>
            </div>
            <StatusBadge
              status={row.critical ? "CRITICAL" : "WARNING"}
              tone={row.critical ? "danger" : "warn"}
            />
          </>
        )}
        rowKey={(row) => `${row.tenantId}-${row.siteId}`}
      />
    </Card>
  );
}

function Card({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-semibold text-white">{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}

function QueueList<T>({
  loading,
  rows,
  renderRow,
  rowKey,
  emptyTitle,
}: {
  loading: boolean;
  rows: T[];
  renderRow: (row: T) => React.ReactNode;
  rowKey: (row: T) => string;
  emptyTitle: string;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} />;
  }
  return (
    <ul className="divide-y divide-slate-800">
      {rows.map((row) => (
        <li
          key={rowKey(row)}
          className="flex items-center justify-between gap-4 py-2"
        >
          {renderRow(row)}
        </li>
      ))}
    </ul>
  );
}
