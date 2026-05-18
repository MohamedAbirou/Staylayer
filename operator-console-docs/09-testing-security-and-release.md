# 09 Testing, Security, And Release

## Test Strategy

The operator console touches support, billing, permissions, customer data, and recovery actions. It needs layered tests.

## Backend Tests

Required:

- operator auth rejects customer-only users
- operator auth accepts each valid operator role
- permission guard blocks unauthorized role/action pairs
- every billing mutation writes audit event
- every support mutation writes support event and audit event where needed
- cross-tenant list/detail queries are explicitly operator-scoped
- customer membership roles cannot call operator endpoints
- dangerous actions require reason
- role rename migration preserves existing finance admins as billing admins

## Frontend Tests

Required:

- operator login flow
- session refresh and logout
- forbidden route handling
- navigation hides disallowed areas
- permission denial surfaces clear UI
- support case lifecycle smoke path
- billing account detail smoke path
- billing sensitive action confirmation path
- tenant/site 360 load path
- audit log filtering smoke path

## E2E Smoke Paths

Minimum Playwright paths:

1. Platform Owner logs in and opens every top-level operator route.
2. Support Admin logs in and can open support/operations but cannot mutate billing.
3. Billing Admin logs in and can open billing but cannot retry deployment.
4. Customer-only user cannot access operator app.
5. Billing plan change writes audit event.
6. Support case creation from operational alert writes case event and audit event.

## Security Requirements

### Session Isolation

- operator app uses separate storage keys from dashboard
- operator auth cookies, if used, should have distinct names
- logout clears only the intended app session unless a shared logout is explicitly chosen
- refresh endpoints must fail closed by app context

### Authorization

- backend permission guard is required for all operator endpoints
- frontend permission checks are UX only
- API responses should avoid leaking sensitive data to roles that cannot use it

### Audit

Audit every mutation with:

- actor id
- actor role
- permission key
- target type
- target id
- tenant id where applicable
- site id where applicable
- action
- reason
- before snapshot when safe
- after snapshot when safe
- request id
- created at

### Billing Safety

- no billing mutation without reason
- no refund/credit without confirmation
- approval threshold for high-value actions
- Stripe sync actions idempotent where possible
- never store provider secrets in operator-visible payloads

### Support Safety

- support can inspect context without changing billing
- support recovery actions must show side effects
- impersonation, if added, requires separate design review

## Release Plan

Recommended rollout:

1. Internal local/staging only with Platform Owner.
2. Add Support Admin read-only access.
3. Add support case mutations.
4. Add Billing Admin read-only access.
5. Add billing mutations behind audit and confirmation.
6. Add analytics and snapshots.
7. Remove old backend `/admin/*` compatibility routes after new `/operator/*` app is fully validated.

## Production Readiness Checklist

- all operator routes protected
- all operator mutations audited
- role matrix tested
- billing actions tested with Stripe test mode
- support workflows tested with seeded tenants
- performance acceptable for large tables
- no admin UI remains in customer dashboard
- docs updated with final operator app commands
- rollback plan documented
