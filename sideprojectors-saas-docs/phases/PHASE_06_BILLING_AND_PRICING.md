# Phase 06: Billing And Pricing

## Objective

Add recurring subscription billing and plan enforcement that fit the hospitality niche.

The point of this phase is to make the product commercially operable, not just technically multi-tenant.

## Pricing Strategy For This Niche

The pricing model should be built around the business value hospitality customers understand.

### Recommended commercial levers

- site count
- enabled locales
- seat count
- inquiry volume
- support tier
- optional property or room-page band

### De-emphasize

- raw page count as the main headline price unit

## Recommended Initial Plan Shape

### Starter Stay

- 1 site
- 1 locale
- low seat count
- one domain
- basic inquiry forms
- suitable for a single-property or single-brand site

### Boutique Growth

- 1 site
- multiple locales
- more pages and seats
- higher inquiry limits
- suitable for boutique hotels, B&Bs, or small portfolios

### Portfolio

- multiple sites or larger allowances
- advanced support
- larger form volume caps
- early access to integrations or premium templates

## Billing System Tasks

1. choose the billing provider, ideally Stripe
2. create products and prices that map to the plan model
3. store provider customer and subscription ids
4. process webhooks for status changes
5. persist billing status to the shared control plane
6. expose plan state in customer and operator interfaces

## Plan Enforcement Tasks

Enforce limits at the API layer for:

- maximum active sites
- maximum enabled locales
- maximum seats
- maximum monthly submissions
- optional page caps

Do not rely on frontend-only gating.

## Non-Payment Behavior

Define this explicitly:

- grace period behavior
- whether editing stays enabled
- whether publishing is blocked
- whether the public site remains live during past-due periods
- what suspension means operationally

Recommended v1 behavior:

- short grace period
- editing allowed during grace period
- new publishing blocked after grace period
- operator retains override ability

## Hospitality-Specific Notes

Many small hospitality buyers think in seasonal cash flow, not in abstract SaaS limits. Billing UI should explain plans in plain language:

- number of languages
- how many sites they can run
- how many team members can edit
- how many monthly inquiries are included

## Definition Of Done

This phase is done when:

1. a new tenant can subscribe and activate a plan
2. plan state is stored in the platform correctly
3. limits are enforced at API level
4. customer and operator UIs reflect billing state accurately
5. non-payment behavior is defined and tested
