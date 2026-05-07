# Sell-Ready Completion Plan

## Purpose

- This document is a product and implementation handoff for getting the platform from its current advanced state to a sell-ready, production-grade SaaS.
- It is intentionally gap-focused. The goal is not to rebuild what already works, but to finish weak areas, close missing features, and harden the customer-facing product so it can be sold confidently.
- The intended execution target is an autonomous coding agent such as Bolt using a strong model.

## Current baseline

- The platform already has strong foundations in multi-tenant auth, role-based access, page CRUD, Puck-backed page editing, publish and unpublish flows, page versioning, Stripe billing, Vercel deployment provisioning, domain verification and attachment, form studio, public form submission intake, and operator admin tooling.
- The platform is not yet sell-ready because several important areas are only partially implemented or not implemented at all: productized plan enforcement UX, customer observability, rollback and deployment visibility, translation workflows, analytics, compliance, spam prevention, and launch hardening.
- The next phase should focus on customer trust, operational reliability, pricing and packaging, and obvious product completeness rather than raw feature count.

## What is already strong enough to keep

- Multi-tenant tenant and site scoping already exists and should remain the backbone of the product.
- Customer page management is already real: create, edit, duplicate, publish, bulk publish, bulk unpublish, soft delete, and version restore exist.
- Page content is already stored as Puck JSON, which is the correct base for versioning, templating, and machine translation.
- Deployment provisioning to Vercel already exists and should be extended, not replaced.
- Domain onboarding already supports provider attachment, DNS verification states, SSL provisioning, and primary domain selection.
- Billing already has plan models and limit categories for sites, locales, seats, pages, domains, and submissions.
- Forms already have schema versioning, routing, branded email delivery, and public submission endpoints.
- The operator admin area already has tenant, deployment, billing, domain, forms, and audit visibility.

## Critical blockers before this should be sold widely

- Tenant isolation needs stronger protection and explicit security validation. The application-level guards are good, but the product should not rely only on request-layer filtering.
- Customers do not yet have enough visibility into deployment failures, form delivery problems, quota usage, and domain health.
- The deployment story needs rollback, richer logs, and clearer live versus draft state.
- Translation support does not exist as an actual workflow even though the data model and locale scaffolding are present.
- Limit enforcement exists in the backend, but the customer-facing experience around limits, overages, warnings, and downgrade behavior is weak.
- Production SEO is usable but incomplete. It lacks sitemap and robots generation, stronger structured data support, and validation feedback in the editor.
- Compliance, backups, exportability, notification preferences, and customer analytics are not yet at commercial SaaS level.

## Recommended commercial packaging

- Add a true free plan instead of trying to sell only paid plans from day one.
- Keep the existing paid plan direction, but tighten the packaging so every limit maps to a visible product promise.
- Enforce all limits centrally in the API and expose all usage clearly in the dashboard.

## Proposed plan matrix

### Free

- Positioning: trial-quality self-serve entry plan for solo hospitality operators validating the product.
- Sites: 1
- Seats: 1
- Active locales: 1
- Allowed languages: English only
- Published pages: 5
- Custom domains: 0
- Platform subdomain: 1 included
- Monthly form submissions: 50
- Translation: unavailable
- Deployment history retention: 1 latest deployment only
- Rollback: unavailable
- Analytics: unavailable
- Export and backup: unavailable
- Support: docs only
- Branding: platform branding allowed on public footer or subdomain

### Starter Stay

- Positioning: single-property paid plan for one real hospitality website.
- Sites: 1
- Seats: 2
- Active locales: 2
- Allowed languages: English plus one of Spanish, French, or German
- Published pages: 25
- Custom domains: 1
- Monthly form submissions: 250
- Translation credits: 50,000 translated characters per month
- Deployment history retention: 10 deployments
- Rollback: basic rollback to previous live deployment
- Analytics: basic page and form overview
- Export and backup: manual JSON export
- Support: email support

### Boutique Growth

- Positioning: independent hotel or boutique hospitality brand that needs multilingual direct-booking style marketing.
- Sites: 1
- Seats: 5
- Active locales: 4
- Allowed languages: English, Spanish, French, German
- Published pages: 100
- Custom domains: 3
- Monthly form submissions: 1,500
- Translation credits: 250,000 translated characters per month
- Deployment history retention: 30 deployments
- Rollback: one-click rollback
- Analytics: site analytics, page performance, form conversion, basic source reporting
- Export and backup: scheduled exports
- Support: priority email support

### Portfolio

- Positioning: multi-property operator, group, or agency managing several hospitality brands.
- Sites: 5
- Seats: 15
- Active locales: 4 per site
- Allowed languages: English, Spanish, French, German
- Published pages: 500 total across tenant
- Custom domains: 15
- Monthly form submissions: 10,000
- Translation credits: 1,000,000 translated characters per month
- Deployment history retention: 90 deployments
- Rollback: one-click rollback plus deployment notes
- Analytics: full tenant plus per-site analytics
- Export and backup: scheduled exports plus restore support
- Support: priority support and migration assistance

### Enterprise or custom

- Positioning: larger operators or agencies that need SSO, higher limits, and contractual support.
- Features to unlock: SSO, custom SLA, custom locale packs, advanced permissions, migration services, white-glove onboarding, higher quotas.

## Product rules that must be enforced cleanly

- Every create action must be limit-aware before mutation happens.
- Every dashboard section must show both current usage and hard plan limits.
- Every plan-gated action must have a clear upgrade call to action instead of a generic failure.
- Downgrades must not create silent broken states. Over-limit tenants should enter a visible remediation state with warnings and grace periods.
- Translation should be both feature-gated and usage-gated because DeepL has real cost.
- Domains, pages, sites, seats, and submissions should all appear in a customer usage center.

## Detailed gap plan by product area

### 1. Customer workspace and multi-site management

- Status: partially implemented.
- What exists: site creation, member creation and invite endpoints, site switching, locale selection, and workspace studio.
- What is weak: no real usage center, no site cloning, no bulk site actions, no polished invite lifecycle, no site archive and restore UX, and no operational view across all sites in one tenant.
- What Bolt should add:
- Build a tenant-level workspace home with cards for every site, current plan usage, recent deployments, domain state, and forms health.
- Add site duplication and site template creation so customers can spin up new brands quickly.
- Add archive, restore, and transfer flows for sites.
- Add invitation lifecycle with pending, resent, revoked, accepted, and expired states.
- Add a single place to switch site context and inspect which site is live, draft-only, over quota, or blocked.
- Add quota-aware creation flows so a user sees the remaining number of sites before clicking create.
- Acceptance criteria: a customer with multiple sites can understand at a glance which sites are healthy, live, blocked, or near quota.

### 2. Page builder, content operations, and editorial workflow

- Status: strong foundation but not yet product-complete.
- What exists: create, edit, duplicate, publish, bulk publish and unpublish, version history, version restore, locale-aware pages, and Puck JSON storage.
- What is weak: no scheduled publishing, no content approvals, no content status model beyond published or unpublished, no bulk metadata editing, and no reusable template library for customers.
- What Bolt should add:
- Add content statuses such as draft, in review, scheduled, published, and archived.
- Add scheduled publish and scheduled unpublish per page.
- Add editor comments and approval workflows for OWNER and ADMIN review.
- Add section templates and full-page templates saved from existing Puck pages.
- Add bulk operations for SEO fields, publish state, locale duplication, and page categorization.
- Add page cloning across sites within the same tenant.
- Add a safe page slug rename flow with redirect suggestions.
- Acceptance criteria: a customer team can run a real editorial workflow without manual coordination outside the app.

### 3. SEO, metadata, and search performance

- Status: partially implemented.
- What exists: page-level SEO fields, site-level defaults, indexing flag support, analytics IDs, and published page rendering.
- What is weak: no sitemap generation, no robots generation, no structured data builder, no canonical conflict warnings, no preview score, and no broken SEO guardrails in the editor.
- What Bolt should add:
- Add automatic sitemap.xml generation per site from published pages.
- Add robots.txt generation that respects noindex and staging states.
- Add structured data support for hospitality businesses, rooms, amenities, FAQs, and contact details.
- Add live SEO validation in the editor for title length, description length, missing OG image, missing canonical, duplicate slug per locale, and missing page title.
- Add social share preview cards in the editor.
- Add redirect management for renamed or deleted pages.
- Add canonical and hreflang generation for multilingual pages.
- Acceptance criteria: a customer can fully manage SEO without touching code, and every published site exposes sitemap, robots, canonical, and hreflang data correctly.

### 4. Deployments, publish pipeline, and release safety

- Status: partially implemented with solid provisioning.
- What exists: provisioning, retry, environment catalog, deployment status tracking, live URL awareness, and domain-aware readiness checks.
- What is weak: no rollback, no deployment logs UI, no diff between draft and live, no staging preview workflow, no deployment approvals, and no deploy scheduling.
- What Bolt should add:
- Add one-click rollback to the last successful live deployment.
- Add deployment phase timelines and surfaced provider logs.
- Add draft versus live comparisons so a user knows exactly what changed before publishing.
- Add optional staged deployments or preview deployments before promoting to live.
- Add environment variable validation before deploy starts.
- Add deploy notes and deployment actor tracking.
- Add notification hooks for deploy started, live, failed, retried, and rolled back.
- Acceptance criteria: customers can publish confidently, diagnose failures quickly, and recover immediately from a bad release.

### 5. Custom domains and production routing

- Status: largely implemented but still needs product polish.
- What exists: add domain, set primary domain, remove domain, provider attachment, DNS checking, SSL provisioning, and domain retry flows.
- What is weak: no polished registrar-specific guidance, no www to apex strategy wizard, no redirect rule manager, no automatic fallback domain policy surfaced to users, and no customer event history.
- What Bolt should add:
- Add a domain onboarding wizard similar to Vercel's experience: enter domain, choose apex or subdomain, get exact DNS records, see provider target, verify continuously.
- Add first-class support for apex and www pair handling with redirect recommendations.
- Add domain event history with timestamps for DNS required, attach pending, SSL provisioning, and active states.
- Add explicit domain health checks inside the readiness page and the site overview.
- Add domain removal safeguards if a live site would be left without a primary public hostname.
- Acceptance criteria: a non-technical customer can connect a personal domain without support intervention in the common case.

### 6. Billing, subscriptions, and plan enforcement UX

- Status: partially implemented.
- What exists: plan definitions, Stripe checkout and portal, billing webhooks, grace period behavior, and backend limit checks.
- What is weak: no dedicated usage center, no upgrade prompts in context, no downgrade remediation workflow, no visible remaining quota counts, and no translation or deployment retention limits.
- What Bolt should add:
- Create a customer usage center that shows sites, pages, seats, locales, domains, submissions, translation credits, and deployment retention.
- Add contextual upgrade prompts on create-site, enable-locale, add-domain, invite-member, and publish actions.
- Add downgrade remediation flow for over-limit tenants with grace period countdown and clear resolution steps.
- Extend plan definitions to include translation credits, analytics retention, deployment retention, backup retention, and support tier.
- Add free plan support end to end across signup, billing screens, entitlement checks, and public messaging.
- Acceptance criteria: every limit behaves predictably, is visible before failure, and maps to a clear upgrade path.

### 7. Translation and localization workflow

- Status: missing as a real feature.
- What exists: locale scaffolding and page uniqueness by locale. The app recognizes English, Spanish, French, and German. There is no real translation service or translation workflow.
- Product requirement: customers must be able to translate pages with one click, see translation progress, and manage multilingual publishing safely.
- What Bolt should add:
- Add a translation service in the API using DeepL.
- Translate Puck JSON field-by-field while preserving component types, IDs, schema structure, links, asset references, numeric values, booleans, and technical keys.
- Only human-authored text should be translated. All structural JSON must remain intact.
- Add translation jobs with states such as queued, processing, completed, failed, review_required, and approved.
- Add translation progress reporting at tenant, site, page, and locale level.
- Add a dashboard translation center where users can choose source locale, target locales, all pages or selected pages, overwrite behavior, and whether to auto-create missing localized pages.
- Add translation review mode that shows source content versus translated content before publish.
- Add translation history and retry on failure.
- Add glossary support for brand terms, property names, room names, and hospitality vocabulary so DeepL outputs remain consistent.
- Add locale publishing controls so translated pages are not published automatically unless the user explicitly chooses that behavior.
- Add locale completeness indicators for every page.
- Add locale-aware SEO generation so title, description, OG text, canonical, and hreflang metadata are translated or derived correctly.
- Add free-plan gating so only English is allowed on free.
- Add plan-based translation credit enforcement to control DeepL spend.
- Acceptance criteria: a customer can select a site, click translate, watch progress, review output, and publish translated pages in English, Spanish, French, and German without corrupting Puck JSON.

### 8. Forms, inquiry operations, and spam protection

- Status: strong foundation but not commercially hardened.
- What exists: form definitions, branded emails, routing, delivery tracking, public submission intake, and webhook delivery.
- What is weak: spam prevention is basic, there is no customer-facing delivery analytics, and there is no strong review queue for suspicious submissions.
- What Bolt should add:
- Add CAPTCHA support on public forms.
- Add per-form and per-IP throttling rather than only broad request throttles.
- Add external spam scoring such as Akismet or equivalent.
- Add suspicious submission review queues.
- Add delivery logs and retry visibility for customer admins.
- Add CSV and JSON export for submissions.
- Add saved filters, tags, assignment, and follow-up statuses for inquiries.
- Add submission summary notifications and digest emails.
- Acceptance criteria: customers can trust inquiry capture in production and operators are not flooded by spam or blind to delivery failures.

### 9. Analytics and customer reporting

- Status: missing as a complete customer feature.
- What exists: analytics identifiers can be configured, but the product does not expose a meaningful reporting layer to customers.
- What Bolt should add:
- Add site analytics overview with page views, top landing pages, top form pages, form conversion, and latest inquiries.
- Add tenant summary for Portfolio plans across all sites.
- Add deployment health and domain health widgets.
- Add reporting for translation coverage and untranslated pages.
- Add reporting for SEO health issues.
- Add plan usage trend charts.
- Acceptance criteria: a customer can answer basic business questions without leaving the product.

### 10. Onboarding and first-time user activation

- Status: partially implemented.
- What exists: an onboarding page exists, but it behaves more like a UI wizard than a complete onboarding system.
- What is weak: there is no persistent onboarding state, no milestone tracking, and no clear guided path from signup to live site.
- What Bolt should add:
- Create a real onboarding state machine stored in the backend.
- Track milestones such as site created, first page published, deployment provisioned, domain connected, SEO completed, form configured, and translation configured.
- Add onboarding checklists on the dashboard home and workspace overview.
- Add contextual empty states and recommended next steps.
- Add plan-aware onboarding so free users see the correct limits and paid users see upgrade-value features.
- Acceptance criteria: a new customer can go from signup to first live site without needing support.

### 11. Notifications and customer communications

- Status: missing as a first-class product area.
- What Bolt should add:
- Add in-app notifications and email notifications for deployment events, domain verification progress, usage warnings, plan downgrade risk, form delivery failures, and translation job completion.
- Add notification preferences by user and by workspace role.
- Add digest emails for weekly activity and quota status.
- Acceptance criteria: customers are informed of important events without having to monitor pages manually.

### 12. Security, compliance, and customer trust

- Status: partially implemented.
- What exists: strong auth basics, structured logging, request IDs, health checks, and guarded admin routes.
- What is missing or weak: no row-level security in the database, limited explicit tenant isolation tests, incomplete legal and privacy flows, no self-serve account deletion or export, and no documented backup or retention policy surfaced to customers.
- What Bolt should add:
- Add database-level row-level security or equivalent hardened tenant isolation controls.
- Add negative-path security tests for cross-tenant access attempts.
- Add audit logging for denied access attempts and sensitive customer actions.
- Add account export, tenant export, and deletion workflows.
- Add Terms of Service and Privacy Policy acceptance tracking.
- Add retention policies for audit logs, submissions, and exports.
- Acceptance criteria: the platform can pass basic security and privacy diligence from real paying customers.

### 13. Observability, reliability, and operator tooling

- Status: partially implemented.
- What exists: logs, health endpoints, and admin surfaces.
- What is weak: no true metrics layer, no alerting, no failure dashboards, and no production incident workflows.
- What Bolt should add:
- Add APM and metrics for deployments, forms, domains, billing, and translation jobs.
- Add operator dashboards for failed deployments, pending domains, repeated form delivery failures, spam spikes, and over-limit tenants.
- Add alert rules with clear escalation targets.
- Add correlation IDs across API actions, deployment events, and customer-visible incidents.
- Acceptance criteria: operators can detect and act on failures before customers raise support tickets.

### 14. Backup, export, restore, and disaster recovery

- Status: missing as a customer promise.
- What Bolt should add:
- Add scheduled tenant data exports.
- Add downloadable exports for pages, settings, forms, and submissions.
- Add internal restore tools for operator recovery.
- Add retention policy surfaced in billing or legal documentation.
- Acceptance criteria: the platform has a credible data safety story for sales and support conversations.

### 15. Testing, performance, and launch hardening

- Status: good validation foundation but not enough for a fully sold SaaS.
- What exists: unit tests, Playwright e2e, build validation, and launch-focused checks.
- What Bolt should add:
- Add cross-tenant security test coverage.
- Add quota and downgrade behavior tests.
- Add translation pipeline tests against representative Puck JSON fixtures.
- Add deployment rollback tests.
- Add load tests for public forms, published pages, and publish workflows.
- Add synthetic production checks for live customer websites, domains, and form endpoints.
- Acceptance criteria: the system is tested on the exact failure modes customers will encounter in production.

## Translation implementation details for Bolt

- The source of truth is the stored Puck JSON for a page.
- Bolt should create a translation extraction layer that traverses the JSON tree and extracts only human-readable content fields.
- Bolt should maintain a per-component translation map so components with special semantics can translate the right fields and ignore the wrong ones.
- Bolt should preserve IDs, layout metadata, booleans, numbers, URLs, asset IDs, and component keys exactly.
- Bolt should support both full-page translation and site-wide batch translation.
- Bolt should store translation metadata separately from the raw page so users can see when a locale is stale relative to the source locale.
- Bolt should include a glossary feature for brand and hospitality terms so DeepL output remains consistent.
- Bolt should never publish machine-translated output automatically by default. Review should be required unless the user opts into auto-publish.
- Bolt should expose job progress via polling or server-sent events so the dashboard can show real progress and current phase.

## Recommended implementation order

- Phase A: plan enforcement UX, usage center, free plan support, and onboarding state.
- Phase B: deployment rollback, deployment logs, domain wizard polish, and notification system.
- Phase C: DeepL translation service, translation center, locale review flow, and translation quota enforcement.
- Phase D: analytics, SEO hardening, redirect manager, and structured data builder.
- Phase E: security and compliance hardening including tenant isolation tests, exports, deletion, and backup policies.
- Phase F: observability, operator alerts, performance testing, and scale validation.

## Definition of done for a sell-ready release

- A free user can create one English-only site and understand exactly why upgrades unlock more power.
- A paid customer can create sites, create pages, edit Puck content, manage SEO, publish safely, deploy to live infrastructure, attach custom domains, and recover from mistakes without support.
- A multilingual paid customer can translate pages into English, Spanish, French, and German with one click, see progress, review output, and publish localized pages safely.
- A customer can clearly see usage, limits, warnings, and next steps before hitting any hard cap.
- Operators can detect failures early, inspect logs, and help customers with concrete visibility.
- The product has a credible trust story across security, backups, exports, compliance, and operational reliability.

## Final direction for Bolt

- Do not rewrite the core architecture.
- Preserve the current tenant, site, billing, deployment, and Puck foundations.
- Prioritize customer confidence, visibility, and commercial completeness.
- Treat translation, plan enforcement UX, deployment rollback, SEO completeness, and observability as the highest-value productization work.
