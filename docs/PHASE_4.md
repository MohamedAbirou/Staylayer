## Phase 4 — Next.js Website Architecture (Refactored)

## PROJECT CONTEXT

Existing site: MyAllocator (vacation rental SaaS marketing website)

- Next.js 15, Pages Router, Tailwind CSS, custom i18n (en/es/fr)
- Currently ~25 hardcoded JSX pages
- Each page manually imports components and hardcodes props/content

Goal: Each page fetches its layout as a Puck JSON blob from the CMS API
and renders it via <Render config={puckConfig} data={pageData} />

---

### Design Philosophy

The website's refactoring is the most delicate part of the migration. The live marketing site must never go down. The strategy is: introduce a dynamic catch-all route (`[...slug].js`) that fetches Puck data from the CMS API, while keeping existing hardcoded pages as fallbacks. Pages are migrated one at a time — a hardcoded page is only removed after its CMS-managed version is published and verified.

### 4.0 Full API Contract

#### Standard Error Response Format

All error responses follow this structure:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "code": "TOKEN_EXPIRED",
  "message": "Access token has expired"
}
```

**Error codes used across the API:**
| Code | HTTP Status | When |
|------|-------------|------|
| VALIDATION_ERROR | 400 | Request body fails DTO validation |
| UNAUTHORIZED | 401 | Missing or invalid credentials |
| TOKEN_EXPIRED | 401 | JWT access token expired |
| TOKEN_REVOKED | 401 | Refresh token was already used (possible theft) |
| ACCOUNT_LOCKED | 403 | Too many failed login attempts |
| FORBIDDEN | 403 | Authenticated but insufficient role |
| NOT_FOUND | 404 | Resource doesn't exist |
| CONFLICT | 409 | Duplicate slug+locale combination |
| PAYLOAD_TOO_LARGE | 413 | puckData exceeds 5MB limit |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Unhandled server error |

---

#### Auth Endpoints

**POST /auth/login**

```
Auth:        Public (no token required)
Rate limit:  10 req/15min per IP
Request:     { "email": "string (email format)", "password": "string (min 8)" }
Success 200: { "accessToken": "string", "user": { "id": "string", "email": "string", "platformRole": "PLATFORM_OWNER|SUPPORT_ADMIN|FINANCE_ADMIN|null" }, "activeMembershipRole": "OWNER|ADMIN|EDITOR|BILLING|null" }
             + Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=2592000
Error 401:   { code: "UNAUTHORIZED", message: "Invalid email or password" }
Error 403:   { code: "ACCOUNT_LOCKED", message: "Account locked. Try again after {lockedUntil}" }
Error 400:   { code: "VALIDATION_ERROR", message: "..." }
Error 429:   { code: "RATE_LIMITED", message: "Too many login attempts" }
```

**POST /auth/refresh**

```
Auth:        Public (token comes from cookie)
Rate limit:  10 req/15min per IP
Request:     (empty body — refresh_token read from httpOnly cookie)
Success 200: { "accessToken": "string" }
             + Set-Cookie: refresh_token=<new_token>; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=2592000
Error 401:   { code: "TOKEN_EXPIRED", message: "Refresh token expired or not found" }
Error 401:   { code: "TOKEN_REVOKED", message: "Token reuse detected. All sessions revoked." }
```

**POST /auth/logout**

```
Auth:        JWT required (any role)
Request:     (empty body)
Success 200: { "message": "Logged out successfully" }
             + Set-Cookie: refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=0
Error 401:   { code: "UNAUTHORIZED" }
```

---

#### Users Endpoints (PLATFORM_OWNER only)

**GET /users**

```
Auth:        JWT required, PLATFORM_OWNER only
Query:       ?page=1&limit=20
Success 200: { "data": [{ "id", "email", "platformRole", "createdAt" }], "total": number, "page": number, "limit": number }
Error 403:   { code: "FORBIDDEN" }
```

**POST /users**

```
Auth:        JWT required, PLATFORM_OWNER only
Request:     { "email": "string (email)", "password": "string (min 8)", "platformRole": "PLATFORM_OWNER|SUPPORT_ADMIN|FINANCE_ADMIN" }
Success 201: { "id", "email", "platformRole", "createdAt" }
Error 409:   { code: "CONFLICT", message: "User with this email already exists" }
Error 400:   { code: "VALIDATION_ERROR" }
```

**PATCH /users/:id**

```
Auth:        JWT required, PLATFORM_OWNER only
Request:     { "email?": "string", "password?": "string", "platformRole?": "PLATFORM_OWNER|SUPPORT_ADMIN|FINANCE_ADMIN" }
             (all fields optional, at least one required)
Success 200: { "id", "email", "platformRole", "updatedAt" }
Error 404:   { code: "NOT_FOUND" }
Error 409:   { code: "CONFLICT", message: "Email already in use" }
```

**DELETE /users/:id**

```
Auth:        JWT required, PLATFORM_OWNER only
Success 200: { "message": "User deleted" }
Error 404:   { code: "NOT_FOUND" }
Error 400:   { code: "VALIDATION_ERROR", message: "Cannot delete your own account" }
```

---

#### Pages Endpoints

**GET /pages**

```
Auth:        JWT required (any role)
Query:       ?locale=en&published=true&page=1&limit=50&search=pricing
             All filters optional.
Success 200: {
               "data": [{
                 "id", "slug", "locale", "title", "published",
                 "seoTitle", "seoDescription",
                 "createdAt", "updatedAt"
               }],
               "total": number,
               "page": number,
               "limit": number
             }
```

**GET /pages/:slug**

```
Auth:        JWT required (any role) — OR public with ?published=true
Query:       ?locale=en (default: "en"), ?published=true (for public access)
             When ?published=true: no JWT required (website fetches published pages)
             When no ?published: JWT required (dashboard reads drafts)
Success 200: {
               "id", "slug", "locale", "title", "puckData": { ... },
               "published", "seoTitle", "seoDescription", "seoKeywords",
               "createdAt", "updatedAt"
             }
Error 404:   { code: "NOT_FOUND" }
```

**POST /pages**

```
Auth:        JWT required (EDITOR, ADMIN, OWNER membership)
Request:     {
               "slug": "string (kebab-case, 1-200 chars)",
               "locale": "en|es|fr|de",
               "title": "string (1-500 chars)",
               "puckData": { ... } (max 5MB),
               "seoTitle?": "string",
               "seoDescription?": "string",
               "seoKeywords?": "string"
             }
Success 201: { full page object }
Error 409:   { code: "CONFLICT", message: "Page with slug '{slug}' and locale '{locale}' already exists" }
Error 400:   { code: "VALIDATION_ERROR" }
Error 413:   { code: "PAYLOAD_TOO_LARGE", message: "puckData exceeds 5MB limit" }
```

**PUT /pages/:slug**

```
Auth:        JWT required (EDITOR, ADMIN, OWNER membership)
Query:       ?locale=en (required)
Request:     {
               "title?": "string",
               "puckData?": { ... },
               "seoTitle?": "string",
               "seoDescription?": "string",
               "seoKeywords?": "string"
             }
Side effect: Creates a PageVersion snapshot automatically on every save
Success 200: { full page object }
Error 404:   { code: "NOT_FOUND" }
Error 413:   { code: "PAYLOAD_TOO_LARGE" }
```

**DELETE /pages/:slug**

```
Auth:        JWT required, elevated workspace membership only
Query:       ?locale=en (required — deletes one locale variant)
Success 200: { "message": "Page deleted" }
Error 404:   { code: "NOT_FOUND" }
Error 403:   { code: "FORBIDDEN" }
```

**POST /pages/:slug/publish**

```
Auth:        JWT required, elevated workspace membership only
Query:       ?locale=en (required)
Side effect: Sets published=true, then calls RevalidationService.revalidatePage(slug)
             which triggers ISR revalidation on the website for all locales
Success 200: { "message": "Page published", "slug", "locale" }
Error 404:   { code: "NOT_FOUND" }
Error 403:   { code: "FORBIDDEN" }
```

**POST /pages/:slug/unpublish**

```
Auth:        JWT required, elevated workspace membership only
Query:       ?locale=en (required)
Side effect: Sets published=false, triggers revalidation (page will 404 on next request)
Success 200: { "message": "Page unpublished", "slug", "locale" }
Error 404:   { code: "NOT_FOUND" }
Error 403:   { code: "FORBIDDEN" }
```

**GET /pages/:slug/preview**

```
Auth:        JWT required (any role)
Query:       ?locale=en (required)
Description: Returns the current puckData regardless of published status.
             Used by dashboard preview feature.
Success 200: { "slug", "locale", "title", "puckData": { ... } }
Error 404:   { code: "NOT_FOUND" }
```

---

#### Version Endpoints

**GET /pages/:slug/versions**

```
Auth:        JWT required (any role)
Query:       ?locale=en&page=1&limit=20
Success 200: {
               "data": [{
                 "id", "savedBy", "note", "savedAt"
               }],
               "total": number,
               "page": number,
               "limit": number
             }
             Note: puckData NOT included in list (too large).
             Client fetches individual version data via restore.
Error 404:   { code: "NOT_FOUND", message: "Page not found" }
```

**POST /pages/:slug/versions/:id/restore**

```
Auth:        JWT required, elevated workspace membership only
Query:       ?locale=en (required)
Side effect: Copies version's puckData to the Page row.
             Creates a new PageVersion with note "Restored from version {id}".
             Does NOT auto-publish — admin must explicitly publish.
Success 200: { full page object with restored puckData }
Error 404:   { code: "NOT_FOUND" }
Error 403:   { code: "FORBIDDEN" }
```

---

#### Health Endpoint

**GET /health**

```
Auth:        Public (no token required)
Success 200: {
               "status": "ok",
               "uptime": 12345,
               "dbConnected": true,
               "timestamp": "2026-03-03T10:00:00.000Z"
             }
Error 503:   {
               "status": "error",
               "uptime": 12345,
               "dbConnected": false,
               "timestamp": "2026-03-03T10:00:00.000Z"
             }
```

### 4.1 How Pages Fetch Puck Data

**New file: `pages/[...slug].js`** — catch-all dynamic route

```javascript
// pages/[...slug].js
import { Render } from "@measured/puck";
import { puckConfig } from "@myallocator/puck-components";
import SEOHead from "@/components/seoHead";
import { fetchPage, fetchAllPublishedSlugs } from "@/lib/cmsClient";
import { getTranslations } from "@/lib/getTranslations";

export async function getStaticPaths() {
  // Fetch all published page slugs from the CMS
  const pages = await fetchAllPublishedSlugs();

  const paths = pages.map((page) => ({
    params: { slug: page.slug.split("/") },
    locale: page.locale,
  }));

  return {
    paths,
    fallback: "blocking", // ISR: generate new pages on first request
  };
}

export async function getStaticProps({ params, locale }) {
  const slug = params.slug.join("/");

  try {
    // Fetch page from CMS API (published pages only)
    const page = await fetchPage(slug, locale || "en");

    if (!page) {
      return { notFound: true };
    }

    // Also fetch global translations for UI strings (navbar, footer, etc.)
    const translations = await getTranslations(locale || "en");

    return {
      props: {
        page,
        translations,
      },
      revalidate: 60, // ISR: revalidate every 60 seconds
    };
  } catch (error) {
    // On API failure: try static fallback
    try {
      const fallback = await import(`@/lib/fallbacks/${slug}.json`);
      const translations = await getTranslations(locale || "en");
      return {
        props: {
          page: fallback.default,
          translations,
        },
        revalidate: 60,
      };
    } catch {
      return { notFound: true };
    }
  }
}

export default function CMSPage({ page, translations }) {
  return (
    <>
      <SEOHead
        pageTitle={page.seoTitle || page.title}
        pageDescription={page.seoDescription || ""}
        pageKeywords={page.seoKeywords || ""}
      />
      <main id={page.slug}>
        <Render config={puckConfig} data={page.puckData} />
      </main>
    </>
  );
}
```

**`lib/cmsClient.js`:**

```javascript
const CMS_API_URL =
  process.env.NEXT_PUBLIC_CMS_API_URL || "http://localhost:4000";

export async function fetchPage(slug, locale = "en") {
  const res = await fetch(
    `${CMS_API_URL}/pages/${slug}?locale=${locale}&published=true`,
    {
      headers: { "Content-Type": "application/json" },
      // Note: no `next: { revalidate }` here — that's App Router syntax.
      // ISR is controlled by `revalidate` in getStaticProps return value.
    },
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`CMS API error: ${res.status}`);

  return res.json();
}

export async function fetchAllPublishedSlugs() {
  const res = await fetch(`${CMS_API_URL}/pages?published=true&limit=1000`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) return [];
  const body = await res.json();
  return body.data; // [{ slug, locale }, ...]
}
```

**Why `fallback: 'blocking'`:** With `blocking`, a request for a slug not in `getStaticPaths` will SSR the page on the first request and cache it. Subsequent requests get the cached version. This means new pages published in the CMS are immediately available without a full rebuild. `'blocking'` is preferred over `true` because `true` shows a loading state to the user (bad for marketing pages), while `blocking` waits for the HTML to be ready.

**Why `revalidate: 60`:** ISR revalidates the page at most once per 60 seconds. After a publish event, the NestJS backend also triggers on-demand revalidation (see 4.2), so in practice the page updates within seconds. The 60s ISR is a safety net for edge cases where on-demand revalidation fails.

**Why static JSON fallbacks:** If the CMS API is down during a build or cold-start, the website must still render. Fallback files are generated during the migration phase (Section 10) — they're the Puck JSON blob for each page, committed to the repo. They're only used when the API fetch fails. This ensures the marketing site never goes blank.

### 4.2 On-Demand ISR Revalidation

**New file: `pages/api/revalidate.js`**

```javascript
// pages/api/revalidate.js

const LOCALES = ["en", "es", "fr", "de"];

export default async function handler(req, res) {
  // Only accept POST
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Validate secret
  const secret = req.headers["x-revalidate-secret"];
  if (secret !== process.env.REVALIDATION_SECRET) {
    return res.status(401).json({ message: "Invalid revalidation secret" });
  }

  const { slug } = req.body;
  if (!slug) {
    return res.status(400).json({ message: "Missing slug" });
  }

  try {
    // Revalidate for all locales
    const results = await Promise.allSettled(
      LOCALES.map(async (locale) => {
        const path = locale === "en" ? `/${slug}` : `/${locale}/${slug}`;
        await res.revalidate(path);
        return { locale, path, status: "ok" };
      }),
    );

    // Also revalidate the homepage if slug is 'index'
    if (slug === "index" || slug === "") {
      await Promise.allSettled(
        LOCALES.map((locale) =>
          res.revalidate(locale === "en" ? "/" : `/${locale}`),
        ),
      );
    }

    return res.json({
      revalidated: true,
      results: results.map((r) =>
        r.status === "fulfilled"
          ? r.value
          : { status: "error", reason: r.reason?.message },
      ),
    });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Revalidation failed", error: err.message });
  }
}
```

**How it's called:** After a page is published or unpublished in the NestJS backend, `RevalidationService` sends:

```
POST {REVALIDATION_URL}
Headers: { x-revalidate-secret: {REVALIDATION_SECRET} }
Body: { slug: "pricing" }
```

**Why all locales:** When a page is published, we don't know which locale was updated (or the user may have published multiple). Revalidating all 4 locale paths is cheap (4 HTTP calls to Next.js's internal ISR mechanism) and guarantees freshness.

**Security:** The `REVALIDATION_SECRET` is a shared secret between the NestJS API and the Next.js website. It's not a JWT — it's a simple bearer token checked with constant-time comparison. Since the revalidation endpoint is only called server-to-server, this is sufficient.

### 4.3 Locale Handling

**How locale variants are stored:**

Each locale variant is a separate row in the `pages` table:

```
| slug     | locale | title         | puckData        | published |
|----------|--------|---------------|-----------------|-----------|
| pricing  | en     | Pricing       | { ... en data } | true      |
| pricing  | es     | Precios       | { ... es data } | true      |
| pricing  | fr     | Tarification  | { ... fr data } | false     |
```

This means `pricing/en` and `pricing/es` are independently editable and independently publishable. This is by design: the Spanish version might be in draft while the English version is live.

**Fallback chain when a locale variant doesn't exist:**

```
Request for /fr/pricing:
  1. Fetch page: GET /pages/pricing?locale=fr&published=true
  2. If 404 (French version doesn't exist or isn't published):
     → Fetch fallback: GET /pages/pricing?locale=en&published=true
  3. If English also 404:
     → return { notFound: true } (shows 404 page)
```

This is implemented in `getStaticProps`:

```javascript
// In [...slug].js getStaticProps
let page = await fetchPage(slug, locale);
if (!page && locale !== "en") {
  // Fallback to English version
  page = await fetchPage(slug, "en");
}
if (!page) {
  return { notFound: true };
}
```

**How existing i18n (locales/index.json) interacts with Puck data:**

This is the critical boundary. Two types of content coexist:

| Content Type              | Source                        | Examples                                                                                                  | Who Edits                       |
| ------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Global UI strings**     | `locales/{locale}/index.json` | Navbar labels, footer text, CTA button text, common phrases ("Get started", "Learn more"), error messages | Developers (in code)            |
| **Page-specific content** | `puckData` (CMS database)     | Hero headline, body paragraphs, section titles, FAQ items, testimonial quotes, feature descriptions       | Marketing team (in Puck editor) |

**Rule of thumb:** If the text appears on multiple pages or is part of the layout chrome (navbar, footer, CTA), it stays in `locales/index.json`. If the text is unique to a specific page's content area, it goes into Puck.

**In practice for the website:**

```javascript
// [...slug].js receives both:
export default function CMSPage({ page, translations }) {
  const { t } = useTranslation(translations);

  return (
    <>
      <SEOHead ... />
      <main>
        {/* page.puckData is rendered by Puck — page-specific content */}
        <Render config={puckConfig} data={page.puckData} />

        {/* Components like UnifiedCTA use t() for global strings */}
        {/* These are baked into the Puck component implementations */}
      </main>
    </>
  );
}
```

**How Puck components access translations:** Components in `puck-components` that need global UI strings (like `UnifiedCTA` which has "Ready to Take Control...?" as heading) receive those strings as Puck field values. In the dashboard editor, the field defaults are pre-populated from the English translation, and the editor can override them per locale. The component itself does NOT call `t()` — it renders whatever string is in its Puck props.

This means:

- Puck components are pure: `(props) => JSX` — no i18n dependency
- All text is in Puck's JSON data, per-locale
- The only `t()` usage on CMS pages is in the Layout (navbar, footer) which wraps all pages via `_app.js`

### 4.4 Route Priority and Coexistence

Next.js Pages Router resolves routes in this order:

1. Exact match in `pages/` (e.g., `pages/pricing.js`)
2. Dynamic routes (e.g., `pages/[...slug].js`)

During migration, both exist. A hardcoded `pages/pricing.js` takes priority over `pages/[...slug].js` for the `/pricing` route. Once the CMS version is verified, the hardcoded file is deleted, and the catch-all handles it.

**This gives us zero-downtime migration:** The hardcoded page serves traffic until the CMS page is ready. Then we delete one file, deploy, and the catch-all takes over.

---

### 4.5 i18n Strategy (Puck + Existing Translations)

#### The Boundary — What Lives Where

| Content Category          | Source                                                                 | Example                                                                                             | Edited By                                                       |
| ------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Layout chrome**         | `locales/{locale}/index.json`                                          | Navbar labels ("Platform", "Resources"), footer text, "Get Started" button, "Learn More" links      | Developers — changed in code, committed to git                  |
| **Global UI patterns**    | `locales/{locale}/index.json`                                          | Common phrases used by multiple components: error messages, form labels, accessibility text         | Developers                                                      |
| **Page-specific content** | `puckData` in CMS database                                             | Hero headlines, body paragraphs, section titles, FAQ Q&As, testimonial quotes, feature descriptions | Marketing team — edited visually in Puck dashboard              |
| **SEO metadata**          | `pages` table columns (`seo_title`, `seo_description`, `seo_keywords`) | Per-page title tags, meta descriptions                                                              | Marketing team — edited in Puck's page settings panel           |
| **Component defaults**    | `puckConfig` default props                                             | "Ready to Take Control...?" (UnifiedCTA heading default)                                            | Developers set defaults; marketing overrides per-page in editor |

#### How the Dashboard Handles Multi-Locale Pages

Each page slug has **separate rows per locale** in the database:

```
pages table:
┌────────┬────────┬───────────────────┬────────────────┬───────────┐
│ slug   │ locale │ title             │ puck_data      │ published │
├────────┼────────┼───────────────────┼────────────────┼───────────┤
│ pricing│ en     │ Pricing           │ { ...en... }   │ true      │
│ pricing│ es     │ Precios           │ { ...es... }   │ true      │
│ pricing│ fr     │ Tarification      │ { ...fr... }   │ false     │
│ pricing│ de     │ (does not exist)  │                │           │
└────────┴────────┴───────────────────┴────────────────┴───────────┘
```

**Dashboard UX for locale management:**

1. **Pages List (`/pages`):** Shows all pages with a locale badge (EN, ES, FR). Filter by locale via tabs. Each locale variant appears as its own row.

2. **Editing a page (`/editor/pricing?locale=en`):** The `LocaleTabs` component at the top of the editor shows tabs: **EN | ES | FR | DE**. Switching tabs navigates to `/editor/pricing?locale=es` — loading a completely different `puckData` blob from the API.

3. **Creating a new locale variant:** If a page exists in EN but not ES, the ES tab shows a "Create Spanish version" button. Clicking it:
   - Calls `POST /pages` with `{ slug: "pricing", locale: "es", title: "Precios", puckData: {copied from EN version} }`
   - Pre-populates with the English puckData as a starting point
   - Marketing team then edits the Spanish text in the Puck editor
   - This is a **copy-then-edit** workflow, not live translation

4. **Publishing is per-locale:** Publishing `pricing/en` does not affect `pricing/es`. The French version can stay as draft while English is live.

#### Fallback Chain When a Locale Variant Doesn't Exist

```
User visits /fr/pricing:
  1. getStaticProps calls fetchPage('pricing', 'fr')
  2. API returns 404 (French version doesn't exist or is unpublished)
  3. Fallback: fetchPage('pricing', 'en')
  4. English version renders, with French global chrome (navbar/footer from locales/fr/index.json)
  5. If English also 404: return { notFound: true } → show 404 page
```

**Reasoning for English fallback:** Showing English content is better than showing a 404 for a page that exists in other locales. The user still gets the information, and the layout chrome (navbar, footer) will be in their locale. This matches the current behavior of the existing i18n system where missing keys fall back to English.

#### How Puck Components Handle Translated Content

Puck components are **locale-agnostic**. They render whatever strings are in their props:

```typescript
// Quote component doesn't know or care about locale
function Quote({ text, author, position, showBorder }) {
  return (
    <blockquote className={showBorder ? 'border-l-4' : ''}>
      <p>{text}</p>
      <cite>{author}, {position}</cite>
    </blockquote>
  );
}
```

For the English page, `text` is "Great product!" — for Spanish, `text` is "Gran producto!" — different puckData blobs, same component code.

**Exception: Components that need global UI strings.** Components like `UnifiedCTA` have default button text ("Get started"). In Puck, these are field defaults. The marketing team can override per-locale. If they don't override, the English default is used. This is acceptable because:

- The default is visible in the editor
- The editor explicitly chose not to change it
- For common CTAs, the English text is often intentionally kept

#### Migration Path for Existing Translation Keys

During migration (Section 10), the content currently in `locales/{locale}/index.json` that is **page-specific** gets moved into Puck's `puckData`. For example:

**Before (in locales/en/index.json):**

```json
{
  "pricing": {
    "hero": {
      "title": "Simple, Transparent Pricing",
      "description": "One plan. Everything included."
    }
  }
}
```

**After (in puckData for pricing/en):**

```json
{
  "content": [
    {
      "type": "HeroSection",
      "props": {
        "heading": "Simple, Transparent Pricing",
        "subheading": "One plan. Everything included.",
        "showCta": true
      }
    }
  ],
  "root": { "title": "Pricing" }
}
```

The `locales/en/index.json` keys for page-specific content are **removed** after migration. Only global UI strings remain in the JSON files.

## SHARED PACKAGE

`@myallocator/puck-components` exports:

- `puckConfig` — the Puck component registry (Config object)
- All component TypeScript types

Install as: `"@myallocator/puck-components": "workspace:*"`

---

## CMS API

Base URL: `process.env.NEXT_PUBLIC_CMS_API_URL`
Endpoint: `GET {base}/pages/{slug}?locale={locale}&published=true`
Note: no `/api` prefix — NestJS exposes `/pages` directly at the root.

Response (success, HTTP 200):

```json
{
  "id": "string",
  "slug": "string",
  "locale": "en",
  "title": "string",
  "puckData": { ... },
  "published": true,
  "seoTitle": "string",
  "seoDescription": "string",
  "seoKeywords": "string",
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}
```

Response (404): `{ "statusCode": 404, "error": "Not Found", "code": "NOT_FOUND", "message": "..." }`

---

## NEW UTILITY: lib/cmsClient.js

This file is the single source of truth for all CMS API communication
from the website. It wraps `fetch` with 404 handling, fallback logic,
and a 5-second timeout.

```js
// lib/cmsClient.js

const CMS_API_URL =
  process.env.NEXT_PUBLIC_CMS_API_URL || "http://localhost:4000";

/**
 * CmsPageData shape — matches the API response exactly:
 * {
 *   id, slug, locale, title,
 *   puckData: Data,
 *   published: boolean,
 *   seoTitle: string,
 *   seoDescription: string,
 *   seoKeywords: string,
 *   createdAt, updatedAt
 * }
 */

// Fetch a single published page. Returns null on 404.
// Throws on network errors (caller handles fallback).
export async function fetchPage(slug, locale = "en") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `${CMS_API_URL}/pages/${slug}?locale=${locale}&published=true`,
      {
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`CMS API error: ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// Fetch a single page with fallback to static JSON on API failure.
// Use this in individual page getStaticProps.
export async function getPageData(slug, locale = "en") {
  try {
    const page = await fetchPage(slug, locale);
    if (page) return page;

    // Locale variant missing — try English fallback
    if (locale !== "en") {
      const enPage = await fetchPage(slug, "en");
      if (enPage) return enPage;
    }

    return null;
  } catch (err) {
    console.error({ slug, locale, error: err.message });

    // API down — try static fallback committed to repo
    try {
      const fallback = await import(`@/lib/fallbacks/${slug}.json`);
      return fallback.default;
    } catch {
      return null;
    }
  }
}

// Fetch all published slugs for getStaticPaths.
export async function fetchAllPublishedSlugs() {
  try {
    const res = await fetch(`${CMS_API_URL}/pages?published=true&limit=1000`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.data; // [{ slug, locale }, ...]
  } catch {
    return [];
  }
}
```

---

## FALLBACK SYSTEM: lib/fallbacks/

Create lib/fallbacks/{slug}.json for each page — a valid Puck JSON blob
containing the current hardcoded content converted to Puck component format.
This ensures the site never fails to build even if the CMS is unreachable.

Generate the fallback JSON for these pages (using the current hardcoded
content):

- index.json
- pricing.json
- about.json
- contact-us.json
- channel-manager-vacation-rental.json
- dynamic-pricing.json
- reservation-system-pms-vacation-rental.json
- statistics-kpis-vacation-rentals.json
- website-builder-vacation-rentals.json
- automatic-guest-communications-vacation-rentals.json

---

## REFACTOR PATTERN

Every hardcoded page is deleted and replaced with this pattern.
The file stays `.js` — the website codebase is JavaScript-only.

```js
// pages/example-page.js  (keep .js — do NOT rename to .tsx)

import { Render } from "@measured/puck";
import { puckConfig } from "@myallocator/puck-components";
import SEOHead from "@/components/seoHead";
import { getPageData } from "@/lib/cmsClient";

const PAGE_SLUG = "example-page";

export async function getStaticProps({ locale }) {
  const page = await getPageData(PAGE_SLUG, locale ?? "en");
  if (!page) return { notFound: true };
  return {
    props: { page },
    revalidate: 60, // ISR: revalidate every 60 seconds
  };
}

export default function ExamplePage({ page }) {
  return (
    <>
      <SEOHead
        pageTitle={page.seoTitle || page.title || "MyAllocator"}
        pageDescription={page.seoDescription || ""}
        pageKeywords={page.seoKeywords || ""}
      />
      <main id={PAGE_SLUG}>
        <Render config={puckConfig} data={page.puckData} />
      </main>
    </>
  );
}
```

**Why no TypeScript in pages:** The existing website is JavaScript-only
per project conventions (see CLAUDE.md). Do not convert `.js` to `.tsx`.
The `@myallocator/puck-components` package provides TypeScript types —
they're available at the package boundary without requiring the consumer
to be TypeScript.

---

## PAGES TO REFACTOR

**Migration is incremental, NOT a big-bang conversion.** The `[...slug].js`
catch-all (section 4.1) handles all CMS-managed pages. Individual hardcoded
files are DELETED one at a time only after their CMS version is published
and verified. Next.js Pages Router gives exact-match files priority over
`[...slug].js`, so both can coexist safely during migration.

For Phase 4 specifically, implement the `[...slug].js` catch-all and
`lib/cmsClient.js`. Do NOT delete the hardcoded pages yet — that happens
in Phase 5 (Migration) as each page's CMS content is verified.

The full migration target (all pages that will eventually be deleted):

1. pages/index.js (PAGE_SLUG: 'home')
2. pages/pricing.js (PAGE_SLUG: 'pricing')
3. pages/about.js
4. pages/contact-us.js
5. pages/careers.js
6. pages/ambassador.js
7. pages/annual-report.js
8. pages/channel-manager-vacation-rental.js
9. pages/channel-manager-airbnb.js
10. pages/channel-manager-booking-com.js
11. pages/dynamic-pricing.js
12. pages/reservation-system-pms-vacation-rental.js
13. pages/statistics-kpis-vacation-rentals.js
14. pages/website-builder-vacation-rentals.js
15. pages/automatic-guest-communications-vacation-rentals.js
16. pages/booking-system-engine-vacation-rental.js
17. pages/guest-guide-for-vacation-rentals.js
18. pages/vacation-apartments-and-homes.js
19. pages/vacations-camping-glamping.js
20. pages/bedbreakfast.js
21. pages/boutique.js
22. pages/farm-stays.js
23. pages/guest-house.js
24. pages/account-access.js
25. pages/customer-agreement.js
26. pages/privacy-policy.js

DO NOT modify: \_app.js, \_document.js, 404.js (keep these as-is forever)

---

## ADDITIONAL FILES TO CREATE/MODIFY

### next.config.js — add:

- `i18n` config if not already present
- Revalidation webhook handler (optional — via on-demand ISR)

### pages/api/revalidate.js — new file:

Full implementation is specified in section 4.2 of this document.
Key contract:

- Method: POST only
- Auth: `x-revalidate-secret` header must match `process.env.REVALIDATION_SECRET`
- Body: `{ slug: string }` — revalidates all locale paths for that slug
- Called by NestJS RevalidationService after every publish/unpublish
- File extension: `.js` (not `.ts`)

### lib/cmsClient.js — new file (spec above)

### lib/fallbacks/\*.json — one per page (spec above)

---

## IMPLEMENTATION RULES

1. Preserve the existing layout.jsx (navbar/footer) — it wraps all pages
   via \_app.js and must not be touched. Never add Navbar or Footer inside
   individual pages or inside `[...slug].js`.
2. CMS-rendered pages never import individual UI components — Puck's
   `<Render />` handles all component rendering from the puckData blob.
3. ISR revalidate: 60 seconds on all CMS pages. On-demand revalidation
   via `pages/api/revalidate.js` triggers immediately on publish.
4. `[...slug].js` IS a dynamic route and DOES require `getStaticPaths`.
   Implement it with `fallback: 'blocking'` so new CMS pages are generated
   on first request without a full rebuild.
5. The catch-all `[...slug].js` coexists with hardcoded pages. Next.js
   resolves exact-match files first, so existing pages are unaffected until
   their hardcoded files are deleted in Phase 5 (Migration).
6. If a hardcoded page has special non-Puck logic (e.g., annual-report.js
   has a form), the form component stays outside Puck — render it below
   `<Render />` with a comment explaining why it isn't in Puck.
7. All page files stay `.js` — do NOT convert to `.tsx`. The website
   codebase is JavaScript-only per project conventions.
8. `<SEOHead>` must always receive valid strings — use fallbacks:
   `page.seoTitle || page.title || 'MyAllocator'`, `page.seoDescription || ''`,
   `page.seoKeywords || ''`.
9. All API calls from the website go through `lib/cmsClient.js` —
   never call the CMS API with raw `fetch` inside a page file.
10. The `<main id={PAGE_SLUG}>` wrapper is required on every page
    per project conventions (used for CSS scoping and analytics).

Write every file completely. Start with `lib/cmsClient.js`, then
`pages/[...slug].js`, then `pages/api/revalidate.js`, then
`lib/fallbacks/index.json` as a worked example.

## Security Checks

### Token Security

- [ ] **Revalidation secret validated with constant-time comparison** — `apps/website/pages/api/revalidate.js` (use `crypto.timingSafeEqual`) — Mitigates: timing attacks on revalidation endpoint.
- [ ] **No secrets in NEXT*PUBLIC* variables** — `apps/website/.env.example` — Mitigates: client-side secret exposure.

```

```
