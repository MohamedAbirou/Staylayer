# Phase 08: Website Runtime And SEO

## Objective

Turn the current Next.js website app into a reusable hospitality site runtime for many dedicated customer deployments.

## Current Problem

The current runtime assumes one global site and one global settings source.

Relevant references:

- [../../apps/website/lib/cmsClient.js](../../apps/website/lib/cmsClient.js)
- [../../apps/website/pages/[...slug].js](../../apps/website/pages/[...slug].js)
- [../../apps/website/components/seoHead.jsx](../../apps/website/components/seoHead.jsx)
- [../../apps/website/next-sitemap.config.js](../../apps/website/next-sitemap.config.js)

## Runtime Strategy

Because each customer gets a dedicated site deployment, the simplest v1 approach is:

- inject `SITE_ID` and locale configuration at build or deploy time
- fetch only the site-owned settings and pages for that deployment
- generate SEO and sitemap data only for that site

This is simpler than trying to make a single deployment dynamically serve many sites.

## Required Runtime Changes

1. make content fetches site-aware
2. make settings fetches site-aware
3. scope `getStaticPaths` and `getStaticProps` to the current site
4. make revalidation site-specific
5. make sitemap and robots generation site-specific
6. keep locale fallback behavior intact but site-scoped

## Hospitality-Specific Runtime Needs

The runtime should support pages common to hospitality brands:

- homepage
- stay or accommodation pages
- amenities
- destination or location guide
- gallery
- FAQ
- contact or inquiry page

SEO priorities should include:

- locale-aware title and description management
- destination and accommodation keywords
- clean URLs
- fast mobile performance
- rich image content support

## Template Strategy

Use the current component library as the foundation for hospitality templates.

Recommended initial template types:

- boutique hotel
- vacation rental villa
- glamping destination
- B&B and guest house

Each template should seed:

- default page set
- SEO placeholders
- inquiry CTAs
- brand settings defaults

## Definition Of Done

This phase is done when:

1. two different site deployments can render different settings and content from the same codebase
2. locale-aware SEO works per site
3. sitemaps and revalidation are site-specific
4. the runtime remains stable under the dedicated-deployment model
