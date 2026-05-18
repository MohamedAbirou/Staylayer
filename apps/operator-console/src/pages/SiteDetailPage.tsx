import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertOctagon,
  ChevronRight,
  Globe,
  Inbox,
  Layers,
  Rocket,
  ScrollText,
  Server,
} from "lucide-react";
import { fetchSiteDetail } from "../api/operator";
import { DataFreshness } from "../components/DataFreshness";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import {
  StatusBadge,
  alertSeverityTone,
  deploymentStatusTone,
  domainStatusTone,
  siteStatusTone,
  tenantStatusTone,
} from "../components/StatusBadge";
import { AuditFeed } from "./_AuditFeed";

/**
 * Site 360 page. Surfaces domains, recent deployments, open alerts,
 * 30-day form submission/delivery counters, and the merged audit feed for
 * the site.
 */
export default function SiteDetailPage() {
  const { siteId = "" } = useParams<{ siteId: string }>();
  const query = useQuery({
    queryKey: ["operator-site", siteId],
    queryFn: () => fetchSiteDetail(siteId),
    enabled: siteId.length > 0,
    staleTime: 30_000,
  });

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
          title="Site unavailable"
          description="The site could not be loaded."
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

  const { site, tenant, domains, deployments, alerts, audit, generatedAt } =
    query.data;

  return (
    <div className="px-8 py-8">
      <nav className="flex items-center gap-1 text-xs text-slate-500">
        <Link to="/tenants" className="hover:text-slate-300">
          Tenants
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to={`/tenants/${tenant.id}`} className="hover:text-slate-300">
          {tenant.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-slate-300">{site.name}</span>
      </nav>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Server className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">{site.name}</h1>
            <p className="text-xs text-slate-400">
              {site.slug} · {site.siteType} · {site.primaryLocale ?? "—"}
            </p>
          </div>
          <StatusBadge
            status={site.status}
            tone={siteStatusTone(site.status)}
          />
          <StatusBadge
            status={`Tenant: ${tenant.status}`}
            tone={tenantStatusTone(tenant.status)}
          />
        </div>
        <DataFreshness generatedAt={generatedAt} />
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Pages" value={site.counts.pages} />
        <Stat label="Domains" value={site.counts.domains} />
        <Stat label="Submissions 30d" value={site.recentSubmissions30d} />
        <Stat
          label="Delivery fails 30d"
          value={site.recentDeliveryFailures30d}
        />
        <Stat label="Redirects" value={site.counts.redirects} />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card
          icon={<Globe className="h-4 w-4 text-cyan-400" />}
          title="Domains"
        >
          {domains.length === 0 ? (
            <EmptyState title="No domains attached" />
          ) : (
            <ul className="divide-y divide-slate-800">
              {domains.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {d.host}
                      {d.isPrimary ? (
                        <span className="ml-2 text-[10px] uppercase tracking-widest text-cyan-400">
                          primary
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {d.verifiedAt
                        ? `Verified ${new Date(d.verifiedAt).toLocaleDateString()}`
                        : "Not verified yet"}
                      {d.lastError ? ` · ${d.lastError}` : ""}
                    </p>
                  </div>
                  <StatusBadge
                    status={d.status}
                    tone={domainStatusTone(d.status)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          icon={<Rocket className="h-4 w-4 text-cyan-400" />}
          title="Deployments"
        >
          {deployments.length === 0 ? (
            <EmptyState title="No deployments" />
          ) : (
            <ul className="divide-y divide-slate-800">
              {deployments.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {d.provider ?? "Unknown provider"}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {new Date(d.updatedAt).toLocaleString()}
                      {d.errorMessage ? ` · ${d.errorMessage}` : ""}
                    </p>
                  </div>
                  <StatusBadge
                    status={d.status}
                    tone={deploymentStatusTone(d.status)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          icon={<AlertOctagon className="h-4 w-4 text-rose-400" />}
          title="Open alerts"
        >
          {alerts.length === 0 ? (
            <EmptyState title="No open alerts" />
          ) : (
            <ul className="divide-y divide-slate-800">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-100">
                      {a.type}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">
                      {a.message} · first triggered{" "}
                      {new Date(a.firstTriggeredAt).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge
                    status={a.severity}
                    tone={alertSeverityTone(a.severity)}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          icon={<Inbox className="h-4 w-4 text-cyan-400" />}
          title="Form delivery summary"
        >
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-slate-500" />
              Form definitions: {site.counts.formDefinitions}
            </li>
            <li className="flex items-center gap-2">
              <Inbox className="h-3.5 w-3.5 text-slate-500" />
              Total submissions (lifetime): {site.counts.formSubmissions}
            </li>
            <li className="flex items-center gap-2">
              <AlertOctagon className="h-3.5 w-3.5 text-slate-500" />
              Delivery failures (30d): {site.recentDeliveryFailures30d}
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
