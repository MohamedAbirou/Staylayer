# 00 Current State And Removal

## What Was Removed From The Customer Dashboard

The embedded operator console was removed from the dashboard app so `apps/dashboard` can be customer-only.

Removed dashboard pieces:

- `/admin/login` route.
- `/admin/*` route tree.
- `AdminLayout`.
- Admin pages under `apps/dashboard/src/pages/admin`.
- Dashboard-side `api/admin.ts` client.
- Dashboard-side platform-user client and hook, `api/users.ts` and `hooks/useUsers.ts`.
- Platform-user management UI from the dashboard Settings page.
- Playwright e2e spec for the old embedded platform-admin console.
- Dashboard-side platform-role route guarding.

Customer dashboard behavior after removal:

- `/login` remains a customer-login redirect to the marketing app.
- `ProtectedRoute` checks customer membership roles only.
- Limbo state means a signed-in customer with no workspace memberships.
- Sidebar and Profile show customer workspace roles, not platform roles.

## What Remains In The Backend For Now

The backend still contains platform-role primitives and admin endpoints. Do not delete them blindly. They are a useful starting point for the new operator app and some services already depend on the shared `AdminService` for audit logging.

Existing backend surfaces that can seed the new app:

- `apps/api/src/admin/*`: overview, tenants, audit, audit helpers.
- `apps/api/src/deployments/admin-deployments.controller.ts`: deployment list, deployment detail, retry, environment inspection.
- `apps/api/src/domains/admin-domains.controller.ts`: domain operations and retry verification.
- `apps/api/src/forms/admin-forms.controller.ts`: inquiry/form operations summaries.
- `apps/api/src/billing/admin-subscriptions.controller.ts`: subscription list.
- `apps/api/src/users/users.controller.ts`: platform user management, currently `PLATFORM_OWNER` only.
- `apps/api/src/auth/guards/roles.guard.ts`: platform role and membership role guard separation.

## Required Refactor Direction

The new implementation should move from ad hoc `/admin/*` endpoints to intentional `/operator/*` modules and contracts.

Recommended path:

1. Keep old backend admin controllers temporarily while the new app is scaffolded.
2. Create new `operator` modules and DTOs beside each domain module.
3. Move endpoint contracts to `/operator/*` names.
4. Keep compatibility aliases only if needed during the migration.
5. Delete old `/admin/*` controllers once the new app and tests use `/operator/*`.

## Backend Login Clarification

There is no truly separate backend admin login today; the same `/auth/login` endpoint returns sessions containing `platformRole` when the user is an operator. The new console should introduce an explicit operator-auth contract instead of relying on dashboard-side routing.

Target backend auth endpoints:

- `POST /operator/auth/login`
- `POST /operator/auth/refresh`
- `POST /operator/auth/logout`
- `GET /operator/auth/session`
- `POST /operator/auth/mfa/challenge` if MFA is added in the same phase or soon after

These endpoints may internally reuse existing auth services, but they must fail closed unless the user has a valid operator role.

## Why This Matters

The customer workspace is a subscriber product. The operator console is the internal business control plane. Keeping them together encourages permission leaks, confusing redirects, mixed route assumptions, and brittle tests.
