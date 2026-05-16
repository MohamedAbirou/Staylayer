import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
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
  cancelPendingBillingPlanChange,
  createCheckoutSession,
  createPortalSession,
  getBillingPlan,
  isBillingPlanKey,
  listBillingPlans,
  updateBillingPlan,
  type BillingPlanKey,
  type BillingPlanCatalogEntry,
  type BillingPlanSnapshot,
  type BillingPlanStatus,
} from "../api/billing";
import { formatDate } from "../lib/formatDate";

const BILLING_PLAN_ORDER: readonly BillingPlanKey[] = [
  "free",
  "starter_stay",
  "boutique_growth",
  "portfolio",
] as const;

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
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = session?.activeTenant?.id ?? null;
  const canViewBilling = hasMembershipRole(session, BILLING_MEMBERSHIP_ROLES);
  const [selectedPlanKey, setSelectedPlanKey] = useState<BillingPlanKey | null>(
    null,
  );
  const [checkoutConfirmOpen, setCheckoutConfirmOpen] = useState(false);
  const [planChangeConfirmOpen, setPlanChangeConfirmOpen] = useState(false);
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

  const {
    data: plans = [],
    isLoading: plansLoading,
    isError: plansError,
  } = useQuery({
    queryKey: ["billing-plans", tenantId],
    queryFn: () => listBillingPlans(tenantId!),
    enabled: Boolean(tenantId && canViewBilling),
    retry: false,
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
      const targetPlanKey = getPaidPlanSelection(selectedPlanKey, plans, plan);

      if (!targetPlanKey) {
        throw new Error("Choose a paid plan before starting checkout");
      }

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

  const planChangeMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !plan) {
        throw new Error("Select a tenant workspace before changing plans");
      }

      const targetPlanKey = getPaidPlanSelection(selectedPlanKey, plans, plan);

      if (!targetPlanKey) {
        throw new Error("Choose a paid plan before changing plans");
      }

      return updateBillingPlan(tenantId, { planKey: targetPlanKey });
    },
    onSuccess: async (updatedPlan) => {
      setPlanChangeConfirmOpen(false);
      setSelectedPlanKey(updatedPlan.planKey);
      await queryClient.invalidateQueries({ queryKey: ["billing", tenantId] });
      toast.success(`Plan changed to ${updatedPlan.planName}`);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ??
        "Unable to change the subscription plan for this workspace.";
      toast.error(message);
    },
  });

  const cancelPendingChangeMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId) {
        throw new Error("Select a tenant workspace before updating billing");
      }

      return cancelPendingBillingPlanChange(tenantId);
    },
    onSuccess: async (updatedPlan) => {
      setSelectedPlanKey(updatedPlan.planKey);
      await queryClient.invalidateQueries({ queryKey: ["billing", tenantId] });
      toast.success("Scheduled plan change canceled");
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? "Unable to cancel the scheduled plan change.";
      toast.error(message);
    },
  });

  const checkoutAllowed = plan ? canStartCheckout(plan) : false;
  const planChangeAllowed = plan ? canChangePlan(plan) : false;

  useEffect(() => {
    if (!plan || plans.length === 0) {
      return;
    }

    const defaultSelection = getDefaultPlanSelection(plan, plans);

    setSelectedPlanKey((current) => {
      if (
        current &&
        current !== "free" &&
        plans.some((catalogPlan) => catalogPlan.key === current)
      ) {
        return current;
      }

      return defaultSelection;
    });
  }, [plan, plans]);

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
    if (!plan || !requestedPlan || !checkoutIntentKey) {
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
    if (checkoutAllowed) {
      setCheckoutConfirmOpen(true);
      return;
    }

    const requestedCatalogPlan = plans.find(
      (catalogPlan) => catalogPlan.key === requestedPlan,
    );

    if (
      planChangeAllowed &&
      requestedPlan !== plan.planKey &&
      !requestedCatalogPlan?.isFree
    ) {
      setPlanChangeConfirmOpen(true);
    }
  }, [
    checkoutAllowed,
    checkoutIntentKey,
    plan,
    planChangeAllowed,
    plans,
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

  if (isError || plansError) {
    return (
      <div className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
        <div className="flex items-start gap-3 text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h1 className="text-xl font-bold">
              Billing details could not be refreshed
            </h1>
            <p className="mt-2 text-sm">
              Retry this live check before making a plan decision for the active
              hospitality workspace.
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

  if (isLoading || plansLoading || !plan) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-10 text-sm text-gray-500 shadow-sm">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        Loading billing details…
      </div>
    );
  }

  const { label, color } = STATUS_META[plan.status];
  const manageBillingAllowed =
    plan.source === "stripe" && !!plan.providerCustomerId;
  const overLimitItems = getOverLimitItems(plan);
  const nearLimitItems = getNearLimitItems(plan);
  const selectedPlanKeyForAction =
    getPaidPlanSelection(selectedPlanKey, plans, plan) ?? plan.planKey;
  const selectedPlan = plans.find(
    (entry) => entry.key === selectedPlanKeyForAction,
  );
  const selectedPlanIsCurrent = selectedPlan?.key === plan.planKey;
  const selectedPlanChangeDirection = selectedPlan
    ? getPlanChangeDirection(plan.planKey, selectedPlan.key)
    : "same";
  const pendingChange = plan.pendingPlanChange;
  const selectedPlanCheckoutEnabled = selectedPlan?.checkoutEnabled !== false;
  const canSubmitCheckout =
    checkoutAllowed &&
    selectedPlan &&
    !selectedPlan.isFree &&
    selectedPlanCheckoutEnabled;
  const canSubmitPlanChange =
    planChangeAllowed &&
    selectedPlan &&
    !selectedPlan.isFree &&
    !selectedPlanIsCurrent &&
    selectedPlanCheckoutEnabled;
  const planChangeConfirmTitle =
    selectedPlanChangeDirection === "downgrade"
      ? "Schedule downgrade?"
      : "Upgrade subscription now?";
  const planChangeConfirmMessage =
    selectedPlanChangeDirection === "downgrade"
      ? `You are scheduling ${session?.activeTenant?.name} to move from ${plan.planName} to ${selectedPlan?.name ?? "the selected plan"} at renewal. Current limits stay available until ${plan.renewsAt ? formatDate(plan.renewsAt) : "the current period ends"}, and Stripe will not create an immediate downgrade invoice.`
      : `You are upgrading ${session?.activeTenant?.name} from ${plan.planName} to ${selectedPlan?.name ?? "the selected plan"}. Stripe will immediately invoice the prorated difference and the plan only changes if payment succeeds.`;

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

      {pendingChange && (
        <StatusBanner
          icon={Clock}
          tone="info"
          title={`${pendingChange.planName} scheduled`}
          message={`${plan.planName} remains active until ${formatDate(pendingChange.effectiveAt)}. The scheduled downgrade starts at renewal, with no immediate credit or $0 invoice.`}
          action={
            <button
              type="button"
              onClick={() => cancelPendingChangeMutation.mutate()}
              disabled={cancelPendingChangeMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
            >
              {cancelPendingChangeMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Keep current plan
            </button>
          }
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

      {plans.length > 0 && (
        <>
          <PlanSelector
            plans={plans}
            currentPlanKey={plan.planKey}
            pendingPlanKey={pendingChange?.planKey ?? null}
            selected={selectedPlanKeyForAction}
            onSelect={setSelectedPlanKey}
          />

          {(checkoutAllowed || planChangeAllowed || manageBillingAllowed) && (
            <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedPlan
                    ? selectedPlanIsCurrent
                      ? `${selectedPlan.name} is your current plan`
                      : selectedPlanChangeDirection === "downgrade"
                        ? `Schedule downgrade to ${selectedPlan.name}`
                        : `Upgrade to ${selectedPlan.name}`
                    : "Choose a paid plan"}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {planChangeAllowed
                    ? selectedPlanChangeDirection === "downgrade"
                      ? "Downgrades take effect at renewal so customers keep paid access for the full period and avoid confusing $0 invoices."
                      : "Upgrades apply immediately. Stripe invoices the prorated difference and the plan changes only if payment succeeds."
                    : "Choose a paid hospitality plan before opening Stripe Checkout."}
                </p>
              </div>

              {checkoutAllowed ? (
                <button
                  type="button"
                  onClick={() => setCheckoutConfirmOpen(true)}
                  disabled={checkoutMutation.isPending || !canSubmitCheckout}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkoutMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Start subscription
                </button>
              ) : planChangeAllowed ? (
                <button
                  type="button"
                  onClick={() => setPlanChangeConfirmOpen(true)}
                  disabled={
                    planChangeMutation.isPending || !canSubmitPlanChange
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {planChangeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  {selectedPlanChangeDirection === "downgrade"
                    ? "Schedule downgrade"
                    : "Upgrade now"}
                </button>
              ) : manageBillingAllowed ? (
                <button
                  type="button"
                  onClick={() => portalMutation.mutate()}
                  disabled={portalMutation.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {portalMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Manage billing
                </button>
              ) : null}
            </div>
          )}
        </>
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

      <ConfirmDialog
        open={planChangeConfirmOpen}
        title={planChangeConfirmTitle}
        message={planChangeConfirmMessage}
        confirmLabel={
          selectedPlanChangeDirection === "downgrade"
            ? "Schedule downgrade"
            : "Upgrade now"
        }
        isPending={planChangeMutation.isPending}
        onConfirm={() => planChangeMutation.mutate()}
        onCancel={() => setPlanChangeConfirmOpen(false)}
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

function canChangePlan(plan: BillingPlanSnapshot): boolean {
  return (
    plan.source === "stripe" &&
    Boolean(plan.providerSubscriptionId) &&
    ["active", "trialing"].includes(plan.status)
  );
}

function getPlanChangeDirection(
  currentPlanKey: BillingPlanKey,
  selectedPlanKey: BillingPlanKey,
): "upgrade" | "downgrade" | "same" {
  const currentRank = BILLING_PLAN_ORDER.indexOf(currentPlanKey);
  const selectedRank = BILLING_PLAN_ORDER.indexOf(selectedPlanKey);

  if (selectedRank > currentRank) {
    return "upgrade";
  }

  if (selectedRank < currentRank) {
    return "downgrade";
  }

  return "same";
}

function getDefaultPlanSelection(
  plan: BillingPlanSnapshot,
  plans: BillingPlanCatalogEntry[],
): BillingPlanKey {
  const paidPlans = plans.filter(
    (entry) => !entry.isFree && entry.checkoutEnabled !== false,
  );

  if (plan.source === "stripe") {
    const currentPaidPlan = paidPlans.find(
      (entry) => entry.key === plan.planKey,
    );
    if (currentPaidPlan) {
      return currentPaidPlan.key;
    }
  }

  return paidPlans[0]?.key ?? plan.planKey;
}

function getPaidPlanSelection(
  selectedPlanKey: BillingPlanKey | null,
  plans: BillingPlanCatalogEntry[],
  plan: BillingPlanSnapshot,
): BillingPlanKey | null {
  const selectedPlan = selectedPlanKey
    ? plans.find((entry) => entry.key === selectedPlanKey)
    : null;

  if (
    selectedPlan &&
    !selectedPlan.isFree &&
    selectedPlan.checkoutEnabled !== false
  ) {
    return selectedPlan.key;
  }

  const defaultPlanKey = getDefaultPlanSelection(plan, plans);
  const defaultPlan = plans.find((entry) => entry.key === defaultPlanKey);

  return defaultPlan &&
    !defaultPlan.isFree &&
    defaultPlan.checkoutEnabled !== false
    ? defaultPlan.key
    : null;
}

function PlanSelector({
  plans,
  currentPlanKey,
  pendingPlanKey,
  selected,
  onSelect,
}: {
  plans: BillingPlanCatalogEntry[];
  currentPlanKey: BillingPlanKey;
  pendingPlanKey: BillingPlanKey | null;
  selected: BillingPlanKey;
  onSelect: (key: BillingPlanKey) => void;
}) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-blue-900">
          Choose your hospitality plan
        </p>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700">
          Live plans
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.key === currentPlanKey;
          const isPending = p.key === pendingPlanKey;
          const isSelected = selected === p.key;
          const disabled = p.isFree || p.checkoutEnabled === false;

          return (
            <button
              key={p.key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(p.key)}
              className={`rounded-lg border-2 p-4 text-left transition-colors ${
                isSelected
                  ? "border-blue-600 bg-white shadow-sm"
                  : "border-transparent bg-white hover:border-blue-300"
              } disabled:cursor-not-allowed disabled:opacity-75`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">{p.name}</p>
                {isCurrent ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                    Current
                  </span>
                ) : isPending ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    Scheduled
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-gray-500">{p.description}</p>
              {p.checkoutEnabled === false ? (
                <p className="mt-2 text-xs font-semibold text-amber-700">
                  Checkout is not available for this plan.
                </p>
              ) : null}
              <p className="mt-3 text-xs font-medium text-gray-600">
                {formatPlanHighlights(p)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatPlanHighlights(plan: BillingPlanCatalogEntry): string {
  return [
    pluralize(plan.limits.sites, "site"),
    pluralize(plan.limits.locales, "language"),
    pluralize(plan.limits.seats, "seat"),
    `${plan.limits.formSubmissions.toLocaleString()} inquiries/mo`,
    plan.limits.domains > 0
      ? pluralize(plan.limits.domains, "domain")
      : "No custom domains",
  ].join(" · ");
}

function pluralize(count: number, singular: string): string {
  return `${count.toLocaleString()} ${singular}${count === 1 ? "" : "s"}`;
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
