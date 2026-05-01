# Implementation Plan For Opus 4.7

## Goal

Turn the current single-tenant marketing CMS into a buyer-operable SaaS for **small hospitality brands that need multilingual direct-inquiry websites**.

The target customer is:

- independent vacation-rental operators
- boutique hotels and B&Bs
- guest houses and farm stays
- glamping and camping brands

The target product is:

- one shared control plane
- one customer workspace
- one operator/admin console
- dedicated website deployments per customer site
- recurring subscriptions and plan limits

The target product is **not** a booking engine in v1.

## Core Thesis

The repo already contains the hardest part of the content experience:

- a modular API
- a visual Puck-based editor
- a component library
- multilingual website rendering
- revalidation and publishing flows

The missing pieces are the SaaS pieces:

- tenancy
- subscriptions
- deployment provisioning
- operator tooling
- domain and forms operations

## Execution Rules

1. Preserve the current editing and rendering system wherever possible.
2. Add tenancy before billing or deployments.
3. Refactor the existing dashboard into the customer workspace.
4. Add a separate operator/admin area for the buyer.
5. Keep the v1 hospitality promise narrow and defensible.
6. Do not let the roadmap drift into PMS or reservations.

## Product Constraints To Respect

### Constraints from the current codebase

- [apps/api/src/prisma/schema.prisma](../apps/api/src/prisma/schema.prisma) is single-tenant.
- [apps/api/src/settings/settings.service.ts](../apps/api/src/settings/settings.service.ts) assumes one global settings record.
- [apps/api/src/pages/pages.service.ts](../apps/api/src/pages/pages.service.ts) assumes globally unique slug and locale combinations.
- [apps/dashboard/src/routes.tsx](../apps/dashboard/src/routes.tsx) is not tenant-aware.
- [apps/website/lib/cmsClient.js](../apps/website/lib/cmsClient.js) assumes one global API and one global site.
- [apps/api/src/revalidation/revalidation.service.ts](../apps/api/src/revalidation/revalidation.service.ts) sends one revalidation stream, not one per site deployment.

### Constraints from the chosen niche

- the platform must feel hospitality-specific from day one
- the product should support a branded direct-inquiry site before any deeper booking integrations
- plans should be priced around site count, unit band, locale count, and support, not just raw page count
- the buyer should be able to market the app without needing a technical team for every customer setup

## End-State Architecture

### Shared control plane

Shared services should own:

- tenants
- memberships and roles
- sites
- settings
- pages and versions
- billing and subscriptions
- deployments metadata
- domains metadata
- form submissions
- audit logs
- template catalog

### Dedicated site runtime

Each customer site deployment should receive:

- site id
- tenant id or site token
- shared API base URL
- deployment secret
- locale configuration
- environment-level domain metadata if needed

### Interface split

- customer workspace: hospitality operator manages site, pages, SEO, locales, domains, forms, and billing
- operator admin console: SideProjectors buyer manages tenants, subscriptions, provisioning, support, and incidents

## Recommended Entity Model

Use these entities as the canonical model:

- `Tenant`
- `TenantMembership`
- `Site`
- `SiteSettings`
- `Page`
- `PageVersion`
- `Subscription`
- `Deployment`
- `Domain`
- `FormSubmission`
- `AuditLog`
- optional later: `Template`, `UsageSnapshot`, `SupportNote`

Important rule:

- a tenant owns one or more sites
- a site owns its settings, pages, versions, domains, and deployment metadata

## Plan Summary

### Phase 00

Freeze scope, terminology, and v1 positioning around the hospitality niche.

### Phase 01

Refactor schema and ownership so the platform can represent many tenants and many sites safely.

### Phase 02

Refactor auth, memberships, and roles so users act inside a site-owning tenant context.

### Phase 03

Apply tenant and site isolation to every customer-facing API path.

### Phase 04

Convert the current dashboard into a customer workspace for hospitality operators.

### Phase 05

Add the operator/admin console for the SaaS owner.

### Phase 06

Add billing, plan enforcement, and pricing logic suitable for hospitality brands.

### Phase 07

Automate dedicated customer website deployments.

### Phase 08

Make the website runtime reusable across many customer sites while preserving SEO and multilingual behavior.

### Phase 09

Add domains, forms, and operational tooling.

### Phase 10

Harden, test, and launch.

## Hospitality-Specific Product Decisions

These decisions should remain stable through implementation.

### Decision 1: inquiry-first, not booking-first

The product will generate and capture direct inquiries.

Possible contact actions:

- contact form
- WhatsApp link
- booking-request form
- external booking engine link
- email CTA

What v1 should not attempt:

- reservation inventory
- checkout/payment for stays
- OTA synchronization
- rate management

### Decision 2: sell to small brands, not enterprise operators

The first version should target hospitality brands that can be served with page-based website composition and a form-driven funnel.

Good fit:

- one villa or lodge
- one boutique hotel
- one glamping site
- one brand with several unit pages

Poor fit in v1:

- hundreds of listings
- heavy inventory logic
- complex rates and reservations

### Decision 3: templates are part of the moat

The template catalog should be hospitality-native.

Suggested starter templates:

- boutique hotel website
- vacation rental direct-inquiry site
- glamping resort site
- B&B and guest house site
- villa collection site

## Delivery Sequence

### Foundation sequence

The first three phases are non-negotiable and sequential:

1. scope and naming
2. schema and tenancy
3. auth and isolation

Without those, billing, deployments, and customer onboarding are not safe.

### Middle sequence

Once the data and auth model are stable:

- customer workspace
- operator admin console
- billing and plan enforcement

### Late sequence

Once the control plane is stable:

- provisioning and deployments
- site runtime generalization
- domains, forms, operations
- testing and launch

## Parallelism Guidance

### Can run in parallel later

- operator admin console and billing UI
- some deployment automation work and runtime adaptation work once the deployment contract is stable
- form and domain workflows once the site and subscription models are stable

### Must not run in parallel too early

- schema redesign and billing implementation
- tenant auth refactor and public onboarding flows
- deployment orchestration before the site entity and permissions model are stable

## Repo Touchpoints That Matter Most

### Backend

- [apps/api/src/prisma/schema.prisma](../apps/api/src/prisma/schema.prisma)
- [apps/api/src/auth/auth.service.ts](../apps/api/src/auth/auth.service.ts)
- [apps/api/src/auth/guards/roles.guard.ts](../apps/api/src/auth/guards/roles.guard.ts)
- [apps/api/src/pages/pages.service.ts](../apps/api/src/pages/pages.service.ts)
- [apps/api/src/settings/settings.service.ts](../apps/api/src/settings/settings.service.ts)
- [apps/api/src/revalidation/revalidation.service.ts](../apps/api/src/revalidation/revalidation.service.ts)

### Dashboard

- [apps/dashboard/src/routes.tsx](../apps/dashboard/src/routes.tsx)
- [apps/dashboard/src/auth/AuthProvider.tsx](../apps/dashboard/src/auth/AuthProvider.tsx)
- [apps/dashboard/src/pages/PagesListPage.tsx](../apps/dashboard/src/pages/PagesListPage.tsx)
- [apps/dashboard/src/pages/EditorPage.tsx](../apps/dashboard/src/pages/EditorPage.tsx)
- [apps/dashboard/src/pages/SettingsPage.tsx](../apps/dashboard/src/pages/SettingsPage.tsx)

### Website runtime

- [apps/website/lib/cmsClient.js](../apps/website/lib/cmsClient.js)
- [apps/website/pages/[...slug].js](../apps/website/pages/[...slug].js)
- [apps/website/components/seoHead.jsx](../apps/website/components/seoHead.jsx)
- [apps/website/next-sitemap.config.js](../apps/website/next-sitemap.config.js)

### Shared component layer

- [packages/puck-components/src](../packages/puck-components/src)

## Acceptance Criteria For The Full SaaS Conversion

The platform is ready only when all of these are true:

1. A new customer can sign up, subscribe, and access a hospitality-focused workspace.
2. The customer can launch a site from a hospitality template, edit pages visually, and publish.
3. The customer can connect a domain and receive inquiry submissions.
4. The customer can operate in multiple languages if their plan allows it.
5. The operator can see subscription state, deploy status, domain state, and support data in an admin console.
6. A failed deployment or failed provisioning job can be retried without manual database repair.
7. Tenant isolation is proven by tests.
8. The platform still feels clearly hospitality-specific, not generic.

## Handoff Guidance For Opus 4.7

Use the phase docs in order. Treat each phase as its own scoped delivery unit with its own validation steps.

Start with:

- [phases/PHASE_00_SCOPE_AND_POSITIONING.md](./phases/PHASE_00_SCOPE_AND_POSITIONING.md)
- [phases/PHASE_01_SCHEMA_AND_MULTI_TENANCY.md](./phases/PHASE_01_SCHEMA_AND_MULTI_TENANCY.md)
- [phases/PHASE_02_AUTH_MEMBERSHIP_AND_ROLES.md](./phases/PHASE_02_AUTH_MEMBERSHIP_AND_ROLES.md)

Do not jump straight into billing or deployments until those are completed and validated.

## Companion Guide For GPT-5.4 And Sonnet 4.6

If the implementation will be run with GPT-5.4 and Sonnet 4.6 instead of Opus 4.7, use the companion execution guide here:

- [03_MODEL_ASSIGNMENT_AND_PROMPTS.md](./03_MODEL_ASSIGNMENT_AND_PROMPTS.md)

That guide assigns a primary model to each phase and includes prompt patterns tuned for the strengths and risks of each model.
