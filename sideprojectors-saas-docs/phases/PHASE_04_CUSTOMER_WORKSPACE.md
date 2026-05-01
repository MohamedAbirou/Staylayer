# Phase 04: Customer Workspace

## Objective

Turn the current dashboard into a customer-facing hospitality website workspace.

The current dashboard is an internal CMS editor. After this phase, it becomes the main product experience for paying customers.

## Current Problem

The existing dashboard:

- is route-structured as a single-tenant internal app
- exposes settings through a global admin lens
- does not reflect tenant or site ownership
- does not include onboarding or plan-aware product flows

Current references:

- [../../apps/dashboard/src/routes.tsx](../../apps/dashboard/src/routes.tsx)
- [../../apps/dashboard/src/pages/PagesListPage.tsx](../../apps/dashboard/src/pages/PagesListPage.tsx)
- [../../apps/dashboard/src/pages/EditorPage.tsx](../../apps/dashboard/src/pages/EditorPage.tsx)
- [../../apps/dashboard/src/pages/SettingsPage.tsx](../../apps/dashboard/src/pages/SettingsPage.tsx)

## Workspace Goals

The customer workspace should let a hospitality operator:

- onboard their brand
- choose a hospitality template
- configure site identity and languages
- create and edit pages visually
- manage SEO and contact settings
- connect a domain
- view inquiry submissions
- understand their current plan and limits

## Suggested Information Architecture

### Overview

- site status
- deployment status
- domain status
- plan summary
- recent inquiries
- quick links to main tasks

### Pages

- list pages by locale
- create new pages from hospitality presets
- edit pages in the current Puck editor
- preview and publish

### Site settings

- site name
- logo
- contact details
- default CTA
- social and analytics fields
- default SEO values
- locale selection

### Domains

- connect domain
- view verification state
- mark primary domain

### Forms

- view inquiries
- filter by status
- export submissions

### Billing

- current plan
- renewal state
- usage and limits
- upgrade path

## Hospitality-Specific UX Requirements

The onboarding flow should ask for:

- brand type: villa, hotel, B&B, glamping, guest house
- primary locale
- additional locales
- destination or region
- preferred template
- default inquiry email

Suggested starter page presets:

- homepage
- accommodation page
- amenities page
- location page
- gallery page
- about page
- FAQ page
- contact/inquiry page

## Key Implementation Tasks

1. restructure routes under a customer workspace namespace
2. introduce tenant and site switchers where necessary
3. add onboarding and empty states
4. refactor settings page into site-owned settings surfaces
5. add forms and billing navigation areas
6. remove platform-only actions from customer screens

## Definition Of Done

This phase is done when:

1. a new hospitality customer can onboard into the workspace
2. the customer can choose a template and edit site pages
3. the customer sees site-scoped settings, not global settings
4. the navigation reflects real SaaS product areas
5. the UI feels customer-facing rather than internal-tooling-facing
