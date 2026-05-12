import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  RefreshCw,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { BILLING_MEMBERSHIP_ROLES, hasMembershipRole } from "../auth/access";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  PLAN_CATALOG,
  createCheckoutSession,
  createPortalSession,
  getBillingPlan,
  isBillingPlanKey,
  type BillingPlanKey,
  type BillingPlanSnapshot,
  type BillingPlanStatus,
} from "../api/billing";
import { formatDate } from "../lib/formatDate";

const STATUS_META: Record<BillingPlanStatus, { label: string; color: string }> =
  {
    active: { label: "Active", color: "bg-emerald-100 text-emerald-700" },
    trialing: { label: "Trial", color: "bg-blue-100 text-blue-700" },
    past_due: { label: "Past due", color: "bg-amber-100 text-amber-800" },
    canceled: { label: "Canceled", color: "bg-gray-100 text-gray-600" },
    inactive: { label: "Inactive", color: "bg-slate-100 text-slate-700" },
  };

export default function BillingPage() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = session?.activeTenant?.id ?? null;
  const canViewBilling = hasMembershipRole(session, BILLING_MEMBERSHIP_ROLES);
  const [selectedPlanKey, setSelectedPlanKey] = useState<BillingPlanKey | null>(
    null,
  );
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);
  const [checkoutFeedback, setCheckoutFeedback] = useState<
    "none" | "syncing" | "synced"
  >(searchParams.get("checkout") === "success" ? "syncing" : "none");
  const [portalFeedback, setPortalFeedback] = useState<"none" | "returned">(
    searchParams.get("portal") === "return" ? "returned" : "none",
  );
  const handledCheckoutIntentRef = useRef<string | null>(null);

  const {
    data: plan,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["billing", tenantId],
    queryFn: () => getBillingPlan(tenantId!),
    enabled: Boolean(tenantId && canViewBilling),
    retry: false,
    refetchInterval: searchParams.get("checkout") === "success" ? 2000 : false,
  });

  const requestedPlanParam = searchParams.get("plan");
  const requestedPlan = isBillingPlanKey(requestedPlanParam)
    ? requestedPlanParam
    : null;
  const checkoutReturn = searchParams.get("checkout");
  const portalReturn = searchParams.get("portal");
  const checkoutIntentKey =
    requestedPlan && searchParams.get("intent") === "checkout"
      ? `${requestedPlan}:checkout`
      : null;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !plan) {
        throw new Error("Select a tenant workspace before starting checkout");
      }

      const returnUrl = `${window.location.origin}/billing?checkout=success`;
      const cancelUrl = `${window.location.origin}/billing?checkout=cancelled`;
      const targetPlanKey = selectedPlanKey ?? plan.planKey;
      return createCheckoutSession(tenantId, {
        planKey: targetPlanKey,
        successUrl: returnUrl,
        cancelUrl,
      });
    },
    onSuccess: ({ checkoutUrl }) => {
      setCheckoutConfirmOpen(false);
      window.location.assign(checkoutUrl);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ??
        "Unable to start checkout for this hospitality workspace.";
      toast.error(message);
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) {
        throw new Error("Select a tenant workspace before managing billing");
      }

      return createPortalSession(tenantId, {
        returnUrl: `${window.location.origin}/billing?portal=return`,
      });
    },
    onSuccess: ({ portalUrl }) => {
      window.location.assign(portalUrl);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ??
        "Unable to open Stripe Billing for this workspace.";
      toast.error(message);
    },
  });

  const checkoutAllowed = plan ? canStartCheckout(plan) : false;

  useEffect(() => {
    if (checkoutReturn === "success") {
      setCheckoutFeedback((current) =>
        current === "synced" ? current : "syncing",
      );
    }
  }, [checkoutReturn]);

  useEffect(() => {
    if (portalReturn !== "return") {
      return;
    }

    setPortalFeedback("returned");
    const next = new URLSearchParams(searchParams);
    next.delete("portal");
    setSearchParams(next, { replace: true });
  }, [portalReturn, searchParams, setSearchParams]);

  useEffect(() => {
    if (!plan || checkoutFeedback !== "syncing") {
      return;
    }

    if (["active", "trialing", "past_due"].includes(plan.status)) {
      setCheckoutFeedback("synced");
      const next = new URLSearchParams(searchParams);
      next.delete("checkout");
      setSearchParams(next, { replace: true });
    }
  }, [checkoutFeedback, plan, searchParams, setSearchParams]);

  useEffect(() => {
    if (!requestedPlan) {
      return;
    }

    setSelectedPlanKey((current) =>
      current === requestedPlan ? current : requestedPlan,
    );
  }, [requestedPlan]);

  useEffect(() => {
    if (!plan || !requestedPlan || !checkoutIntentKey || !checkoutAllowed) {
      return;
    }

    const activePlan = selectedPlanKey ?? plan.planKey;
    if (activePlan !== requestedPlan) {
      return;
    }

    if (handledCheckoutIntentRef.current === checkoutIntentKey) {
      return;
    }

    handledCheckoutIntentRef.current = checkoutIntentKey;
    setCheckoutConfirmOpen(true);
  }, [
    checkoutAllowed,
    checkoutIntentKey,
    plan,
    requestedPlan,
    selectedPlanKey,
  ]);

  if (!tenantId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Plan</h1>
        <p className="mt-2 text-sm text-gray-600">
          Select a tenant workspace to view billing and subscription status.
        </p>
      </div>
    );
  }

  if (!canViewBilling) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Billing & Plan</h1>
        <p className="mt-2 text-sm text-gray-600">
          Only the workspace owner or billing contact can view plan details.
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
        <div className="flex items-start gap-3 text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h1 className="text-xl font-bold">
              Billing status could not be refreshed
            </h1>
            <p className="mt-2 text-sm">
              Retry this live check before making a launch decision for the
              active hospitality workspace.
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

  if (isLoading || !plan) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-10 text-sm text-gray-500 shadow-sm">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        Loading billing status…
      </div>
    );
  }

  const { label, color } = STATUS_META[plan.status];
  const manageBillingAllowed =
    plan.source === "stripe" && !!plan.providerCustomerId;
  const overLimitItems = getOverLimitItems(plan);
  const nearLimitItems = getNearLimitItems(plan);
  const selectedPlan = PLAN_CATALOG.find(
    (entry) => entry.key === (selectedPlanKey ?? plan.planKey),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Plan</h1>
          <p className="mt-1 text-sm text-gray-500">
            Live billing state for {session?.activeTenant?.name}. Site selection
            is only required for content editing, domains, and inquiries.
          </p>
        </div>
        <button
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {checkoutFeedback === "syncing" && (
        <StatusBanner
          icon={Loader2}
          tone="info"
          title="Payment confirmed, syncing subscription..."
          message="Stripe accepted the payment. StayLayer is reconciling the subscription state for this workspace now."
        />
      )}

      {checkoutFeedback === "synced" && plan.status !== "inactive" && (
        <StatusBanner
          icon={CheckCircle2}
          tone="success"
          title="Subscription synced"
          message={`Your ${plan.planName} plan is active for ${session?.activeTenant?.name}.`}
        />
      )}

      {checkoutReturn === "cancelled" && (
        <StatusBanner
          icon={AlertTriangle}
          tone="warning"
          title="Checkout canceled"
          message="No payment was captured. You can restart checkout whenever you're ready."
        />
      )}

      {portalFeedback === "returned" && (
        <StatusBanner
          icon={CreditCard}
          tone="info"
          title="Returned from Stripe Billing"
          message="Your billing portal session is complete. StayLayer refreshed the live workspace billing snapshot when you came back."
        />
      )}

      {!plan.actions.publishingBlocked &&
        plan.status === "past_due" &&
        plan.gracePeriodEndsAt && (
          <StatusBanner
            icon={Clock}
            tone="warning"
            title="Billing grace period is active"
            message={`Publishing will be blocked after ${formatDate(plan.gracePeriodEndsAt)} unless payment is recovered.`}
          />
        )}

      {plan.source === "default_trial" && plan.status === "trialing" && (
        <StatusBanner
          icon={Zap}
          tone="info"
          title="Trial active"
          message={`Your hospitality trial${plan.renewsAt ? ` ends ${formatDate(plan.renewsAt)}` : ""}. Choose a plan below and start checkout to keep publishing access after the trial window closes.`}
        />
      )}

      {plan.source === "default_trial" && plan.status === "inactive" && (
        <StatusBanner
          icon={AlertTriangle}
          tone="warning"
          title="Trial has ended"
          message="Your free hospitality trial has expired. Publishing is blocked until you subscribe to a paid plan."
        />
      )}

      {plan.status === "trialing" &&
        plan.source !== "default_trial" &&
        plan.renewsAt && (
          <StatusBanner
            icon={Zap}
            tone="info"
            title="Stripe trial active"
            message={`Your managed trial ends on ${formatDate(plan.renewsAt)}. No payment has been charged yet. Your plan activates automatically when the trial closes.`}
          />
        )}

      {plan.status === "canceled" && (
        <StatusBanner
          icon={AlertTriangle}
          tone="warning"
          title="Subscription canceled"
          message="Your subscription was canceled. Editing remains available but publishing is blocked. Select a plan below to reactivate."
        />
      )}

      {plan.cancelAtPeriodEnd && plan.status === "active" && plan.renewsAt && (
        <StatusBanner
          icon={Clock}
          tone="warning"
          title="Subscription set to cancel"
          message={`Your subscription will not renew after ${formatDate(plan.renewsAt)}. Publishing access stops at that date unless you reactivate.`}
        />
      )}

      {overLimitItems.length > 0 && (
        <StatusBanner
          icon={AlertTriangle}
          tone="danger"
          title="Plan limits are exceeded"
          message={`This workspace is currently over limit for ${overLimitItems.map((item) => item.label.toLowerCase()).join(", ")}. Resolve the overage before launch commitments rely on this plan.`}
          action={
            manageBillingAllowed ? (
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                {portalMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Manage billing
              </button>
            ) : undefined
          }
        />
      )}

      {overLimitItems.length === 0 && nearLimitItems.length > 0 && (
        <StatusBanner
          icon={Clock}
          tone="warning"
          title="Plan capacity is getting tight"
          message={`Usage is approaching the current plan limit for ${nearLimitItems.map((item) => item.label.toLowerCase()).join(", ")}. Review capacity before the next launch or content push.`}
          action={
            manageBillingAllowed ? (
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
              >
                {portalMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Review billing
              </button>
            ) : undefined
          }
        />
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Current plan
            </p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900">
              {plan.planName}
            </h2>
            <p className="mt-1 text-sm text-gray-500">{plan.description}</p>
            {plan.renewsAt && (
              <p className="mt-2 text-xs text-gray-500">
                {plan.status === "trialing"
                  ? `Trial ends ${formatDate(plan.renewsAt)}`
                  : plan.cancelAtPeriodEnd
                    ? `Cancels ${formatDate(plan.renewsAt)}`
                    : `Renews ${formatDate(plan.renewsAt)}`}
              </p>
            )}
            {plan.lastWebhookAt && (
              <p className="mt-1 text-xs text-gray-400">
                Last billing sync {formatDate(plan.lastWebhookAt)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}
            >
              {label}
            </span>
            {manageBillingAllowed && (
              <button
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {portalMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CreditCard className="h-3.5 w-3.5" />
                )}
                Manage billing
              </button>
            )}
            {checkoutAllowed && (
              <button
                onClick={() => setCheckoutConfirmOpen(true)}
                disabled={checkoutMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {checkoutMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                {plan.status === "canceled" || plan.status === "inactive"
                  ? "Resume billing"
                  : "Start subscription"}
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <UsageMeter
            label="Pages"
            used={plan.usage.pages}
            limit={plan.limits.pages}
          />
          <UsageMeter
            label="Locales"
            used={plan.usage.locales}
            limit={plan.limits.locales}
          />
          <UsageMeter
            label="Form submissions / mo"
            used={plan.usage.formSubmissions}
            limit={plan.limits.formSubmissions}
          />
          <UsageMeter
            label="Sites"
            used={plan.usage.sites}
            limit={plan.limits.sites}
          />
          <UsageMeter
            label="Seats"
            used={plan.usage.seats}
            limit={plan.limits.seats}
          />
        </div>
        {overLimitItems.length > 0 && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-800">
              Immediate remediation required
            </p>
            <ul className="mt-2 space-y-1 text-sm text-red-700">
              {overLimitItems.map((item) => (
                <li key={item.label}>
                  {item.label}: {item.used} used against a limit of {item.limit}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {checkoutAllowed && (
        <PlanSelector
          selected={selectedPlanKey ?? plan.planKey}
          onSelect={setSelectedPlanKey}
        />
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">
            Billing enforcement state
          </h3>
        </div>
        <ul className="space-y-2">
          {[
            plan.actions.editingAllowed
              ? "Editing remains available"
              : "Editing is currently restricted",
            plan.actions.publishingBlocked
              ? "Publishing is blocked"
              : "Publishing is currently allowed",
            plan.actions.publicSitesRemainLive
              ? "Public hospitality sites stay live"
              : "Public hospitality sites are not guaranteed to stay live",
            `Custom domains included: up to ${plan.limits.domains}`,
          ].map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-sm text-gray-600"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <CreditCard className="h-4 w-4" />
          <span>
            Billing is scoped to {session?.activeTenant?.name}. This page uses
            the live tenant billing snapshot, not placeholder values.
          </span>
        </div>
      </div>

      <ConfirmDialog
        open={checkoutConfirmOpen}
        title="Continue to Stripe Checkout?"
        message={`You are about to open Stripe Checkout for ${selectedPlan?.name ?? plan.planName}. This creates or restores a live subscription for ${session?.activeTenant?.name}.`}
        confirmLabel="Open Stripe Checkout"
        isPending={checkoutMutation.isPending}
        onConfirm={() => checkoutMutation.mutate()}
        onCancel={() => setCheckoutConfirmOpen(false)}
      />
    </div>
  );
}

function canStartCheckout(plan: BillingPlanSnapshot): boolean {
  return (
    // plan.source === "default_trial" ||
    plan.source === "free" ||
    plan.status === "inactive" ||
    plan.status === "canceled"
  );
}

function PlanSelector({
  selected,
  onSelect,
}: {
  selected: BillingPlanKey;
  onSelect: (key: BillingPlanKey) => void;
}) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
      <p className="mb-4 text-sm font-semibold text-blue-900">
        Choose your hospitality plan
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PLAN_CATALOG.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onSelect(p.key)}
            className={`rounded-lg border-2 p-4 text-left transition-colors ${
              selected === p.key
                ? "border-blue-600 bg-white shadow-sm"
                : "border-transparent bg-white hover:border-blue-300"
            }`}
          >
            <p className="text-sm font-semibold text-gray-900">{p.name}</p>
            <p className="mt-1 text-xs text-gray-500">{p.tagline}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusBanner({
  icon: Icon,
  tone,
  title,
  message,
  action,
}: {
  icon: ElementType;
  tone: "info" | "warning" | "danger" | "success";
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  };

  return (
    <div
      className={`flex items-start justify-between gap-4 rounded-lg border px-4 py-3 ${styles[tone]}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs opacity-90">{message}</p>
        </div>
      </div>
      {action ?? null}
    </div>
  );
}

function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const hasNumericLimit = typeof limit === "number";
  const rawPct = hasNumericLimit && limit > 0 ? (used / limit) * 100 : 0;
  const pct = hasNumericLimit ? Math.min(rawPct, 100) : 0;
  const overLimit = hasNumericLimit && used > limit;
  const nearLimit = hasNumericLimit && rawPct >= 80;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">{label}</span>
        <span
          className={`text-xs ${overLimit ? "font-semibold text-red-600" : nearLimit ? "text-amber-600" : "text-gray-400"}`}
        >
          {hasNumericLimit ? `${used} / ${limit}` : `${used} / Unlimited`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all ${
            overLimit
              ? "bg-red-600"
              : nearLimit
                ? "bg-amber-500"
                : "bg-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function getOverLimitItems(plan: BillingPlanSnapshot) {
  return [
    { label: "Pages", used: plan.usage.pages, limit: plan.limits.pages },
    { label: "Locales", used: plan.usage.locales, limit: plan.limits.locales },
    {
      label: "Form submissions",
      used: plan.usage.formSubmissions,
      limit: plan.limits.formSubmissions,
    },
    { label: "Sites", used: plan.usage.sites, limit: plan.limits.sites },
    { label: "Seats", used: plan.usage.seats, limit: plan.limits.seats },
  ].filter(
    (item): item is { label: string; used: number; limit: number } =>
      typeof item.limit === "number" && item.used > item.limit,
  );
}

function getNearLimitItems(plan: BillingPlanSnapshot) {
  return [
    { label: "Pages", used: plan.usage.pages, limit: plan.limits.pages },
    { label: "Locales", used: plan.usage.locales, limit: plan.limits.locales },
    {
      label: "Form submissions",
      used: plan.usage.formSubmissions,
      limit: plan.limits.formSubmissions,
    },
    { label: "Sites", used: plan.usage.sites, limit: plan.limits.sites },
    { label: "Seats", used: plan.usage.seats, limit: plan.limits.seats },
  ].filter(
    (item): item is { label: string; used: number; limit: number } =>
      typeof item.limit === "number" &&
      item.used <= item.limit &&
      item.limit > 0 &&
      item.used / item.limit >= 0.8,
  );
}
