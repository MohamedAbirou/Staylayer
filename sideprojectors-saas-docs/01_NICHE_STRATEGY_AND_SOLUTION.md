# Niche Strategy And Solution

## Executive Recommendation

The best niche for this codebase is:

**Inquiry-first direct-booking marketing sites for independent vacation rentals, boutique hotels, B&Bs, guest houses, and glamping brands with roughly 1 to 20 units.**

That is the cleanest path to a sellable SaaS because it aligns with what the repo already does well:

- multilingual marketing pages
- strong SEO control
- visual page editing with reusable sections
- form-based lead capture
- hospitality-oriented messaging and component inventory
- a public website runtime already separated from the editor

This also avoids the biggest trap: trying to sell a generic website builder or a half-finished PMS. The buyer on SideProjectors needs a clear revenue story and a credible scope. This niche gives both.

## Why This Niche Wins

### 1. It fits the existing product DNA

The current website already leans heavily toward hospitality and direct-booking positioning.

Relevant repo signals:

- [apps/website/components/financialToolsTabs.jsx](../apps/website/components/financialToolsTabs.jsx) references channel manager, PMS, and reporting.
- [apps/website/components/otas.jsx](../apps/website/components/otas.jsx) includes OTA logos such as Airbnb, Booking.com, Vrbo, Expedia, and Hotelbeds.
- [apps/website/pages/website-builder-vacation-rentals.js](../apps/website/pages/website-builder-vacation-rentals.js) is already written around vacation-rental website building and direct bookings.
- [apps/website/components/featuresTable.jsx](../apps/website/components/featuresTable.jsx) includes direct-booking, guest messaging, and hospitality-specific sales copy.

This means the codebase already carries a believable hospitality story. A buyer can market that much more easily than a generic “landing page builder”.

### 2. It matches the current technical ceiling

The repo is currently strong at:

- page authoring
- translations
- SEO and settings
- publishing and revalidation
- controlled component-based layouts

It is not currently a true SaaS, and it is not a booking engine. The recommended niche deliberately works with those constraints. In v1, the platform should help operators launch and manage hospitality websites that generate inquiries, direct-contact leads, and optionally link out to external booking flows.

### 3. It gives the buyer a simple revenue model

For this niche, the operator can charge recurring subscriptions around:

- number of brand sites
- number of properties or unit pages supported
- number of languages
- number of team seats
- number of monthly inquiry submissions
- premium template access

That is easier to package and explain than pricing “by pages”, which is not the core economic unit in hospitality.

## Recommended Market Positioning

### Positioning statement

This SaaS should be positioned as:

**A multilingual, SEO-first website platform for small hospitality brands that want more direct inquiries and stronger brand presence without hiring developers.**

### Ideal customers

- independent vacation-rental hosts with 1 to 10 units
- boutique hotels and B&Bs
- guest houses and farm stays
- glamping and camping operators
- small hospitality management brands that need one branded site and several property pages

### Not the target customer in v1

- enterprise hotel groups
- PMS buyers expecting reservation operations in the app
- agencies needing highly customized white-label platforms on day one
- marketplaces, OTAs, or multi-sided booking businesses

## Recommended Product Definition

The product should be a **hospitality website SaaS**, not a general no-code site builder.

### What customers get

- a branded public website
- drag-and-drop page editing through the existing Puck-based editor
- hospitality-specific templates and sections
- multilingual page support
- site-wide and page-level SEO controls
- contact and inquiry forms
- domain connection
- managed deployment
- analytics field configuration

### What customers do not get in v1

- native booking engine
- room inventory management
- calendar synchronization
- payment processing for reservations
- advanced CRM or email marketing automation

Those can become future integrations, but they should not define the v1 promise.

## The Product Shape I Recommend

### The core promise

“Launch a direct-inquiry hospitality website in hours, edit it visually, publish on your own domain, and manage your content in multiple languages.”

### The operational model

- one shared control plane for the SaaS operator
- one shared API and database
- one customer workspace application
- one operator/admin console
- one dedicated website deployment per customer site

This model gives the buyer a stronger commercial story than one giant shared frontend runtime, while still keeping backend operations manageable.

## Why Dedicated Customer Deployments Are Still The Right Choice

You approved per-customer deployment, and for this niche that is the correct choice.

Reasons:

- it fits the “premium hospitality website” sales angle
- it makes custom-domain handling easier to explain and operate
- it gives the buyer a cleaner support story
- it creates space for higher-value plans later
- it avoids some of the brand-mixing risks of a single shared public runtime

Recommended boundary:

- shared control plane: API, dashboard, billing, provisioning, admin
- dedicated site runtime: one deployed Next.js site per customer site

## Recommended Pricing Logic

Do not lead with page-based pricing. For this niche, page count is a secondary limit, not the main one.

### Better pricing units

- site count
- unit or property count band
- number of locales
- number of operators/editors
- inquiry volume
- premium support or premium templates

### Example pricing structure

#### Starter Stay

- 1 site
- 1 language
- up to 10 pages
- up to 1 property or a simple single-location brand
- 1 custom domain
- basic inquiry form

#### Boutique Growth

- 1 site
- up to 3 languages
- up to 30 pages
- up to 5 properties or room-type pages
- richer SEO controls
- higher inquiry limits

#### Portfolio

- multiple sites or larger property portfolios
- more seats
- more locales
- priority support
- future integrations first

## How The SaaS Should Be Sold On SideProjectors

The strongest angle is not “we migrated a Next.js site to Puck”.

The strongest angle is:

**A recurring-revenue hospitality website platform with multilingual editing, SEO controls, domain management, and automated site deployment for small operators who want more direct inquiries.**

That is a business. The buyer can imagine:

- who they will sell to
- why those customers will pay monthly
- what features matter at launch
- what to postpone without breaking the business model

## Architecture Recommendation

### Shared control plane

Keep these centralized:

- tenants/accounts
- user memberships
- subscriptions
- site metadata
- deployments metadata
- domains metadata
- forms and submissions
- audit logs
- template catalog
- plan enforcement

### Dedicated public websites

Each customer site gets a dedicated website deployment with:

- customer site identifier
- shared API URL
- revalidation secret
- locale configuration
- optional analytics flags

### Data model direction

The current schema in [apps/api/src/prisma/schema.prisma](../apps/api/src/prisma/schema.prisma) is single-tenant. The future schema should introduce:

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

The critical shift is that pages and settings must belong to a site, and sites must belong to a tenant.

## Product Surface Recommendations

### Customer workspace

Build on the current dashboard and reframe it as a hospitality website workspace.

It should include:

- onboarding
- site setup
- page editing
- SEO settings
- locale management
- domain setup
- inquiry inbox or submission history
- billing and plan view

### Operator admin console

Add a separate operator-facing area for the SideProjectors buyer.

It should include:

- tenant management
- subscription status
- deployment health
- domain verification status
- form volume monitoring
- manual retry and support actions
- suspension/reactivation tools

### Public website runtime

The current website app already gives a strong foundation through:

- remote content fetching in [apps/website/lib/cmsClient.js](../apps/website/lib/cmsClient.js)
- catch-all page rendering in [apps/website/pages/[...slug].js](../apps/website/pages/[...slug].js)
- ISR/webhook revalidation in [apps/api/src/revalidation/revalidation.service.ts](../apps/api/src/revalidation/revalidation.service.ts)

That runtime should become site-aware rather than singleton-aware.

## Recommended Feature Set For V1

### Must-have

- account signup and login
- one tenant with one site on lower plans
- hospitality starter templates
- visual page editing
- multilingual support
- page-level and site-level SEO
- site publishing
- domain connection
- inquiry/contact forms
- operator admin console
- billing and subscription state
- provisioning of dedicated site deployments

### Nice-to-have but not launch-blocking

- template cloning marketplace
- lead export integrations
- simple CRM notes
- analytics dashboards
- multiple sites per tenant

### Explicitly exclude from v1

- booking engine
- OTA synchronization
- PMS workflow execution
- inventory/rates engine
- guest check-in flows
- team workflow automation
- enterprise SSO

## Differentiation Strategy

The platform should not compete by being more general. It should compete by being more specific.

Potential differentiators:

- hospitality-native templates
- multilingual direct-inquiry positioning
- fast setup for small operators
- managed deployment and domains
- content editing without agencies or developers
- future optional integrations with PMS or booking links, without forcing them into v1

## Risks And Mitigations

### Risk: the product drifts into being a PMS

Mitigation:

- freeze the v1 promise around marketing websites and inquiry capture
- treat booking or PMS integrations as external links or later add-ons

### Risk: the niche becomes too broad

Mitigation:

- use hospitality as the broad vertical, but keep the first ICP narrow: 1 to 20 unit brands
- write all launch copy around direct-inquiry hospitality sites

### Risk: pricing becomes confusing

Mitigation:

- anchor plans around site count, unit band, locales, and support level
- keep page count as a silent or secondary cap

### Risk: per-site deployments raise operational cost

Mitigation:

- keep the control plane shared
- automate provisioning early
- include deployment cost assumptions in pricing

## Final Recommendation

Build and sell this as a **hospitality website SaaS for small direct-booking brands**, not as a generic site builder.

The ideal short version is:

**A multilingual, SEO-first, inquiry-driven website platform for vacation rentals, boutique hotels, and glamping brands, with managed deployment and visual editing.**

That is the niche most aligned with the repo, the fastest path to a credible SideProjectors listing, and the clearest way for a buyer to imagine recurring revenue.
