# Phase 07: Provisioning And Deployments

## Objective

Automate dedicated site deployments for each customer site while keeping the control plane shared.

This is the phase that converts the product from “editable CMS” into a real hosted SaaS offer.

## Current Problem

The current deployment model is manual and single-site oriented.

Relevant references:

- [../../docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)
- [../../apps/api/src/revalidation/revalidation.service.ts](../../apps/api/src/revalidation/revalidation.service.ts)
- [../../apps/website/lib/cmsClient.js](../../apps/website/lib/cmsClient.js)

## Provisioning Model

For each customer site, the platform should be able to:

1. create a deployment record
2. create the website project at the deployment provider
3. set required environment variables
4. trigger the initial deployment
5. store project ids and deployment metadata
6. track success, failure, and retries

## Recommended Environment Contract

Each dedicated site deployment should receive at least:

- `CMS_API_URL`
- `SITE_ID`
- `SITE_SLUG`
- `REVALIDATE_SECRET`
- `PRIMARY_LOCALE`
- `ENABLED_LOCALES`
- optional public brand values where useful

## Job States

Provisioning should be modeled as a state machine, not a fire-and-forget request.

Suggested states:

- pending
- creating_project
- syncing_env
- deploying
- live
- failed
- retrying

## Required Implementation Tasks

1. create deployment and provisioning models
2. build deployment-provider client integration
3. make provisioning idempotent
4. store provider metadata and failure reasons
5. add operator retry controls
6. connect publish actions to site-specific revalidation or redeploy logic

## Hospitality-Specific Concerns

Because this product is sold as a premium hospitality website platform, deployment failure is customer-visible and business-critical. The system must support:

- visible site status in the customer workspace
- clear operator diagnostics
- domain readiness coordination with deployment readiness

## Definition Of Done

This phase is done when:

1. a new paying customer site can be provisioned automatically
2. deployment failures are visible and retryable
3. the platform knows which deployment belongs to which site
4. publishing and revalidation target the correct site deployment
