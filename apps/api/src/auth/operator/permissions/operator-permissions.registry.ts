import { PlatformRole } from "@prisma/client";

/**
 * Granular operator permission registry described in
 * operator-console-docs/02-auth-rbac-and-permissions.md.
 *
 * The format is intentionally `resource.action.scope` so future phases can
 * narrow the scope from `all` to `tenant:<id>` / `site:<id>` etc. without
 * changing call sites. Wildcards (`*`) are allowed in the scope segment so
 * permission checks can be matched against either an explicit grant or a
 * broader bundle (e.g. `audit.read.all` grants `audit.read.support`).
 *
 * Permissions are derived from role bundles at session bootstrap. The role
 * bundles below MUST match the minimal role matrix documented in
 * 02-auth-rbac-and-permissions.md. Do not add permissions ad-hoc inside
 * feature modules — extend this file so every grant is reviewed in one
 * place.
 */

// ─── Permission keys ────────────────────────────────────────────────────

export const OPERATOR_PERMISSIONS = {
  // ── Overview / dashboard ─────────────────────────────────────────────
  OVERVIEW_READ_ALL: "overview.read.all",
  OVERVIEW_READ_SUPPORT: "overview.read.support",
  OVERVIEW_READ_BILLING: "overview.read.billing",

  // ── Tenants ──────────────────────────────────────────────────────────
  TENANT_READ_ALL: "tenant.read.all",
  TENANT_READ_BILLING: "tenant.read.billing",
  TENANT_LIST_ALL: "tenant.list.all",
  TENANT_SUSPEND_ALL: "tenant.suspend.all",
  TENANT_REACTIVATE_ALL: "tenant.reactivate.all",
  TENANT_ARCHIVE_ALL: "tenant.archive.all",

  // ── Sites ────────────────────────────────────────────────────────────
  SITE_READ_ALL: "site.read.all",
  SITE_LIST_ALL: "site.list.all",
  SITE_SUSPEND_ALL: "site.suspend.all",
  SITE_REACTIVATE_ALL: "site.reactivate.all",

  // ── Support cases ────────────────────────────────────────────────────
  SUPPORT_CASE_READ_ALL: "support_case.read.all",
  SUPPORT_CASE_READ_BILLING: "support_case.read.billing",
  SUPPORT_CASE_CREATE_ALL: "support_case.create.all",
  SUPPORT_CASE_ASSIGN_ALL: "support_case.assign.all",
  SUPPORT_CASE_REPLY_ALL: "support_case.reply.all",
  SUPPORT_CASE_REPLY_BILLING: "support_case.reply.billing",
  SUPPORT_CASE_NOTE_ALL: "support_case.note.all",
  SUPPORT_CASE_NOTE_BILLING: "support_case.note.billing",
  SUPPORT_CASE_RESOLVE_ALL: "support_case.resolve.all",
  SUPPORT_CASE_TRANSFER_ALL: "support_case.transfer.all",

  // ── Billing accounts ─────────────────────────────────────────────────
  BILLING_ACCOUNT_READ_ALL: "billing.account.read.all",
  BILLING_ACCOUNT_READ_BASIC: "billing.account.read.basic",
  BILLING_SUBSCRIPTION_READ_ALL: "billing.subscription.read.all",
  BILLING_SUBSCRIPTION_CHANGE_PLAN_ALL: "billing.subscription.change_plan.all",
  BILLING_SUBSCRIPTION_CANCEL_ALL: "billing.subscription.cancel.all",
  BILLING_INVOICE_READ_ALL: "billing.invoice.read.all",
  BILLING_INVOICE_REFUND_ALL: "billing.invoice.refund.all",
  BILLING_PAYMENT_READ_ALL: "billing.payment.read.all",
  BILLING_STRIPE_REPLAY_ALL: "billing.stripe.replay.all",
  BILLING_STRIPE_SYNC_ALL: "billing.stripe.sync.all",
  BILLING_ENTITLEMENT_OVERRIDE_ALL: "billing.entitlement.override.all",
  BILLING_NOTE_ALL: "billing.note.all",

  // ── Deployments / domains / forms (read + safe retries) ─────────────
  DEPLOYMENT_READ_ALL: "deployment.read.all",
  DEPLOYMENT_RETRY_ALL: "deployment.retry.all",
  DOMAIN_READ_ALL: "domain.read.all",
  DOMAIN_RETRY_VERIFICATION_ALL: "domain.retry_verification.all",
  FORM_DELIVERY_READ_ALL: "form_delivery.read.all",
  FORM_DELIVERY_REPLAY_ALL: "form_delivery.replay.all",

  // ── Audit ────────────────────────────────────────────────────────────
  AUDIT_READ_ALL: "audit.read.all",
  AUDIT_READ_SUPPORT: "audit.read.support",
  AUDIT_READ_BILLING: "audit.read.billing",

  // ── Operator user & permission management ────────────────────────────
  OPERATOR_USER_READ_ALL: "operator_user.read.all",
  OPERATOR_USER_MANAGE_ALL: "operator_user.manage.all",
  PERMISSION_MANAGE_ALL: "permission.manage.all",
} as const;

export type OperatorPermissionKey =
  (typeof OPERATOR_PERMISSIONS)[keyof typeof OPERATOR_PERMISSIONS];

/**
 * Strongly-typed list of all permission keys. Useful for runtime validation
 * and for shipping the full catalog to the operator console UI.
 */
export const ALL_OPERATOR_PERMISSIONS: ReadonlyArray<OperatorPermissionKey> =
  Object.values(OPERATOR_PERMISSIONS);

const ALL_OPERATOR_PERMISSIONS_SET: ReadonlySet<string> = new Set(
  ALL_OPERATOR_PERMISSIONS,
);

export function isOperatorPermissionKey(
  value: string,
): value is OperatorPermissionKey {
  return ALL_OPERATOR_PERMISSIONS_SET.has(value);
}

// ─── Role → permission bundles ──────────────────────────────────────────

const P = OPERATOR_PERMISSIONS;

const PLATFORM_OWNER_PERMISSIONS: ReadonlyArray<OperatorPermissionKey> =
  ALL_OPERATOR_PERMISSIONS;

const SUPPORT_ADMIN_PERMISSIONS: ReadonlyArray<OperatorPermissionKey> = [
  P.OVERVIEW_READ_SUPPORT,
  P.TENANT_READ_ALL,
  P.TENANT_LIST_ALL,
  P.SITE_READ_ALL,
  P.SITE_LIST_ALL,
  P.SUPPORT_CASE_READ_ALL,
  P.SUPPORT_CASE_CREATE_ALL,
  P.SUPPORT_CASE_ASSIGN_ALL,
  P.SUPPORT_CASE_REPLY_ALL,
  P.SUPPORT_CASE_NOTE_ALL,
  P.SUPPORT_CASE_RESOLVE_ALL,
  P.SUPPORT_CASE_TRANSFER_ALL,
  P.BILLING_ACCOUNT_READ_BASIC,
  P.DEPLOYMENT_READ_ALL,
  P.DEPLOYMENT_RETRY_ALL,
  P.DOMAIN_READ_ALL,
  P.DOMAIN_RETRY_VERIFICATION_ALL,
  P.FORM_DELIVERY_READ_ALL,
  P.FORM_DELIVERY_REPLAY_ALL,
  P.AUDIT_READ_SUPPORT,
];

const FINANCE_ADMIN_PERMISSIONS: ReadonlyArray<OperatorPermissionKey> = [
  P.OVERVIEW_READ_BILLING,
  P.TENANT_READ_BILLING,
  P.TENANT_LIST_ALL,
  P.SITE_READ_ALL,
  P.SITE_LIST_ALL,
  P.SUPPORT_CASE_READ_BILLING,
  P.SUPPORT_CASE_REPLY_BILLING,
  P.SUPPORT_CASE_NOTE_BILLING,
  P.BILLING_ACCOUNT_READ_ALL,
  P.BILLING_SUBSCRIPTION_READ_ALL,
  P.BILLING_SUBSCRIPTION_CHANGE_PLAN_ALL,
  P.BILLING_SUBSCRIPTION_CANCEL_ALL,
  P.BILLING_INVOICE_READ_ALL,
  P.BILLING_INVOICE_REFUND_ALL,
  P.BILLING_PAYMENT_READ_ALL,
  P.BILLING_STRIPE_REPLAY_ALL,
  P.BILLING_STRIPE_SYNC_ALL,
  P.BILLING_ENTITLEMENT_OVERRIDE_ALL,
  P.BILLING_NOTE_ALL,
  P.DEPLOYMENT_READ_ALL,
  P.DOMAIN_READ_ALL,
  P.FORM_DELIVERY_READ_ALL,
  P.AUDIT_READ_BILLING,
];

const ROLE_PERMISSIONS: Readonly<
  Record<PlatformRole, ReadonlyArray<OperatorPermissionKey>>
> = {
  PLATFORM_OWNER: PLATFORM_OWNER_PERMISSIONS,
  SUPPORT_ADMIN: SUPPORT_ADMIN_PERMISSIONS,
  FINANCE_ADMIN: FINANCE_ADMIN_PERMISSIONS,
};

/**
 * Return the de-duplicated permission set for the given platform role.
 * Returns an empty array if the role is null/undefined.
 */
export function getPermissionsForRole(
  role: PlatformRole | null | undefined,
): OperatorPermissionKey[] {
  if (!role) return [];
  const bundle = ROLE_PERMISSIONS[role];
  // Defensive copy so callers cannot mutate the registry.
  return Array.from(new Set(bundle));
}

/**
 * Return true if a permission set satisfies every required permission key.
 *
 * Supports two extensions:
 *  - The literal key `*` grants everything (reserved for Platform Owner if
 *    we ever want a wildcard grant; not currently issued).
 *  - A held permission with a trailing `.all` scope satisfies any required
 *    permission with the same `resource.action.*` prefix. This lets future
 *    phases issue narrower tenant- or site-scoped grants without breaking
 *    consumers that ask for the broader `.all` form.
 */
export function hasAllPermissions(
  held: ReadonlyArray<string>,
  required: ReadonlyArray<string>,
): boolean {
  if (required.length === 0) return true;
  if (held.length === 0) return false;
  const heldSet = new Set(held);
  if (heldSet.has("*")) return true;
  for (const key of required) {
    if (heldSet.has(key)) continue;
    // `resource.action.all` is a superset of `resource.action.<scope>`.
    const parts = key.split(".");
    if (parts.length >= 2) {
      const allKey = `${parts.slice(0, -1).join(".")}.all`;
      if (heldSet.has(allKey)) continue;
    }
    return false;
  }
  return true;
}
