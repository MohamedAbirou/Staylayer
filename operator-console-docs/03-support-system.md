# 03 Support System

## Product Goal

Build a native, advanced support system for StayLayer operators. Support should not be a loose collection of lists; it should be a full customer operations workspace.

The support system must help SUPPORT_ADMIN users answer three questions quickly:

1. Who is affected?
2. What changed?
3. What action is safest now?

## Build Native First, Integrate Later

Open-source systems worth studying:

- Chatwoot for conversation inbox patterns.
- Zammad for ticket lifecycle and knowledge-base ideas.
- FreeScout for simple email-ticket workflows.
- Plane or Linear-style issue views for queue ergonomics.

Recommended decision: build a native StayLayer support system instead of embedding one of those as the source of truth.

Reason:

- Support cases need first-class tenant, site, billing, deployment, domain, form, SEO, translation, and audit context.
- Operators need action buttons that call StayLayer backend recovery workflows.
- External ticketing tools would still need deep custom panels for the real work.

Optional later integration:

- Inbound support email creates or updates a native support case.
- Chatwoot can be used as a customer chat channel, but the canonical case record should remain in StayLayer.
- External helpdesk ids can be stored as linked references.

## Core Data Model

Add backend models similar to:

- `SupportCase`
- `SupportCaseMessage`
- `SupportCaseNote`
- `SupportCaseEvent`
- `SupportCaseAssignment`
- `SupportCaseSlaSnapshot`
- `SupportCaseTag`
- `SupportMacro`
- `SupportSavedView`
- `SupportAttachment`
- `SupportLinkedResource`
- `SupportHandoff`

Important fields for `SupportCase`:

- tenant id
- site id optional
- requester user id optional
- requester email
- source channel: manual, email, customer_workspace, system_alert, billing, webhook
- status: open, pending_customer, pending_internal, resolved, closed
- priority: low, normal, high, urgent
- category: billing, deployment, domain, forms, seo, translation, access, content, account, other
- assigned operator id
- created at, first response at, resolved at, closed at
- SLA due timestamps
- linked alert ids
- linked deployment/domain/form/billing records

## Required Support UI

### Support Inbox

Features:

- queues by status, priority, SLA breach, assigned-to-me, unassigned, category
- saved views
- keyboard navigation
- bulk assign/tag/status actions
- unread/customer-waiting indicators
- quick filters for billing, deployment, domain, forms, access

### Case Detail

Must include:

- threaded customer-visible messages
- private internal notes
- timeline of system events and operator actions
- customer account context
- tenant health snapshot
- linked resources
- suggested next actions
- macro insertion
- attachments
- handoff panel for Billing or Platform Owner

### Tenant 360 Support Panel

Support needs one screen that combines:

- tenant status
- active subscription and billing risk
- sites and live URLs
- recent deployments
- domain status
- form delivery health
- recent submissions summary
- open alerts
- recent audit events
- workspace members
- support case history

### Incident Mode

For repeated failures, support should be able to group cases into an incident.

Incident fields:

- title
- affected tenants/sites
- owning operator
- severity
- root cause
- status
- updates
- linked support cases
- linked operational alerts

## Recovery Actions From Support

SUPPORT_ADMIN can perform or request actions such as:

- retry deployment
- retry domain verification
- retry form delivery
- mark support case resolved
- add internal note
- escalate to Billing
- escalate to Platform Owner
- request tenant suspension review

SUPPORT_ADMIN should not directly:

- refund payments
- apply credits
- change plans
- delete tenants
- permanently delete customer content
- manage operator users

## SLA And Queue Metrics

Track:

- first response time
- resolution time
- cases opened/resolved per day
- breached SLA count
- cases by category
- cases by plan tier
- cases by root cause
- reopen rate
- billing handoff count

## AI-Assisted Support Later

Do not make AI mandatory for v1, but design events and context so future AI can help.

Potential later features:

- summarize tenant health
- draft support replies
- suggest root cause
- recommend recovery actions
- detect duplicate incidents
- generate postmortem notes

Every AI-generated action must remain human-reviewed before mutation.
