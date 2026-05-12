## Phase 3 — CMS Dashboard

## PROJECT: MyAllocator CMS Dashboard

A private web application used by the marketing team to visually edit
pages of the MyAllocator website (a vacation rental SaaS).

---

### TECH STACK

```
- Framework: React 19 + Vite (SPA — no SSR, no Next.js), Typescript (strict)
- Styling: Tailwind CSS v4 (via @tailwindcss/vite plugin)
- Auth: Custom AuthContext + Axios interceptors — httpOnly cookie (refresh token) + module-scoped JS variable (access token). No NextAuth.
- Page Editor: @measured/puck
- Component Library: @myallocator/puck-components (local workspace package)
- HTTP client: Axios — with request interceptor (attaches Bearer token) and response interceptor (handles 401 with silent refresh + request queue)
- Routing: React Router v7
- State: TanStack Query (React Query) for all server state (pages, users, versions) + React Context for auth (no Redux — overkill for this app)
- Notifications: react-hot-toast
- Modals/UI: Shadcn UI
- Testing: Vitest + React Testing Library
- Icons: Lucide React Icons
```

---

### Why React 19 + Vite (not Next.js)

The dashboard is a private, authenticated SPA with zero SEO requirements. SSR adds complexity (server state hydration, cookie forwarding, server components) for no benefit. Puck's editor is 100% client-side — it manipulates a JSON tree in the browser. Vite gives us sub-second HMR, smaller production bundles (no server runtime), and simpler deployment (static files behind a CDN or served by the NestJS API itself).

### 3.1 Project Structure

```
apps/dashboard/
├── src/
│   ├── main.tsx                      # ReactDOM.createRoot, renders <App />
│   ├── App.tsx                       # AuthProvider → ToastProvider → RouterProvider
│   ├── routes.tsx                    # React Router v7 route tree
│   │
│   ├── api/                          # API communication layer
│   │   ├── client.ts                 # Axios instance: baseURL, interceptors, refresh logic
│   │   ├── auth.ts                   # login(email, pw), refresh(), logout()
│   │   ├── pages.ts                  # getPages(), getPage(slug, locale), createPage(), updatePage(), deletePage(), publishPage(), unpublishPage(), getVersions(), restoreVersion()
│   │   └── users.ts                  # getUsers(), createUser(), updateUser(), deleteUser()
│   │
│   ├── auth/                         # Authentication layer
│   │   ├── AuthContext.tsx            # createContext<AuthState>
│   │   ├── AuthProvider.tsx           # Provider: holds user, accessToken, loading; handles silent refresh on mount
│   │   ├── ProtectedRoute.tsx         # Wrapper: redirects to /login if !user && !loading
│   │   └── useAuth.ts                # useContext(AuthContext) convenience hook
│   │
│   ├── pages/                        # Route-level page components
│   │   ├── LoginPage.tsx             # Email/password form, calls login(), redirects to /pages on success
│   │   ├── PagesListPage.tsx         # Fetches pages list, search/filter, status badges, locale tabs
│   │   ├── NewPagePage.tsx           # Form: slug (auto-kebab), locale dropdown, title → POST /pages
│   │   ├── EditorPage.tsx            # Puck <Editor> component, auto-save indicator, Save/Publish buttons
│   │   ├── PreviewPage.tsx           # Renders puckData via <Render> in an iframe or inline
│   │   └── SettingsPage.tsx          # User CRUD table (PLATFORM_OWNER only), platform role dropdown
│   │
│   ├── components/                   # Shared UI components
│   │   ├── Layout.tsx                # Dashboard shell: sidebar (left) + main content area (right)
│   │   ├── Sidebar.tsx               # Nav links: Pages, Settings (if PLATFORM_OWNER), Logout
│   │   ├── ToastProvider.tsx         # Toast context + toast() function + toast container UI
│   │   ├── PageStatusBadge.tsx       # Green "Published" / Yellow "Draft" pill badge
│   │   ├── LocaleTabs.tsx            # Tab bar: EN | ES | FR | DE — switches locale query param
│   │   ├── ConfirmDialog.tsx         # Modal: "Are you sure?" with confirm/cancel actions
│   │   ├── LoadingSpinner.tsx        # Centered spinner for async states
│   │   └── ErrorBoundary.tsx         # React error boundary with retry button
│   │
│   ├── hooks/                        # React Query hooks (server state)
│   │   ├── usePages.ts              # useQuery(['pages', filters], () => getPages(filters))
│   │   ├── usePage.ts               # useQuery(['page', slug, locale], () => getPage(slug, locale))
│   │   ├── useUsers.ts              # useQuery(['users'], () => getUsers())
│   │   ├── useSavePage.ts           # useMutation for PUT /pages/:slug + invalidates queries
│   │   ├── usePublishPage.ts        # useMutation for POST /pages/:slug/publish
│   │   └── useVersions.ts           # useQuery(['versions', slug, locale], () => getVersions(...))
│   │
│   └── lib/                          # Utilities
│       ├── constants.ts              # API_URL, LOCALES, ROLES, etc.
│       └── formatDate.ts             # Date formatting utility
│
├── public/
│   └── favicon.ico
├── index.html                        # Vite entry: <div id="root">
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts                # Tailwind config (imports puck-components content paths)
└── package.json
```

### 3.2 Full API Contract

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

### 3.3 Auth Implementation in SPA

**Architecture decision:** Access token stored in a module-scoped variable (not React state, not localStorage). React state triggers re-renders; a module variable does not. The AuthContext exposes `user` (triggers UI updates) and a `getAccessToken()` function (reads the module variable synchronously).

```typescript
// auth/AuthProvider.tsx — simplified implementation spec

let accessToken: string | null = null; // module-scoped, invisible to XSS

export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: attempt silent refresh
  useEffect(() => {
    refresh()
      .then(({ accessToken: at, user: u }) => {
        accessToken = at;
        setUser(u);
      })
      .catch(() => {
        accessToken = null;
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Schedule proactive refresh 1 minute before expiry
  useEffect(() => {
    if (!accessToken) return;
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    const msUntilRefresh = (payload.exp * 1000) - Date.now() - 60_000;
    const timer = setTimeout(async () => {
      try {
        const { accessToken: at } = await refresh();
        accessToken = at;
      } catch {
        accessToken = null;
        setUser(null);
      }
    }, Math.max(msUntilRefresh, 0));
    return () => clearTimeout(timer);
  }, [user]); // re-run when user changes (new token issued)

  const getAccessToken = () => accessToken;

  return (
    <AuthContext.Provider value={{ user, loading, getAccessToken, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**Axios interceptor for transparent token refresh:**

```typescript
// api/client.ts

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true, // sends httpOnly cookies on every request
});

// Request interceptor: attach access token
client.interceptors.request.use((config) => {
  const token = getAccessToken(); // reads module-scoped variable
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle 401 with silent refresh
let isRefreshing = false;
let failedQueue: Array<{ resolve: Function; reject: Function }> = [];

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => {
          originalRequest.headers.Authorization = `Bearer ${getAccessToken()}`;
          return client(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { accessToken: newToken } = await refreshTokenAPI();
        setAccessToken(newToken);
        // Retry all queued requests
        failedQueue.forEach(({ resolve }) => resolve());
        failedQueue = [];
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);
      } catch {
        failedQueue.forEach(({ reject }) => reject(error));
        failedQueue = [];
        // Force logout — redirect to /login
        window.location.href = "/login";
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
```

**Why this approach:**

- **Module variable (not localStorage):** XSS cannot read module-scoped JS variables. localStorage is accessible to any script on the page.
- **Not sessionStorage:** Same XSS vulnerability as localStorage.
- **Not React state alone:** Storing the token in React state would cause re-renders on every refresh. The module variable is read imperatively by the Axios interceptor.
- **Queue pattern:** If multiple requests get 401 simultaneously, only one refresh is attempted. Others queue up and retry after the refresh succeeds. This prevents refresh token stampede.

### 3.4 Routing

```typescript
// routes.tsx
import { createBrowserRouter } from 'react-router-dom';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    // Public — no ProtectedRoute wrapper
  },
  {
    element: <ProtectedRoute><Layout /></ProtectedRoute>,
    children: [
      {
        path: '/',
        element: <Navigate to="/pages" replace />,
      },
      {
        path: '/pages',
        element: <PagesListPage />,
      },
      {
        path: '/pages/new',
        element: <NewPagePage />,
      },
      {
        path: '/editor/:slug',
        element: <EditorPage />,
        // locale comes from ?locale=en query param
      },
      {
        path: '/preview/:slug',
        element: <PreviewPage />,
        // locale comes from ?locale=en query param
      },
      {
        path: '/settings',
        element: <RoleGate platformRoles={['PLATFORM_OWNER']}><SettingsPage /></RoleGate>,
      },
    ],
  },
]);
```

**Route breakdown:**

| Path             | Component     | Auth   | Role           | Description                                                                                               |
| ---------------- | ------------- | ------ | -------------- | --------------------------------------------------------------------------------------------------------- |
| `/login`         | LoginPage     | Public | —              | Email/password login form                                                                                 |
| `/`              | (redirect)    | JWT    | Any            | Redirects to /pages                                                                                       |
| `/pages`         | PagesListPage | JWT    | Any            | Pages list with search, filter by locale/status                                                           |
| `/pages/new`     | NewPagePage   | JWT    | Any            | Create new page (slug + locale + title)                                                                   |
| `/editor/:slug`  | EditorPage    | JWT    | Any            | Puck editor. `?locale=en` query param. Save = content membership. Publish = elevated workspace membership |
| `/preview/:slug` | PreviewPage   | JWT    | Any            | Renders page using Puck `<Render>`. `?locale=en` query param                                              |
| `/settings`      | SettingsPage  | JWT    | PLATFORM_OWNER | User management CRUD table                                                                                |

### 3.5 State Management

| State                       | Where                                      | Why                                                                                                                          |
| --------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Auth (user, token, loading) | AuthContext (React Context)                | Global, needed by every protected route and the Axios interceptor. Changes infrequently (login/logout/refresh).              |
| Pages list                  | React Query `useQuery`                     | Server state — cached, auto-refetched on window focus, paginated. React Query handles loading/error/stale states.            |
| Single page data            | React Query `useQuery`                     | Same reasoning. Cache key: `['page', slug, locale]`.                                                                         |
| Editor dirty state          | Local `useState` in EditorPage             | Only relevant to the editor. Puck's `onChange` sets `isDirty = true`. Save button resets to false. No need for global state. |
| User list                   | React Query `useQuery`                     | Server state, only fetched on /settings page.                                                                                |
| Confirm dialog              | Local `useState` in the component using it | Scoped to the component that triggers the dialog (delete page, restore version).                                             |

**Why React Query (TanStack Query) over Redux/Zustand:**

- 90% of the dashboard's state is server data (pages, users, versions). React Query is purpose-built for this: caching, background refetching, optimistic updates, pagination, mutation invalidation.
- The remaining state (auth, toasts) is simple enough for React Context.
- Redux or Zustand would add a store, actions, reducers/slices — all boilerplate for what React Query already handles. We'd be fighting the abstraction, not using it.

### 3.6 Puck Editor Integration

```typescript
// pages/EditorPage.tsx — key implementation details

import { Editor } from "@measured/puck";
import { puckConfig } from "@myallocator/puck-components";

export default function EditorPage() {
  const { slug } = useParams();
  const locale = useSearchParams()[0].get('locale') || 'en';
  const { data: page, isLoading } = usePage(slug, locale);
  const saveMutation = useSavePage();
  const [isDirty, setIsDirty] = useState(false);

  const handleSave = (data: Data) => {
    saveMutation.mutate(
      { slug, locale, puckData: data },
      {
        onSuccess: () => {
          setIsDirty(false);
          toast.success('Page saved');
        },
      }
    );
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <Editor
      config={puckConfig}
      data={page?.puckData || { content: [], root: {} }}
      onPublish={handleSave}  // Puck's "Publish" button = our "Save" action
      onChange={() => setIsDirty(true)}
      // Header actions are customized to show our Save/Publish/Preview buttons
    />
  );
}
```

**Key decisions:**

- Puck's built-in `onPublish` callback is used as the "Save draft" action (naming is Puck's convention — we rename the button label to "Save").
- Actual publish/unpublish is a separate button that calls `POST /pages/:slug/publish`.
- `puckConfig` is imported from the shared `@myallocator/puck-components` package — identical config used by both dashboard (editing) and website (rendering).

### 3.7 Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
```

**Dev proxy reasoning:** In development, the dashboard runs on :5173 and the API on :4000. The Vite proxy rewrites `/api/*` to `localhost:4000/*`, avoiding CORS issues during development. In production, the dashboard is a static build served from a CDN, and CORS on the NestJS API allows the dashboard's origin.

---

## DETAILED REQUIREMENTS (You can be creative, you don't have to stick EXACTLY to this detailed requirements!)

### /login

- Email + password form, clean centered card layout
- Calls NextAuth signIn('credentials', { email, password })
- Shows error state on invalid credentials
- Redirect to / on success
- No sign-up link (admin creates users via seed)

### / — Pages Dashboard

Layout: sidebar with nav (Pages, Settings, Logout) + main content area

Pages table columns:

- Title | Slug | Locale | Status (Published / Draft badge) | Last Updated
  | Actions

Actions per row:

- Edit button → /editor/[slug]?locale={locale}
- Publish / Unpublish toggle (optimistic UI — update badge immediately,
  rollback on API error)
- Delete button → confirmation dialog → DELETE /api/pages/:slug

Top bar:

- "New Page" button → opens modal
- Search input (client-side filter by title or slug)
- Locale filter tabs: All | EN | ES | FR

"New Page" modal fields:

- Title (text, required)
- Slug (text, required — auto-generated from title, user can override,
  validate: lowercase, hyphens only, no spaces)
- Locale (select: en | es | fr)
- On submit: POST /api/pages → redirect to /editor/[slug]?locale={locale}

### /editor/[slug]

- On load: GET /api/pages/:slug?locale={locale}
- If 404: show "Page not found" with back button
- Render: <Puck config={puckConfig} data={fetchedPuckData} onPublish={handleSave} />
- handleSave: PUT /api/pages/:slug?locale={locale} with puck_data body
  - Show toast: "Saving..." → "Saved!" or "Save failed — please retry"
- Auto-save: every 30s save draft to localStorage key
  `draft__{slug}__{locale}` — show a "Draft auto-saved" indicator
- On mount: check localStorage for newer draft, show banner:
  "You have an unsaved draft from {time}. Restore it?"
- Unsaved changes: track isDirty (puck onChange), warn on navigation away
  (window.beforeunload + Next.js router)
- Top bar (outside Puck):
  - "← Dashboard" breadcrumb
  - Page title + locale badge
  - "Preview" button → opens /preview/[slug]?locale={locale} in new tab
  - "Publish" button (ADMIN role only) → POST /api/pages/:slug/publish

### /preview/[slug]

- Fetch from GET /api/pages/:slug/preview?locale={locale}
  (preview endpoint returns draft puckData regardless of published status)
- Render: <Render config={puckConfig} data={pageData} />
- Yellow banner at top: "PREVIEW MODE — this page is not publicly visible"
  with "Back to Editor" link
- No navbar/footer from dashboard layout — clean full-page render

---

## IMPLEMENTATION RULES

1. This is a pure client-side SPA (Vite + React 19) — there are NO Server
   Components, no RSC, no server actions. Every component is a client component.
   Do not use "use client" directives — they are meaningless here.
2. All API calls go through the Axios client in `src/api/client.ts` — never
   use `fetch` directly. The Axios instance handles auth headers and 401 retry
   transparently.
3. All server state (pages list, single page, users, versions) lives in
   TanStack Query (`useQuery` / `useMutation`). Never put server data in
   `useState`. After a mutation succeeds, call `queryClient.invalidateQueries`
   to refetch affected queries.
4. Auth state comes from `useAuth()` (reads AuthContext) — never read the
   access token directly from a component. Role checks should go through the
   session helpers in `src/auth/access.ts`, using `activeMembershipRole` and
   `user.platformRole` rather than the removed global role field.
5. Role-based UI: gate "Publish" and "Delete" buttons with
   `canPublishContent()` and `canPermanentlyDeleteContent()` from
   `src/auth/access.ts`, not inline legacy role-string checks.
6. Unsaved changes: track `isDirty` via Puck's `onChange`. Warn on navigation
   away using `window.beforeunload` and React Router's `useBlocker` hook.
7. Error boundaries: wrap `EditorPage` and `PagesListPage` in the shared
   `ErrorBoundary` component with a retry button. Use React Router's
   `errorElement` prop on the relevant routes.
8. Tailwind only — no inline styles, no CSS modules. Use Shadcn UI components
   for dialogs, dropdowns, and form elements. Use Lucide React for all icons.
9. Notifications: use `react-hot-toast` — call `toast.success()`,
   `toast.error()`, `toast.loading()`. Never build custom toast UI.
10. Mobile layout for pages list; editor is desktop-only — show a centered
    warning card on screens narrower than the `lg` breakpoint (1024px).
11. All date formatting must use `Intl.DateTimeFormat` — no external date
    libraries.
12. Slug input must auto-generate from title in real time using a `slugify`
    utility and validate against `/^[a-z0-9-]+$/` before form submit.
13. Locale is always passed as a `?locale=en` query param — read it with
    `useSearchParams()`. Default to `'en'` if absent. Never hardcode a locale.
14. Write every file completely — no placeholders, no truncation.

## Security Checks

### Token Security

- [ ] **Access token stored in JS memory (not localStorage)** — `apps/dashboard/src/auth/AuthProvider.tsx` — Mitigates: XSS token theft (memory variables aren't accessible via `document.cookie` or `localStorage`).

```

```
