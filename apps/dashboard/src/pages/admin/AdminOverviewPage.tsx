import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CreditCard,
  Globe,
  Loader2,
  RefreshCw,
  Rocket,
  Siren,
} from "lucide-react";
import { Link } from "react-router-dom";
import { getAdminOverview, type AdminOverview } from "../../api/admin";
import { formatDate, formatRelativeTime } from "../../lib/formatDate";

export default function AdminOverviewPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => getAdminOverview(),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-gray-200 bg-white text-sm text-gray-500 shadow-sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading operator overview…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
        <div className="flex items-start gap-3 text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h1 className="text-xl font-bold">Operator overview unavailable</h1>
            <p className="mt-2 text-sm">
              The admin overview API could not be loaded. Refresh the snapshot
              before making an operations decision.
            </p>
          </div>
        </div>
        <button
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
      </div>
    );
  }

  const billingAttentionCount = data.queues.billingAttention.length;
  const deploymentFailuresCount = data.queues.deploymentFailures.length;
  const domainIssuesCount = data.queues.domainIssues.length;
  const formAlertsCount = data.queues.formAlerts.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Operator Overview
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Live platform health, commercial risk, and operator queues across
            all tenant workspaces.
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-400">
            Snapshot generated {formatDate(data.generatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/audit"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Review audit log
          </Link>
          <button
            onClick={() => void refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-5">
        <StatCard
          title="Tenants"
          value={data.scorecards.tenants.total}
          subtitle={`${data.scorecards.tenants.newLast30Days} new in the last 30 days`}
          detail={`${data.scorecards.tenants.active} active, ${data.scorecards.tenants.suspended} suspended`}
          icon={Building2}
          to="/admin/tenants"
        />
        <StatCard
          title="Billing Risk"
          value={
            data.scorecards.billing.pastDue +
            data.scorecards.billing.canceled +
            data.scorecards.billing.inactive
          }
          subtitle={`${data.scorecards.billing.active} active subscriptions in good standing`}
          detail={`${data.scorecards.billing.trialing} trials, ${billingAttentionCount} in the attention queue`}
          icon={CreditCard}
          to="/admin/subscriptions"
        />
        <StatCard
          title="Deployments"
          value={`${data.scorecards.deployments.liveRate}%`}
          subtitle={`${data.scorecards.deployments.liveSites} sites live right now`}
          detail={`${deploymentFailuresCount} failed, ${data.scorecards.deployments.buildingSites} building, ${data.scorecards.deployments.unprovisionedSites} not provisioned`}
          icon={Rocket}
          to="/admin/deployments"
        />
        <StatCard
          title="Domains"
          value={data.scorecards.domains.activeDomains}
          subtitle={`${data.scorecards.domains.sitesMissingPrimaryDomain} sites missing a verified primary domain`}
          detail={`${domainIssuesCount} domains need operator attention`}
          icon={Globe}
          to="/admin/domains"
        />
        <StatCard
          title="Operations"
          value={data.scorecards.operations.openAlerts}
          subtitle={`${data.scorecards.operations.criticalAlerts} critical alerts open`}
          detail={`${data.scorecards.operations.submissionsLast30Days} submissions and ${data.scorecards.operations.failedDeliveriesLast30Days} failed deliveries in 30 days`}
          icon={Siren}
          to="/admin/forms"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                Plan Mix
              </p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">
                Commercial footprint by current plan
              </h2>
            </div>
            <BarChart3 className="h-5 w-5 text-gray-300" />
          </div>
          <div className="mt-6 space-y-4">
            {data.planMix.length === 0 ? (
              <EmptyState message="No tenant commercial data is available yet." />
            ) : (
              data.planMix.map((item) => (
                <PlanMixRow
                  key={item.planKey}
                  item={item}
                  totalTenants={data.scorecards.tenants.total}
                />
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                Tenant Health
              </p>
              <h2 className="mt-1 text-lg font-semibold text-gray-900">
                Lowest-scoring workspaces
              </h2>
            </div>
            <Link
              to="/admin/tenants"
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Open tenant list
            </Link>
          </div>
          <div className="mt-6 space-y-4">
            {data.tenantHealth.length === 0 ? (
              <EmptyState message="No tenant health signals are available yet." />
            ) : (
              data.tenantHealth.map((tenant) => (
                <HealthRow key={tenant.tenantId} tenant={tenant} />
              ))
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        <QueueCard
          title="Billing Attention"
          count={billingAttentionCount}
          to="/admin/subscriptions"
        >
          {data.queues.billingAttention.length === 0 ? (
            <EmptyState message="No billing interventions are queued right now." />
          ) : (
            data.queues.billingAttention.map((item) => (
              <QueueRow
                key={`${item.tenantId}-${item.billingStatus}`}
                title={item.tenantName}
                subtitle={`${item.planName} • ${formatBillingStatus(item.billingStatus)}`}
                detail={item.reason}
                meta={
                  item.renewsAt ? `Renews ${formatDate(item.renewsAt)}` : null
                }
                tone={billingTone(item.billingStatus)}
              />
            ))
          )}
        </QueueCard>

        <QueueCard
          title="Deployment Failures"
          count={deploymentFailuresCount}
          to="/admin/deployments"
        >
          {data.queues.deploymentFailures.length === 0 ? (
            <EmptyState message="No failed latest deployments are open." />
          ) : (
            data.queues.deploymentFailures.map((item) => (
              <QueueRow
                key={item.deploymentId}
                title={`${item.siteName} • ${item.tenantName}`}
                subtitle={formatDeploymentStatus(item.status)}
                detail={
                  item.errorMessage ??
                  "Deployment failed without an explicit provider message."
                }
                meta={formatRelativeTime(item.updatedAt)}
                tone="danger"
              />
            ))
          )}
        </QueueCard>

        <QueueCard
          title="Domain Issues"
          count={domainIssuesCount}
          to="/admin/domains"
        >
          {data.queues.domainIssues.length === 0 ? (
            <EmptyState message="All tracked domains are healthy." />
          ) : (
            data.queues.domainIssues.map((item) => (
              <QueueRow
                key={item.domainId}
                title={`${item.hostname} • ${item.siteName}`}
                subtitle={`${item.tenantName} • ${formatDomainStatus(item.status)}`}
                detail={
                  item.lastError ??
                  "Domain still needs verification or SSL completion."
                }
                meta={
                  item.lastCheckedAt
                    ? formatDate(item.lastCheckedAt)
                    : "Awaiting first verification pass"
                }
                tone={domainTone(item.status)}
              />
            ))
          )}
        </QueueCard>

        <QueueCard
          title="Form Alerts"
          count={formAlertsCount}
          to="/admin/forms"
        >
          {data.queues.formAlerts.length === 0 ? (
            <EmptyState message="No inquiry delivery or spike alerts are open." />
          ) : (
            data.queues.formAlerts.map((item) => (
              <QueueRow
                key={`${item.siteId}-${item.alertTypes.join("-")}`}
                title={`${item.siteName} • ${item.tenantName}`}
                subtitle={item.alertTypes.map(formatAlertType).join(" • ")}
                detail={item.messages.join(" ")}
                meta={
                  item.lastTriggeredAt ? formatDate(item.lastTriggeredAt) : null
                }
                tone={item.critical ? "danger" : "warning"}
              />
            ))
          )}
        </QueueCard>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
              Recent Audit
            </p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">
              Latest operator actions
            </h2>
          </div>
          <Link
            to="/admin/audit"
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Open full log
          </Link>
        </div>
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-100">
          {data.queues.recentAudit.length === 0 ? (
            <div className="p-6">
              <EmptyState message="No operator audit events have been recorded yet." />
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    When
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Action
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Target
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {data.queues.recentAudit.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {entry.actorEmail}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {entry.action}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {entry.targetType && entry.targetId
                        ? `${entry.targetType} / ${entry.targetId}`
                        : (entry.targetType ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  detail,
  icon: Icon,
  to,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  detail: string;
  icon: typeof Building2;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/40"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            {title}
          </p>
          <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className="rounded-xl bg-slate-100 p-3 text-slate-600">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-600">{subtitle}</p>
      <p className="mt-2 text-xs text-gray-400">{detail}</p>
    </Link>
  );
}

function PlanMixRow({
  item,
  totalTenants,
}: {
  item: AdminOverview["planMix"][number];
  totalTenants: number;
}) {
  const width = totalTenants ? (item.tenantCount / totalTenants) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{item.planName}</p>
          <p className="text-xs text-gray-500">
            {item.activeCount} active, {item.trialCount} trialing,{" "}
            {item.attentionCount} flagged
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {item.tenantCount} tenants
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-slate-900"
          style={{ width: `${Math.max(width, item.tenantCount > 0 ? 8 : 0)}%` }}
        />
      </div>
    </div>
  );
}

function HealthRow({
  tenant,
}: {
  tenant: AdminOverview["tenantHealth"][number];
}) {
  const tone =
    tenant.healthScore <= 45
      ? "bg-red-100 text-red-700"
      : tenant.healthScore <= 70
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-700";

  return (
    <div className="rounded-xl border border-gray-100 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">
              {tenant.tenantName}
            </p>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}
            >
              Health {tenant.healthScore}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {tenant.planName}
            </span>
            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
              {formatBillingStatus(tenant.billingStatus)}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {tenant.siteCount} sites, {tenant.liveSites} live,{" "}
            {tenant.failedSites} failed, {tenant.sitesMissingPrimaryDomain}{" "}
            missing production domains, {tenant.openAlerts} open alerts
          </p>
          {tenant.reasons.length > 0 ? (
            <p className="mt-2 text-sm text-gray-600">
              {tenant.reasons.join(" • ")}
            </p>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              No high-risk signals are open.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function QueueCard({
  title,
  count,
  to,
  children,
}: {
  title: string;
  count: number;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            Queue
          </p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {count}
          </span>
          <Link
            to={to}
            className="text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            Open
          </Link>
        </div>
      </div>
      <div className="mt-6 space-y-3">{children}</div>
    </section>
  );
}

function QueueRow({
  title,
  subtitle,
  detail,
  meta,
  tone,
}: {
  title: string;
  subtitle: string;
  detail: string;
  meta: string | null;
  tone: "danger" | "warning" | "info";
}) {
  const toneClass = {
    danger: "border-red-200 bg-red-50",
    warning: "border-amber-200 bg-amber-50",
    info: "border-blue-200 bg-blue-50",
  }[tone];

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
            {subtitle}
          </p>
        </div>
        {meta ? <span className="text-xs text-gray-500">{meta}</span> : null}
      </div>
      <p className="mt-3 text-sm text-gray-700">{detail}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="text-sm text-gray-500">{message}</p>;
}

function formatBillingStatus(
  status: AdminOverview["tenantHealth"][number]["billingStatus"],
) {
  switch (status) {
    case "past_due":
      return "Past due";
    case "trialing":
      return "Trialing";
    case "canceled":
      return "Canceled";
    case "inactive":
      return "Inactive";
    case "active":
    default:
      return "Active";
  }
}

function formatDeploymentStatus(
  status: AdminOverview["queues"]["deploymentFailures"][number]["status"],
) {
  return status === "LIVE" ? "Live" : status.replaceAll("_", " ").toLowerCase();
}

function formatDomainStatus(
  status: AdminOverview["queues"]["domainIssues"][number]["status"],
) {
  return status.replaceAll("_", " ").toLowerCase();
}

function formatAlertType(
  type: AdminOverview["queues"]["formAlerts"][number]["alertTypes"][number],
) {
  switch (type) {
    case "FORM_DELIVERY_FAILURE":
      return "Delivery";
    case "SUBMISSION_SPIKE":
      return "Spike";
    case "DOMAIN_FAILURE":
      return "Domain";
    default:
      return type;
  }
}

function billingTone(
  status: AdminOverview["tenantHealth"][number]["billingStatus"],
) {
  if (status === "past_due" || status === "inactive" || status === "canceled") {
    return "danger" as const;
  }

  return "warning" as const;
}

function domainTone(
  status: AdminOverview["queues"]["domainIssues"][number]["status"],
) {
  if (status === "FAILED" || status === "DNS_REQUIRED") {
    return "danger" as const;
  }

  if (status === "PROVIDER_ATTACH_PENDING" || status === "SSL_PROVISIONING") {
    return "warning" as const;
  }

  return "info" as const;
}
