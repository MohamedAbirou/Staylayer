# Phase 03: API Isolation And Security

## Objective

Apply tenant and site ownership rules to the actual API behavior so there is no cross-tenant data leakage.

This phase turns the schema and auth model into real isolation.

## Current Problem

The current services query global tables without tenant-aware boundaries.

Critical examples:

- [../../apps/api/src/pages/pages.service.ts](../../apps/api/src/pages/pages.service.ts)
- [../../apps/api/src/settings/settings.service.ts](../../apps/api/src/settings/settings.service.ts)

Without a full isolation pass, later billing and deployment work would sit on top of unsafe access patterns.

## Isolation Rules

### Customer data rule

Every customer-owned record must be read and written in the context of:

- one tenant
- and when relevant, one site

### Operator data rule

Operator routes may see cross-tenant data, but only behind platform-role checks and audit logging.

### Public data rule

Public website reads must resolve only the site they are supposed to serve.

## Modules To Audit

The audit should cover at least:

- pages
- page versions
- settings
- users and memberships
- subscriptions
- deployments
- domains
- form submissions
- future public read endpoints

## Required Implementation Tasks

1. add tenant and site filters to all customer-facing queries
2. refactor controller signatures so tenant and site context are explicit
3. add shared helpers to prevent forgotten tenant filters
4. add audit logging for sensitive mutations
5. create operator-only routes where platform-wide visibility is necessary
6. review all public website fetch endpoints for correct site scoping

## Suggested Patterns

### Pattern 1: context-first service methods

Prefer methods like:

- `listPagesForSite(siteId, filters)`
- `updateSiteSettings(siteId, dto, actorId)`

Avoid methods that depend on hidden global assumptions.

### Pattern 2: forbidden by default

If tenant or site context is missing for a customer-owned route, fail closed.

### Pattern 3: audit on mutating actions

Create audit events for:

- page create
- page update
- page delete or restore
- settings update
- billing state changes
- deployment retry
- domain change

## Hospitality-Specific Public API Design

Because each customer site is a hospitality website, the public website fetch layer should be able to retrieve:

- site settings
- published pages
- locale-aware SEO fields
- form endpoint configuration

But it must never expose operator or subscription internals.

## Security Test Cases

At minimum, create tests proving:

1. tenant A cannot list tenant B pages
2. tenant A cannot update tenant B settings
3. customer roles cannot access operator deployment views
4. public website requests for one site cannot leak another site's page content
5. audit logs are created for sensitive writes

## Definition Of Done

This phase is done when:

1. all customer-owned API paths are tenant- and site-aware
2. operator-only routes are separated and permission-checked
3. public reads are site-scoped
4. cross-tenant isolation tests pass
5. audit logging exists for the main mutating actions
