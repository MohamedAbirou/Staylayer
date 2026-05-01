# Phase 09: Domains, Forms, And Operations

## Objective

Finish the customer-facing SaaS experience with custom domains, inquiry handling, and operator visibility.

## Domains

### Customer capabilities

- add a custom domain
- verify ownership or required DNS state
- mark the primary domain
- understand the current status clearly

### Operator capabilities

- inspect domain state across all sites
- retry sync or verification checks
- identify SSL or propagation failures

### Recommended domain statuses

- pending
- dns_required
- verifying
- active
- failed

## Forms

The product promise is inquiry-first. Forms are therefore core, not auxiliary.

### Required form types

- general contact
- stay inquiry
- availability request
- group booking inquiry

### Minimum submission behavior

- store submissions centrally
- show them in customer workspace
- optionally email or webhook them onward
- capture originating page and locale
- basic spam protection

Relevant existing references:

- [../../apps/website/components/contactForm.jsx](../../apps/website/components/contactForm.jsx)
- [../../apps/website/lib/FormSubmitHandler.js](../../apps/website/lib/FormSubmitHandler.js)

## Operations

The operator console should expose:

- deploy health
- domain failures
- form delivery failures
- subscription issues
- suspicious submission spikes

## Required Implementation Tasks

1. add domain records and status tracking
2. build domain UI in customer and operator surfaces
3. add form submission storage and moderation basics
4. add delivery notifications or forwarding
5. add support views for failed domains and failed form routing

## Hospitality-Specific Notes

Hospitality sites depend heavily on trust and responsiveness. A broken inquiry form is commercially serious. Monitoring and status visibility should treat forms as a first-class operational surface.

## Definition Of Done

This phase is done when:

1. a customer can connect a domain and understand its status
2. inquiry forms create stored submissions tied to the correct site and page
3. customers can review inquiry history
4. operators can diagnose domain and form issues without database access
