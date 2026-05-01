# Phase 01: Schema And Multi-Tenancy

## Objective

Replace the single-tenant data model with a site-owning tenant model that can safely support many paying hospitality customers.

This is the foundation phase. If it is weak, every later phase becomes fragile.

## Current Problem

The current Prisma schema is single-tenant:

- users are global
- pages are global
- settings are singleton-based
- uniqueness rules assume one website

That behavior is visible in:

- [../../apps/api/src/prisma/schema.prisma](../../apps/api/src/prisma/schema.prisma)
- [../../apps/api/src/pages/pages.service.ts](../../apps/api/src/pages/pages.service.ts)
- [../../apps/api/src/settings/settings.service.ts](../../apps/api/src/settings/settings.service.ts)

## Target Model

### Core entities to add

- `Tenant`
- `TenantMembership`
- `Site`
- `Subscription`
- `Deployment`
- `Domain`
- `FormSubmission`
- `AuditLog`

### Existing entities to refactor

- `Page` should belong to `Site`
- `PageVersion` should belong to `Page` and inherit site ownership
- `SiteSettings` should belong to `Site`, not be a singleton
- `User` should no longer represent global access by itself; tenant relationships should live in memberships

## Recommended Schema Direction

### `Tenant`

Fields should include at least:

- `id`
- `slug`
- `name`
- `status`
- `createdAt`
- `updatedAt`

### `TenantMembership`

Fields should include:

- `tenantId`
- `userId`
- `role`
- `isDefault`
- `createdAt`

Recommended roles:

- `OWNER`
- `ADMIN`
- `EDITOR`
- `BILLING`

### `Site`

Fields should include:

- `tenantId`
- `name`
- `slug`
- `status`
- `templateKey`
- `primaryLocale`
- `enabledLocales`
- `siteType`
- `createdAt`
- `updatedAt`

For the chosen niche, `siteType` can support values such as:

- vacation-rental
- boutique-hotel
- bnb
- glamping
- guest-house

### `Page`

Must gain:

- `siteId`

Must change uniqueness from:

- `slug + locale`

To:

- `siteId + slug + locale`

### `SiteSettings`

Must stop using the singleton `default` row pattern and become site-owned.

Add fields useful for hospitality sites if not already present:

- site subtitle
- public contact email
- public phone or WhatsApp link
- address or region
- primary CTA label
- default inquiry routing email

### `FormSubmission`

Recommended fields:

- `siteId`
- `formType`
- `pageSlug`
- `locale`
- `payload`
- `spamScore`
- `status`
- `createdAt`

Recommended `formType` values:

- contact
- inquiry
- availability-request
- group-stay

### `Subscription`

Recommended fields:

- `tenantId`
- `provider`
- `providerCustomerId`
- `providerSubscriptionId`
- `planKey`
- `status`
- `currentPeriodStart`
- `currentPeriodEnd`
- `cancelAtPeriodEnd`
- `limitsSnapshot`

## Key Implementation Tasks

1. redesign Prisma models
2. create and review migration SQL carefully
3. preserve existing content through a migration path from single-site to first tenant plus first site
4. create seed data that supports at least two tenants and two sites
5. add indexes for site and tenant filtering
6. document ownership rules in the schema itself where useful

## Data Migration Strategy

For the current data, migrate as follows:

1. create one bootstrap tenant from the existing system
2. create one bootstrap site under that tenant
3. attach all current pages and settings to that site
4. attach current users to the tenant through memberships

This avoids data loss and keeps the current project bootable during transition.

## Risks

### Risk: schema changes break existing code paths

Mitigation:

- update service methods immediately after schema change
- do not leave hybrid global plus site-owned behavior in production code

### Risk: later phases misuse tenant and site boundaries

Mitigation:

- define ownership clearly now: tenant owns sites, site owns pages and settings

## Definition Of Done

This phase is done when:

1. the schema can represent multiple tenants cleanly
2. at least two sites can have the same page slug in different scopes
3. site settings are no longer singleton-based
4. seed data can create realistic hospitality accounts
5. migrations are tested on a clean database and the current project database
