## Phase 6 — Testing & QA

## SYSTEM UNDER TEST

MyAllocator CMS — a Puck-based headless CMS with:

1. **API** (NestJS 10 / TypeScript / Prisma / PostgreSQL) — test with **Jest + Supertest** (NestJS default)
2. **Dashboard** (React 19 + Vite + TypeScript strict) — test with **Vitest + React Testing Library**
3. **Website** (Next.js 15 Pages Router) — test with **Playwright** (E2E)

**Important:** The NestJS API exposes routes at the root — no `/api` prefix.
All test paths use `/auth/...`, `/pages/...`, `/health` directly.

---

## PART 1: API TESTS (Jest + Supertest)

### tests/api/auth.test.ts

Test every auth scenario:

- `POST /auth/login` valid credentials → 200, body `{ accessToken, user: { id, email, role } }`,
  `Set-Cookie` header sets `refresh_token` as httpOnly cookie
- `POST /auth/login` wrong password → 401, code `UNAUTHORIZED`
- `POST /auth/login` non-existent email → 401, **same error as wrong password** (no user enumeration)
- `POST /auth/login` missing fields → 400, code `VALIDATION_ERROR`
- `POST /auth/login` 5 consecutive failures → 6th attempt → 403, code `ACCOUNT_LOCKED`
- `POST /auth/refresh` valid cookie → 200, new `accessToken` in body, new `refresh_token` cookie set
- `POST /auth/refresh` expired/missing cookie → 401, code `TOKEN_EXPIRED`
- `POST /auth/refresh` reuse of already-used token → 401, code `TOKEN_REVOKED`
- `POST /auth/logout` valid JWT → 200, `refresh_token` cookie cleared (`Max-Age=0`)
- Rate limit: 11th `POST /auth/login` from same IP within 15 min → 429

### tests/api/pages.test.ts

Setup: seed 3 test pages (2 published EN, 1 draft EN, 1 published ES) before tests; clean up after.

- `GET /pages` unauthenticated → 401, code `UNAUTHORIZED`
- `GET /pages` authenticated EDITOR → 200, array, each item does NOT include `puckData`
- `GET /pages?locale=en` → returns only `locale=en` pages
- `GET /pages?published=true` → returns only published pages
- `GET /pages/:slug?locale=en` → 200, full page object including `puckData`
- `GET /pages/:slug?locale=es` → returns the ES variant
- `GET /pages/:slug?locale=fr` → 404 when FR variant doesn't exist
- `GET /pages/non-existent-slug?locale=en` → 404, code `NOT_FOUND`
- `POST /pages` as EDITOR → 201, creates page, `published` defaults to `false`
- `POST /pages` duplicate slug+locale → 409, code `CONFLICT`
- `PUT /pages/:slug?locale=en` as EDITOR → 200, updates `puckData`
- `PUT /pages/:slug?locale=en` with `puckData` > 5MB → 413, code `PAYLOAD_TOO_LARGE`
- `PUT /pages/:slug?locale=en` → a `PageVersion` row is created in DB (verify via Prisma directly)
- `DELETE /pages/:slug?locale=en` as EDITOR role → 403, code `FORBIDDEN`
- `DELETE /pages/:slug?locale=en` as ADMIN role → 200, page no longer retrievable
- `POST /pages/:slug/publish?locale=en` as EDITOR → 403, code `FORBIDDEN`
- `POST /pages/:slug/publish?locale=en` as ADMIN → 200, `page.published` becomes `true`
- `POST /pages/:slug/publish?locale=en` → triggers `RevalidationService` with correct
  slug and secret (mock the outbound HTTP call, assert it was called once with `{ slug }`)
- `POST /pages/:slug/unpublish?locale=en` as ADMIN → 200, `page.published` becomes `false`
- `GET /pages/:slug/preview?locale=en` → 200, returns `puckData` even when `published=false`

### tests/api/versions.test.ts

- `GET /pages/:slug/versions?locale=en` → 200, array sorted by `savedAt` desc
- `PUT /pages/:slug?locale=en` × 5 → `GET /pages/:slug/versions` returns exactly 5 items
- `POST /pages/:slug/versions/:id/restore?locale=en` as ADMIN → 200, page `puckData` matches restored version, a new version is created with `note` containing "Restored"
- `POST /pages/:slug/versions/:id/restore?locale=en` as EDITOR → 403, code `FORBIDDEN`

### tests/api/health.test.ts

- `GET /health` → 200, `{ status: "ok", dbConnected: true, uptime: <number>, timestamp: <ISO string> }`
- `GET /health` with DB unavailable (mock `prisma.$queryRaw` to throw) → 503,
  `{ status: "error", dbConnected: false }`

---

## PART 2: DASHBOARD UNIT/INTEGRATION TESTS (Vitest + React Testing Library)

### src/auth/AuthProvider.test.tsx

- On mount: calls `POST /auth/refresh` automatically (silent refresh)
- If refresh succeeds: `user` state is set, `loading` becomes `false`
- If refresh fails (401): `user` is `null`, `loading` becomes `false`, no redirect from provider
- `getAccessToken()` returns the module-scoped token (not a React state value)
- After successful refresh: schedules proactive re-refresh ~1 min before `exp`
  (mock `setTimeout`, assert it was called with correct delay)

### src/auth/ProtectedRoute.test.tsx

- When `loading=true`: renders nothing / spinner (not the children, not a redirect)
- When `user=null` and `loading=false`: redirects to `/login`
- When `user` is set: renders children

### src/api/client.test.ts

- Request interceptor attaches `Authorization: Bearer <token>` when token exists
- Request interceptor sends no `Authorization` header when token is `null`
- Response interceptor: on 401, calls `POST /auth/refresh`, retries original request
  with new token
- Response interceptor: if two concurrent requests both get 401, only **one** refresh
  call is made (queue pattern — assert `POST /auth/refresh` called exactly once)
- Response interceptor: if refresh also returns 401, redirects to `/login`

### src/pages/LoginPage.test.tsx

- Renders email + password inputs and a submit button
- Submit with empty fields: shows validation errors, does not call the API
- Submit with valid credentials: calls `POST /auth/login` with `{ email, password }`
- On success: navigates to `/pages`
- On 401 error: shows "Invalid email or password" error message (not a thrown error)
- On 403 `ACCOUNT_LOCKED`: shows "Account locked" message with retry time

### src/pages/PagesListPage.test.tsx

- Shows loading spinner while `usePages` query is pending
- Renders a row per page when data loads (title, slug, locale, status badge)
- Published page shows green badge; draft page shows yellow badge
- Search input filters rows by slug (client-side, no new API call)
- Locale tab "ES" filters to only Spanish pages
- "New Page" button opens the new page modal/dialog
- Slugify: typing "My New Page" in title field auto-fills slug as "my-new-page"
- Clicking "Delete" on a row: shows `ConfirmDialog`; confirming calls
  `DELETE /pages/:slug?locale=en`; row disappears (optimistic update)
- EDITOR role: "Publish" and "Delete" actions are hidden

### src/pages/EditorPage.test.tsx

- Shows `LoadingSpinner` while `usePage` query is pending
- Renders Puck `<Editor>` when page data loads
- Puck `onChange` fires → `isDirty` becomes `true`
- Clicking Save (`onPublish` callback): calls `PUT /pages/:slug?locale=en` with updated
  `puckData`
- On save success: shows `toast.success("Page saved")`, `isDirty` resets to `false`
- On save failure (500): shows `toast.error("Save failed...")`, `isDirty` stays `true`
- ADMIN role: "Publish" button is visible
- EDITOR role: "Publish" button is hidden (`user.role === 'EDITOR'` from `useAuth()`)

### src/hooks/usePages.test.ts

- Calls `GET /pages` with correct query params (locale, published filters)
- Returns paginated result `{ data, total, page, limit }`
- On network error: returns React Query error state

---

## PART 3: WEBSITE E2E TESTS (Playwright)

### e2e/website/pages.spec.ts

- `GET /` → 200, renders `HeroSection` with expected headline text
- `GET /pricing` → 200, renders pricing content, `<title>` contains "Pricing"
- `GET /channel-manager-vacation-rental` → 200, no console errors
- `GET /dynamic-pricing` → 200, `<title>` contains "Dynamic Pricing"
- `GET /non-existent-page-xyz` → 404 page renders (custom 404.js)
- Every page in the above list: zero browser console errors
  (attach `page.on('console', ...)` and assert `errors.length === 0`)
- Every page: no broken images (assert all `<img>` elements have `naturalWidth > 0`)

### e2e/website/seo.spec.ts

For `/`, `/pricing`, `/channel-manager-vacation-rental`:

- `<title>` tag is set, non-empty, contains "MyAllocator"
- `<meta name="description">` is present and non-empty
- `<link rel="canonical">` is present and matches the page URL
- `og:title`, `og:description`, `og:image` are all present and non-empty
- JSON-LD structured data: parses without error (assert valid JSON)

### e2e/website/isr.spec.ts

Tests on-demand ISR revalidation (requires API + website both running on staging):

- Load `/pricing` → read current `HeroSection` heading text
- Update the pricing page via API: `PUT /pages/pricing?locale=en` with new heading
- Publish it: `POST /pages/pricing/publish?locale=en`
  (this triggers `RevalidationService` → `POST /api/revalidate` on the website)
- Poll `/pricing` every 2 seconds for up to 70 seconds
- Assert the heading on the page has changed to match the new content

### e2e/website/performance.spec.ts (Lighthouse CI — skip locally)

For `/`, `/pricing`, `/dynamic-pricing`:

- Performance score ≥ 85
- SEO score ≥ 95
- Best Practices score ≥ 90
- No render-blocking resources from Puck's `<Render />`

---

## TEST HELPERS

### tests/api/helpers/testDb.ts (Jest)

```ts
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

// Run before entire suite
export async function setupTestDb() {
  await prisma.$executeRaw`TRUNCATE TABLE users, pages, page_versions, refresh_tokens CASCADE`;
  // Seed ADMIN and EDITOR test users with known Argon2id password hashes
  await prisma.user.createMany({
    data: [
      {
        id: "test-admin-id",
        email: "admin@test.com",
        passwordHash: await hashPassword("AdminPass123!"),
        role: "ADMIN",
      },
      {
        id: "test-editor-id",
        email: "editor@test.com",
        passwordHash: await hashPassword("EditorPass123!"),
        role: "EDITOR",
      },
    ],
  });
}

export async function teardownTestDb() {
  await prisma.$disconnect();
}

// Factory — creates a test page with valid puckData shape
export function createTestPage(overrides = {}) {
  return {
    slug: "test-page",
    locale: "en",
    title: "Test Page",
    puckData: {
      content: [
        {
          type: "HeroSection",
          props: {
            heading: "Test",
            subheading: "",
            ctaText: "Go",
            ctaHref: "/",
            showCta: true,
          },
        },
      ],
      root: { title: "Test Page" },
    },
    published: false,
    ...overrides,
  };
}
```

### tests/api/helpers/auth.ts (Jest)

```ts
import * as request from "supertest";

// Returns a valid JWT for a test user by actually logging in
// (uses the real /auth/login endpoint — tests the full auth flow)
export async function getAuthToken(
  app: any,
  role: "ADMIN" | "EDITOR",
): Promise<string> {
  const credentials =
    role === "ADMIN"
      ? { email: "admin@test.com", password: "AdminPass123!" }
      : { email: "editor@test.com", password: "EditorPass123!" };

  const res = await request(app)
    .post("/auth/login")
    .send(credentials)
    .expect(200);

  return res.body.accessToken;
}
```

### e2e/helpers/api.ts (Playwright)

```ts
import type { APIRequestContext } from "@playwright/test";

let adminToken: string;

// Get an admin token once and reuse (avoids repeated logins)
export async function getAdminToken(
  request: APIRequestContext,
): Promise<string> {
  if (adminToken) return adminToken;
  const res = await request.post(`${process.env.API_URL}/auth/login`, {
    data: {
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    },
  });
  adminToken = (await res.json()).accessToken;
  return adminToken;
}

// Seed a page via the CMS API before a test
export async function seedPage(
  request: APIRequestContext,
  data: { slug: string; locale: string; title: string; puckData: object },
) {
  const token = await getAdminToken(request);
  await request.post(`${process.env.API_URL}/pages`, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

// Clean up a page after a test
export async function deletePage(
  request: APIRequestContext,
  slug: string,
  locale = "en",
) {
  const token = await getAdminToken(request);
  await request.delete(
    `${process.env.API_URL}/pages/${slug}?locale=${locale}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
}

// Fill login form and wait for redirect to /pages
export async function loginAs(page: any, role: "ADMIN" | "EDITOR") {
  const [email, password] =
    role === "ADMIN"
      ? [process.env.SEED_ADMIN_EMAIL!, process.env.SEED_ADMIN_PASSWORD!]
      : [process.env.SEED_EDITOR_EMAIL!, process.env.SEED_EDITOR_PASSWORD!];

  await page.goto("/login");
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('[type="submit"]');
  await page.waitForURL("/pages");
}
```

---

## IMPLEMENTATION RULES

1. API tests use **Jest + Supertest** — not Vitest. NestJS's test runner is Jest.
   Use `@nestjs/testing` `createTestingModule` for the NestJS app instance.
2. Dashboard tests use **Vitest + React Testing Library**. Mock the Axios client
   (`vi.mock('../api/client')`) — never make real HTTP calls in unit tests.
3. Dashboard tests mock `useAuth()` to control the current user/role in tests:
   `vi.mock('../auth/useAuth', () => ({ useAuth: () => ({ user: mockUser }) }))`
4. Each test must be independent — no shared mutable state between tests.
   `beforeEach` resets all mocks (`vi.resetAllMocks()` or `jest.resetAllMocks()`).
5. Use descriptive test names: `"should return 403 when EDITOR tries to delete a page"`.
6. API tests use `TEST_DATABASE_URL` env var pointing to a separate test DB.
   Never run tests against the development or production database.
7. Playwright tests run against a **real running staging instance** — no mocked API.
   Use fixtures and `beforeEach` hooks to seed/cleanup test data via the helpers.
8. Rate limit tests in Jest: override `ThrottlerGuard` in the test module
   (`{ provide: APP_GUARD, useValue: mockThrottlerGuard }`) to avoid dependency
   on IP-based rate limiting in test environments.
9. Lighthouse tests run in CI only — add `test.skip` guard controlled by
   `process.env.CI` so local runs skip them.
10. All async operations must be explicitly awaited — zero floating promises.

Write every test file completely, starting with `tests/api/auth.test.ts`.
