# 07 Backend API Gap Map

## Current Backend Assets

The API already contains many modules that can power operator views.

Known useful modules:

- auth and roles guards
- tenants/workspaces/memberships
- profile/account flows
- billing and Stripe webhooks
- deployments and deployment environment variables
- domains and domain verification
- forms, form definitions, submissions, routing, deliveries
- notifications
- audit logs
- SEO crawler, Search Console, PSI, CrUX, hreflang, Bing Webmaster
- site deletion/archive/restore related modules
- workspace transfer and deletion flows
- translation and glossary modules

## Existing Operator-Like Endpoints

Current `/admin/*` surfaces:

- overview
- tenants
- audit
- deployments
- domains
- forms summary
- subscriptions

These should be refactored into `/operator/*` contracts rather than copied into the customer dashboard again.

## Major Gaps

### Auth

Needed:

- dedicated operator login/refresh/logout/session endpoints
- operator session storage semantics
- optional MFA step
- operator-only cookie/session names
- event logging for operator auth

### Permissions

Needed:

- permission registry
- role-to-permission map
- backend guard by permission key
- frontend permission context
- operator permission management UI for Platform Owner

### Support

Needed:

- support case models
- case message/note/event models
- support case APIs
- support queue APIs
- tenant/site context APIs
- support macros
- SLA snapshots
- case-to-alert and case-to-resource linking

### Billing

Needed:

- billing account detail endpoint
- invoice/payment event snapshots
- Stripe reconciliation endpoints
- webhook replay endpoint
- plan-change operator endpoint
- entitlement override endpoint
- refund/credit workflow endpoint if supported
- billing notes and approvals

### Data Operations

Needed:

- consistent list/detail contracts for operator resources
- tenant 360 endpoint
- site 360 endpoint
- cross-module timeline endpoint
- operator search endpoint
- saved views

### Analytics

Needed:

- command center metrics endpoint
- support metrics endpoint
- billing metrics endpoint
- operations metrics endpoint
- tenant health score endpoint
- historical snapshots for charts

### Audit

Needed:

- richer operator audit metadata
- before/after snapshots for mutations
- reason capture
- request id/correlation id
- sensitivity classification
- export permission controls

## API Naming Recommendation

Prefer these routes in the new console:

```text
/operator/auth/*
/operator/overview
/operator/search
/operator/tenants
/operator/tenants/:tenantId
/operator/tenants/:tenantId/timeline
/operator/sites/:siteId
/operator/support/cases
/operator/support/cases/:caseId
/operator/billing/accounts
/operator/billing/accounts/:tenantId
/operator/billing/subscriptions/:subscriptionId
/operator/operations/deployments
/operator/operations/domains
/operator/operations/forms
/operator/audit
/operator/permissions
/operator/users
```

Avoid adding new dashboard consumers of `/admin/*`.

## Implementation Rule

Backend APIs for the operator console should be designed as operator contracts, not thin database dumps. Every endpoint should answer a job-to-be-done.
