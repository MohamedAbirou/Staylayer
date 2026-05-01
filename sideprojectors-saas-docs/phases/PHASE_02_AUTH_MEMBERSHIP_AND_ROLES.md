# Phase 02: Auth, Membership, And Roles

## Objective

Move from global-role authentication to tenant-aware hospitality workspace authentication.

This phase determines who can do what, and in which tenant or site context.

## Current Problem

The current auth flow is user-centric and global-role-centric.

Current references:

- [../../apps/api/src/auth/auth.service.ts](../../apps/api/src/auth/auth.service.ts)
- [../../apps/api/src/auth/guards/roles.guard.ts](../../apps/api/src/auth/guards/roles.guard.ts)
- [../../apps/dashboard/src/auth/AuthProvider.tsx](../../apps/dashboard/src/auth/AuthProvider.tsx)

Problems:

- JWT payload does not carry active tenant or site context
- one `SUPER_ADMIN` concept is overloaded
- dashboard bootstrap has no workspace switching model
- customer roles and platform roles are not separated

## Target Role Model

### Platform roles

- `PLATFORM_OWNER`
- `SUPPORT_ADMIN`
- `FINANCE_ADMIN`

These roles are only for the SaaS operator.

### Tenant membership roles

- `OWNER`
- `ADMIN`
- `EDITOR`
- `BILLING`

These roles are for customer accounts.

## Required Auth Changes

### Login response

The login and refresh flows should return:

- user identity
- accessible tenant memberships
- active tenant
- active site if one is selected or defaulted
- role information appropriate to that scope

### JWT payload

Recommended fields:

- `sub`
- `email`
- `platformRole` if applicable
- `activeTenantId`
- `activeMembershipRole`
- possibly `activeSiteId` when route semantics need it

### Workspace switching

If a user belongs to multiple tenants, the app must support switching tenant context safely.

That switch should:

- refresh auth context
- refresh API headers or token claims as needed
- invalidate cached customer data
- change route context consistently

## Hospitality-Specific UX Considerations

The customer user is not a developer or a SaaS operator. The auth and workspace model must feel simple.

Recommended behavior:

- if a user belongs to one tenant, open directly into that tenant
- if a tenant owns one site, open directly into that site
- if multiple sites exist, show a site picker with plain language labels

## Key Implementation Tasks

1. extend auth services and DTOs
2. introduce membership-aware guards and decorators
3. split platform roles from tenant roles
4. refactor the dashboard auth provider to store workspace context
5. update protected route behavior for customer versus operator areas
6. make API clients send active tenant or site context consistently

## Suggested Frontend Behavior

### Customer workspace

The UI should show:

- current tenant
- current site
- role in that site or tenant

### Operator admin console

The UI should show:

- operator identity
- platform role
- no accidental leakage of customer workspace controls

## Security Requirements

1. a valid user cannot access a tenant they are not a member of
2. customer roles cannot reach operator routes
3. switching workspace invalidates stale data caches
4. every API request with customer-owned data is tied to tenant context

## Definition Of Done

This phase is done when:

1. auth responses include active tenant context
2. the dashboard can bootstrap into the correct tenant and site
3. membership roles work separately from operator roles
4. a user with access to more than one tenant can switch safely
5. route guards match the new role model
