# 04 Billing Control System

## Product Goal

Build a complete billing operations cockpit for `FINANCE_ADMIN` and `PLATFORM_OWNER`. Billing is the most sensitive area of the operator console, so accuracy, auditability, and guardrails matter more than speed.

## Current Billing Foundation

The backend already has:

- Stripe-based billing service.
- subscription records.
- billing plans and limits.
- customer billing plan snapshot.
- Stripe webhooks.
- admin subscription listing.
- plan enforcement primitives and usage totals.

The new console must turn this into an operator-grade billing control system.

## Core Screens

### Billing Command Center

Metrics:

- MRR estimate
- active subscriptions
- trials
- trials ending soon
- past due accounts
- canceled accounts
- failed payments
- webhook failures
- revenue at risk
- plan mix
- upgrade/downgrade trends

Queues:

- payment recovery
- trial ending soon
- canceled recently
- webhook needs attention
- mismatched Stripe/local state
- limit override review

### Billing Account Detail

Should include:

- tenant identity
- plan and status
- current period
- grace period
- Stripe customer id
- Stripe subscription id
- provider price id
- cancellation flags
- pending plan change
- limits snapshot
- usage snapshot
- invoices
- payment events
- webhook events
- support cases
- audit timeline

### Subscription Operations

Actions:

- refresh from Stripe
- open Stripe customer/subscription link
- change plan
- schedule downgrade
- cancel at period end
- reactivate subscription if provider allows
- apply manual grace period extension
- create billing support case
- add billing note

All actions require a reason.

### Invoice And Payment Operations

Actions:

- view invoices
- mark invoice status from provider sync only, not local manual truth
- retry invoice sync
- open hosted invoice link
- review payment failures
- start refund workflow if Stripe supports it
- issue credit workflow if Stripe supports it

Refunds and credits should require stronger confirmation and optional approval thresholds.

### Plan And Entitlement Control

Capabilities:

- view plan definition and current tenant usage
- compare current plan vs target plan
- show what limits would change before applying a plan change
- record manual entitlement overrides separately from normal plan limits
- expire overrides automatically where possible
- audit all overrides

Do not silently mutate plan limits without a billing audit event.

## Billing Data Model Gaps

Recommended additions:

- `BillingAccountSnapshot`
- `BillingInvoiceSnapshot`
- `BillingPaymentEvent`
- `BillingOperatorNote`
- `BillingActionRequest`
- `BillingApproval`
- `BillingEntitlementOverride`
- `BillingReconciliationJob`

`BillingActionRequest` should capture:

- actor id
- tenant id
- action type
- payload
- reason
- status
- approver id if required
- provider object ids
- before snapshot
- after snapshot

## Stripe Reconciliation

The console must expose local billing truth and provider truth without confusing them.

Add:

- provider sync timestamp
- local status
- provider status
- mismatch warning
- webhook replay queue
- reconciliation job history
- idempotency key display for operator-triggered syncs

## Permission Requirements

`FINANCE_ADMIN` can:

- read all billing data
- manage subscriptions
- sync Stripe data
- manage credits/refunds within policy
- manage billing notes and billing support cases
- read tenant operational health where relevant to billing

`FINANCE_ADMIN` cannot:

- manage operator users
- delete tenants
- retry deployments unless Platform Owner grants explicit permission
- edit customer content
- change support system policy

## Acceptance Criteria

Billing system is ready when:

- billing data can be inspected without database access
- Stripe/local mismatches are obvious
- every billing mutation is audited
- sensitive actions require reason and confirmation
- support can hand off to billing with full context
- billing can return context back to support without side-channel notes
