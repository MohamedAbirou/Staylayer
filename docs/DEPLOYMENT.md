# Deployment Guide — MyAllocator CMS Monorepo

## Table of Contents

1. [Why a Monorepo?](#1-why-a-monorepo)
2. [GitHub Setup — What to Create & Push](#2-github-setup)
3. [What to Commit vs. Ignore](#3-what-to-commit-vs-ignore)
4. [Deployment Architecture](#4-deployment-architecture)
5. [NestJS API — VPS Deployment](#5-nestjs-api--vps-deployment)
6. [Next.js Website — Vercel Deployment](#6-nextjs-website--vercel-deployment)
7. [React Dashboard — Vercel Deployment](#7-react-dashboard--vercel-deployment)
8. [Database — PostgreSQL Setup](#8-database--postgresql-setup)
9. [First-Run Checklist](#9-first-run-checklist)
10. [Environment Variable Reference](#10-environment-variable-reference)

---

## 1. Why a Monorepo?

### The Decision

We chose a **Turborepo monorepo** with **pnpm workspaces** because this project has three tightly coupled apps that share code:

| App                        | Stack         | Description                    |
| -------------------------- | ------------- | ------------------------------ |
| `apps/api`                 | NestJS        | REST API + DB access           |
| `apps/dashboard`           | React + Vite  | CMS editor for content editors |
| `apps/website`             | Next.js       | Public-facing website          |
| `packages/puck-components` | React library | Shared Puck component config   |

### Key Benefits

1. **Shared component library** — `packages/puck-components` is used by both the `dashboard` (Puck editor) and `website` (Puck renderer). With a monorepo, both apps always use the **same version** — no npm publish cycle, no version drift, instant updates.

2. **Atomic commits** — A single pull request can change the Puck component library, the API, the dashboard, and the website together, so they are always in sync.

3. **Single CI pipeline** — One GitHub Actions workflow can build, lint, and test all apps together. Turborepo's cache means only changed apps rebuild.

4. **Consistent tooling** — Shared ESLint config (`packages/eslint-config`), TypeScript config (`packages/typescript-config`), and Prettier config in the root apply to all apps uniformly.

5. **Simpler dependency management** — pnpm hoists shared dependencies. `react`, `@puckeditor/core`, etc. are installed once, not per-app.

### Why not separate repos?

With separate repos you would need to:

- Publish `puck-components` to npm every time a component changes, then update the version in both apps
- Coordinate destructive schema/API changes across repos (breakage risk)
- Manage 3+ separate CI pipelines
- Keep dev environments in sync manually

---

## 2. GitHub Setup

### What to Ask the Manager to Create

Ask the manager to create **one private repository**:

```
Repository name: myallocator-cms
Visibility:      Private
Default branch:  main
Initialize:      Empty (no README, no .gitignore — you will push the existing code)
```

That is **one repo for the entire monorepo**. Do not create separate repos per app.

### First Push

Run these commands **once** from the monorepo root:

```bash
# 1. Initialize git (if not already done)
git init
git branch -M main

# 2. Add the remote (replace ORG with your GitHub org/username)
git remote add origin https://github.com/ORG/myallocator-cms.git

# 3. Stage everything (respects .gitignore automatically)
git add .

# 4. Verify what will be committed — check nothing secret is included
git status

# 5. Create the initial commit
git commit -m "feat: initial monorepo — NestJS API, React dashboard, Next.js website"

# 6. Push
git push -u origin main
```

### Branch Strategy (recommended)

```
main          → production (auto-deploys to live)
staging       → pre-production testing
develop       → integration branch
feature/*     → individual feature branches
fix/*         → bug fix branches
```

---

## 3. What to Commit vs. Ignore

### ✅ DO commit

| Path                                                 | Why                                                   |
| ---------------------------------------------------- | ----------------------------------------------------- |
| `apps/api/src/prisma/schema.prisma`                  | Source of truth for DB schema                         |
| `apps/api/src/prisma/migrations/*/migration.sql`     | Migration history — must be committed                 |
| `apps/api/src/prisma/migrations/migration_lock.toml` | Locks migration provider                              |
| `**/.env.example`                                    | Templates with no secrets — guides deployment         |
| `pnpm-lock.yaml`                                     | Exact dependency tree — ensures reproducible installs |
| `turbo.json`, `pnpm-workspace.yaml`                  | Monorepo configuration                                |
| All source code under `src/`                         | Obviously                                             |

### ❌ DO NOT commit

| Path                                 | Why                                       |
| ------------------------------------ | ----------------------------------------- |
| `**/.env`, `**/.env.local`           | Contains secrets (DB passwords, JWT keys) |
| `**/node_modules/`                   | Installed from `pnpm-lock.yaml`           |
| `**/dist/`, `**/.next/`, `**/build/` | Generated artifacts                       |
| `**/.turbo/`                         | Local Turborepo cache                     |
| `*.pem`, `private.key`               | Private RSA keys                          |
| `apps/api/src/prisma/generated/`     | Generated from schema — rebuild on deploy |

---

## 4. Deployment Architecture

```
                        ┌──────────────────────────────────────────────┐
                        │              GitHub (main branch)             │
                        └───────────┬──────────────┬───────────────────┘
                                    │              │
                    ┌───────────────▼──┐     ┌─────▼─────────────────────┐
                    │  Vercel (2 apps) │     │   VPS (your server)       │
                    │                  │     │                             │
                    │  ┌─────────────┐ │     │  ┌─────────────────────┐  │
                    │  │  Next.js    │ │     │  │  NestJS API         │  │
                    │  │  Website    │ │     │  │  (PM2 / systemd)    │  │
                    │  │             │ │     │  │                     │  │
                    │  │ www.myall.. │ │     │  │  api.myallocator.com│  │
                    │  └─────────────┘ │     │  └──────────┬──────────┘  │
                    │                  │     │             │              │
                    │  ┌─────────────┐ │     │  ┌──────────▼──────────┐  │
                    │  │  React      │ │     │  │  PostgreSQL DB      │  │
                    │  │  Dashboard  │ │     │  │  (same VPS or RDS)  │  │
                    │  │             │ │     │  └─────────────────────┘  │
                    │  │ cms.myall.. │ │     │                             │
                    │  └─────────────┘ │     │  Nginx (reverse proxy)    │
                    └──────────────────┘     └─────────────────────────────┘
```

---

## 5. NestJS API — VPS Deployment

### Prerequisites on the VPS

- Ubuntu 22.04+
- Node.js 20 LTS (`nvm install 20`)
- pnpm (`npm i -g pnpm`)
- PM2 (`npm i -g pm2`)
- PostgreSQL 16
- Nginx
- Certbot (SSL)

### Step-by-step

```bash
# 1. Clone the repo on the VPS
git clone https://github.com/ORG/myallocator-cms.git /var/www/myallocator-cms
cd /var/www/myallocator-cms

# 2. Install dependencies (hoisted, fast)
pnpm install --frozen-lockfile

# 3. Create the API .env
cp apps/api/.env.example apps/api/.env
nano apps/api/.env        # Fill in DATABASE_URL, JWT keys, CORS_ORIGINS, etc.

# 4. Run database migrations (applies all pending SQL migrations)
pnpm db:migrate

# 5. Generate the Prisma client (must run AFTER migrate)
pnpm db:generate

# 6. Seed the first SUPER_ADMIN user
pnpm --filter @myallocator/api db:seed

# 7. Build the NestJS app
pnpm --filter @myallocator/api build

# 8. Start with PM2
pm2 start apps/api/dist/main.js --name "myallocator-api" --env production
pm2 save
pm2 startup    # Makes PM2 restart on server reboot
```

### Nginx config for the API

Create `/etc/nginx/sites-available/api.myallocator.com`:

```nginx
server {
    listen 80;
    server_name api.myallocator.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.myallocator.com;

    ssl_certificate     /etc/letsencrypt/live/api.myallocator.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.myallocator.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    location / {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/api.myallocator.com /etc/nginx/sites-enabled/
certbot --nginx -d api.myallocator.com
nginx -t && systemctl reload nginx
```

### Deploying updates

```bash
cd /var/www/myallocator-cms
git pull origin main
pnpm install --frozen-lockfile
pnpm db:migrate          # Apply new migrations (safe — only runs pending ones)
pnpm db:generate         # Regenerate Prisma client if schema changed
pnpm --filter @myallocator/api build
pm2 restart myallocator-api
```

---

## 6. Next.js Website — Vercel Deployment

### Setup

1. Push the code to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project**
3. Import the `myallocator-cms` repository
4. Vercel detects it as a monorepo — configure:

| Setting              | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| **Framework Preset** | Next.js                                                                |
| **Root Directory**   | `apps/website`                                                         |
| **Build Command**    | `cd ../.. && pnpm install && pnpm --filter @myallocator/website build` |
| **Output Directory** | `.next` (default)                                                      |
| **Install Command**  | _(leave blank — build command handles it)_                             |

5. Add Environment Variables (Settings → Environment Variables):

```
NEXT_PUBLIC_CMS_API_URL     = https://api.myallocator.com
REVALIDATE_SECRET           = (same value as api REVALIDATE_SECRET)
NEXT_PUBLIC_GTM_ID          = GTM-XXXXXXX
NEXT_PUBLIC_CLARITY_ID      = xxxxxxxxxx
NEXT_PUBLIC_BRAND_NAME      = MyAllocator
NEXT_PUBLIC_BRAND_URL       = https://www.myallocator.com
```

6. Set custom domain: `www.myallocator.com` in Vercel → Domains

**That's it. Vercel auto-deploys on every push to `main`.**

### ISR (Incremental Static Regeneration)

The website uses ISR. When a page is published from the CMS dashboard, the API calls:

```
POST https://www.myallocator.com/api/revalidate
```

This triggers Next.js to regenerate just that page — no full redeploy needed.

---

## 7. React Dashboard — Vercel Deployment

### Setup

1. In Vercel → **Add New Project** → import the same `myallocator-cms` repo
2. Configure:

| Setting              | Value                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| **Framework Preset** | Vite                                                                     |
| **Root Directory**   | `apps/dashboard`                                                         |
| **Build Command**    | `cd ../.. && pnpm install && pnpm --filter @myallocator/dashboard build` |
| **Output Directory** | `dist`                                                                   |

3. Add Environment Variables:

```
VITE_API_URL = https://api.myallocator.com
```

---

## 8. Database — PostgreSQL Setup

### Option A: Same VPS (simplest)

```bash
sudo apt install postgresql-16
sudo -u postgres psql
```

```sql
CREATE USER myallocator WITH PASSWORD 'strong-password-here';
CREATE DATABASE myallocator_cms OWNER myallocator;
GRANT ALL PRIVILEGES ON DATABASE myallocator_cms TO myallocator;
\q
```

```
DATABASE_URL="postgresql://myallocator:strong-password-here@localhost:5432/myallocator_cms?schema=public"
```

### Option B: Managed database (recommended for production)

Use **Supabase**, **Railway**, or **Neon** for fully managed PostgreSQL:

- Automatic backups
- Point-in-time recovery
- Connection pooling
- They provide a ready `DATABASE_URL` to paste into your `.env`

### Running migrations

```bash
# On first deploy (or after any schema change):
pnpm db:migrate      # Applies all pending migrations from apps/api/src/prisma/migrations/
pnpm db:generate     # Regenerates the Prisma client types
```

Prisma's `migrate deploy` is safe to run repeatedly — it only applies migrations that haven't been applied yet, tracked in the `_prisma_migrations` table.

---

## 9. First-Run Checklist

After the initial deployment, run through this in order:

- [ ] Database is accessible from the VPS (`psql $DATABASE_URL`)
- [ ] `pnpm db:migrate` ran successfully (no errors)
- [ ] `pnpm db:generate` ran successfully
- [ ] `pnpm db:seed` created the first SUPER_ADMIN user
- [ ] API health check responds: `curl https://api.myallocator.com/health`
- [ ] Dashboard opens at `https://cms.myallocator.com` and login works
- [ ] Website ISR works: publish a page from dashboard and verify it updates on the website
- [ ] CORS: dashboard can successfully call the API (no CORS errors in browser console)
- [ ] SSL certificates issued for all three domains
- [ ] PM2 is running and set to restart on boot (`pm2 startup && pm2 save`)

---

## 10. Environment Variable Reference

### `apps/api/.env`

| Variable                 | Required | Description                                              |
| ------------------------ | -------- | -------------------------------------------------------- |
| `DATABASE_URL`           | ✅       | PostgreSQL connection string                             |
| `JWT_PRIVATE_KEY`        | ✅       | RS256 private key (PEM format, `\n` for newlines)        |
| `JWT_PUBLIC_KEY`         | ✅       | RS256 public key (PEM format)                            |
| `PORT`                   | ✅       | Port the NestJS server listens on (default: 3001)        |
| `NODE_ENV`               | ✅       | `production` in prod                                     |
| `CORS_ORIGINS`           | ✅       | Comma-separated allowed origins                          |
| `REVALIDATION_URL`       | ✅       | Next.js ISR revalidation endpoint                        |
| `REVALIDATE_SECRET`      | ✅       | Shared secret — must match website's `REVALIDATE_SECRET` |
| `JWT_ACCESS_EXPIRES_IN`  | ✅       | Access token TTL (e.g., `15m`)                           |
| `JWT_REFRESH_EXPIRES_IN` | ✅       | Refresh token TTL (e.g., `30d`)                          |

### `apps/dashboard/.env`

| Variable       | Required | Description                                    |
| -------------- | -------- | ---------------------------------------------- |
| `VITE_API_URL` | ✅       | Full URL of the NestJS API (no trailing slash) |

### `apps/website/.env.local`

| Variable                  | Required  | Description                                          |
| ------------------------- | --------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_CMS_API_URL` | ✅        | Full URL of the NestJS API                           |
| `REVALIDATE_SECRET`       | ✅        | Shared secret — must match API's `REVALIDATE_SECRET` |
| `NEXT_PUBLIC_GTM_ID`      | ✅        | Google Tag Manager container ID                      |
| `NEXT_PUBLIC_CLARITY_ID`  | ✅        | Microsoft Clarity tracking ID                        |
| `NEXT_PUBLIC_BRAND_NAME`  | ✅        | Brand name used in UI                                |
| `NEXT_PUBLIC_BRAND_URL`   | ✅        | Brand URL for canonical links                        |
| `CMS_ADMIN_EMAIL`         | seed only | Used by migration scripts — remove after seeding     |
| `CMS_ADMIN_PASSWORD`      | seed only | Used by migration scripts — remove after seeding     |
