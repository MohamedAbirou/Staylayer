# 08 Opus 4.7 Implementation Phases

## Execution Rule

Give Opus 4.7 one phase at a time. Each phase must end with validation, a short risk note, and explicit follow-up items. Do not ask it to build the entire console in one prompt.

## Phase 0: Confirm Extraction And Contracts

Goal:

- Verify `apps/dashboard` is customer-only.
- Confirm no dashboard route imports operator pages, platform-role guards, or operator API clients.
- Document remaining backend `/admin/*` endpoints as temporary backend assets only.

Likely validation:

- dashboard type-check
- grep for dashboard admin references
- customer e2e smoke test

Acceptance:

- no `/admin` UI in dashboard
- customer auth still works
- operator backend endpoints are not consumed by dashboard

## Phase 1: Scaffold New Operator App

Goal:

- Create `apps/operator-console` as a Vite React app.
- Add package scripts and workspace integration.
- Add independent layout, router, API client, auth provider placeholders, and design foundation.

Likely files:

- `apps/operator-console/package.json`
- `apps/operator-console/vite.config.ts`
- `apps/operator-console/src/*`
- root workspace/turbo config if needed

Acceptance:

- app builds and type-checks
- app runs on its own dev port
- no import from dashboard auth/layout/pages

## Phase 2: Operator Auth And Role Rename

Goal:

- Add dedicated operator auth endpoints.
- Implement operator session bootstrap in the new app.

Backend tasks:

- add operator auth controller
- add operator session DTO
- add operator auth tests
- seed Finance Admin user

Frontend tasks:

- operator login page
- session refresh
- protected routes
- logout
- unauthorized/forbidden views

Acceptance:

- customer-only users cannot access operator app
- operator users can sign in to operator app
- dashboard customer login remains unchanged

## Phase 3: Permission Registry And Guards

Goal:

- Implement granular permissions behind the three role bundles.

Backend tasks:

- permission registry
- role-to-permission mapping
- permission guard/decorator
- mutation audit interceptor foundation

Frontend tasks:

- permission context
- `useCan`
- protected route wrapper
- permission-aware navigation

Acceptance:

- SUPPORT_ADMIN cannot execute billing mutations
- FINANCE_ADMIN cannot execute support recovery actions unless explicitly allowed
- PLATFORM_OWNER can access all routes

## Phase 4: Operator Resource Shell And Read-Only Data

Goal:

- Create core read-only operator views using existing customer-domain data.

Build:

- Command Center v1
- tenant list
- tenant detail / Tenant 360
- site detail / Site 360
- audit log v1
- global search v1

Acceptance:

- operators can inspect tenants/sites without database access
- views show data freshness
- list/detail contracts are consistent

## Phase 5: Support System Backend

Goal:

- Add native support case data model and APIs.

Build:

- support case schema
- messages, notes, events, tags, assignments
- support case lifecycle service
- support queues
- case-resource linking
- support audit events

Acceptance:

- support case can be created manually
- support case can be linked to tenant/site/resource
- notes and status changes are audited
- permission boundaries are tested

## Phase 6: Support System UI

Goal:

- Build the operator support workspace.

Build:

- Support Inbox
- Case Detail
- Tenant 360 support panel
- macros v1
- SLA indicators v1
- case timeline
- escalation/handoff controls

Acceptance:

- SUPPORT_ADMIN can triage and resolve cases
- case timeline combines support and system events
- Billing handoff creates visible context for FINANCE_ADMIN

## Phase 7: Billing Control Backend

Goal:

- Expand billing from subscription list to full control system.

Build:

- billing account detail endpoint
- invoice/payment snapshots
- Stripe reconciliation endpoint
- webhook replay endpoint
- operator plan-change endpoint
- entitlement override endpoint
- billing notes
- billing approvals for sensitive actions

Acceptance:

- billing mutations require reason
- before/after audit is written
- provider/local mismatch is visible
- SUPPORT_ADMIN cannot mutate billing

## Phase 8: Billing Control UI

Goal:

- Build billing command center and account detail workflows.

Build:

- Billing Command Center
- billing accounts table
- account detail
- subscription operations panel
- invoice/payment timeline
- Stripe sync/replay UI
- entitlement override UI

Acceptance:

- FINANCE_ADMIN can safely manage billing state
- sensitive actions use confirmation and audit reason
- support handoffs are visible in billing context

## Phase 9: Operations Modules

Goal:

- Build operator surfaces for existing customer-dashboard features.

Build:

- deployments operations
- domain operations
- forms and delivery operations
- SEO/search operations
- translations/glossary operations
- notifications operations where needed

Acceptance:

- read-only data is available for all major customer features
- safe recovery actions are role-guarded and audited
- operational alerts can create support cases

## Phase 10: Analytics And Metrics

Goal:

- Make the console a decision center, not only a CRUD shell.

Build:

- command center metrics
- billing metrics
- support metrics
- operations metrics
- tenant health score
- historical snapshots if live queries are too expensive

Acceptance:

- metrics drill down into relevant lists
- widgets show freshness
- expensive endpoints are indexed or snapshotted

## Phase 11: Permission Management UI

Goal:

- Give Platform Owner control over operator users and role assignments.

Build:

- operator users list
- create/update operator user
- role assignment
- permission preview
- audit of role changes

Acceptance:

- only Platform Owner can manage operator users
- role changes are audited
- Billing Admin cannot grant themselves privileges

## Phase 12: Hardening And Launch

Goal:

- Make the new operator console production-ready.

Required validation:

- API permission tests
- frontend route guard tests
- Playwright operator flows
- billing mutation tests
- support case lifecycle tests
- audit completeness tests
- cross-tenant read/write tests
- performance checks for large tables
- accessibility pass for dense workflows

Acceptance:

- old embedded dashboard admin remains gone
- new operator app is the only operator UI
- customer app and operator app have isolated auth and routing
- critical billing/support workflows are audited and tested

## Ready Prompt Template For Opus 4.7

Use this template for each phase:

```text
Use operator-console-docs/08-opus-4-7-implementation-phases.md as the phase index.

Task: implement Phase N: <phase name>.

Critical invariants:
- Do not add operator routes back to apps/dashboard.
- Customer auth and operator auth must stay isolated.
- Do not widen scope beyond this phase.
- Every operator mutation must be permission-checked and audited.
- Billing actions require stronger confirmation and reason capture.

Before editing:
- inspect the current files relevant to this phase
- identify existing backend contracts to reuse or refactor

After the first substantive edit:
- run focused type-check/test validation

Finish with:
- changed files
- validation performed
- remaining risks
- next phase handoff notes
```
