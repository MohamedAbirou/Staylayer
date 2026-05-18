# 06 Analytics, Metrics, And Observability

## Goal

The operator console should be rich with metrics, but every chart should drive an operator decision. Metrics are not decoration; they are navigation into work.

## Command Center Metrics

Top-level cards:

- total tenants
- active tenants
- suspended tenants
- active sites
- live sites
- failed deployments
- domains needing action
- failed form deliveries
- open support cases
- urgent support cases
- past due billing accounts
- trials ending soon
- revenue at risk

## Business Metrics

Recommended charts:

- new tenants over time
- active vs suspended tenants
- plan mix
- trial conversion funnel
- churn/cancel trend
- MRR estimate by plan
- payment failure trend
- expansion and downgrade movement
- support volume by plan tier

## Support Metrics

Recommended charts:

- open cases by priority
- cases by category
- first response time
- resolution time
- SLA breaches
- reopen rate
- cases created from operational alerts
- cases handed off to billing
- operator workload

## Operations Metrics

Recommended charts:

- deployment success rate
- deployment duration percentiles
- domain verification success rate
- SSL provisioning states
- form submission volume
- failed delivery rate
- spam ratio
- SEO audit critical issue trend
- search integration health
- PSI/Core Web Vitals trend by site if available

## Customer Health Score

Build a health score for tenant prioritization.

Inputs:

- billing status
- deployment health
- domain health
- form delivery health
- inquiry activity
- SEO readiness
- active support cases
- recent critical alerts
- plan usage pressure
- last customer activity

Example output:

- 90 to 100: healthy
- 70 to 89: watch
- 40 to 69: needs support
- 0 to 39: critical

The score must show reasons, not just a number.

## Data Freshness

Every dashboard widget should show freshness:

- live query
- generated at
- last sync at
- last provider webhook at
- stale warning where relevant

Billing and provider-derived metrics must distinguish local data from Stripe data.

## Metrics Backend Strategy

Do not calculate every dashboard from heavy live cross-tenant joins forever.

Suggested progression:

1. Use live queries for early implementation and correctness.
2. Add indexed aggregate endpoints for expensive lists.
3. Add daily/hourly snapshots for historical charts.
4. Add reconciliation jobs for provider-derived metrics.

Potential models:

- `OperatorMetricSnapshot`
- `TenantHealthSnapshot`
- `SupportMetricSnapshot`
- `BillingMetricSnapshot`
- `OperationalMetricSnapshot`

## Observability

The console should surface system reliability, not hide it.

Operator observability panels:

- API health
- database connectivity
- webhook processing health
- job queue failures if queues exist
- deployment provider status
- email delivery provider status
- Stripe webhook status
- recent critical backend errors if error tracking exists

Do not expose secrets or raw stack traces in the operator UI.
