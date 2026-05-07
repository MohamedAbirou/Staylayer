import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { usePages } from "../hooks/usePages";
import { useAuth } from "../auth/useAuth";
import { hasActiveSite } from "../auth/access";
import { formatDate } from "../lib/formatDate";
import { PageStatusBadge } from "../components/PageStatusBadge";
import { DeploymentStatusBadge } from "../components/DeploymentStatusBadge";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { getBillingPlan } from "../api/billing";
import { getDomains } from "../api/domains";
import { getSubmissions } from "../api/submissions";
import { getLatestDeployment } from "../api/deployments";
import type { SiteDeployment } from "../api/deployments";
import {
  FileText,
  Globe,
  FileEdit,
  Languages,
  Plus,
  ArrowRight,
  Clock,
  Inbox,
  CreditCard,
  Sparkles,
  Rocket,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

const POLLING_DEPLOYMENT_STATUSES: SiteDeployment["status"][] = [
  "CREATING_PROJECT",
  "SYNCING_ENV",
  "DEPLOYING",
  "RETRYING",
];

export default function DashboardHome() {
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const activeSiteId = session?.activeSite?.id ?? null;
  const activeTenantId = session?.activeTenant?.id ?? null;
  const canViewBilling = session?.activeMembershipRole === "OWNER";
  const { data, isLoading } = usePages({ limit: 100 });
  const { data: unreadSubmissions } = useQuery({
    queryKey: ["dashboard-home", "unread-submissions", activeSiteId],
    queryFn: () =>
      getSubmissions(activeSiteId!, {
        status: "RECEIVED",
        limit: 1,
      }),
    enabled: !!activeSiteId,
    retry: false,
  });
  const { data: domains } = useQuery({
    queryKey: ["dashboard-home", "domains", activeSiteId],
    queryFn: () => getDomains(activeSiteId!),
    enabled: !!activeSiteId,
    retry: false,
  });
  const { data: billingPlan } = useQuery({
    queryKey: ["dashboard-home", "billing", activeTenantId],
    queryFn: () => getBillingPlan(activeTenantId!),
    enabled: !!activeTenantId && canViewBilling,
    retry: false,
  });

  const { data: latestDeployment, isLoading: deploymentLoading } = useQuery({
    queryKey: ["dashboard-home", "latest-deployment", activeSiteId],
    queryFn: () => getLatestDeployment(activeSiteId!),
    enabled: !!activeSiteId,
    refetchInterval: (query) => {
      const deployment = query.state.data;

      if (
        !deployment ||
        !POLLING_DEPLOYMENT_STATUSES.includes(deployment.status)
      ) {
        return false;
      }

      return 10_000;
    },
    retry: false,
  });

  const stats = useMemo(() => {
    const pages = data?.data ?? [];
    const published = pages.filter((p) => p.published).length;
    const drafts = pages.filter((p) => !p.published).length;
    const locales = new Set(pages.map((p) => p.locale)).size;
    const recent = [...pages]
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )
      .slice(0, 6);
    return { total: pages.length, published, drafts, locales, recent };
  }, [data]);

  if (!hasActiveSite(session)) {
    return (
      <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
          <Sparkles className="h-7 w-7 text-blue-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to your workspace
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Select a site from the sidebar or run the setup wizard to create
            your first hospitality website.
          </p>
        </div>
        <button
          onClick={() => navigate("/onboarding")}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Sparkles className="h-4 w-4" />
          Set up your site
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (isLoading) return <LoadingSpinner />;

  const greeting = user?.email?.split("@")[0] ?? "there";
  const unreadCount = unreadSubmissions?.total ?? 0;
  const pendingDomains = (domains ?? []).filter(
    (domain) => domain.status !== "ACTIVE",
  ).length;
  const activeDomains = (domains ?? []).filter(
    (domain) => domain.status === "ACTIVE",
  ).length;
  const domainBadge = domains?.length
    ? pendingDomains > 0
      ? statusBadge(`${pendingDomains} pending`, "amber")
      : statusBadge(`${activeDomains} active`, "green")
    : statusBadge("No domains", "slate");
  const billingBadge = canViewBilling
    ? billingPlan
      ? statusBadge(
          billingPlan.status === "past_due" ? "Past due" : billingPlan.planName,
          billingPlan.status === "past_due"
            ? "red"
            : billingPlan.status === "trialing"
              ? "blue"
              : billingPlan.status === "canceled"
                ? "slate"
                : "green",
        )
      : statusBadge("Unavailable", "slate")
    : statusBadge("Owner only", "slate");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good to see you, {greeting} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Here&apos;s an overview of the content for{" "}
            {session?.activeSite?.name}.
          </p>
        </div>
        <button
          onClick={() => navigate("/pages/new")}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800"
        >
          <Plus className="h-4 w-4" />
          New Page
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Pages"
          value={stats.total}
          icon={FileText}
          color="blue"
          onClick={() => navigate("/pages")}
        />
        <StatCard
          label="Published"
          value={stats.published}
          icon={Globe}
          color="green"
          onClick={() => navigate("/pages")}
        />
        <StatCard
          label="Drafts"
          value={stats.drafts}
          icon={FileEdit}
          color="amber"
          onClick={() => navigate("/pages")}
        />
        <StatCard
          label="Locales"
          value={stats.locales}
          icon={Languages}
          color="purple"
        />
      </div>

      {/* Site deployment status */}
      {!deploymentLoading && (
        <DeploymentStatusSection deployment={latestDeployment ?? null} />
      )}

      {/* Workspace status row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WorkspaceStatusCard
          label="Inquiries"
          description="Contact and booking inquiries from your site"
          icon={Inbox}
          action="View inquiries"
          onClick={() => navigate("/forms")}
          badge={
            unreadCount > 0
              ? statusBadge(`${unreadCount} new`, "blue")
              : statusBadge("All caught up", "green")
          }
        />
        <WorkspaceStatusCard
          label="Domain"
          description="Custom domain connection status"
          icon={Globe}
          action="Manage domains"
          onClick={() => navigate("/domains")}
          badge={domainBadge}
        />
        <WorkspaceStatusCard
          label="Plan"
          description="Current subscription and usage limits"
          icon={CreditCard}
          action={canViewBilling ? "View billing" : "Billing restricted"}
          onClick={canViewBilling ? () => navigate("/billing") : undefined}
          badge={billingBadge}
        />
      </div>

      {/* Recently updated */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">
              Recently Updated
            </h2>
          </div>
          <button
            onClick={() => navigate("/pages")}
            className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {stats.recent.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
            <FileText className="h-10 w-10 text-gray-200" />
            <p className="text-sm text-gray-500">No pages yet</p>
            <button
              onClick={() => navigate("/pages/new")}
              className="text-sm font-medium text-blue-600 hover:text-blue-800"
            >
              Create your first page →
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {stats.recent.map((page) => (
              <div
                key={page.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50/70 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {page.title}
                    </p>
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      {page.locale}
                    </span>
                    <PageStatusBadge published={page.published} />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    /{page.slug} · updated {formatDate(page.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={() =>
                    navigate(`/editor/${page.slug}?locale=${page.locale}`)
                  }
                  className="ml-4 shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DeploymentStatusSection ──────────────────────────────────────────────────

function DeploymentStatusSection({
  deployment,
}: {
  deployment: SiteDeployment | null | undefined;
}) {
  const isInProgress =
    deployment !== null &&
    deployment !== undefined &&
    !["LIVE", "FAILED", "PENDING"].includes(deployment.status);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-800">Site Deployment</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/deployments"
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            Open deployment center
          </Link>
          {deployment ? (
            <DeploymentStatusBadge status={deployment.status} />
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              Not deployed
            </span>
          )}
        </div>
      </div>

      {deployment?.status === "LIVE" && deployment.url && (
        <a
          href={deployment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          <ExternalLink className="h-3 w-3" />
          {deployment.url}
        </a>
      )}

      {deployment?.status === "FAILED" && deployment.errorMessage && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-xs text-red-700">{deployment.errorMessage}</p>
        </div>
      )}

      {isInProgress && (
        <p className="mt-2 text-xs text-gray-500">
          Your site is being prepared. This may take a few minutes.
        </p>
      )}

      {!deployment && (
        <p className="mt-2 text-xs text-gray-500">
          Your site has not been deployed yet. Open the deployment center to
          provision a dedicated deployment.
        </p>
      )}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: "blue" | "green" | "amber" | "purple";
  onClick?: () => void;
}

const colorMap = {
  blue: { bg: "bg-blue-50", icon: "text-blue-600", value: "text-blue-700" },
  green: {
    bg: "bg-emerald-50",
    icon: "text-emerald-600",
    value: "text-emerald-700",
  },
  amber: { bg: "bg-amber-50", icon: "text-amber-500", value: "text-amber-600" },
  purple: {
    bg: "bg-purple-50",
    icon: "text-purple-600",
    value: "text-purple-700",
  },
};

function StatCard({ label, value, icon: Icon, color, onClick }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div
      onClick={onClick}
      className={`group rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all ${
        onClick ? "cursor-pointer hover:shadow-md hover:border-gray-200" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {label}
          </p>
          <p className={`mt-2 text-3xl font-bold ${c.value}`}>{value}</p>
        </div>
        <div
          className={`rounded-xl p-2.5 ${c.bg} transition-transform group-hover:scale-110`}
        >
          <Icon className={`h-5 w-5 ${c.icon}`} />
        </div>
      </div>
    </div>
  );
}

// ─── WorkspaceStatusCard ──────────────────────────────────────────────────────
interface WorkspaceStatusCardProps {
  label: string;
  description: string;
  icon: React.ElementType;
  action: string;
  onClick?: () => void;
  badge: React.ReactNode;
}

function WorkspaceStatusCard({
  label,
  description,
  icon: Icon,
  action,
  onClick,
  badge,
}: WorkspaceStatusCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-800">{label}</p>
          </div>
          {badge}
        </div>
        <p className="mt-1.5 text-xs text-gray-500">{description}</p>
      </div>
      {onClick ? (
        <button
          onClick={onClick}
          className="mt-4 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          {action}
          <ArrowRight className="h-3 w-3" />
        </button>
      ) : (
        <p className="mt-4 text-xs font-medium text-gray-400">{action}</p>
      )}
    </div>
  );
}

function statusBadge(
  label: string,
  tone: "blue" | "green" | "amber" | "red" | "slate",
) {
  const tones = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-700",
  } as const;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {label}
    </span>
  );
}
