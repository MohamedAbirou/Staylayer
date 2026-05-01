# Phase 00: Scope And Positioning

## Objective

Freeze the product definition before any technical work begins.

This phase exists to stop the project from drifting into a generic website builder or a half-built hospitality operations suite.

## Chosen Niche

The SaaS is for:

- independent vacation-rental operators
- boutique hotels and B&Bs
- guest houses and farm stays
- glamping and camping brands
- small hospitality brands with roughly 1 to 20 units

The v1 product promise is:

**multilingual, SEO-first, inquiry-driven hospitality websites with visual editing and managed deployment**

## Hard Product Boundaries

### In scope

- visual website editing
- multilingual page management
- page-level and site-level SEO
- domain management
- inquiry and contact forms that collect stay intent and contact details only
- recurring subscriptions
- operator admin tools
- dedicated website deployment per customer site

### Out of scope in v1

- booking engine
- reservations checkout
- reservation confirmation workflows
- OTA synchronization
- PMS workflows
- rate management
- inventory management
- payment capture for stays
- live availability as a transactional source of truth
- enterprise SSO
- agency white-label platform depth

## Required Decisions

Lock these decisions before Phase 01 starts:

1. customer archetype: small hospitality brands, not enterprise hotel chains
2. commercial model: monthly subscription tiers
3. deployment model: shared control plane plus dedicated site deployment per customer site
4. funnel model: inquiry-first, not booking-first
5. main pricing units: site count, locale count, seat count, inquiry volume, and support level; optional property/page band only if packaging needs it

## Output Documents

This phase should produce:

- one-page ICP definition
- one-page value proposition
- plan matrix draft
- glossary of platform entities and commercial terms
- approved route naming conventions
- provider assumptions for billing and deployments

## Locked Glossary

These names are locked as product language for later phases. Storage shape can evolve later, but the concepts and boundaries should not be renamed casually.

- `Tenant`: the paying account and primary authorization boundary
- `TenantMembership`: an explicit user-to-tenant relationship with a role; if it cannot be resolved, access is denied
- `User`: an authenticated person who may belong to one or more tenants through memberships
- `Operator`: an internal platform administrator, not a customer tenant seat
- `Site`: one public hospitality website belonging to exactly one tenant
- `SiteSettings`: branding, SEO defaults, analytics, contact details, and locale configuration for one site
- `Page`: one editable page belonging to exactly one site
- `Locale`: one configured site language or locale variant
- `Seat`: one billable customer workspace membership
- `SupportLevel`: the support entitlement attached to the subscribed plan
- `Subscription`: billing state, plan metadata, and commercial limits for a tenant account
- `Deployment`: one deployment record for exactly one site
- `Domain`: one custom-domain record attached to one site
- `FormSubmission`: one public inquiry or contact submission tied to one site and optionally one page
- `AuditLog`: one operator or customer action log entry with tenant context

## Explicit Phase-00 Assumptions

- Auth provider: not selected in this phase. Requirement: customer access must resolve through an authenticated `User` plus a valid `TenantMembership`. If tenant, site, or role resolution is ambiguous, access must fail closed.
- Billing provider: not selected in this phase. Requirement: recurring monthly subscriptions priced primarily by sites, locales, seats, inquiry volume, and support level.
- Deployment provider: not selected in this phase. Requirement: one shared control plane plus a dedicated deployment target per customer site.
- No other infrastructure contract is implied in this phase. Later phases must name concrete providers and interfaces before implementation work begins.

## Hospitality-Specific Positioning Rules

All product and sales copy should emphasize:

- direct inquiries
- multilingual presence
- hospitality brand trust
- SEO and discoverability
- easy website management
- no developer required for ordinary content work

Avoid sales language that implies the app already does:

- channel management
- availability sync
- reservation execution
- payment orchestration for stays

Forms may promise fast responses and direct inquiries. They must not imply confirmed inventory, guaranteed rates, or completed reservations.

## Suggested Route Shape

Use route namespaces that reflect product roles clearly:

- `/app/...` for customer workspace
- `/admin/...` for operator console

Route constraints for later phases:

- customer workspace routes must carry explicit tenant context as `:tenantSlug`
- site-scoped workspace routes must carry explicit site context as `:siteId`
- operator routes must stay under `/admin` and must not masquerade as tenant routes
- if `:tenantSlug`, `:siteId`, and authenticated membership do not resolve to the same tenant, deny access; never infer or auto-switch tenant context
- avoid route nouns such as `bookings`, `reservations`, `availability`, and `rates` in v1 customer workspace naming

Suggested customer pattern:

- `/app/:tenantSlug/sites/:siteId/overview`
- `/app/:tenantSlug/sites/:siteId/pages`
- `/app/:tenantSlug/sites/:siteId/settings`
- `/app/:tenantSlug/sites/:siteId/forms`
- `/app/:tenantSlug/sites/:siteId/billing`

Suggested operator pattern:

- `/admin/tenants`
- `/admin/deployments`
- `/admin/subscriptions`
- `/admin/domains`
- `/admin/forms`

## Definition Of Done

This phase is done when:

1. the niche is fixed in writing
2. the v1 scope boundaries are explicit
3. the pricing units are agreed, including support level
4. the deployment model is fixed
5. the naming of tenant, site, subscription, and deployment is fixed
6. later phases do not need to reinterpret the product promise
7. auth and tenant-resolution ambiguity is documented to fail closed
8. provider assumptions are explicit without locking vendors prematurely

## Locked Assumptions For Later Phases

Later phases must not violate these assumptions:

1. the product is a hospitality website SaaS for direct inquiries, not a booking engine
2. the ICP remains independent vacation rentals, boutique hotels, B&Bs, guest houses, farm stays, and glamping brands with roughly 1 to 20 units
3. the deployment model remains a shared control plane plus dedicated site deployment per customer site
4. tenant access must resolve through explicit memberships, and unresolved tenant or site context must deny access
5. pricing remains anchored to sites, locales, seats, inquiry volume, and support level
6. public forms collect inquiry data only and must not imply reservation confirmation, stay payments, or inventory control

## Repo Context

Relevant current-state references:

- [../../apps/website/pages/website-builder-vacation-rentals.js](../../apps/website/pages/website-builder-vacation-rentals.js)
- [../../apps/website/components/financialToolsTabs.jsx](../../apps/website/components/financialToolsTabs.jsx)
- [../../apps/website/components/otas.jsx](../../apps/website/components/otas.jsx)
- [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
