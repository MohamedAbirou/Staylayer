## Phase 7 — DevOps & Deployment

## SYSTEM TO DEPLOY

**MyAllocator CMS** — Turborepo monorepo with:

| App            | Tech                    | Host                        |
| -------------- | ----------------------- | --------------------------- |
| apps/website   | Next.js 15 Pages Router | Vercel                      |
| apps/dashboard | React 19 + Vite SPA     | Vercel (static)             |
| apps/api       | NestJS 10 TypeScript    | VPS                         |
| Database       | PostgreSQL 18           | VPS (add-on to api service) |

**Repository:** GitHub monorepo
**Environments:** development, staging, production

---

## FILE 1: .github/workflows/ci.yml

Trigger: on every push to any branch + on every pull request to main

Jobs (run in parallel where possible):

**job: lint**

- Checkout
- Setup Node 20
- Install dependencies (npm ci with cache)
- Run: npx turbo lint (lints all 3 apps + packages)

**job: typecheck**

- Same setup
- Run: npx turbo typecheck

**job: test-api**

- Setup Node 20 + PostgreSQL 15 service container
- Set TEST_DATABASE_URL to the service container
- Run Prisma migrate deploy on test DB
- Run: npx turbo test --filter=api
- Upload test results as artifact

**job: test-dashboard**

- Setup Node 20
- Run: npx turbo test --filter=dashboard
  (Vitest + React Testing Library unit/integration tests — no server required)
- Upload coverage report as artifact

**job: test-e2e-website**

- Needs: lint, typecheck, test-api
- Setup Node 20
- Install Playwright browsers
- Start API server (background, pointing at test DB)
- Start website dev server (background)
- Wait for both to be healthy (retry curl /health for API, / for website)
- Run: npx playwright test e2e/website --ignore=\*\*/isr.spec.ts
  (skip ISR test in CI — it requires full staging infra)
- Upload Playwright report as artifact on failure

**job: build**

- Needs: all test jobs (only runs if all pass)
- Run: npx turbo build
- Verify build artifacts exist: apps/api/dist/, apps/dashboard/dist/, apps/website/.next/

---

## FILE 2: .github/workflows/deploy-production.yml

Trigger: on push to main (after CI passes), manual dispatch

**job: deploy-api (Railway)**

- Checkout
- Install Railway CLI
- Run: railway up --service=myallocator-api --environment=production
- Run: railway run --service=myallocator-api npx prisma migrate deploy
- Health check: curl https://api.myallocator.com/health → expect 200
  with body `{ "status": "ok", "dbConnected": true }`

**job: deploy-dashboard (Vercel)**

- Needs: deploy-api
- Install Vercel CLI
- Run: vercel deploy --prod --token=$VERCEL_TOKEN --scope=$VERCEL_ORG_ID
  (filter to dashboard app — deploys static Vite build)

**job: deploy-website (Vercel)**

- Needs: deploy-api (website needs API up before build-time ISR fetch)
- Run: vercel deploy --prod (filter to website app)
- After deploy: trigger on-demand revalidation for all critical pages
  by calling POST https://api.myallocator.com/revalidate/all
  with header `x-revalidation-secret: $REVALIDATION_SECRET`

**job: notify-slack**

- Runs on completion (success OR failure)
- Posts to Slack: deployment status, PR author, commit message,
  environment links

---

## FILE 3: railway.toml (in apps/api/)

```toml
[build]
builder = "nixpacks"
buildCommand = "npm run build"

[deploy]
startCommand = "npm start"
restartPolicyType = "on_failure"
restartPolicyMaxRetries = 3
healthcheckPath = "/health"
healthcheckTimeout = 30

[[services]]
name = "myallocator-api"
```

---

## FILE 4: vercel.json for apps/dashboard/

- Framework: `vite` (this is a React 19 + Vite SPA — pure static output, no SSR)
- Build command: `cd ../.. && npx turbo build --filter=dashboard`
- Output directory: `apps/dashboard/dist`
- Environment variables list (values from Vercel project settings):
  `VITE_API_URL` (points to the NestJS API base URL, no `/api` prefix)
- Security headers: X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy
- SPA fallback rewrite: rewrite all paths `/*` → `/index.html`
  (required so React Router v7 client-side routes work on direct load/refresh)
- Force HTTPS

---

## FILE 5: vercel.json for apps/website/

- Framework: nextjs
- Build command: `cd ../.. && npx turbo build --filter=website`
- ISR configuration: revalidate 60s (set in `getStaticProps`, not vercel.json)
- Security headers (same as dashboard)
- Rewrites: none (all routes are static page routes + `[...slug].js` catch-all)
- On-demand revalidation: exposed via `/api/revalidate` (Next.js API route)
  protected by `REVALIDATION_SECRET` header check
- No SPA fallback needed (Next.js handles 404 via `pages/404.js`)

---

## FILE 6: turbo.json (root)

Define the task graph:

- build: depends on ^build (dependencies build first),
  outputs: `dist/**`, `.next/**`, `storybook-static/**`
- test: depends on ^build, runs independently per app
- lint: no dependencies, runs in parallel across all packages
- typecheck: depends on ^build
- dev: persistent: true, cache: false

---

## FILE 7: docker-compose.yml (for local development)

Services:

- postgres: image postgres:15, port 5432, persistent volume,
  init script creates 2 databases: `myallocator_dev` + `myallocator_test`
- api: build from apps/api/Dockerfile, depends_on postgres,
  hot reload via `ts-node-dev` watching `apps/api/src/**`
- adminer: image adminer (DB GUI at localhost:8080)

Note: dashboard and website are run separately via `npm run dev` in their
respective app directories — they do not need Docker (no server-side runtime).

Include .env.example showing all required vars for docker-compose.

---

## FILE 8: apps/api/Dockerfile

Multi-stage:

1. **deps stage**: node:20-alpine, copy package\*.json files from monorepo root
   and apps/api/, run `npm ci --workspace=apps/api`
2. **builder stage**: copy apps/api/src/, run `npm run build` (NestJS → tsc),
   run `npx prisma generate`
3. **production stage**: node:20-alpine, copy dist/ and node_modules
   from previous stages (production deps only), copy prisma/schema.prisma
   (needed for Prisma runtime), non-root user (uid 1001),
   EXPOSE 3001, CMD ["node", "dist/main.js"]

Note: NestJS compiles to `dist/main.js` — this is the entry point,
not `dist/server.js`.

---

## FILE 9: .github/workflows/db-backup.yml

Schedule: daily at 02:00 UTC

- Use Railway CLI to trigger a PostgreSQL dump:
  `railway run pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql`
- Compress: gzip
- Upload to S3 (use AWS CLI, credentials from GitHub secrets)
- Retain last 30 backups (delete older ones from S3)
- Notify Slack on failure

---

## FILE 10: monitoring setup (scripts/setup-monitoring.sh)

A bash script that uses the Checkly CLI to create:

- API health check: GET https://api.myallocator.com/health every 1 min,
  assert response status 200 and body contains `"status":"ok"` and `"dbConnected":true`
- Website homepage check: GET https://myallocator.com every 5 min,
  check for "Vacation-Rental" in response body
- Dashboard check: GET https://dashboard.myallocator.com every 5 min,
  check for 200 status

Alert channels: email to devops@myallocator.com + Slack webhook

---

## ENVIRONMENT VARIABLES MAP

### Complete Variable Table

#### apps/api

| Variable               | Required | Dev Default                                                            | Production                                               | Description                                                                                                 |
| ---------------------- | -------- | ---------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Yes      | `postgresql://postgres:postgres@localhost:5432/myallocator_cms`        | Injected by hosting provider (Railway, Render, etc.)     | PostgreSQL connection string for Prisma                                                                     |
| `JWT_PRIVATE_KEY`      | Yes      | Base64-encoded RS256 private key (generate with `openssl genrsa 2048`) | Stored in secret manager (AWS SSM, Vault, etc.)          | Signs JWT access tokens. Must be RS256 (asymmetric).                                                        |
| `JWT_PUBLIC_KEY`       | Yes      | Base64-encoded RS256 public key (derived from private key)             | Can be committed to repo (public keys are safe to share) | Verifies JWT access tokens. Shared with website if needed.                                                  |
| `REFRESH_TOKEN_SECRET` | No       | N/A (unused — refresh tokens are random bytes, not signed)             | N/A                                                      | **Reserved for future use.** Not currently used — refresh tokens use argon2 hash of random bytes, not HMAC. |
| `CORS_ORIGINS`         | Yes      | `http://localhost:5173,http://localhost:3000`                          | `https://cms.myallocator.com,https://myallocator.com`    | Comma-separated allowed origins for CORS. Dashboard and website origins.                                    |
| `REVALIDATION_SECRET`  | Yes      | `dev-revalidation-secret-change-me`                                    | Random 32-char hex string (shared with website)          | Authenticates revalidation webhook calls from API to website                                                |
| `REVALIDATION_URL`     | Yes      | `http://localhost:3000/api/revalidate`                                 | `https://myallocator.com/api/revalidate`                 | Next.js revalidation webhook URL                                                                            |
| `API_PORT`             | No       | `4000`                                                                 | `4000` (or injected by platform)                         | Port the NestJS server listens on                                                                           |
| `THROTTLE_TTL`         | No       | `900000`                                                               | `900000` (15 min in ms)                                  | Rate limit window duration                                                                                  |
| `THROTTLE_LIMIT`       | No       | `200`                                                                  | `200`                                                    | Max requests per IP per window (default endpoints)                                                          |
| `THROTTLE_AUTH_LIMIT`  | No       | `10`                                                                   | `10`                                                     | Max requests per IP per window (auth endpoints)                                                             |
| `NODE_ENV`             | Auto     | `development`                                                          | `production`                                             | Set by platform. Affects logging verbosity, error detail.                                                   |
| `LOG_LEVEL`            | No       | `debug`                                                                | `warn`                                                   | Minimum log level: debug, log, warn, error                                                                  |

#### apps/dashboard

| Variable       | Required | Dev Default                                           | Production                    | Description                                                       |
| -------------- | -------- | ----------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------- |
| `VITE_API_URL` | Yes      | `http://localhost:4000` (proxied via Vite dev server) | `https://api.myallocator.com` | CMS API base URL. Prefixed with `VITE_` for Vite's env injection. |

**Note:** The dashboard has only one environment variable because:

- Auth tokens are handled via httpOnly cookies (no client-side secrets)
- The API URL is the only external dependency
- No analytics on the private dashboard
- Brand config is not needed (dashboard has its own UI)

#### apps/website

| Variable                  | Required | Dev Default                         | Production                                | Description                                                                                         |
| ------------------------- | -------- | ----------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_BRAND_NAME`  | Yes      | `MyAllocator`                       | `MyAllocator`                             | Brand name used in SEO, titles, footer. Drives `DOMAIN_NAME` and `EMAIL_CONTACT` in `lib/brand.js`. |
| `NEXT_PUBLIC_PRICE`       | Yes      | `$9`                                | `$9` (or current price)                   | Displayed pricing. Used by PricingSectionOnePlan and PricingCard.                                   |
| `NEXT_PUBLIC_CMS_API_URL` | Yes      | `http://localhost:4000`             | `https://api.myallocator.com`             | CMS API URL for getStaticProps page fetching.                                                       |
| `NEXT_PUBLIC_GTM_ID`      | No       | `G-CFM6W1YVG8`                      | Same or updated                           | Google Tag Manager measurement ID                                                                   |
| `NEXT_PUBLIC_CLARITY_ID`  | No       | `stpytbw2kb`                        | Same or updated                           | Microsoft Clarity project ID                                                                        |
| `REVALIDATION_SECRET`     | Yes      | `dev-revalidation-secret-change-me` | Same value as API's `REVALIDATION_SECRET` | Validates incoming revalidation webhook calls. Must match the API's value.                          |

### Key Generation Commands

```bash
# Generate RS256 key pair for JWT signing
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Base64 encode for environment variable storage
cat private.pem | base64 -w 0 > private.b64   # JWT_PRIVATE_KEY
cat public.pem | base64 -w 0 > public.b64     # JWT_PUBLIC_KEY

# Generate revalidation secret
openssl rand -hex 32    # REVALIDATION_SECRET
```

### Per-App .env.example Files

**apps/api/.env.example:**

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myallocator_cms
JWT_PRIVATE_KEY=<base64-encoded-rs256-private-key>
JWT_PUBLIC_KEY=<base64-encoded-rs256-public-key>
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
REVALIDATION_SECRET=dev-revalidation-secret-change-me
REVALIDATION_URL=http://localhost:3000/api/revalidate
API_PORT=4000
THROTTLE_TTL=900000
THROTTLE_LIMIT=200
THROTTLE_AUTH_LIMIT=10
LOG_LEVEL=debug
```

**apps/dashboard/.env.example:**

```bash
VITE_API_URL=http://localhost:4000
```

**apps/website/.env.example:**

```bash
NEXT_PUBLIC_BRAND_NAME=MyAllocator
NEXT_PUBLIC_PRICE=$9
NEXT_PUBLIC_CMS_API_URL=http://localhost:4000
NEXT_PUBLIC_GTM_ID=G-CFM6W1YVG8
NEXT_PUBLIC_CLARITY_ID=stpytbw2kb
REVALIDATION_SECRET=dev-revalidation-secret-change-me
```

### GitHub Actions secrets required

```
RAILWAY_TOKEN
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_DASHBOARD_PROJECT_ID
VERCEL_WEBSITE_PROJECT_ID
JWT_PRIVATE_KEY
JWT_PUBLIC_KEY
REVALIDATION_SECRET
AWS_ACCESS_KEY_ID         (for S3 DB backups)
AWS_SECRET_ACCESS_KEY     (for S3 DB backups)
S3_BACKUP_BUCKET
SLACK_WEBHOOK_URL
SEED_ADMIN_EMAIL          (used by E2E test helpers)
SEED_ADMIN_PASSWORD       (used by E2E test helpers)
TEST_DATABASE_URL         (PostgreSQL service container URL in CI)
```

---

## IMPLEMENTATION RULES

1. All secrets must come from environment variables — never hardcoded.
2. CI jobs must use `concurrency` groups to cancel stale runs on
   the same branch.
3. Deployment jobs must be gated: only run on main, never on PRs.
4. The Railway deploy job must verify migration succeeded before
   marking deployment done.
5. All cron schedules must be in UTC.
6. Docker image must run as non-root user (uid 1001).
7. Vercel deployments must use `--prebuilt` flag when possible
   (build in CI, deploy artifact — faster).
8. Every workflow file must have a clear `name:` at the top and
   `name:` on every job and step.
9. The dashboard Vercel deployment must include an SPA fallback rewrite
   (`/*` → `/index.html`) so React Router v7 routes work on direct URL load.
10. The NestJS API has no `/api` prefix — health check and all other
    endpoints are at the root: `/health`, `/auth/login`, `/pages`, etc.
11. Write every file completely, starting with turbo.json, then docker-compose.yml, then each GitHub Actions workflow.

## Security Checks

#### Dependency Security

- [ ] **pnpm audit in CI pipeline** — `.github/workflows/ci.yml` — Mitigates: known vulnerabilities in dependencies.
- [ ] **Dependabot or Renovate configured** — `.github/dependabot.yml` — Mitigates: stale dependencies with known CVEs.
- [ ] **Private key never committed to repo** — `.gitignore` includes `*.pem`, `.env` — Mitigates: key exposure via version control.

```

```
