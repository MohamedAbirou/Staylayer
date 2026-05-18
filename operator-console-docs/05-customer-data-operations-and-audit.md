# 05 Customer Data Operations And Audit

## Goal

Everything outside the large support, billing, and permission systems should help operators retrieve clean data, understand customer state, and safely manage existing customer-dashboard features.

The operator console should not duplicate the customer workspace. It should provide cross-tenant visibility, diagnostics, recovery actions, and audit.

## Resource Strategy

Build operator resource APIs around customer-domain modules.

Important resources:

- tenants
- tenant members
- sites
- pages
- page versions
- settings
- deployments
- deployment environment variables
- domains
- form definitions
- form submissions
- form deliveries
- inquiry integrations
- billing snapshots
- subscriptions
- notifications
- audit logs
- redirects
- SEO structured data
- Search Console data
- PageSpeed/CrUX records
- hreflang scans
- Bing Webmaster data
- translations and glossaries

## Tenant 360

This is one of the most important operator views.

Sections:

- identity and status
- plan and billing status
- members and roles
- sites
- live URLs and domains
- deployment history
- form activity and delivery health
- SEO/search health
- translation usage
- support cases
- audit timeline
- operational alerts
- risk summary

Actions should be role-specific and visible only when allowed.

## Site 360

Sections:

- site identity
- status
- runtime URL and custom domain
- deployment state
- domain state
- enabled locales
- page inventory
- SEO defaults and page-level gaps
- form definitions and routing
- submissions and delivery state
- sitemap/search integrations
- audit timeline

## Clean Data API Contract

Every operator list endpoint should follow a consistent contract:

```ts
type OperatorListResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  filters: Record<string, unknown>;
  generatedAt: string;
};
```

Every detail endpoint should include:

- `generatedAt`
- `permissions` for current operator on that resource
- `auditContext` or target metadata for future mutations
- stable ids for tenant, site, and resource

## Read-Only First

For each customer-domain module, ship in this order:

1. read-only list
2. read-only detail
3. timeline/audit correlation
4. safe retry or recovery action
5. destructive or sensitive action only if truly needed

## Audit Requirements

The current `AuditLog` model is a foundation, but the operator console needs richer audit semantics.

Recommended additions or extensions:

- actor role
- permission key
- request id
- IP/User-Agent if policy allows
- target tenant/site/resource ids
- before snapshot
- after snapshot
- reason
- correlation id for async jobs
- severity or sensitivity

Audit views should support:

- filter by actor
- filter by tenant/site/resource
- filter by action
- filter by date range
- filter by sensitivity
- export with permission
- case and billing timeline embedding

## Operator Notes

Do not store all notes as audit events.

Use separate note models for:

- support notes
- billing notes
- tenant account notes
- incident notes

Audit is immutable record of actions. Notes are operator-authored context with its own permissions and retention policy.

## Recovery Actions To Expose

Likely support/operator actions:

- retry failed deployment
- retry domain verification
- retry form delivery
- resolve operational alert
- add support note
- create support case from alert
- suspend/reactivate tenant, owner only or approval-only
- request site/archive restore if supported by existing backend
- trigger sitemap/search resubmission if already implemented
- rerun SEO/PSI/hreflang checks if existing modules support it

Every recovery action must show:

- what will happen
- what resource is affected
- whether customer-visible state changes
- required role/permission
- audit reason input
