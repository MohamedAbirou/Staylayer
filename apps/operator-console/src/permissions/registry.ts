// Operator permission registry. Mirrors the backend
// `apps/api/src/auth/operator/permissions/operator-permissions.registry.ts`.
// Permission keys follow the pattern `resource.action.scope` so future
// scoping (e.g. `tenant.update.region:eu`) can be introduced without
// reshaping consumers.
//
// IMPORTANT: this file is the single source of truth for permission keys
// inside the operator console. Backend and frontend constant lists MUST be
// kept in sync — any change here must be reflected in the backend registry
// and vice-versa. The backend remains the only authority that grants or
// denies access; this list is used purely for UI gating.

export const OPERATOR_PERMISSIONS = {
  // Command center / overview surfaces
  OVERVIEW_READ_ALL: "overview.read.all",
  OVERVIEW_READ_SUPPORT: "overview.read.support",
  OVERVIEW_READ_BILLING: "overview.read.billing",

  // Tenants
  TENANT_READ_ALL: "tenant.read.all",
  TENANT_READ_BILLING: "tenant.read.billing",
  TENANT_LIST_ALL: "tenant.list.all",
  TENANT_UPDATE_ALL: "tenant.update.all",
  TENANT_SUSPEND_ALL: "tenant.suspend.all",
  TENANT_NOTE_ALL: "tenant.note.all",

  // Sites
  SITE_READ_ALL: "site.read.all",
  SITE_LIST_ALL: "site.list.all",
  SITE_RESTORE_ALL: "site.restore.all",
  SITE_DELETE_ALL: "site.delete.all",

  // Support cases
  SUPPORT_CASE_READ_ALL: "support_case.read.all",
  SUPPORT_CASE_READ_BILLING: "support_case.read.billing",
  SUPPORT_CASE_LIST_ALL: "support_case.list.all",
  SUPPORT_CASE_CREATE_ALL: "support_case.create.all",
  SUPPORT_CASE_ASSIGN_ALL: "support_case.assign.all",
  SUPPORT_CASE_REPLY_ALL: "support_case.reply.all",
  SUPPORT_CASE_REPLY_BILLING: "support_case.reply.billing",
  SUPPORT_CASE_NOTE_ALL: "support_case.note.all",
  SUPPORT_CASE_NOTE_BILLING: "support_case.note.billing",
  SUPPORT_CASE_RESOLVE_ALL: "support_case.resolve.all",
  SUPPORT_CASE_TRANSFER_ALL: "support_case.transfer.all",
  SUPPORT_CASE_IMPERSONATE_ALL: "support_case.impersonate.all",

  // Billing
  BILLING_ACCOUNT_READ_ALL: "billing.account.read.all",
  BILLING_ACCOUNT_READ_BASIC: "billing.account.read.basic",
  BILLING_SUBSCRIPTION_READ_ALL: "billing.subscription.read.all",
  BILLING_SUBSCRIPTION_CHANGE_PLAN_ALL: "billing.subscription.change_plan.all",
  BILLING_SUBSCRIPTION_CANCEL_ALL: "billing.subscription.cancel.all",
  BILLING_INVOICE_READ_ALL: "billing.invoice.read.all",
  BILLING_INVOICE_REFUND_ALL: "billing.invoice.refund.all",
  BILLING_PAYMENT_READ_ALL: "billing.payment.read.all",
  BILLING_PAYMENT_RETRY_ALL: "billing.payment.retry.all",
  BILLING_STRIPE_SYNC_ALL: "billing.stripe.sync.all",
  BILLING_STRIPE_REPLAY_ALL: "billing.stripe.replay.all",
  BILLING_ENTITLEMENT_OVERRIDE_ALL: "billing.entitlement.override.all",
  BILLING_NOTE_ALL: "billing.note.all",
  BILLING_GRACE_PERIOD_EXTEND_ALL: "billing.grace_period.extend.all",
  BILLING_CREDIT_ISSUE_ALL: "billing.credit.issue.all",
  BILLING_ACTION_APPROVE_ALL: "billing.action.approve.all",

  // Operations
  DEPLOYMENT_READ_ALL: "deployment.read.all",
  DEPLOYMENT_RETRY_ALL: "deployment.retry.all",
  DEPLOYMENT_ROLLBACK_ALL: "deployment.rollback.all",
  DOMAIN_READ_ALL: "domain.read.all",
  DOMAIN_VERIFY_ALL: "domain.verify.all",
  DOMAIN_RETRY_VERIFICATION_ALL: "domain.retry_verification.all",
  FORM_SUBMISSION_READ_ALL: "form_submission.read.all",
  FORM_DELIVERY_READ_ALL: "form_delivery.read.all",
  FORM_DELIVERY_RETRY_ALL: "form_delivery.retry.all",
  FORM_DELIVERY_REPLAY_ALL: "form_delivery.replay.all",
  OPERATIONAL_ALERT_READ_ALL: "operational_alert.read.all",
  OPERATIONAL_ALERT_RESOLVE_ALL: "operational_alert.resolve.all",
  SEO_READ_ALL: "seo.read.all",
  SEO_RESUBMIT_ALL: "seo.resubmit.all",
  TRANSLATION_JOB_READ_ALL: "translation_job.read.all",
  TRANSLATION_JOB_RETRY_ALL: "translation_job.retry.all",
  TRANSLATION_GLOSSARY_READ_ALL: "translation_glossary.read.all",
  NOTIFICATION_READ_ALL: "notification.read.all",

  // Audit
  AUDIT_READ_ALL: "audit.read.all",
  AUDIT_READ_SUPPORT: "audit.read.support",
  AUDIT_READ_BILLING: "audit.read.billing",

  // Analytics & observability (Phase 10)
  ANALYTICS_READ_ALL: "analytics.read.all",
  ANALYTICS_READ_BUSINESS: "analytics.read.business",
  ANALYTICS_READ_SUPPORT: "analytics.read.support",
  ANALYTICS_READ_OPERATIONS: "analytics.read.operations",
  OBSERVABILITY_READ_ALL: "observability.read.all",

  // Operator user management (Phase 12)
  OPERATOR_USER_READ_ALL: "operator_user.read.all",
  OPERATOR_USER_MANAGE_ALL: "operator_user.manage.all",
  PERMISSION_MANAGE_ALL: "permission.manage.all",
} as const;

export type OperatorPermissionKey =
  (typeof OPERATOR_PERMISSIONS)[keyof typeof OPERATOR_PERMISSIONS];

/**
 * `.all` permission keys act as a superset for narrower scopes.
 * For example, `tenant.update.all` satisfies `tenant.update.region:eu`.
 * A literal `*` in the held set is always a superset (used for
 * PLATFORM_OWNER seeds).
 */
export function hasPermission(
  held: ReadonlySet<string> | readonly string[] | null | undefined,
  required: string,
): boolean {
  if (!held) return false;
  const set = held instanceof Set ? held : new Set(held);
  if (set.has("*")) return true;
  if (set.has(required)) return true;

  const lastDot = required.lastIndexOf(".");
  if (lastDot === -1) return false;
  const broad = `${required.slice(0, lastDot)}.all`;
  if (set.has(broad)) return true;
  return false;
}

export function hasAllPermissions(
  held: ReadonlySet<string> | readonly string[] | null | undefined,
  required: readonly string[],
): boolean {
  if (required.length === 0) return true;
  return required.every((p) => hasPermission(held, p));
}

export function hasAnyPermission(
  held: ReadonlySet<string> | readonly string[] | null | undefined,
  required: readonly string[],
): boolean {
  if (required.length === 0) return true;
  return required.some((p) => hasPermission(held, p));
}

// Re-exported legacy enums for code that still references resource/action
// names. These are NOT used for permission checks — they only document the
// resource taxonomy.
export type OperatorResource =
  | "tenant"
  | "site"
  | "support_case"
  | "billing_account"
  | "subscription"
  | "deployment"
  | "domain"
  | "form_submission"
  | "audit_log";

export type OperatorAction =
  | "read"
  | "list"
  | "create"
  | "update"
  | "retry"
  | "resolve"
  | "export"
  | "delete";

export interface PermissionCheck {
  resource: OperatorResource;
  action: OperatorAction;
}
