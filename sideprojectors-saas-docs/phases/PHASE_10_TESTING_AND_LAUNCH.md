# Phase 10: Testing And Launch

## Objective

Harden the platform so it can be sold and operated as a business, not just demonstrated as a prototype.

## Required Test Coverage

### API tests

- tenant isolation
- site ownership enforcement
- role boundaries
- billing limit enforcement
- provisioning state transitions
- form submission routing

### Frontend tests

- signup and onboarding
- workspace navigation
- page editing and publishing
- domain setup flows
- billing visibility
- operator recovery actions

### End-to-end tests

At least these end-to-end paths must exist:

1. sign up -> subscribe -> create site -> provision -> edit -> publish
2. connect domain -> verify -> public site loads
3. public inquiry -> stored submission -> customer sees it
4. failed payment -> plan state changes -> restricted behavior is enforced
5. operator retry of failed provisioning -> site recovers

## Operational Readiness

Add:

- structured logging
- request correlation ids
- error tracking
- deployment telemetry
- synthetic health checks for publish-to-live flow

## Launch Checklist

Before launch, verify:

1. staging environment mirrors production architecture
2. at least two tenants can coexist without data leakage
3. at least two dedicated site deployments can run simultaneously
4. real domain attachment works on the chosen provider
5. form routing works on a real deployed site
6. billing webhooks are reliable and idempotent

## Buyer-Readiness Checklist

The product is ready to present as a SideProjectors business only when the buyer can understand:

- who it serves
- how it makes money
- what the operational workload looks like
- how customer sites get provisioned
- what the main support cases are

## Definition Of Done

This phase is done when:

1. the full revenue path works from signup to live site
2. cross-tenant isolation is proven
3. operator recovery paths work without manual database edits
4. logs and alerts are good enough for real support work
5. the product can be described honestly as a recurring-revenue hospitality website SaaS
