import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertOctagon,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CreditCard,
  ExternalLink,
  History,
  Pencil,
  Pin,
  PinOff,
  RefreshCw,
  ShieldAlert,
  StickyNote,
  Trash2,
} from "lucide-react";
import type {
  BillingAccountDetailResponse,
  BillingActionRequest,
  BillingActionType,
  BillingEntitlementOverrideRow,
  BillingInvoiceSnapshotRow,
  BillingOperatorNoteRow,
  BillingPlanCatalogEntry,
} from "../api/operator";
import {
  cancelBillingAtPeriodEnd,
  cancelPendingBillingPlanChange,
  changeBillingPlan,
  createBillingNote,
  deleteBillingNote,
  extendBillingGracePeriod,
  fetchBillingAccount,
  fetchBillingPlans,
  reactivateBillingSubscription,
  requestBillingCredit,
  requestBillingOverride,
  requestBillingOverrideRevoke,
  requestBillingRefund,
  syncBillingFromStripe,
  updateBillingNote,
} from "../api/operator";
import {
  OPERATOR_PERMISSIONS,
  PermissionButton,
  usePermissions,
} from "../permissions";
import { ReasonModal } from "../components/ReasonModal";
import { DataFreshness } from "../components/DataFreshness";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { StatusBadge, billingStatusTone } from "../components/StatusBadge";
import {
  BILLING_ACTION_STATUS_LABELS,
  BILLING_ACTION_TYPE_LABELS,
  HIGH_RISK_ACTION_TYPES,
  billingActionStatusTone,
  formatCurrencyMinor,
  formatDate,
  formatDateTime,
  formatPlanLabel,
  stripeCustomerUrl,
  stripeInvoiceUrl,
  stripeSubscriptionUrl,
} from "../lib/billing";
import { extractErrorMessage } from "../lib/errors";

type ModalKind =
  | { kind: "change-plan"; targetPlanKey: string }
  | { kind: "cancel-pending-plan" }
  | { kind: "cancel-at-period-end" }
  | { kind: "reactivate" }
  | { kind: "grace"; until: string }
  | { kind: "sync" }
  | { kind: "refund"; invoiceId: string; amount: string }
  | { kind: "credit"; amount: string; currency: string }
  | {
      kind: "override-create";
      limitKey: string;
      valueMode: "int" | "json";
      intValue: string;
      jsonValue: string;
      expiresAt: string;
    }
  | { kind: "override-revoke"; overrideId: string }
  | null;

/**
 * Phase 8 — Billing Account Detail. Surfaces the full operator-facing view
 * of a tenant's billing posture (snapshot, invoices, payments, notes,
 * overrides, recent action requests, pending approvals) and offers every
 * billing mutation supported by the backend. Every sensitive mutation
 * captures a reason ≥ 8 chars and is recorded as a `BillingActionRequest`.
 */
export default function BillingAccountDetailPage() {
  const { tenantId = "" } = useParams<{ tenantId: string }>();
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const [modal, setModal] = useState<ModalKind>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    kind: "ok" | "warn" | "error";
    text: string;
  } | null>(null);

  const detailQuery = useQuery({
    queryKey: ["operator-billing-account", tenantId],
    queryFn: () => fetchBillingAccount(tenantId),
    enabled: tenantId.length > 0,
    staleTime: 15_000,
  });

  const plansQuery = useQuery({
    queryKey: ["operator-billing-plans"],
    queryFn: fetchBillingPlans,
    staleTime: 5 * 60_000,
  });

  const onMutationDone = (
    action: BillingActionRequest,
    successText: string,
  ) => {
    queryClient.invalidateQueries({
      queryKey: ["operator-billing-account", tenantId],
    });
    queryClient.invalidateQueries({
      queryKey: ["operator-billing-overview"],
    });
    if (action.status === "PENDING_APPROVAL") {
      setToast({
        kind: "warn",
        text: "Pending approval — submitted to the approval queue.",
      });
    } else {
      setToast({ kind: "ok", text: successText });
    }
    setModal(null);
    setModalError(null);
  };

  const onMutationError = (err: unknown) =>
    setModalError(extractErrorMessage(err));

  // ─── Mutations ────────────────────────────────────────────────────────

  const changePlanMutation = useMutation({
    mutationFn: (vars: { targetPlanKey: string; reason: string }) =>
      changeBillingPlan(tenantId, vars),
    onSuccess: (res) => onMutationDone(res.action, "Plan change executed."),
    onError: onMutationError,
  });

  const cancelPendingMutation = useMutation({
    mutationFn: (vars: { reason: string }) =>
      cancelPendingBillingPlanChange(tenantId, vars),
    onSuccess: (res) =>
      onMutationDone(res.action, "Pending plan change cancelled."),
    onError: onMutationError,
  });

  const cancelAtEndMutation = useMutation({
    mutationFn: (vars: { reason: string }) =>
      cancelBillingAtPeriodEnd(tenantId, vars),
    onSuccess: (res) =>
      onMutationDone(res.action, "Subscription will cancel at period end."),
    onError: onMutationError,
  });

  const reactivateMutation = useMutation({
    mutationFn: (vars: { reason: string }) =>
      reactivateBillingSubscription(tenantId, vars),
    onSuccess: (res) => onMutationDone(res.action, "Subscription reactivated."),
    onError: onMutationError,
  });

  const graceMutation = useMutation({
    mutationFn: (vars: { until: string; reason: string }) =>
      extendBillingGracePeriod(tenantId, vars),
    onSuccess: (res) => onMutationDone(res.action, "Grace period extended."),
    onError: onMutationError,
  });

  const syncMutation = useMutation({
    mutationFn: (vars: { reason: string }) =>
      syncBillingFromStripe(tenantId, vars),
    onSuccess: (res) =>
      onMutationDone(res.action, "Sync from Stripe complete."),
    onError: onMutationError,
  });

  const refundMutation = useMutation({
    mutationFn: (vars: {
      invoiceProviderId: string;
      amount?: number | null;
      reason: string;
    }) =>
      requestBillingRefund(tenantId, vars.invoiceProviderId, {
        amount: vars.amount,
        reason: vars.reason,
      }),
    onSuccess: (action) => onMutationDone(action, "Refund queued."),
    onError: onMutationError,
  });

  const creditMutation = useMutation({
    mutationFn: (vars: { amount: number; currency: string; reason: string }) =>
      requestBillingCredit(tenantId, vars),
    onSuccess: (action) => onMutationDone(action, "Credit queued."),
    onError: onMutationError,
  });

  const overrideCreateMutation = useMutation({
    mutationFn: (vars: {
      limitKey: string;
      intValue?: number | null;
      jsonValue?: Record<string, unknown> | null;
      expiresAt?: string;
      reason: string;
    }) => requestBillingOverride(tenantId, vars),
    onSuccess: (action) =>
      onMutationDone(action, "Override request submitted."),
    onError: onMutationError,
  });

  const overrideRevokeMutation = useMutation({
    mutationFn: (vars: { overrideId: string; reason: string }) =>
      requestBillingOverrideRevoke(tenantId, vars.overrideId, {
        reason: vars.reason,
      }),
    onSuccess: (action) =>
      onMutationDone(action, "Override revoke request submitted."),
    onError: onMutationError,
  });

  const detail = detailQuery.data;

  if (detailQuery.isLoading || !detail) {
    return (
      <div className="px-8 py-8">
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (detailQuery.isError) {
    return (
      <div className="px-8 py-8">
        <EmptyState
          icon={<AlertOctagon className="h-6 w-6" />}
          title="Failed to load billing account"
          description={extractErrorMessage(detailQuery.error)}
        />
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/billing/accounts"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-800 text-slate-400 hover:text-white"
            aria-label="Back to accounts"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <CreditCard className="h-5 w-5 text-cyan-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">
              {detail.tenant.name}
            </h1>
            <p className="text-xs text-slate-400">
              <Link
                to={`/tenants/${detail.tenant.id}`}
                className="hover:text-cyan-300"
              >
                {detail.tenant.slug}
              </Link>
              <span className="mx-2">·</span>
              <span className="font-mono text-[10px]">{detail.tenant.id}</span>
            </p>
          </div>
        </div>
        <DataFreshness generatedAt={new Date().toISOString()} />
      </header>

      {toast ? (
        <div
          className={[
            "mt-4 rounded-xl border px-4 py-2 text-xs",
            toast.kind === "ok"
              ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
              : toast.kind === "warn"
                ? "border-amber-700 bg-amber-950/40 text-amber-200"
                : "border-rose-700 bg-rose-950/40 text-rose-200",
          ].join(" ")}
        >
          {toast.text}
        </div>
      ) : null}

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <SnapshotCard detail={detail} />
        <ActionBar
          detail={detail}
          openModal={setModal}
          permissions={permissions}
        />
        <PendingActionsCard detail={detail} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <LimitsUsageCard detail={detail} />
        <SupportCasesCard detail={detail} />
      </section>

      <section className="mt-6">
        <InvoicesCard
          detail={detail}
          onRefundClick={(invoiceId) =>
            setModal({ kind: "refund", invoiceId, amount: "" })
          }
          canRefund={permissions.can(
            OPERATOR_PERMISSIONS.BILLING_INVOICE_REFUND_ALL,
          )}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <PaymentsCard detail={detail} />
        <OverridesCard
          detail={detail}
          onCreate={() =>
            setModal({
              kind: "override-create",
              limitKey: "sites",
              valueMode: "int",
              intValue: "",
              jsonValue: "{}",
              expiresAt: "",
            })
          }
          onRevoke={(overrideId) =>
            setModal({ kind: "override-revoke", overrideId })
          }
          canManage={permissions.can(
            OPERATOR_PERMISSIONS.BILLING_ENTITLEMENT_OVERRIDE_ALL,
          )}
        />
      </section>

      <section className="mt-6">
        <NotesPanel
          tenantId={tenantId}
          notes={detail.notes}
          canManage={permissions.can(OPERATOR_PERMISSIONS.BILLING_NOTE_ALL)}
        />
      </section>

      <section className="mt-6">
        <RecentActionsCard detail={detail} />
      </section>

      {/* ─── Modals ────────────────────────────────────────────────── */}
      {modal?.kind === "change-plan" ? (
        <ReasonModal
          open
          title="Change subscription plan"
          description="Changing a plan immediately rebuilds the entitlements snapshot and notifies Stripe."
          confirmLabel="Change plan"
          minReasonLength={8}
          submitting={changePlanMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) =>
            changePlanMutation.mutateAsync({
              targetPlanKey: modal.targetPlanKey,
              reason,
            })
          }
          slotBefore={
            <PlanPicker
              plans={plansQuery.data ?? []}
              value={modal.targetPlanKey}
              currentPlanKey={detail.snapshot.planKey}
              onChange={(next) =>
                setModal({ kind: "change-plan", targetPlanKey: next })
              }
            />
          }
          extraInvalid={!modal.targetPlanKey}
        />
      ) : null}

      {modal?.kind === "cancel-pending-plan" ? (
        <ReasonModal
          open
          title="Cancel pending plan change"
          confirmLabel="Cancel pending change"
          confirmTone="danger"
          minReasonLength={8}
          submitting={cancelPendingMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) => cancelPendingMutation.mutateAsync({ reason })}
        />
      ) : null}

      {modal?.kind === "cancel-at-period-end" ? (
        <ReasonModal
          open
          title="Cancel at period end"
          description="Subscription will remain active until current_period_end, then end."
          confirmLabel="Cancel at period end"
          confirmTone="danger"
          minReasonLength={8}
          submitting={cancelAtEndMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) => cancelAtEndMutation.mutateAsync({ reason })}
        />
      ) : null}

      {modal?.kind === "reactivate" ? (
        <ReasonModal
          open
          title="Reactivate subscription"
          description="Clears cancel_at_period_end on the Stripe subscription."
          confirmLabel="Reactivate"
          minReasonLength={8}
          submitting={reactivateMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) => reactivateMutation.mutateAsync({ reason })}
        />
      ) : null}

      {modal?.kind === "grace" ? (
        <ReasonModal
          open
          title="Extend grace period"
          confirmLabel="Extend"
          minReasonLength={8}
          submitting={graceMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) => {
            const iso = new Date(modal.until).toISOString();
            return graceMutation.mutateAsync({ until: iso, reason });
          }}
          slotBefore={
            <label className="block text-xs text-slate-300">
              <span className="mb-1 block font-medium text-slate-200">
                Grace period until
              </span>
              <input
                type="datetime-local"
                required
                value={modal.until}
                onChange={(e) =>
                  setModal({ kind: "grace", until: e.target.value })
                }
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              />
            </label>
          }
          extraInvalid={
            !modal.until || new Date(modal.until).getTime() <= Date.now()
          }
        />
      ) : null}

      {modal?.kind === "sync" ? (
        <ReasonModal
          open
          title="Sync from Stripe"
          description="Re-fetches subscription, invoices, and customer state from Stripe."
          confirmLabel="Sync now"
          minReasonLength={8}
          submitting={syncMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) => syncMutation.mutateAsync({ reason })}
        />
      ) : null}

      {modal?.kind === "refund" ? (
        <ReasonModal
          open
          title="Request invoice refund"
          description="Refunds enter the approval queue. Amount is in minor units (cents); leave blank for a full refund."
          confirmLabel="Submit for approval"
          confirmTone="danger"
          highRisk
          highRiskToken="REFUND"
          minReasonLength={8}
          submitting={refundMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) => {
            const amount =
              modal.amount.trim() === "" ? null : Number(modal.amount);
            return refundMutation.mutateAsync({
              invoiceProviderId: modal.invoiceId,
              amount,
              reason,
            });
          }}
          slotBefore={
            <label className="block text-xs text-slate-300">
              <span className="mb-1 block font-medium text-slate-200">
                Amount (minor units)
              </span>
              <input
                type="number"
                min={1}
                step={1}
                placeholder="Leave empty for full refund"
                value={modal.amount}
                onChange={(e) =>
                  setModal({
                    kind: "refund",
                    invoiceId: modal.invoiceId,
                    amount: e.target.value,
                  })
                }
                className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100"
              />
            </label>
          }
          extraInvalid={
            modal.amount.trim() !== "" &&
            (!Number.isFinite(Number(modal.amount)) ||
              Number(modal.amount) <= 0)
          }
        />
      ) : null}

      {modal?.kind === "credit" ? (
        <ReasonModal
          open
          title="Issue credit"
          description="Credits are queued for approval. After approval, finance issues the credit note in Stripe manually."
          confirmLabel="Submit for approval"
          confirmTone="danger"
          highRisk
          highRiskToken="CREDIT"
          minReasonLength={8}
          submitting={creditMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) =>
            creditMutation.mutateAsync({
              amount: Number(modal.amount),
              currency: modal.currency.trim().toLowerCase(),
              reason,
            })
          }
          slotBefore={
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              <label>
                <span className="mb-1 block font-medium text-slate-200">
                  Amount (minor units)
                </span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={modal.amount}
                  onChange={(e) =>
                    setModal({
                      kind: "credit",
                      amount: e.target.value,
                      currency: modal.currency,
                    })
                  }
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                />
              </label>
              <label>
                <span className="mb-1 block font-medium text-slate-200">
                  Currency
                </span>
                <input
                  type="text"
                  maxLength={3}
                  required
                  value={modal.currency}
                  onChange={(e) =>
                    setModal({
                      kind: "credit",
                      amount: modal.amount,
                      currency: e.target.value,
                    })
                  }
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-sm uppercase text-slate-100"
                />
              </label>
            </div>
          }
          extraInvalid={
            !Number.isFinite(Number(modal.amount)) ||
            Number(modal.amount) <= 0 ||
            modal.currency.trim().length !== 3
          }
        />
      ) : null}

      {modal?.kind === "override-create" ? (
        <ReasonModal
          open
          title="Create entitlement override"
          description="Overrides require Platform Owner approval before they take effect."
          confirmLabel="Submit for approval"
          confirmTone="danger"
          highRisk
          highRiskToken="OVERRIDE"
          minReasonLength={8}
          submitting={overrideCreateMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) => {
            const expiresAt =
              modal.expiresAt.trim() === ""
                ? undefined
                : new Date(modal.expiresAt).toISOString();
            if (modal.valueMode === "int") {
              return overrideCreateMutation.mutateAsync({
                limitKey: modal.limitKey,
                intValue: Number(modal.intValue),
                expiresAt,
                reason,
              });
            }
            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(modal.jsonValue);
            } catch {
              setModalError("JSON value is not valid JSON.");
              throw new Error("invalid-json");
            }
            return overrideCreateMutation.mutateAsync({
              limitKey: modal.limitKey,
              jsonValue: parsed,
              expiresAt,
              reason,
            });
          }}
          slotBefore={
            <div className="space-y-2 text-xs text-slate-300">
              <label className="block">
                <span className="mb-1 block font-medium text-slate-200">
                  Limit key
                </span>
                <input
                  type="text"
                  required
                  value={modal.limitKey}
                  onChange={(e) =>
                    setModal({ ...modal, limitKey: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                />
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="value-mode"
                    checked={modal.valueMode === "int"}
                    onChange={() => setModal({ ...modal, valueMode: "int" })}
                    className="accent-cyan-500"
                  />
                  Integer
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="value-mode"
                    checked={modal.valueMode === "json"}
                    onChange={() => setModal({ ...modal, valueMode: "json" })}
                    className="accent-cyan-500"
                  />
                  JSON
                </label>
              </div>
              {modal.valueMode === "int" ? (
                <label className="block">
                  <span className="mb-1 block font-medium text-slate-200">
                    Integer value
                  </span>
                  <input
                    type="number"
                    required
                    value={modal.intValue}
                    onChange={(e) =>
                      setModal({ ...modal, intValue: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="mb-1 block font-medium text-slate-200">
                    JSON value
                  </span>
                  <textarea
                    required
                    rows={4}
                    value={modal.jsonValue}
                    onChange={(e) =>
                      setModal({ ...modal, jsonValue: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block font-medium text-slate-200">
                  Expires at (optional)
                </span>
                <input
                  type="datetime-local"
                  value={modal.expiresAt}
                  onChange={(e) =>
                    setModal({ ...modal, expiresAt: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                />
              </label>
            </div>
          }
          extraInvalid={
            modal.limitKey.trim().length === 0 ||
            (modal.valueMode === "int" &&
              (!Number.isFinite(Number(modal.intValue)) ||
                modal.intValue.trim() === "")) ||
            (modal.valueMode === "json" && modal.jsonValue.trim().length === 0)
          }
        />
      ) : null}

      {modal?.kind === "override-revoke" ? (
        <ReasonModal
          open
          title="Revoke entitlement override"
          description="Revocation requires Platform Owner approval before it takes effect."
          confirmLabel="Submit for approval"
          confirmTone="danger"
          highRisk
          highRiskToken="REVOKE"
          minReasonLength={8}
          submitting={overrideRevokeMutation.isPending}
          error={modalError}
          onCancel={() => {
            setModal(null);
            setModalError(null);
          }}
          onConfirm={(reason) =>
            overrideRevokeMutation.mutateAsync({
              overrideId: modal.overrideId,
              reason,
            })
          }
        />
      ) : null}
    </div>
  );
}

// ─── Cards ────────────────────────────────────────────────────────────

function SnapshotCard({ detail }: { detail: BillingAccountDetailResponse }) {
  const s = detail.snapshot;
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:col-span-2">
      <header className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <Building2 className="h-4 w-4 text-cyan-300" />
        Subscription snapshot
      </header>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        <Field label="Plan" value={formatPlanLabel(s.planKey)} />
        <Field
          label="Status"
          value={
            <StatusBadge status={s.status} tone={billingStatusTone(s.status)} />
          }
        />
        <Field label="Source" value={s.source} />
        <Field
          label="Current period start"
          value={formatDate(s.currentPeriodStart)}
        />
        <Field label="Renews at" value={formatDate(s.renewsAt)} />
        <Field
          label="Cancels at period end"
          value={s.cancelAtPeriodEnd ? "Yes" : "No"}
        />
        <Field
          label="Grace period ends"
          value={formatDate(s.gracePeriodEndsAt)}
        />
        <Field label="Last webhook" value={formatDateTime(s.lastWebhookAt)} />
        <Field
          label="Customer"
          value={
            s.providerCustomerId ? (
              <a
                href={stripeCustomerUrl(s.providerCustomerId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-300 hover:text-cyan-200"
              >
                {s.providerCustomerId.slice(0, 14)}…
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              "—"
            )
          }
        />
        <Field
          label="Subscription"
          value={
            s.providerSubscriptionId ? (
              <a
                href={stripeSubscriptionUrl(s.providerSubscriptionId)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-300 hover:text-cyan-200"
              >
                {s.providerSubscriptionId.slice(0, 14)}…
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              "—"
            )
          }
        />
        {s.pendingPlanChange ? (
          <Field
            label="Pending plan change"
            value={`${formatPlanLabel(s.pendingPlanChange.planKey)} @ ${formatDate(s.pendingPlanChange.effectiveAt)}`}
          />
        ) : null}
      </dl>
    </article>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-100">{value}</dd>
    </div>
  );
}

function ActionBar({
  detail,
  openModal,
  permissions,
}: {
  detail: BillingAccountDetailResponse;
  openModal: (m: ModalKind) => void;
  permissions: ReturnType<typeof usePermissions>;
}) {
  const s = detail.snapshot;
  const hasSubscription = Boolean(s.subscriptionId);
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <header className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <ShieldAlert className="h-4 w-4 text-amber-300" />
        Operator actions
      </header>
      <div className="mt-3 grid gap-2">
        <PermissionButton
          permission={OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CHANGE_PLAN_ALL}
          className="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          onClick={() => openModal({ kind: "change-plan", targetPlanKey: "" })}
        >
          Change plan
        </PermissionButton>
        {s.pendingPlanChange ? (
          <PermissionButton
            permission={
              OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CHANGE_PLAN_ALL
            }
            className="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-800 disabled:opacity-50"
            onClick={() => openModal({ kind: "cancel-pending-plan" })}
          >
            Cancel pending plan change
          </PermissionButton>
        ) : null}
        <PermissionButton
          permission={OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CANCEL_ALL}
          disabled={!hasSubscription || s.cancelAtPeriodEnd}
          className="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          onClick={() => openModal({ kind: "cancel-at-period-end" })}
        >
          Cancel at period end
        </PermissionButton>
        <PermissionButton
          permission={OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_CANCEL_ALL}
          disabled={!s.cancelAtPeriodEnd}
          className="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          onClick={() => openModal({ kind: "reactivate" })}
        >
          Reactivate subscription
        </PermissionButton>
        <PermissionButton
          permission={OPERATOR_PERMISSIONS.BILLING_GRACE_PERIOD_EXTEND_ALL}
          className="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          onClick={() => openModal({ kind: "grace", until: "" })}
        >
          Extend grace period
        </PermissionButton>
        <PermissionButton
          permission={OPERATOR_PERMISSIONS.BILLING_STRIPE_SYNC_ALL}
          className="rounded-md border border-slate-700 bg-slate-800/40 px-3 py-2 text-left text-xs text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          onClick={() => openModal({ kind: "sync" })}
        >
          <RefreshCw className="inline h-3 w-3 mr-1" />
          Sync from Stripe
        </PermissionButton>
        <PermissionButton
          permission={OPERATOR_PERMISSIONS.BILLING_CREDIT_ISSUE_ALL}
          className="rounded-md border border-rose-800 bg-rose-950/30 px-3 py-2 text-left text-xs text-rose-200 hover:bg-rose-950/50 disabled:opacity-50"
          onClick={() =>
            openModal({ kind: "credit", amount: "", currency: "usd" })
          }
        >
          Issue credit (approval required)
        </PermissionButton>
      </div>
      {!permissions.can(OPERATOR_PERMISSIONS.BILLING_SUBSCRIPTION_READ_ALL) ? (
        <p className="mt-3 text-[10px] text-slate-500">
          Some actions are gated by permissions you do not hold.
        </p>
      ) : null}
    </article>
  );
}

function PendingActionsCard({
  detail,
}: {
  detail: BillingAccountDetailResponse;
}) {
  const rows = detail.pendingActions;
  return (
    <article className="rounded-2xl border border-amber-800/60 bg-amber-950/20 p-5">
      <header className="flex items-center gap-2 text-sm font-semibold text-amber-200">
        <History className="h-4 w-4" />
        Pending approval ({rows.length})
      </header>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-amber-200/70">
          No actions awaiting approval for this account.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 text-xs">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-md border border-amber-800/60 bg-amber-950/40 p-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-amber-100">
                  {BILLING_ACTION_TYPE_LABELS[row.type] ?? row.type}
                </span>
                <span className="text-[10px] text-amber-200/70">
                  {formatDateTime(row.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-amber-100/80 line-clamp-2">
                {row.reason}
              </p>
              <Link
                to={`/billing/approvals?status=PENDING_APPROVAL`}
                className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-200 hover:text-amber-100"
              >
                Open in approvals
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function LimitsUsageCard({ detail }: { detail: BillingAccountDetailResponse }) {
  const limits = detail.snapshot.limits as Record<string, unknown>;
  const usage = detail.snapshot.usage as Record<string, unknown>;
  const keys = useMemo(() => {
    const merged = new Set<string>([
      ...Object.keys(limits),
      ...Object.keys(usage),
    ]);
    return Array.from(merged).sort();
  }, [limits, usage]);
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <header className="text-sm font-semibold text-slate-100">
        Limits & usage
      </header>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="text-left text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="py-1 pr-3">Key</th>
              <th className="py-1 pr-3">Limit</th>
              <th className="py-1">Usage</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {keys.map((key) => (
              <tr key={key}>
                <td className="py-1 pr-3 font-mono text-[11px] text-slate-300">
                  {key}
                </td>
                <td className="py-1 pr-3 text-slate-100">
                  {formatValue(limits[key])}
                </td>
                <td className="py-1 text-slate-100">
                  {formatValue(usage[key])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function formatValue(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return value.toLocaleString();
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function SupportCasesCard({
  detail,
}: {
  detail: BillingAccountDetailResponse;
}) {
  const cases = detail.supportCases;
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <header className="text-sm font-semibold text-slate-100">
        Recent support cases
      </header>
      {cases.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No support cases.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-xs">
          {cases.map((c) => (
            <li
              key={c.id}
              className="rounded-md border border-slate-800 bg-slate-950/60 p-2"
            >
              <Link
                to={`/support/${c.id}`}
                className="block font-medium text-slate-100 hover:text-cyan-300"
              >
                {c.subject}
              </Link>
              <p className="mt-1 text-[10px] text-slate-500">
                {c.status} · {c.priority} · {formatDateTime(c.updatedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function InvoicesCard({
  detail,
  onRefundClick,
  canRefund,
}: {
  detail: BillingAccountDetailResponse;
  onRefundClick: (invoiceId: string) => void;
  canRefund: boolean;
}) {
  const invoices = detail.invoices;
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900">
      <header className="border-b border-slate-800 px-5 py-3 text-sm font-semibold text-slate-100">
        Invoices ({invoices.length})
      </header>
      {invoices.length === 0 ? (
        <EmptyState
          title="No invoices"
          description="This tenant has no synced Stripe invoices yet."
        />
      ) : (
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="text-left text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-5 py-2 font-semibold">Invoice</th>
              <th className="px-5 py-2 font-semibold">Status</th>
              <th className="px-5 py-2 font-semibold">Period</th>
              <th className="px-5 py-2 font-semibold text-right">Paid</th>
              <th className="px-5 py-2 font-semibold text-right">Remaining</th>
              <th className="px-5 py-2 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {invoices.map((inv) => (
              <InvoiceRow
                key={inv.id}
                inv={inv}
                onRefundClick={onRefundClick}
                canRefund={canRefund}
              />
            ))}
          </tbody>
        </table>
      )}
    </article>
  );
}

function InvoiceRow({
  inv,
  onRefundClick,
  canRefund,
}: {
  inv: BillingInvoiceSnapshotRow;
  onRefundClick: (invoiceId: string) => void;
  canRefund: boolean;
}) {
  const canRefundThis =
    canRefund && inv.amountPaid > 0 && inv.status !== "void";
  return (
    <tr className="hover:bg-slate-800/40">
      <td className="px-5 py-2">
        <a
          href={stripeInvoiceUrl(inv.providerInvoiceId)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[11px] text-cyan-300 hover:text-cyan-200"
        >
          {inv.number ?? inv.providerInvoiceId.slice(0, 16)}…
          <ExternalLink className="h-3 w-3" />
        </a>
      </td>
      <td className="px-5 py-2 text-slate-300">{inv.status}</td>
      <td className="px-5 py-2 text-[11px] text-slate-400">
        {formatDate(inv.periodStart)} → {formatDate(inv.periodEnd)}
      </td>
      <td className="px-5 py-2 text-right text-slate-100">
        {formatCurrencyMinor(inv.amountPaid, inv.currency)}
      </td>
      <td className="px-5 py-2 text-right text-slate-300">
        {formatCurrencyMinor(inv.amountRemaining, inv.currency)}
      </td>
      <td className="px-5 py-2 text-right">
        <button
          type="button"
          disabled={!canRefundThis}
          onClick={() => onRefundClick(inv.providerInvoiceId)}
          className="rounded-md border border-rose-800 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-950/50 disabled:opacity-50"
          title={
            canRefundThis
              ? "Submit refund for approval"
              : "Refund not available"
          }
        >
          Refund
        </button>
      </td>
    </tr>
  );
}

function PaymentsCard({ detail }: { detail: BillingAccountDetailResponse }) {
  const payments = detail.payments;
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <header className="text-sm font-semibold text-slate-100">
        Payment events ({payments.length})
      </header>
      {payments.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No payment events yet.</p>
      ) : (
        <ol className="mt-3 space-y-2 text-xs">
          {payments.map((p) => (
            <li
              key={p.id}
              className="rounded-md border border-slate-800 bg-slate-950/40 p-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-100">{p.kind}</span>
                <span className="text-[10px] text-slate-500">
                  {formatDateTime(p.occurredAt)}
                </span>
              </div>
              <p className="text-slate-300">
                {formatCurrencyMinor(p.amount, p.currency)} · {p.status}
              </p>
              {p.failureMessage ? (
                <p className="mt-1 text-rose-300">{p.failureMessage}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

function OverridesCard({
  detail,
  onCreate,
  onRevoke,
  canManage,
}: {
  detail: BillingAccountDetailResponse;
  onCreate: () => void;
  onRevoke: (id: string) => void;
  canManage: boolean;
}) {
  const overrides = detail.overrides;
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <header className="flex items-center justify-between text-sm font-semibold text-slate-100">
        <span>Entitlement overrides ({overrides.length})</span>
        <PermissionButton
          permission={OPERATOR_PERMISSIONS.BILLING_ENTITLEMENT_OVERRIDE_ALL}
          onClick={onCreate}
          className="rounded-md border border-rose-800 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-950/50 disabled:opacity-50"
        >
          Request override
        </PermissionButton>
      </header>
      {overrides.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No active overrides.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-xs">
          {overrides.map((o) => (
            <OverrideRow
              key={o.id}
              o={o}
              canManage={canManage}
              onRevoke={onRevoke}
            />
          ))}
        </ul>
      )}
    </article>
  );
}

function OverrideRow({
  o,
  canManage,
  onRevoke,
}: {
  o: BillingEntitlementOverrideRow;
  canManage: boolean;
  onRevoke: (id: string) => void;
}) {
  return (
    <li className="rounded-md border border-slate-800 bg-slate-950/40 p-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-slate-100">
          {o.limitKey}
        </span>
        <span className="text-[10px] text-slate-500">
          {formatDateTime(o.createdAt)}
        </span>
      </div>
      <p className="text-slate-300">
        {o.intValue != null ? o.intValue : JSON.stringify(o.jsonValue)}
        {o.expiresAt ? ` · until ${formatDate(o.expiresAt)}` : ""}
      </p>
      <p className="text-[10px] text-slate-500">{o.reason}</p>
      {canManage && !o.revokedAt ? (
        <button
          type="button"
          onClick={() => onRevoke(o.id)}
          className="mt-1 text-[11px] text-rose-300 hover:text-rose-200"
        >
          Request revoke
        </button>
      ) : null}
    </li>
  );
}

function NotesPanel({
  tenantId,
  notes,
  canManage,
}: {
  tenantId: string;
  notes: BillingOperatorNoteRow[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: ["operator-billing-account", tenantId],
    });

  const createMutation = useMutation({
    mutationFn: () =>
      createBillingNote(tenantId, { body: body.trim(), pinned }),
    onSuccess: () => {
      setBody("");
      setPinned(false);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { noteId: string; body?: string; pinned?: boolean }) =>
      updateBillingNote(tenantId, vars.noteId, {
        body: vars.body,
        pinned: vars.pinned,
      }),
    onSuccess: () => {
      setEditingId(null);
      setEditingBody("");
      invalidate();
    },
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (noteId: string) => deleteBillingNote(tenantId, noteId),
    onSuccess: () => invalidate(),
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const ordered = useMemo(() => {
    return [...notes].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [notes]);

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <header className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <StickyNote className="h-4 w-4 text-cyan-300" />
        Operator notes ({notes.length})
      </header>
      {error ? (
        <div className="mt-3 rounded-md border border-rose-700 bg-rose-950/40 px-2 py-1 text-xs text-rose-200">
          {error}
        </div>
      ) : null}
      {canManage ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim().length < 2) return;
            createMutation.mutate();
          }}
          className="mt-3 space-y-2"
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note (min 2 chars, max 4000)…"
            rows={2}
            maxLength={4000}
            className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-100"
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1 text-[11px] text-slate-300">
              <input
                type="checkbox"
                checked={pinned}
                onChange={(e) => setPinned(e.target.checked)}
                className="accent-cyan-500"
              />
              Pin
            </label>
            <button
              type="submit"
              disabled={body.trim().length < 2 || createMutation.isPending}
              className="rounded-md border border-cyan-600 bg-cyan-600/20 px-2 py-1 text-[11px] text-cyan-100 hover:bg-cyan-600/40 disabled:opacity-50"
            >
              Add note
            </button>
          </div>
        </form>
      ) : null}
      {ordered.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No operator notes yet.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-xs">
          {ordered.map((note) => (
            <li
              key={note.id}
              className="rounded-md border border-slate-800 bg-slate-950/40 p-2"
            >
              {editingId === note.id ? (
                <div className="space-y-1">
                  <textarea
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                    rows={2}
                    maxLength={4000}
                    className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateMutation.mutate({
                          noteId: note.id,
                          body: editingBody,
                        })
                      }
                      disabled={
                        editingBody.trim().length < 2 ||
                        updateMutation.isPending
                      }
                      className="rounded-md border border-cyan-600 bg-cyan-600/20 px-2 py-1 text-[11px] text-cyan-100 hover:bg-cyan-600/40 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditingBody("");
                      }}
                      className="text-[11px] text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-slate-100">
                      {note.body}
                    </p>
                    {canManage ? (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          title={note.pinned ? "Unpin" : "Pin"}
                          onClick={() =>
                            updateMutation.mutate({
                              noteId: note.id,
                              pinned: !note.pinned,
                            })
                          }
                          className="text-slate-400 hover:text-slate-100"
                        >
                          {note.pinned ? (
                            <PinOff className="h-3 w-3" />
                          ) : (
                            <Pin className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          onClick={() => {
                            setEditingId(note.id);
                            setEditingBody(note.body);
                          }}
                          className="text-slate-400 hover:text-slate-100"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          onClick={() => {
                            if (
                              window.confirm(
                                "Delete this billing note? This cannot be undone.",
                              )
                            ) {
                              deleteMutation.mutate(note.id);
                            }
                          }}
                          className="text-rose-300 hover:text-rose-200"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {note.author?.email ?? "unknown"} ·{" "}
                    {formatDateTime(note.createdAt)}
                    {note.pinned ? " · pinned" : ""}
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function RecentActionsCard({
  detail,
}: {
  detail: BillingAccountDetailResponse;
}) {
  const rows = detail.recentActions;
  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900">
      <header className="border-b border-slate-800 px-5 py-3 text-sm font-semibold text-slate-100">
        Recent action requests ({rows.length})
      </header>
      {rows.length === 0 ? (
        <EmptyState
          title="No action history"
          description="Operator-initiated billing actions for this account will appear here."
        />
      ) : (
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="text-left text-[10px] uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-5 py-2 font-semibold">Action</th>
              <th className="px-5 py-2 font-semibold">Status</th>
              <th className="px-5 py-2 font-semibold">Reason</th>
              <th className="px-5 py-2 font-semibold">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/40">
                <td className="px-5 py-2 text-slate-200">
                  {BILLING_ACTION_TYPE_LABELS[row.type] ?? row.type}
                  {HIGH_RISK_ACTION_TYPES.has(row.type as BillingActionType) ? (
                    <span className="ml-2 inline-block rounded bg-rose-900/40 px-1 py-0.5 text-[9px] uppercase tracking-widest text-rose-200">
                      high risk
                    </span>
                  ) : null}
                </td>
                <td className="px-5 py-2">
                  <StatusBadge
                    status={BILLING_ACTION_STATUS_LABELS[row.status]}
                    tone={billingActionStatusTone(row.status)}
                  />
                </td>
                <td className="px-5 py-2 text-xs text-slate-300 line-clamp-2">
                  {row.reason}
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

function PlanPicker({
  plans,
  value,
  currentPlanKey,
  onChange,
}: {
  plans: BillingPlanCatalogEntry[];
  value: string;
  currentPlanKey: string;
  onChange: (next: string) => void;
}) {
  const payable = plans.filter((p) => !p.isFree);
  return (
    <label className="block text-xs text-slate-300">
      <span className="mb-1 block font-medium text-slate-200">Target plan</span>
      <select
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-sm text-slate-100"
      >
        <option value="">Select a plan…</option>
        {payable.map((p) => (
          <option key={p.key} value={p.key} disabled={p.key === currentPlanKey}>
            {p.name}
            {p.key === currentPlanKey ? " (current)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
