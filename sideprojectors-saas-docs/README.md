# SideProjectors SaaS Docs

This folder contains the SaaS conversion strategy for turning the current codebase into a buyer-operable business.

Recommended niche:

- inquiry-first direct-booking marketing sites for independent vacation rentals, boutique hotels, B&Bs, guest houses, and glamping brands with roughly 1 to 20 units.

Main docs:

- [01_NICHE_STRATEGY_AND_SOLUTION.md](./01_NICHE_STRATEGY_AND_SOLUTION.md)
- [02_IMPLEMENTATION_PLAN_FOR_OPUS_4_7.md](./02_IMPLEMENTATION_PLAN_FOR_OPUS_4_7.md)
- [03_MODEL_ASSIGNMENT_AND_PROMPTS.md](./03_MODEL_ASSIGNMENT_AND_PROMPTS.md)

Phase docs:

- [phases/PHASE_00_SCOPE_AND_POSITIONING.md](./phases/PHASE_00_SCOPE_AND_POSITIONING.md)
- [phases/PHASE_01_SCHEMA_AND_MULTI_TENANCY.md](./phases/PHASE_01_SCHEMA_AND_MULTI_TENANCY.md)
- [phases/PHASE_02_AUTH_MEMBERSHIP_AND_ROLES.md](./phases/PHASE_02_AUTH_MEMBERSHIP_AND_ROLES.md)
- [phases/PHASE_03_API_ISOLATION_AND_SECURITY.md](./phases/PHASE_03_API_ISOLATION_AND_SECURITY.md)
- [phases/PHASE_04_CUSTOMER_WORKSPACE.md](./phases/PHASE_04_CUSTOMER_WORKSPACE.md)
- [phases/PHASE_05_OPERATOR_ADMIN_CONSOLE.md](./phases/PHASE_05_OPERATOR_ADMIN_CONSOLE.md)
- [phases/PHASE_06_BILLING_AND_PRICING.md](./phases/PHASE_06_BILLING_AND_PRICING.md)
- [phases/PHASE_07_PROVISIONING_AND_DEPLOYMENTS.md](./phases/PHASE_07_PROVISIONING_AND_DEPLOYMENTS.md)
- [phases/PHASE_08_WEBSITE_RUNTIME_AND_SEO.md](./phases/PHASE_08_WEBSITE_RUNTIME_AND_SEO.md)
- [phases/PHASE_09_DOMAINS_FORMS_AND_OPERATIONS.md](./phases/PHASE_09_DOMAINS_FORMS_AND_OPERATIONS.md)
- [phases/PHASE_10_TESTING_AND_LAUNCH.md](./phases/PHASE_10_TESTING_AND_LAUNCH.md)

Why this niche fits the repo:

- the website already contains hospitality-specific language and sections such as OTA coverage, PMS messaging, and direct-booking website copy
- the page builder already supports multilingual marketing pages and strong SEO surfaces
- the current product can become monetizable faster by focusing on hospitality websites with inquiry capture, not on rebuilding an entire PMS or booking engine in v1

Recommended execution setup:

- use GPT-5.4 as the lead model for architecture-heavy, security-sensitive, and operationally risky phases
- use Sonnet 4.6 for bounded implementation phases and UI-heavy delivery inside a pre-approved phase
- use [03_MODEL_ASSIGNMENT_AND_PROMPTS.md](./03_MODEL_ASSIGNMENT_AND_PROMPTS.md) as the phase-by-phase execution companion
