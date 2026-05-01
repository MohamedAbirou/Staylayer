# Model Assignment And Prompts

## Purpose

This document maps each implementation phase to the best available model in your stack as of May 1, 2026:

- GPT-5.4
- Sonnet 4.6

Use this as the execution companion for the phase docs.

## Short Answer

If you must choose one model for the entire project, use **GPT-5.4**.

If you want the best practical workflow with the models you actually have:

- use **GPT-5.4** for architecture-heavy, security-sensitive, schema-sensitive, and operationally risky phases
- use **Sonnet 4.6** for bounded implementation phases with clear file scope, clear acceptance criteria, and explicit non-goals

## Why This Split Works

### GPT-5.4 is stronger at

- multi-step architectural consistency
- schema and auth redesign
- tenant isolation reasoning
- billing and provisioning edge cases
- phase planning and review
- catching hidden coupling between apps

### Sonnet 4.6 is stronger when you constrain it to

- local implementation tasks
- UI and route refactors with clear boundaries
- component and dashboard work
- repetitive coding inside a stable contract
- finishing approved subtasks quickly

### What Sonnet 4.6 should not own alone

- tenant security model design
- auth redesign strategy
- billing-state architecture
- provisioning idempotency strategy
- migration design for schema refactors

## Phase Assignment Table

| Phase                           | Primary Model | Secondary Use                                                  | Why                                                              |
| ------------------------------- | ------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| 00 Scope And Positioning        | GPT-5.4       | Sonnet 4.6 not needed                                          | product framing and guardrails affect every later decision       |
| 01 Schema And Multi-Tenancy     | GPT-5.4       | Sonnet 4.6 for follow-up refactors only                        | highest risk of structural mistakes and migration bugs           |
| 02 Auth Membership And Roles    | GPT-5.4       | Sonnet 4.6 for contained UI updates                            | auth and tenancy mistakes are expensive                          |
| 03 API Isolation And Security   | GPT-5.4       | Sonnet 4.6 for test expansion after design is fixed            | this is the cross-tenant leak phase                              |
| 04 Customer Workspace           | Sonnet 4.6    | GPT-5.4 review for route and data contract sanity              | UI-heavy and bounded once APIs are stable                        |
| 05 Operator Admin Console       | Sonnet 4.6    | GPT-5.4 review for permission boundaries                       | mostly internal UI and list/detail tooling                       |
| 06 Billing And Pricing          | GPT-5.4       | Sonnet 4.6 for billing screens after backend contract is fixed | billing edge cases and enforcement are risky                     |
| 07 Provisioning And Deployments | GPT-5.4       | Sonnet 4.6 for dashboard/status UI only                        | idempotency, retries, and deployment orchestration are high risk |
| 08 Website Runtime And SEO      | GPT-5.4       | Sonnet 4.6 for template or presentational cleanup              | public runtime correctness and SEO behavior are tightly coupled  |
| 09 Domains Forms And Operations | Sonnet 4.6    | GPT-5.4 review for domain and submission flows                 | mixed UI and ops work, but less foundational than phases 1 to 3  |
| 10 Testing And Launch           | GPT-5.4       | Sonnet 4.6 for filling missing tests                           | launch criteria and risk review need the stronger planner        |

## Practical Rule

Use this rule when in doubt:

- if the phase can break isolation, billing truth, deployment truth, or data ownership, give it to GPT-5.4
- if the phase mostly implements UI and bounded flows on top of already-approved contracts, Sonnet 4.6 is acceptable

## Universal Prompt Rules

These rules should appear in every prompt regardless of model.

1. Work only on the current phase.
2. Do not silently widen scope into future phases.
3. Preserve the hospitality niche and inquiry-first product promise.
4. Run focused validation immediately after the first substantive edit.
5. Fail closed on auth or tenant ambiguity.
6. Do not invent missing infrastructure contracts; state them explicitly if required.
7. Prefer small reversible edits over sweeping rewrites.
8. End with a short risk report: what is done, what was validated, what still needs human review.

## Model-Specific Prompt Pattern

### Prompt style for GPT-5.4

Use GPT-5.4 when the task needs architectural reasoning.

Prompt shape:

- define the phase
- list critical invariants
- list exact files likely to change
- list what must not change
- require tests or validation gates
- require a brief risk note before finishing

### Prompt style for Sonnet 4.6

Use Sonnet 4.6 only when the phase contract is already stable.

Prompt shape:

- define a narrow bounded task
- name exact files to edit
- state explicit non-goals
- state exact acceptance criteria
- require tests or at least compile-level validation
- forbid speculative architecture changes

## Ready Prompts By Phase

The prompts below are written to be pasted directly into the assigned model.

---

## Phase 00

### Assigned model

- Primary: GPT-5.4

### Prompt

```text
Use the phase doc at sideprojectors-saas-docs/phases/PHASE_00_SCOPE_AND_POSITIONING.md as the source of truth.

Task: tighten and finalize the product scope for this SaaS conversion.

You are not implementing code in this phase unless documentation structure clearly requires it. Your job is to lock the business and product guardrails so later engineering work does not drift.

Critical invariants:
- The product is a hospitality website SaaS for direct inquiries, not a booking engine.
- The initial ICP is independent vacation rentals, boutique hotels, B&Bs, guest houses, and glamping brands with roughly 1 to 20 units.
- The deployment model is shared control plane plus dedicated site deployment per customer site.
- Pricing should center on sites, locales, seats, inquiry volume, and support level.

Deliverables:
- finalize scope language if gaps exist
- finalize the entity glossary if gaps exist
- finalize route naming guidance if gaps exist
- keep all edits inside the docs unless a clear project config doc must be updated

Non-goals:
- no schema work
- no billing code
- no deployment code

Finish by stating the locked assumptions that later phases must not violate.
```

---

## Phase 01

### Assigned model

- Primary: GPT-5.4
- Secondary: Sonnet 4.6 only for follow-up mechanical refactors after schema design is approved

### Prompt

```text
Use the phase doc at sideprojectors-saas-docs/phases/PHASE_01_SCHEMA_AND_MULTI_TENANCY.md as the source of truth.

Task: implement the schema foundation for a multi-tenant hospitality website SaaS.

Critical invariants:
- A tenant owns one or more sites.
- A site owns pages, settings, versions, domains, deployment metadata, and form submissions.
- Global singleton assumptions must be removed from customer-owned data.
- The schema must support multiple sites having the same slug and locale under different ownership scopes.
- The migration path from the current single-tenant system must preserve existing content.

Likely files:
- apps/api/src/prisma/schema.prisma
- page/settings/user related services that will fail after schema changes
- seed scripts or migration helpers if needed

Required process:
- change the schema in the smallest coherent unit
- run focused validation immediately after schema edits
- update only the minimum dependent code required to restore local correctness before widening scope
- call out any migration ambiguity instead of guessing silently

Non-goals:
- no billing UI
- no deployment orchestration
- no customer workspace redesign

Finish with:
- changed entities
- migration risks
- exact follow-up code paths that phase 2 or 3 will need to touch
```

---

## Phase 02

### Assigned model

- Primary: GPT-5.4
- Secondary: Sonnet 4.6 only for contained dashboard auth UI once the backend contract is fixed

### Prompt

```text
Use the phase doc at sideprojectors-saas-docs/phases/PHASE_02_AUTH_MEMBERSHIP_AND_ROLES.md as the source of truth.

Task: redesign authentication and authorization around tenant membership and operator roles.

Critical invariants:
- Platform roles and tenant membership roles are separate concepts.
- JWT and session bootstrap must carry active tenant context.
- A user must never gain access to a tenant they do not belong to.
- Customer workspace auth and operator admin auth must remain distinct.

Likely files:
- apps/api/src/auth/*
- apps/api/src/users/* or membership-related services
- apps/dashboard/src/auth/*
- apps/dashboard/src/api/* where auth context is sent

Required process:
- define the backend contract first
- update the dashboard auth bootstrap only after the contract is stable
- validate guarded routes after the first auth change
- fail closed on ambiguity

Non-goals:
- no broad customer workspace redesign beyond what auth requires
- no billing or provisioning work

Finish with:
- the new auth contract
- the new role model
- remaining phase 3 isolation risks
```

---

## Phase 03

### Assigned model

- Primary: GPT-5.4
- Secondary: Sonnet 4.6 only to expand tests after isolation rules are already implemented

### Prompt

```text
Use the phase doc at sideprojectors-saas-docs/phases/PHASE_03_API_ISOLATION_AND_SECURITY.md as the source of truth.

Task: apply tenant and site isolation to all customer-owned API flows.

Critical invariants:
- Every customer-owned read or write must be scoped by tenant and site context.
- Missing context must fail closed.
- Operator routes may be cross-tenant only when explicitly guarded and audited.
- Public site reads must resolve only the intended site.

Likely files:
- apps/api/src/pages/*
- apps/api/src/settings/*
- apps/api/src/users/* or membership services
- any public site read endpoints
- tests covering tenant isolation

Required process:
- update one module at a time
- run focused validation immediately after the first substantive isolation edit
- add or update tests for leakage boundaries as you go

Non-goals:
- no customer UI redesign
- no billing or deployment features

Finish with:
- which modules are now isolated
- what tests prove isolation
- any remaining unaudited surfaces
```

---

## Phase 04

### Assigned model

- Primary: Sonnet 4.6
- Reviewer: GPT-5.4 for route and contract sanity if possible

### Prompt

```text
Use the phase doc at sideprojectors-saas-docs/phases/PHASE_04_CUSTOMER_WORKSPACE.md as the source of truth.

Task: convert the current dashboard into the customer-facing hospitality workspace.

Scope is intentionally bounded. Assume phases 1 to 3 are already approved. Do not redesign tenancy or auth architecture.

Critical invariants:
- The workspace is site-aware and tenant-aware.
- The UI remains hospitality-specific and inquiry-first.
- Platform-only controls must not appear in customer routes.
- Existing editor functionality should be preserved where possible.

Likely files:
- apps/dashboard/src/routes.tsx
- apps/dashboard/src/pages/*
- apps/dashboard/src/components/*
- apps/dashboard/src/auth/* only if required for route context

Acceptance criteria:
- customer routes are namespaced cleanly
- pages, settings, forms, and billing navigation exist or are scaffolded correctly
- settings are site-scoped in the UI
- onboarding and empty states do not imply booking-engine features

Non-goals:
- no backend architecture redesign
- no billing backend logic
- no deployment orchestration logic

Validate with:
- focused route or component checks
- any available build or type validation for the dashboard slice

Finish with a short note listing any API assumptions this UI still depends on.
```

---

## Phase 05

### Assigned model

- Primary: Sonnet 4.6
- Reviewer: GPT-5.4 for permission boundaries if possible

### Prompt

```text
Use the phase doc at sideprojectors-saas-docs/phases/PHASE_05_OPERATOR_ADMIN_CONSOLE.md as the source of truth.

Task: add the operator admin console for the SaaS owner.

This is a bounded admin-surface implementation. Do not redesign customer auth or tenant architecture.

Critical invariants:
- Admin routes are fully separate from customer routes.
- Platform-only actions are permission-checked.
- The UI supports support and recovery workflows for non-technical hospitality customers.

Likely files:
- apps/dashboard/src/routes.tsx
- admin-facing pages and components
- guarded route components
- admin-oriented API client calls

Acceptance criteria:
- tenant, deployment, subscription, domain, and form surfaces exist or are scaffolded consistently
- admin actions are clearly separated from customer actions
- no customer route exposes platform-level controls

Non-goals:
- no schema redesign
- no billing state model redesign
- no provisioning architecture redesign

Validate with:
- focused route checks
- dashboard build/type validation if available

Finish with a short note on any admin actions that still require backend support.
```

---

## Phase 06

### Assigned model

- Primary: GPT-5.4
- Secondary: Sonnet 4.6 for UI screens only after billing contracts are fixed

### Prompt

```text
Use the phase doc at sideprojectors-saas-docs/phases/PHASE_06_BILLING_AND_PRICING.md as the source of truth.

Task: implement billing state, plan enforcement, and the backend contract for subscription-based hospitality plans.

Critical invariants:
- Billing truth must be stored reliably and synced from the provider.
- Plan limits must be enforced at the API layer, not just the UI.
- The pricing logic must reflect hospitality-specific units such as sites, locales, seats, and inquiry volume.
- Non-payment behavior must be explicit and testable.

Likely files:
- billing modules and schema additions
- webhook handlers
- plan enforcement checks
- later, billing UI surfaces

Required process:
- define provider and data contracts first
- implement enforcement before polishing UI
- validate webhook and limit behavior before widening scope

Non-goals:
- no customer workspace redesign beyond what billing needs
- no deployment orchestration unless billing status must gate it

Finish with:
- enforced limits
- payment-state transitions
- operational edge cases needing human review
```

---

## Phase 07

### Assigned model

- Primary: GPT-5.4
- Secondary: Sonnet 4.6 for deploy-status UI only

### Prompt

```text
Use the phase doc at sideprojectors-saas-docs/phases/PHASE_07_PROVISIONING_AND_DEPLOYMENTS.md as the source of truth.

Task: implement provisioning and deployment orchestration for dedicated customer site deployments.

Critical invariants:
- Provisioning must be idempotent.
- Failure states must be visible and retryable.
- Each deployment must be tied to exactly one site record.
- Publish and revalidation behavior must target the correct site deployment.

Likely files:
- deployment or provisioning services
- site and deployment models
- revalidation services
- operator visibility surfaces if needed

Required process:
- define the job state model before coding retries
- implement one narrow provisioning slice first
- validate the first orchestration edit before widening
- do not hand-wave provider failure modes

Non-goals:
- no generic infra platform redesign
- no unrelated public UI work

Finish with:
- job states implemented
- idempotency strategy
- failure modes that still need explicit tests
```

---

## Phase 08

### Assigned model

- Primary: GPT-5.4
- Secondary: Sonnet 4.6 for presentational cleanup only

### Prompt

```text
Use the phase doc at sideprojectors-saas-docs/phases/PHASE_08_WEBSITE_RUNTIME_AND_SEO.md as the source of truth.

Task: adapt the Next.js website runtime to support dedicated hospitality site deployments safely.

Critical invariants:
- Public runtime fetches are site-aware.
- SEO, sitemap, and locale behavior remain correct per site.
- The runtime remains inquiry-first and does not imply booking-engine capabilities.
- The same codebase can serve many deployments without global-site assumptions.

Likely files:
- apps/website/lib/cmsClient.js
- apps/website/pages/[...slug].js
- apps/website/components/seoHead.jsx
- apps/website/next-sitemap.config.js

Required process:
- update the content fetch contract first
- validate the first runtime change before widening
- keep fallback behavior intact while making it site-scoped

Non-goals:
- no broad component redesign unless required by site-awareness
- no billing or provisioning redesign

Finish with:
- how site identity is resolved
- what SEO and sitemap behavior changed
- any remaining runtime assumptions tied to the old singleton model
```

---

## Phase 09

### Assigned model

- Primary: Sonnet 4.6
- Reviewer: GPT-5.4 for domain and submission flow sanity if possible

### Prompt

```text
Use the phase doc at sideprojectors-saas-docs/phases/PHASE_09_DOMAINS_FORMS_AND_OPERATIONS.md as the source of truth.

Task: implement domains, inquiry forms, and the related customer and operator workflows.

This is a bounded feature phase. Assume tenancy, auth, and core site ownership are already correct.

Critical invariants:
- Forms are site-owned and inquiry-first.
- Domain status is explicit and understandable.
- Operators can diagnose domain and form issues without database access.

Likely files:
- form handling and submission surfaces
- domain models and UI surfaces
- operator diagnostics screens

Acceptance criteria:
- customers can see domain state clearly
- inquiry submissions are stored against the correct site and page
- operators have enough UI support for common issues

Non-goals:
- no auth model redesign
- no deployment architecture redesign
- no billing model redesign

Validate with:
- focused form-flow checks
- targeted build or type validation for touched surfaces

Finish with a short note on operational blind spots that still remain.
```

---

## Phase 10

### Assigned model

- Primary: GPT-5.4
- Secondary: Sonnet 4.6 to fill specific missing tests after the launch checklist is defined

### Prompt

```text
Use the phase doc at sideprojectors-saas-docs/phases/PHASE_10_TESTING_AND_LAUNCH.md as the source of truth.

Task: harden the platform for launch by closing test gaps, validation gaps, and operational readiness gaps.

Critical invariants:
- Tenant isolation must be proven.
- The full revenue path must work from signup to live site.
- Launch readiness must be based on executable checks, not documentation claims.
- Remaining risks must be listed explicitly.

Likely files:
- tests across API, dashboard, and website
- deployment or monitoring docs
- any thin glue needed to make validation runnable

Required process:
- identify highest-risk gaps first
- add the narrowest executable validations possible
- rerun focused checks after each substantive testing change

Non-goals:
- no new feature expansion
- no speculative roadmap work

Finish with:
- launch-blocking issues remaining
- validated paths
- residual risks that still require human sign-off
```

## Final Recommendation

If you have both GPT-5.4 and Sonnet 4.6 available, the best result comes from a **lead-review split**:

- GPT-5.4 decides and reviews the risky phases
- Sonnet 4.6 executes bounded phases and local follow-up work

If you only want one-model execution, use **GPT-5.4 for every phase** and keep the same prompt discipline.
