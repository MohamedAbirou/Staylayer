import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { TriangleAlert as AlertTriangle, ArrowRight } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { BILLING_MEMBERSHIP_ROLES, hasMembershipRole } from "../auth/access";
import {
  getBillingPlan,
  type BillingPlanSnapshot,
  type BillingUsageTotals,
  type BillingPlanLimits,
} from "../api/billing";

type OverLimitItem = { label: string; used: number; limit: number };

function getOverLimits(plan: BillingPlanSnapshot): OverLimitItem[] {
  const rows: Array<{
    label: string;
    used: number;
    limit: number | null;
  }> = [
    { label: "sites", used: plan.usage.sites, limit: plan.limits.sites },
    { label: "seats", used: plan.usage.seats, limit: plan.limits.seats },
    { label: "locales", used: plan.usage.locales, limit: plan.limits.locales },
    { label: "pages", used: plan.usage.pages, limit: plan.limits.pages },
    {
      label: "inquiries this month",
      used: plan.usage.formSubmissions,
      limit: plan.limits.formSubmissions,
    },
    {
      label: "custom domains",
      used: plan.usage.domains,
      limit: plan.limits.domains,
    },
    {
      label: "translation characters",
      used: (plan.usage as BillingUsageTotals).translationCharactersThisMonth,
      limit: (plan.limits as BillingPlanLimits).translationCharactersPerMonth,
    },
  ];

  return rows.filter(
    (r): r is OverLimitItem =>
      typeof r.limit === "number" && r.limit >= 0 && r.used > r.limit,
  );
}

export function PlanEnforcementBanner() {
  const { session } = useAuth();
  const tenantId = session?.activeTenant?.id ?? null;
  const canRead = hasMembershipRole(session, BILLING_MEMBERSHIP_ROLES);

  const { data: plan } = useQuery({
    queryKey: ["plan-enforcement-banner", tenantId],
    queryFn: () => getBillingPlan(tenantId!),
    enabled: Boolean(tenantId && canRead),
    retry: false,
    staleTime: 60_000,
  });

  if (!plan) return null;

  const overLimits = getOverLimits(plan);
  const blocked = plan.actions.publishingBlocked;

  if (overLimits.length === 0 && !blocked) return null;

  const title = blocked
    ? "Publishing is blocked for this workspace"
    : "Plan limits exceeded — remediation required";

  const summary = overLimits.length
    ? `Over limit for ${overLimits
        .map((o) => `${o.label} (${o.used}/${o.limit})`)
        .join(", ")}.`
    : "Resolve billing state to restore publishing.";

  return (
    <div className="border-b border-red-200 bg-red-50 px-6 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-sm font-semibold text-red-800">{title}</p>
            <p className="mt-0.5 text-xs text-red-700">{summary}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/usage"
            className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Review usage
            <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            to="/billing"
            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >
            Upgrade plan
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  );
}
