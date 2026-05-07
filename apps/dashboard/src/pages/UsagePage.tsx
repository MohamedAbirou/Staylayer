import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TriangleAlert as AlertTriangle, ArrowRight, ArrowUpRight, CircleCheck as CheckCircle2, CircleDashed, ExternalLink, Gauge, Inbox, Languages, Layers, Loader as Loader2, RefreshCw, Rocket, Sparkles, Users } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../auth/useAuth";
import {
  BILLING_MEMBERSHIP_ROLES,
  CONTENT_MEMBERSHIP_ROLES,
  hasMembershipRole,
} from "../auth/access";
import {
  getBillingPlan,
  type BillingPlanLimits,
  type BillingPlanSnapshot,
  type BillingUsageTotals,
} from "../api/billing";
import {
  MILESTONE_META,
  getOnboarding,
  markOnboardingMilestone,
  type OnboardingMilestoneKey,
  type OnboardingSnapshot,
} from "../api/onboarding";

const MILESTONE_ORDER: OnboardingMilestoneKey[] = [
  "SITE_CREATED",
  "FIRST_PAGE_PUBLISHED",
  "DEPLOYMENT_PROVISIONED",
  "DOMAIN_CONNECTED",
  "SEO_COMPLETED",
  "FORM_CONFIGURED",
  "TRANSLATION_CONFIGURED",
];

export default function UsagePage() {
  const { session } = useAuth();
  const tenantId = session?.activeTenant?.id ?? null;
  const canViewBilling = hasMembershipRole(session, BILLING_MEMBERSHIP_ROLES);
  const canMarkMilestones = hasMembershipRole(session, CONTENT_MEMBERSHIP_ROLES);
  const queryClient = useQueryClient();

  const {
    data: plan,
    isLoading: planLoading,
    isError: planError,
    refetch: refetchPlan,
  } = useQuery({
    queryKey: ["usage", "billing", tenantId],
    queryFn: () => getBillingPlan(tenantId!),
    enabled: Boolean(tenantId && canViewBilling),
    retry: false,
  });

  const {
    data: onboarding,
    isLoading: onboardingLoading,
    isError: onboardingError,
    refetch: refetchOnboarding,
  } = useQuery({
    queryKey: ["usage", "onboarding", tenantId],
    queryFn: () => getOnboarding(tenantId!),
    enabled: Boolean(tenantId),
    retry: false,
  });

  const markMutation = useMutation({
    mutationFn: (key: OnboardingMilestoneKey) =>
      markOnboardingMilestone(tenantId!, key),
    onSuccess: (next) => {
      queryClient.setQueryData(["usage", "onboarding", tenantId], next);
      toast.success("Milestone marked complete");
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? "Could not update milestone";
      toast.error(message);
    },
  });

  if (!tenantId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Usage Center</h1>
        <p className="mt-2 text-sm text-gray-600">
          Select a tenant workspace to review usage, limits, and onboarding
          progress.
        </p>
      </div>
    );
  }

  const isLoading = planLoading || onboardingLoading;
  const isError = planError || onboardingError;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usage Center</h1>
          <p className="mt-1 text-sm text-gray-500">
            Live usage against plan limits and onboarding milestones for{" "}
            {session?.activeTenant?.name}.
          </p>
        </div>
        <button
          onClick={() => {
            void refetchPlan();
            void refetchOnboarding();
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {isError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Usage data could not be fully loaded. Refresh the page to retry.
            </p>
          </div>
        </div>
      )}

      {isLoading && !plan && !onboarding ? (
        <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-10 text-sm text-gray-500 shadow-sm">
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          Loading usage snapshot…
        </div>
      ) : (
        <>
          {plan && canViewBilling && (
            <PlanSummaryCard plan={plan} />
          )}

          {plan && canViewBilling && (
            <UsageGrid limits={plan.limits} usage={plan.usage} />
          )}

          {onboarding && (
            <OnboardingCard
              snapshot={onboarding}
              canMark={canMarkMilestones}
              onMark={(key) => markMutation.mutate(key)}
              pending={markMutation.isPending}
            />
          )}

          {!canViewBilling && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
              Billing usage is visible only to the workspace owner and billing
              contact. Onboarding milestones remain visible to all members.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PlanSummaryCard({ plan }: { plan: BillingPlanSnapshot }) {
  const supportLabels: Record<BillingPlanLimits["supportTier"], string> = {
    docs: "Self-serve docs",
    email: "Email support",
    priority: "Priority support",
    white_glove: "White-glove onboarding",
  };

  const statusTone: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    trialing: "bg-blue-100 text-blue-700",
    past_due: "bg-amber-100 text-amber-800",
    canceled: "bg-slate-100 text-slate-700",
    inactive: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Current plan
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">
            {plan.planName}
          </h2>
          <p className="mt-1 text-sm text-gray-500">{plan.description}</p>
          <p className="mt-2 text-xs text-gray-500">
            Support: {supportLabels[plan.limits.supportTier]} ·{" "}
            {plan.limits.rollbackEnabled
              ? "Rollback enabled"
              : "Rollback not available"}{" "}
            ·{" "}
            {plan.limits.analyticsEnabled
              ? "Analytics included"
              : "Analytics not included"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              statusTone[plan.status] ?? "bg-gray-100 text-gray-700"
            }`}
          >
            {plan.status.replace("_", " ")}
          </span>
          <Link
            to="/billing"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Manage plan
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}

interface UsageRow {
  key: string;
  label: string;
  used: number;
  limit: number | null;
  icon: React.ElementType;
  description: string;
}

function UsageGrid({
  limits,
  usage,
}: {
  limits: BillingPlanLimits;
  usage: BillingUsageTotals;
}) {
  const rows = useMemo<UsageRow[]>(
    () => [
      {
        key: "sites",
        label: "Sites",
        used: usage.sites,
        limit: limits.sites,
        icon: Layers,
        description: "Active hospitality sites in this workspace",
      },
      {
        key: "pages",
        label: "Pages",
        used: usage.pages,
        limit: limits.pages,
        icon: Sparkles,
        description: "Published and draft pages across every site",
      },
      {
        key: "locales",
        label: "Locales",
        used: usage.locales,
        limit: limits.locales,
        icon: Languages,
        description: "Languages currently enabled on your sites",
      },
      {
        key: "seats",
        label: "Seats",
        used: usage.seats,
        limit: limits.seats,
        icon: Users,
        description: "Members with access to this tenant",
      },
      {
        key: "formSubmissions",
        label: "Inquiries / month",
        used: usage.formSubmissions,
        limit: limits.formSubmissions,
        icon: Inbox,
        description: "Form submissions received in the current billing month",
      },
      {
        key: "domains",
        label: "Custom domains",
        used: usage.domains,
        limit: limits.domains,
        icon: Rocket,
        description: "Verified custom domains connected to any site",
      },
      {
        key: "translation",
        label: "Translation chars / month",
        used: usage.translationCharactersThisMonth,
        limit: limits.translationCharactersPerMonth,
        icon: Gauge,
        description: "Characters translated this billing month",
      },
    ],
    [limits, usage],
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => (
        <UsageCard key={row.key} row={row} />
      ))}
    </div>
  );
}

function UsageCard({ row }: { row: UsageRow }) {
  const Icon = row.icon;
  const hasLimit = typeof row.limit === "number";
  const limit = row.limit ?? 0;
  const rawPct = hasLimit && limit > 0 ? (row.used / limit) * 100 : 0;
  const pct = Math.min(rawPct, 100);
  const over = hasLimit && row.used > limit;
  const near = hasLimit && !over && rawPct >= 80;
  const unlimited = !hasLimit;

  const barColor = over
    ? "bg-red-600"
    : near
      ? "bg-amber-500"
      : "bg-blue-500";

  const badgeTone = over
    ? "bg-red-100 text-red-700"
    : near
      ? "bg-amber-100 text-amber-800"
      : "bg-emerald-100 text-emerald-700";

  const badgeLabel = over
    ? "Over limit"
    : near
      ? "Near limit"
      : unlimited
        ? "Unlimited"
        : "Healthy";

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{row.label}</p>
            <p className="text-[11px] text-gray-500">{row.description}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeTone}`}
        >
          {badgeLabel}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <p className="text-lg font-bold text-gray-900">
            {row.used.toLocaleString()}
          </p>
          <p className="text-xs text-gray-500">
            {unlimited ? "No limit" : `of ${limit.toLocaleString()}`}
          </p>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: unlimited ? "100%" : `${pct}%` }}
          />
        </div>
        {over && (
          <p className="mt-2 text-xs font-medium text-red-700">
            Upgrade your plan or reduce usage to restore healthy state.
          </p>
        )}
        {!over && near && (
          <p className="mt-2 text-xs font-medium text-amber-700">
            Approaching your plan limit — consider upgrading before launch.
          </p>
        )}
      </div>
    </div>
  );
}

function OnboardingCard({
  snapshot,
  canMark,
  onMark,
  pending,
}: {
  snapshot: OnboardingSnapshot;
  canMark: boolean;
  onMark: (key: OnboardingMilestoneKey) => void;
  pending: boolean;
}) {
  const byKey = new Map(snapshot.milestones.map((m) => [m.key, m]));
  const ordered = MILESTONE_ORDER.map(
    (key) =>
      byKey.get(key) ?? {
        key,
        completed: false,
        completedAt: null,
      },
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Onboarding
          </p>
          <h2 className="mt-1 text-xl font-bold text-gray-900">
            Getting your site ready
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {snapshot.completedAt
              ? "All milestones complete. Your workspace is launch-ready."
              : "Complete these steps to reach a launch-ready hospitality site."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-500">
              {snapshot.progress.completed} / {snapshot.progress.total}
            </p>
            <p className="text-[11px] text-gray-400">
              {snapshot.progress.percent}% complete
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-blue-50 p-1">
            <div
              className="h-full w-full rounded-full bg-gradient-to-br from-blue-500 to-blue-600"
              style={{
                opacity: Math.max(snapshot.progress.percent / 100, 0.1),
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${snapshot.progress.percent}%` }}
        />
      </div>

      <ul className="mt-5 space-y-2">
        {ordered.map((milestone) => {
          const meta = MILESTONE_META[milestone.key];
          return (
            <li
              key={milestone.key}
              className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                milestone.completed
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-gray-200 bg-white hover:border-blue-200"
              }`}
            >
              <div className="mt-0.5">
                {milestone.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <CircleDashed className="h-5 w-5 text-gray-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-semibold ${
                    milestone.completed ? "text-emerald-900" : "text-gray-900"
                  }`}
                >
                  {meta.title}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {meta.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!milestone.completed && canMark && (
                  <button
                    type="button"
                    onClick={() => onMark(milestone.key)}
                    disabled={pending}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                  >
                    {pending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                    Mark done
                  </button>
                )}
                <Link
                  to={meta.href}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  Go
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
        <ExternalLink className="h-3 w-3" />
        Milestones are detected automatically. Use &quot;Mark done&quot; to
        override if auto-detection missed a step.
      </div>
    </div>
  );
}
