# StayLayer Operator Console Docs

Date: 2026-05-18

This folder is the implementation handoff for building a new dedicated operator console app. The existing embedded operator console has been removed from `apps/dashboard`; the dashboard should now remain customer-workspace only.

## Core Decision

Build a new React + Vite app under `apps/operator-console` instead of continuing inside `apps/dashboard`.

Reasons:

- Customer auth and operator auth need separate surfaces, routing, storage, permission checks, and testing.
- The operator console will become a large internal product with support, billing, permissioning, analytics, audit, customer data operations, and recovery workflows.
- Retool and Refine.dev are useful inspiration, but the console should be custom-built for StayLayer's domain because support and billing workflows are sensitive and tightly coupled to tenant/site state.

## Role Language

Target operator roles:

- `PLATFORM_OWNER`: owns everything, can view and manage all operator features.
- `SUPPORT_ADMIN`: owns customer support, incidents, operational recovery, support cases, and customer-facing diagnostics.
- `FINANCE_ADMIN`: owns billing, subscriptions, invoices, dunning, revenue risk, credits, refunds, plan changes, and financial audit.

## Recommended Reading Order

1. [00-current-state-and-removal.md](00-current-state-and-removal.md)
2. [01-architecture-and-tech-stack.md](01-architecture-and-tech-stack.md)
3. [02-auth-rbac-and-permissions.md](02-auth-rbac-and-permissions.md)
4. [03-support-system.md](03-support-system.md)
5. [04-billing-control-system.md](04-billing-control-system.md)
6. [05-customer-data-operations-and-audit.md](05-customer-data-operations-and-audit.md)
7. [06-analytics-metrics-and-observability.md](06-analytics-metrics-and-observability.md)
8. [07-backend-api-gap-map.md](07-backend-api-gap-map.md)
9. [08-opus-4-7-implementation-phases.md](08-opus-4-7-implementation-phases.md)
10. [09-testing-security-and-release.md](09-testing-security-and-release.md)

## Non-Negotiable Invariants

- Do not put operator routes back into `apps/dashboard`.
- Do not reuse dashboard session storage for operator sessions.
- Do not let customer membership roles authorize operator actions.
- Every operator mutation must be audited with actor, permission, target, reason, before/after where possible, and request id.
- Billing actions need stricter controls than normal support actions.
- Support tools must make customer context easier to understand without bypassing tenant isolation.
- Read-only operator views should ship before destructive or financially sensitive operator actions.
