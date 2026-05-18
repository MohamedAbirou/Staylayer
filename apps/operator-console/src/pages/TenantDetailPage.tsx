import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  ChevronRight,
  CreditCard,
  Globe,
  LifeBuoy,
  Plus,
  ScrollText,
  Server,
  ShieldAlert,
  Users,
} from "lucide-react";
import { fetchSupportCases, fetchTenantDetail } from "../api/operator";
import {
  OPERATOR_PERMISSIONS,
  PermissionButton,
  usePermissions,
} from "../permissions";
import {
  SUPPORT_PRIORITY_LABELS,
  SUPPORT_STATUS_LABELS,
  formatRelativeTime,
  supportPriorityTone,
  supportStatusTone,
} from "../lib/support";
import { DataFreshness } from "../components/DataFreshness";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import {
  StatusBadge,
  deploymentStatusTone,
  siteStatusTone,
  tenantStatusTone,
} from "../components/StatusBadge";
import { AuditFeed } from "./_AuditFeed";

/**
 * Tenant 360 page. Combines core metadata, members, sites, subscriptions
 * (gated by finance permission) and a merged audit feed scoped to the
 * tenant. Layout follows the spec in operator-console-docs/01.
 */
export default function TenantDetailPage() {
  const { tenantId = "" } = useParams<{ tenantId: string }>();
  const permissions = usePermissions();
  const navigate = useNavigate();

  // Pick the broadest variant the operator can read. Finance-only admins
  // hit `/operator/tenants/:id/billing` which returns the same shape and
  // is gated on `tenant.read.billing`.
  const variant = permissions.can(OPERATOR_PERMISSIONS.TENANT_READ_ALL)
    ? "all"
    : permissions.can(OPERATOR_PERMISSIONS.TENANT_READ_BILLING)
      ? "billing"
      : null;

  const query = useQuery({
    queryKey: ["operator-tenant", tenantId, variant],
    queryFn: () =>
      fetchTenantDetail(tenantId, { variant: variant ?? undefined }),
    enabled: tenantId.length > 0 && variant !== null,
    staleTime: 30_000,
  });

  const supportVisible = permissions.canAny([
    OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_ALL,
    OPERATOR_PERMISSIONS.SUPPORT_CASE_READ_BILLING,
    OPERATOR_PERMISSIONS.SUPPORT_CASE_LIST_ALL,
  ]);
  const supportCasesQuery = useQuery({
    queryKey: ["operator-tenant-support", tenantId],
    queryFn: () => fetchSupportCases({ tenantId, limit: 5, page: 1 }),
    enabled: tenantId.length > 0 && supportVisible,
    staleTime: 30_000,
  });

  if (variant === null) {
    return (
      <div className="px-8 py-8">
        <EmptyState
          title="Insufficient permission"
          description="You do not have permission to view this tenant."
        />
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="space-y-4 px-8 py-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="px-8 py-8">
        <EmptyState
          title="Tenant unavailable"
          description="The tenant could not be loaded. It may have been archived or removed."
          action={
            <Link
              to="/tenants"
              className="text-xs text-cyan-400 hover:underline"
            >
              Back to tenants
            </Link>
          }
        />
      </div>
    );
  }

  const { tenant, members, sites, subscriptions, audit, generatedAt } =
    query.data;

  const showBilling = permissions.canAny([
    OPERATOR_PERMISSIONS.TENANT_READ_BILLING,
    OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_READ_ALL,
    OPERATOR_PERMISSIONS.TENANT_READ_ALL,
  ]);

  return (
    <div className="px-8 py-8">
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link to="/tenants" className="hover:text-slate-300">
          Tenants
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-300">{tenant.name}</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">{tenant.name}</h1>
            <p className="text-xs text-slate-400">
              {tenant.slug} · created{" "}
              {new Date(tenant.createdAt).toLocaleDateString()}
            </p>
          </div>
          <StatusBadge
            status={tenant.status}
            tone={tenantStatusTone(tenant.status)}
          />
        </div>
        <DataFreshness generatedAt={generatedAt} />
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Sites" value={tenant.siteCount} />
        <Stat label="Members" value={tenant.memberCount} />
        <Stat label="Open alerts" value={tenant.openAlerts} />
        <Stat
          label="Updated"
          value={new Date(tenant.updatedAt).toLocaleDateString()}
        />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card icon={<Server className="h-4 w-4 text-cyan-400" />} title="Sites">
          {sites.length === 0 ? (
            <EmptyState title="No sites yet" />
          ) : (
            <ul className="divide-y divide-slate-800">
              {sites.map((site) => (
                <li
                  key={site.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/sites/${site.id}`}
                      className="block truncate text-sm font-medium text-slate-100 hover:text-white"
                    >
                      {site.name}
                    </Link>
                    <p className="truncate text-[11px] text-slate-500">
                      {site.primaryDomain ?? site.publicSubdomain ?? site.slug}{" "}
                      · {site.pageCount} pages · {site.openAlerts} alerts
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {site.latestDeployment ? (
                      <StatusBadge
                        status={site.latestDeployment.status}
                        tone={deploymentStatusTone(
                          site.latestDeployment.status,
                        )}
                      />
                    ) : null}
                    <StatusBadge
                      status={site.status}
                      tone={siteStatusTone(site.status)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          icon={<Users className="h-4 w-4 text-cyan-400" />}
          title="Members"
        >
          {members.length === 0 ? (
            <EmptyState title="No members" />
          ) : (
            <ul className="divide-y divide-slate-800">
              {members.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {member.user.email}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      member.role + (member.isDefault ? " · default" : "")
                    }
                    tone="info"
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {showBilling ? (
          <Card
            icon={<CreditCard className="h-4 w-4 text-cyan-400" />}
            title="Subscriptions"
          >
            {subscriptions.length === 0 ? (
              <EmptyState title="No subscriptions" />
            ) : (
              <ul className="divide-y divide-slate-800">
                {subscriptions.map((sub) => (
                  <li
                    key={sub.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">
                        {sub.planKey ?? "(no plan)"}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {sub.provider} ·{" "}
                        {sub.currentPeriodEnd
                          ? `renews ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                          : "no renewal date"}
                        {sub.cancelAtPeriodEnd ? " · cancel pending" : ""}
                      </p>
                    </div>
                    <StatusBadge status={sub.status} tone="info" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        {supportVisible ? (
          <Card
            icon={<LifeBuoy className="h-4 w-4 text-cyan-400" />}
            title="Support"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <Link
                to={`/support?tenantId=${encodeURIComponent(tenantId)}`}
                className="text-[11px] uppercase tracking-widest text-cyan-400 hover:text-cyan-300"
              >
                View all cases
              </Link>
              <PermissionButton
                permission={OPERATOR_PERMISSIONS.SUPPORT_CASE_CREATE_ALL}
                onClick={() =>
                  navigate(
                    `/support/new?tenantId=${encodeURIComponent(tenantId)}`,
                  )
                }
                className="inline-flex items-center gap-1 rounded-md bg-cyan-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-white hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500"
              >
                <Plus className="h-3 w-3" />
                Open case
              </PermissionButton>
            </div>
            {supportCasesQuery.data &&
            supportCasesQuery.data.data.length === 0 ? (
              <EmptyState
                title="No support cases"
                description="This tenant has no support cases on record."
              />
            ) : (
              <ul className="divide-y divide-slate-800">
                {(supportCasesQuery.data?.data ?? []).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/support/${c.id}`}
                        className="block truncate text-sm font-medium text-slate-100 hover:text-cyan-300"
                      >
                        #{c.number} · {c.subject}
                      </Link>
                      <p className="text-[11px] text-slate-500">
                        {formatRelativeTime(c.lastActivityAt)}
                        {c.assignedOperator
                          ? ` · ${c.assignedOperator.email}`
                          : " · unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={SUPPORT_PRIORITY_LABELS[c.priority]}
                        tone={supportPriorityTone(c.priority)}
                      />
                      <StatusBadge
                        status={SUPPORT_STATUS_LABELS[c.status]}
                        tone={supportStatusTone(c.status)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}

        <Card
          icon={<ShieldAlert className="h-4 w-4 text-cyan-400" />}
          title="Snapshot"
        >
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-slate-500" /> Tenant id:{" "}
              <span className="font-mono text-slate-400">{tenant.id}</span>
            </li>
            <li className="flex items-center gap-2">
              <ScrollText className="h-3.5 w-3.5 text-slate-500" /> Audit
              entries shown: {audit.length}
            </li>
          </ul>
        </Card>
      </section>

      <section className="mt-8">
        <Card
          icon={<ScrollText className="h-4 w-4 text-cyan-400" />}
          title="Audit feed"
        >
          <AuditFeed entries={audit} />
        </Card>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <header className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </header>
      {children}
    </div>
  );
}
