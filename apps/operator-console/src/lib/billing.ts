import type { BillingActionStatus, BillingActionType } from "../api/operator";

export const BILLING_ACTION_TYPE_LABELS: Record<BillingActionType, string> = {
  CHANGE_PLAN: "Change plan",
  CANCEL_PENDING_PLAN_CHANGE: "Cancel pending plan change",
  CANCEL_AT_PERIOD_END: "Cancel at period end",
  REACTIVATE_SUBSCRIPTION: "Reactivate subscription",
  EXTEND_GRACE_PERIOD: "Extend grace period",
  STRIPE_SYNC: "Sync from Stripe",
  STRIPE_WEBHOOK_REPLAY: "Replay webhook",
  REFUND_INVOICE: "Refund invoice",
  ISSUE_CREDIT: "Issue credit",
  ENTITLEMENT_OVERRIDE_CREATE: "Create entitlement override",
  ENTITLEMENT_OVERRIDE_REVOKE: "Revoke entitlement override",
};

export const BILLING_ACTION_STATUS_LABELS: Record<BillingActionStatus, string> =
  {
    PENDING_APPROVAL: "Pending approval",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    EXECUTED: "Executed",
    FAILED: "Failed",
    CANCELED: "Canceled",
  };

export function billingActionStatusTone(
  status: BillingActionStatus,
): "warn" | "info" | "ok" | "danger" | "muted" {
  switch (status) {
    case "PENDING_APPROVAL":
      return "warn";
    case "APPROVED":
      return "info";
    case "EXECUTED":
      return "ok";
    case "FAILED":
    case "REJECTED":
      return "danger";
    case "CANCELED":
    default:
      return "muted";
  }
}

export const BILLING_PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter_stay: "Starter Stay",
  boutique_growth: "Boutique Growth",
  portfolio: "Portfolio",
};

export function formatPlanLabel(planKey: string | null | undefined): string {
  if (!planKey) return "—";
  return BILLING_PLAN_LABELS[planKey] ?? planKey;
}

/**
 * Format a Stripe-style minor-unit amount (e.g. cents) into a localized
 * currency string. Stripe sends all amounts in the smallest unit of the
 * currency (e.g. cents for USD, but Yen has no minor unit).
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
]);

export function formatCurrencyMinor(
  amountMinor: number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amountMinor == null) return "—";
  const cur = (currency ?? "USD").toUpperCase();
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.has(cur);
  const major = isZeroDecimal ? amountMinor : amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: cur,
      minimumFractionDigits: isZeroDecimal ? 0 : 2,
      maximumFractionDigits: isZeroDecimal ? 0 : 2,
    }).format(major);
  } catch {
    return `${major.toFixed(isZeroDecimal ? 0 : 2)} ${cur}`;
  }
}

export function stripeCustomerUrl(customerId: string): string {
  return `https://dashboard.stripe.com/customers/${encodeURIComponent(
    customerId,
  )}`;
}

export function stripeSubscriptionUrl(subscriptionId: string): string {
  return `https://dashboard.stripe.com/subscriptions/${encodeURIComponent(
    subscriptionId,
  )}`;
}

export function stripeInvoiceUrl(invoiceId: string): string {
  return `https://dashboard.stripe.com/invoices/${encodeURIComponent(
    invoiceId,
  )}`;
}

export function formatDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return "—";
  }
}

export const HIGH_RISK_ACTION_TYPES = new Set<BillingActionType>([
  "REFUND_INVOICE",
  "ISSUE_CREDIT",
  "ENTITLEMENT_OVERRIDE_CREATE",
  "ENTITLEMENT_OVERRIDE_REVOKE",
]);
