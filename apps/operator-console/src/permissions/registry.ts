// Phase 1 placeholder for the granular operator permission registry described
// in operator-console-docs/02-auth-rbac-and-permissions.md. Phase 3 will
// expand this into a full permission-to-role mapping plus a `useCan` hook.
//
// Resource and action enums are defined here so feature code written in
// Phase 1 (navigation, route guards) can already reference them without
// circular imports.

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
