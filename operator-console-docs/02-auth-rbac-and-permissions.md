# 02 Auth, RBAC, And Permissions

## Goal

Build a professional operator permission system that supports three role families while staying extensible enough for future sub-permissions.

Target roles:

- `PLATFORM_OWNER`
- `SUPPORT_ADMIN`
- `FINANCE_ADMIN`

## Permission Model

Do not rely only on role names inside UI code. Use role names as bundles of permissions.

Recommended permission key format:

```text
resource.action.scope
```

Examples:

- `tenant.read.all`
- `tenant.suspend.all`
- `support_case.assign.all`
- `support_case.reply.all`
- `billing.subscription.read.all`
- `billing.subscription.change_plan.all`
- `billing.invoice.refund.all`
- `deployment.retry.all`
- `domain.retry_verification.all`
- `audit.read.all`
- `operator_user.manage.all`

## Minimal Role Matrix

| Area                       | PLATFORM_OWNER     | SUPPORT_ADMIN                    | FINANCE_ADMIN                 |
| -------------------------- | ------------------ | -------------------------------- | ----------------------------- |
| Overview metrics           | full               | support/ops                      | billing/revenue               |
| Tenant list and tenant 360 | full               | read + support actions           | read billing-relevant fields  |
| Suspend/reactivate tenant  | full               | request/limited if policy allows | no                            |
| Support cases              | full               | full                             | read only if billing-related  |
| Support replies/notes      | full               | full                             | billing-note only             |
| Billing accounts           | full               | read basic status                | full                          |
| Plan changes               | full               | no                               | full with audit and reason    |
| Refunds/credits            | full with approval | no                               | full with approval thresholds |
| Stripe webhook replay      | full               | no                               | full with audit               |
| Deploy/domain retries      | full               | full                             | read only                     |
| Form delivery diagnostics  | full               | full                             | read only                     |
| Audit log                  | full               | support-scoped read              | billing-scoped read           |
| Operator user management   | full               | no                               | no                            |
| Permission management      | full               | no                               | no                            |

## Sensitive Billing Controls

Billing operations should have stronger safety rules:

- Require reason text for every mutation.
- Record before/after values.
- Require confirmation typing for refunds, credits, cancellations, and manual overrides.
- Add approval thresholds for large refunds or account-level financial changes.
- Keep Stripe object ids visible but never expose secrets.
- Avoid irreversible actions when a reversible Stripe workflow exists.

## Support Safety Controls

Support actions are operationally powerful but should avoid silent customer-impacting changes.

Rules:

- Every support case action logs actor, case, tenant, site, target, and reason.
- Deployment/domain/form retry actions must show expected side effects.
- Support can view billing status but cannot mutate billing except through a formal handoff to Billing.
- Impersonation, if added, must be scoped, time-limited, customer-visible if policy requires, and audited.

## Backend Guarding

Implement a dedicated operator guard layer:

- `OperatorAuthGuard`: validates operator session/token.
- `OperatorRoleGuard`: validates role bundle.
- `OperatorPermissionGuard`: validates permission keys.
- `OperatorAuditInterceptor`: attaches request id, actor, permission, and target metadata for mutations.

Do not reuse customer membership decorators for operator authorization.

## Frontend Guarding

Frontend checks are not security, but they improve UX.

The operator app should expose:

- `useOperatorSession()`
- `useCan(permissionKey, target?)`
- `RequireOperatorPermission`
- `PermissionButton`
- `PermissionRoute`

All permission denials from the API must still be handled gracefully.
