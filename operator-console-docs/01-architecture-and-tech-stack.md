# 01 Architecture And Tech Stack

## App Boundary

Create a new workspace app:

```text
apps/operator-console/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  .env.example
  src/
    App.tsx
    main.tsx
    routes.tsx
    api/
    auth/
    permissions/
    components/
    features/
    pages/
    lib/
```

The operator console should have its own:

- auth provider
- API client
- session storage keys
- route guards
- app layout
- query cache keys
- e2e tests
- deployment config

It should not import customer dashboard auth, layout, or route code.

## Recommended Stack

Use the repo's existing strengths and add only libraries that remove real complexity.

Core:

- React 19
- Vite
- TypeScript
- React Router 7, matching the existing dashboard app
- TanStack Query for server state
- Axios for the API client, matching existing app patterns
- Tailwind CSS v4
- lucide-react icons
- react-hot-toast or a shared toast equivalent

Data-dense UI additions:

- TanStack Table for tables, sorting, column visibility, pinned columns, filters, row selection, and server-side pagination.
- TanStack Virtual for large lists, support inboxes, event timelines, and audit logs.
- Recharts for normal dashboard charts. Consider Visx only if charts become highly custom.
- cmdk for global command/search palette.
- react-hook-form + zod for complex operator forms and mutation payload validation.
- date-fns or existing local date helpers for date windows and relative time.
- dnd-kit only where reordering is a real workflow, such as support macros or queue views.

Support-system UI additions:

- TipTap or another ProseMirror-based editor for support replies, internal notes, macros, and rich text where plain textarea becomes limiting.
- File upload should reuse or mirror the existing asset upload/security pattern, not invent ad hoc direct uploads.

Testing:

- Playwright for operator e2e.
- Vitest only if the new app introduces substantial pure client logic. Otherwise keep API and e2e tests as the first line.
- MSW can be added for isolated UI stories/tests if the operator UI becomes too expensive to run against a live API.

## Refine.dev Decision

Do not build the core console on Refine.dev for v1.

Use Refine as inspiration for:

- resource definitions
- list/detail/edit mental model
- declarative data provider shape
- permissions around resources and actions

Do not let Refine own the app because:

- billing workflows need custom approval, audit, Stripe sync, and dangerous-action UX
- support workflows need a domain-specific case timeline, customer context panel, SLA logic, and incident correlation
- the app must remain deeply aware of tenants, sites, deployments, domains, forms, SEO, billing, and audit history
- framework indirection could slow sensitive security and financial reasoning

Recommended compromise:

Create an internal resource layer inspired by Refine:

```ts
type OperatorResource =
  | "tenant"
  | "site"
  | "support_case"
  | "billing_account"
  | "subscription"
  | "deployment"
  | "domain"
  | "form_submission"
  | "audit_log";

type OperatorAction =
  | "read"
  | "list"
  | "create"
  | "update"
  | "retry"
  | "resolve"
  | "export"
  | "delete";
```

Use that to drive navigation, route guards, button visibility, command palette results, and audit labels.

## Information Architecture

Primary navigation should be organized by operator job, not backend module name.

Recommended top-level areas:

- Command Center
- Tenants
- Support
- Billing
- Operations
- Growth and Usage
- Audit
- Permissions
- System

Recommended second-level areas:

- Tenant 360
- Site 360
- Support Queue
- Cases
- Incidents
- Billing Accounts
- Subscriptions
- Invoices
- Payment Risk
- Deployments
- Domains
- Forms and Deliveries
- SEO and Search
- Translations
- Audit Log
- Operator Users
- Roles and Permissions

## App Layout Principles

This is an operator tool, not a marketing surface.

Use:

- dense tables with excellent filtering
- persistent tenant/site context panels
- clear status badges
- timelines for history
- side panels for detail and action confirmation
- charts that answer real operational questions
- global search and command palette
- saved views for queues

Avoid:

- hero sections
- decorative cards for every block
- purely visual dashboards with no drilldown
- unscoped destructive actions
- hidden permission failures
