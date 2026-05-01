# Phase 05: Operator Admin Console

## Objective

Create a separate operator-facing control surface for the SaaS buyer.

The customer workspace is not enough. The buyer needs a platform-level console to run the business.

## What The Operator Must Be Able To Do

- view all tenants
- view subscription states
- view deployment states
- view domain verification states
- inspect inquiry volume
- suspend or reactivate accounts
- retry failed provisioning
- trigger redeploy or revalidation
- review audit activity

## Suggested Admin Areas

### Tenants

- tenant list
- plan
- status
- site count
- membership count
- health summary

### Deployments

- latest deploy per site
- status history
- provider project ids
- redeploy or retry actions

### Subscriptions

- active, past_due, canceled states
- plan key
- renewal dates
- webhook sync status

### Domains

- verification state
- SSL state
- primary domain
- failures needing support

### Forms

- submission volume
- spam ratio
- delivery issues

### Support and audit

- impersonation or support session flow if added later
- action logs
- operator notes

## Key Implementation Tasks

1. add `/admin` route tree
2. separate operator role checks from customer membership checks
3. create admin-friendly list and detail APIs
4. add guarded manual actions for support and recovery
5. log all manual operator actions in audit logs

## Hospitality-Specific Needs

The operator will likely support non-technical hospitality customers. The admin console should make common incidents obvious:

- “site published but domain not verified”
- “billing failed so publishing is disabled”
- “deploy failed after template setup”
- “form submissions not routing to destination email”

## Definition Of Done

This phase is done when:

1. the buyer can operate the platform without direct database access
2. support-critical actions exist in the UI
3. admin routes are isolated from customer routes
4. all manual recovery actions are permission-checked and logged
