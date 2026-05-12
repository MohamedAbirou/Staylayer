# MyAllocator CMS Migration — Technical Architecture Document

**Version:** 1.0
**Date:** 2026-03-03
**Author:** Principal Architect
**Status:** Authoritative — this is the single source of truth for implementation

---

## Table of Contents

1. [Monorepo Structure](#section-1-monorepo-structure)
2. [NestJS Backend Architecture](#section-2-nestjs-backend-architecture)
3. [React 19 + Vite Dashboard Architecture](#section-3-react-19--vite-dashboard-architecture)
4. [Next.js Website Architecture (Refactored)](#section-4-nextjs-website-architecture-refactored)
5. [packages/puck-components Architecture](#section-5-packagespuck-components-architecture)
6. [Data Flow Diagrams](#section-6-data-flow-diagrams)
7. [Environment Variables](#section-7-environment-variables)
8. [Security Checklist](#section-8-security-checklist)
9. [i18n Strategy](#section-9-i18n-strategy)
10. [Migration Strategy](#section-10-migration-strategy)
11. [Risk Register](#section-11-risk-register)

---

## SECTION 1: Monorepo Structure

### Why Turborepo

Turborepo gives us content-hash-based task caching, parallel execution across workspaces, and a declarative task pipeline. All three apps share the Puck component library and TypeScript configs. A single repo means atomic commits across API + dashboard + website, one CI pipeline, and no cross-repo version drift.

### Complete Directory Tree

```
myallocator-cms/
├── turbo.json                          # Turborepo pipeline config
├── package.json                        # Root workspace config (pnpm workspaces)
├── pnpm-workspace.yaml                 # pnpm workspace declaration
├── tsconfig.base.json                  # Shared TypeScript base config
├── .eslintrc.base.js                   # Shared ESLint base config
├── .gitignore
├── .prettierrc                         # Shared Prettier config
├── .env.example                        # Root-level env var documentation
├── README.md
│
├── apps/
│   ├── api/                            # NestJS 10 backend (modular monolith)
│   │   ├── src/
│   │   │   ├── main.ts                 # Bootstrap, CORS, Swagger, global pipes
│   │   │   ├── app.module.ts           # Root module — imports all feature modules
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.module.ts    # Global Prisma module
│   │   │   │   ├── prisma.service.ts   # PrismaClient lifecycle (onModuleInit/Destroy)
│   │   │   │   └── schema.prisma       # Full Prisma schema
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts      # AuthModule: imports PassportModule, JwtModule
│   │   │   │   ├── auth.controller.ts  # POST /auth/login, /auth/refresh, /auth/logout
│   │   │   │   ├── auth.service.ts     # Login, token issuance, refresh rotation
│   │   │   │   ├── strategies/
│   │   │   │   │   ├── local.strategy.ts   # Email+password validation
│   │   │   │   │   └── jwt.strategy.ts     # JWT access token extraction & validation
│   │   │   │   ├── guards/
│   │   │   │   │   ├── jwt-auth.guard.ts   # Applies JwtStrategy
│   │   │   │   │   └── roles.guard.ts      # RBAC guard (checks platform + workspace role decorators)
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── current-user.decorator.ts  # Extracts user from req
│   │   │   │   │   └── roles.decorator.ts         # @PlatformRoles(...) + @MembershipRoles(...)
│   │   │   │   └── dto/
│   │   │   │       ├── login.dto.ts        # { email, password }
│   │   │   │       └── refresh.dto.ts      # (empty — token comes from cookie)
│   │   │   ├── users/
│   │   │   │   ├── users.module.ts     # UsersModule
│   │   │   │   ├── users.controller.ts # CRUD endpoints for user management
│   │   │   │   ├── users.service.ts    # User CRUD, password hashing
│   │   │   │   └── dto/
│   │   │   │       ├── create-user.dto.ts
│   │   │   │       └── update-user.dto.ts
│   │   │   ├── pages/
│   │   │   │   ├── pages.module.ts     # PagesModule
│   │   │   │   ├── pages.controller.ts # Full page CRUD + publish/unpublish
│   │   │   │   ├── pages.service.ts    # Page CRUD, versioning, slug validation
│   │   │   │   ├── versions.controller.ts  # Version history + restore
│   │   │   │   ├── versions.service.ts     # Version listing and restore logic
│   │   │   │   └── dto/
│   │   │   │       ├── create-page.dto.ts
│   │   │   │       ├── update-page.dto.ts
│   │   │   │       └── page-query.dto.ts   # Filtering (locale, published, etc.)
│   │   │   ├── revalidation/
│   │   │   │   ├── revalidation.module.ts      # RevalidationModule
│   │   │   │   └── revalidation.service.ts     # Calls Next.js revalidation webhook
│   │   │   ├── health/
│   │   │   │   ├── health.module.ts    # HealthModule
│   │   │   │   └── health.controller.ts # GET /health (DB check, uptime)
│   │   │   └── common/
│   │   │       ├── filters/
│   │   │       │   └── http-exception.filter.ts  # Standardized error response
│   │   │       ├── interceptors/
│   │   │       │   └── logging.interceptor.ts    # Request/response logging
│   │   │       └── pipes/
│   │   │           └── validation.pipe.ts        # Global class-validator pipe
│   │   ├── test/
│   │   │   ├── app.e2e-spec.ts
│   │   │   └── jest-e2e.json
│   │   ├── .env.example                # API-specific env vars
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json               # Extends ../../tsconfig.base.json
│   │   ├── tsconfig.build.json
│   │   └── package.json
│   │
│   ├── dashboard/                      # React 19 + Vite SPA (Puck editor)
│   │   ├── src/
│   │   │   ├── main.tsx                # React root render
│   │   │   ├── App.tsx                 # Router + AuthProvider wrapper
│   │   │   ├── routes.tsx              # React Router v7 route definitions
│   │   │   ├── api/
│   │   │   │   ├── client.ts           # Axios instance with interceptors
│   │   │   │   ├── auth.ts             # login(), refresh(), logout() API calls
│   │   │   │   ├── pages.ts            # Page CRUD API calls
│   │   │   │   └── users.ts            # User management API calls
│   │   │   ├── auth/
│   │   │   │   ├── AuthContext.tsx      # Auth state (user, accessToken, loading)
│   │   │   │   ├── AuthProvider.tsx     # Provider with silent refresh logic
│   │   │   │   ├── ProtectedRoute.tsx   # Redirects to /login if unauthenticated
│   │   │   │   └── useAuth.ts          # Hook to consume AuthContext
│   │   │   ├── pages/
│   │   │   │   ├── LoginPage.tsx        # Email/password login form
│   │   │   │   ├── PagesListPage.tsx    # List all pages with status badges
│   │   │   │   ├── NewPagePage.tsx      # Create page form (slug, locale, title)
│   │   │   │   ├── EditorPage.tsx       # Puck editor (main editing interface)
│   │   │   │   ├── PreviewPage.tsx      # Server-rendered preview in iframe
│   │   │   │   └── SettingsPage.tsx     # Internal user management (PLATFORM_OWNER)
│   │   │   ├── components/
│   │   │   │   ├── Layout.tsx           # Dashboard shell (sidebar + content)
│   │   │   │   ├── Sidebar.tsx          # Navigation sidebar
│   │   │   │   ├── ToastProvider.tsx    # Toast notification context
│   │   │   │   ├── PageStatusBadge.tsx  # Published/Draft badge
│   │   │   │   └── LocaleTabs.tsx       # en/es/fr locale tab switcher
│   │   │   └── hooks/
│   │   │       ├── usePages.ts          # React Query hook for pages list
│   │   │       ├── usePage.ts           # React Query hook for single page
│   │   │       └── useUsers.ts          # React Query hook for users list
│   │   ├── public/
│   │   │   └── favicon.ico
│   │   ├── index.html                  # Vite HTML entry point
│   │   ├── .env.example                # Dashboard-specific env vars
│   │   ├── vite.config.ts              # Vite config with API proxy
│   │   ├── tsconfig.json               # Extends ../../tsconfig.base.json
│   │   └── package.json
│   │
│   └── website/                        # Next.js 15 (Pages Router) — marketing site
│       ├── pages/                      # All existing pages (migrated)
│       │   ├── _app.js
│       │   ├── _document.js
│       │   ├── index.js                # Refactored: fetches puckData from CMS
│       │   ├── [...slug].js            # Dynamic catch-all for CMS pages
│       │   ├── 404.js
│       │   └── api/
│       │       ├── revalidate.js       # On-demand ISR webhook
│       │       └── translations/
│       │           └── [locale].js     # Existing translations API
│       ├── components/                 # Existing components (unchanged)
│       │   ├── layout/
│       │   ├── seoHead.jsx
│       │   └── ... (all existing)
│       ├── lib/
│       │   ├── brand.js                # Existing brand config
│       │   ├── getTranslations.js      # Existing i18n loader
│       │   ├── useTranslation.js       # Existing i18n hook
│       │   ├── FormSubmitHandler.js    # Existing form handler
│       │   ├── publicPages.js          # Existing public pages list
│       │   ├── cmsClient.js            # NEW: fetch pages from CMS API
│       │   ├── fallbacks/              # NEW: static JSON fallbacks per page
│       │   │   ├── index.json
│       │   │   ├── pricing.json
│       │   │   └── ...                 # One per migrated page
│       │   └── puckRenderer.js         # NEW: renders puckData → React tree
│       ├── locales/                    # Existing translation files
│       │   ├── en/index.json
│       │   ├── es/index.json
│       │   └── fr/index.json
│       ├── styles/globals.css
│       ├── public/                     # Existing static assets
│       ├── .env.example
│       ├── next.config.js
│       ├── jsconfig.json
│       ├── tailwind.config.js
│       ├── next-sitemap.config.js
│       └── package.json
│
├── packages/
│   ├── puck-components/                # Shared Puck component registry
│   │   ├── src/
│   │   │   ├── index.ts               # Re-exports puckConfig + all components
│   │   │   ├── config.ts              # puckConfig object (component registry)
│   │   │   ├── components/
│   │   │   │   ├── HeroSection.tsx
│   │   │   │   ├── TextImageSection.tsx
│   │   │   │   ├── ImageTextSection.tsx
│   │   │   │   ├── HeroTextImageSection.tsx
│   │   │   │   ├── FeatureCard.tsx
│   │   │   │   ├── FeatureCardWrapper.tsx
│   │   │   │   ├── CTASection.tsx
│   │   │   │   ├── PlanIncludesBanner.tsx
│   │   │   │   ├── FAQ.tsx
│   │   │   │   ├── Quote.tsx
│   │   │   │   ├── OTASlider.tsx
│   │   │   │   ├── PricingCard.tsx
│   │   │   │   ├── PricingSectionOnePlan.tsx
│   │   │   │   ├── OnePlanFeaturesTable.tsx
│   │   │   │   ├── UnifiedCTA.tsx
│   │   │   │   ├── OrderList.tsx
│   │   │   │   ├── UnorderedList.tsx
│   │   │   │   ├── FinancialToolsTabs.tsx
│   │   │   │   ├── Accordion.tsx
│   │   │   │   ├── Button.tsx
│   │   │   │   └── LinkButton.tsx
│   │   │   └── types/
│   │   │       └── index.ts           # Shared prop types for all components
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts             # Build config (ESM + CJS dual output)
│   │   └── package.json
│   │
│   ├── typescript-config/             # Shared TypeScript configs
│   │   ├── base.json                  # Strict mode, ES2022 target, paths
│   │   ├── nextjs.json                # Extends base, adds Next.js specifics
│   │   ├── react-vite.json            # Extends base, adds Vite/React specifics
│   │   ├── nestjs.json                # Extends base, adds NestJS specifics
│   │   └── package.json
│   │
│   └── eslint-config/                 # Shared ESLint configs
│       ├── base.js                    # Shared rules (no-console, etc.)
│       ├── nextjs.js                  # Next.js specific rules
│       ├── react-vite.js              # React + Vite specific rules
│       ├── nestjs.js                  # NestJS specific rules
│       └── package.json
│
└── .github/
    └── workflows/
        ├── ci.yml                     # Lint + type-check + test on PR
        └── deploy.yml                 # Deploy on merge to main
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"],
      "env": [
        "DATABASE_URL",
        "JWT_PRIVATE_KEY",
        "JWT_PUBLIC_KEY",
        "NEXT_PUBLIC_*",
        "VITE_*"
      ]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": [],
      "env": ["DATABASE_URL"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

**Reasoning:** `^build` ensures packages/puck-components is always built before any app that consumes it. `dev` is `persistent: true` so Turborepo keeps long-running dev servers alive. Database tasks are never cached.

### Root package.json

```json
{
  "name": "myallocator-cms",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "type-check": "turbo type-check",
    "test": "turbo test",
    "db:generate": "turbo db:generate --filter=@myallocator/api",
    "db:migrate": "turbo db:migrate --filter=@myallocator/api",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\""
  },
  "devDependencies": {
    "prettier": "^3.2.0",
    "turbo": "^2.3.0"
  },
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20.0.0"
  }
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "exclude": ["node_modules", "dist", ".next", "build"]
}
```

### .eslintrc.base.js

```js
module.exports = {
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  rules: {
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn",
  },
  ignorePatterns: ["dist/", "node_modules/", ".next/", "build/"],
};
```

### .env.example (Root — documentation only)

```bash
# ─── API (apps/api) ────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/myallocator_cms
JWT_PRIVATE_KEY=base64_encoded_rs256_private_key
JWT_PUBLIC_KEY=base64_encoded_rs256_public_key
REFRESH_TOKEN_SECRET=random_64_char_hex_string
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
REVALIDATION_SECRET=random_32_char_hex_string
REVALIDATION_URL=http://localhost:3000/api/revalidate
API_PORT=4000
THROTTLE_TTL=900000
THROTTLE_LIMIT=200

# ─── Dashboard (apps/dashboard) ────────────────────────────
VITE_API_URL=http://localhost:4000

# ─── Website (apps/website) ────────────────────────────────
NEXT_PUBLIC_BRAND_NAME=MyAllocator
NEXT_PUBLIC_PRICE=$9
NEXT_PUBLIC_CMS_API_URL=http://localhost:4000
NEXT_PUBLIC_GTM_ID=G-CFM6W1YVG8
NEXT_PUBLIC_CLARITY_ID=stpytbw2kb
REVALIDATION_SECRET=random_32_char_hex_string
```

---

## SECTION 2: NestJS Backend Architecture

### 2.1 Module Map

#### AppModule (`src/app.module.ts`)

- **Role:** Root module — imports all feature modules, sets up global providers
- **Imports:** PrismaModule, AuthModule, UsersModule, PagesModule, RevalidationModule, HealthModule, ThrottlerModule
- **Global providers:** APP_GUARD → ThrottlerGuard (default 200 req/15min), ValidationPipe (global), HttpExceptionFilter (global), LoggingInterceptor (global)
- **No services of its own** — pure orchestration

#### PrismaModule (`src/prisma/prisma.module.ts`)

- **Role:** Global database access layer
- **Services:** PrismaService — extends PrismaClient, implements OnModuleInit (connects on startup), OnModuleDestroy (disconnects on shutdown), enableShutdownHooks()
- **Exports:** PrismaService — available to all modules via `@Global()` decorator
- **Imports:** none
- **Reasoning:** Global because every feature module needs DB access. Single PrismaClient instance manages the connection pool.

#### AuthModule (`src/auth/auth.module.ts`)

- **Role:** Authentication (JWT + refresh token) and authorization (platform + workspace RBAC)
- **Services:**
  - AuthService — login validation, access token generation, refresh token issuance/rotation, logout (revoke all user tokens)
- **Controllers:**
  - AuthController — `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
- **Providers (internal):**
  - LocalStrategy — validates email + password via Passport
  - JwtStrategy — extracts and validates JWT from Authorization header
  - RolesGuard — checks `@PlatformRoles()` and `@MembershipRoles()` metadata against `req.user.platformRole` and `req.user.activeMembershipRole`
- **Exports:** JwtStrategy, RolesGuard (consumed by other modules' controllers)
- **Imports:** PrismaModule (implicit via Global), UsersModule (for user lookup), PassportModule, JwtModule (async config with RS256 keys)
- **Rate limit override:** Auth endpoints → 10 req/15min per IP (stricter than default)

#### UsersModule (`src/users/users.module.ts`)

- **Role:** User CRUD operations and password management
- **Services:**
  - UsersService — createUser, findByEmail, findById, updateUser, deleteUser, hashPassword, verifyPassword, incrementFailedAttempts, resetFailedAttempts, lockAccount
- **Controllers:**
  - UsersController — `GET /users`, `POST /users`, `PATCH /users/:id`, `DELETE /users/:id` (platform-owner only)
- **Exports:** UsersService — consumed by AuthModule for login validation
- **Imports:** PrismaModule (implicit via Global)

#### PagesModule (`src/pages/pages.module.ts`)

- **Role:** CMS page CRUD, publishing workflow, version history
- **Services:**
  - PagesService — createPage, findAll (with filters), findBySlug, updatePage (upserts puckData + creates version), deletePage, publishPage, unpublishPage, getPreviewData
  - VersionsService — listVersions (paginated), restoreVersion (copies puckData back to Page, creates new version with note "Restored from version X")
- **Controllers:**
  - PagesController — `GET /pages`, `GET /pages/:slug`, `POST /pages`, `PUT /pages/:slug`, `DELETE /pages/:slug`, `POST /pages/:slug/publish`, `POST /pages/:slug/unpublish`, `GET /pages/:slug/preview`
  - VersionsController — `GET /pages/:slug/versions`, `POST /pages/:slug/versions/:id/restore`
- **Exports:** PagesService (consumed by RevalidationModule for publish events)
- **Imports:** PrismaModule (implicit), RevalidationModule

#### RevalidationModule (`src/revalidation/revalidation.module.ts`)

- **Role:** Triggers Next.js ISR revalidation after page publish/unpublish
- **Services:**
  - RevalidationService — revalidatePage(slug: string) — sends POST to `REVALIDATION_URL` with `x-revalidate-secret` header for each configured locale (en, es, fr, de). Uses `Promise.allSettled` so one locale failure doesn't block others. Logs failures but doesn't throw.
- **Exports:** RevalidationService
- **Imports:** HttpModule (for outbound HTTP calls to Next.js)

#### HealthModule (`src/health/health.module.ts`)

- **Role:** Liveness/readiness probe for infrastructure
- **Controllers:**
  - HealthController — `GET /health` — returns `{ status: 'ok', uptime, dbConnected, timestamp }`
- **Imports:** PrismaModule (implicit, for DB ping)
- **No auth required** — public endpoint

### 2.2 Complete Prisma Schema

```prisma
// apps/api/src/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ─────────────────────────────────────────────────

enum PlatformRole {
  PLATFORM_OWNER
  SUPPORT_ADMIN
  FINANCE_ADMIN
}

enum TenantMembershipRole {
  OWNER
  ADMIN
  EDITOR
  BILLING
}

// ─── User ──────────────────────────────────────────────────

model User {
  id             String   @id @default(cuid())
  email          String   @unique
  passwordHash   String   @map("password_hash")
  platformRole   PlatformRole? @map("platform_role")

  // Brute-force protection
  failedAttempts Int      @default(0) @map("failed_attempts")
  lockedUntil    DateTime? @map("locked_until")

  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  refreshTokens  RefreshToken[]
  memberships    TenantMembership[]

  @@map("users")
}

// ─── Tenant Membership ─────────────────────────────────────

model TenantMembership {
  id         String               @id @default(cuid())
  userId     String               @map("user_id")
  tenantId   String               @map("tenant_id")
  role       TenantMembershipRole
  createdAt  DateTime             @default(now()) @map("created_at")
  updatedAt  DateTime             @updatedAt @map("updated_at")

  user       User                 @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, tenantId])
  @@index([tenantId, role])
  @@map("tenant_memberships")
}

// ─── Refresh Token ─────────────────────────────────────────

model RefreshToken {
  id         String    @id @default(cuid())
  userId     String    @map("user_id")
  tokenHash  String    @map("token_hash")
  expiresAt  DateTime  @map("expires_at")
  revokedAt  DateTime? @map("revoked_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

// ─── Page ──────────────────────────────────────────────────

model Page {
  id         String    @id @default(cuid())
  slug       String
  locale     String    @default("en")
  title      String
  puckData   Json      @map("puck_data")
  published  Boolean   @default(false)

  seoTitle       String?  @map("seo_title")
  seoDescription String?  @map("seo_description")
  seoKeywords    String?  @map("seo_keywords")

  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  versions   PageVersion[]

  @@unique([slug, locale])
  @@index([slug])
  @@index([locale])
  @@index([published])
  @@index([published, locale])
  @@map("pages")
}

// ─── Page Version ──────────────────────────────────────────

model PageVersion {
  id       String   @id @default(cuid())
  pageId   String   @map("page_id")
  puckData Json     @map("puck_data")
  savedBy  String   @map("saved_by")
  note     String?
  savedAt  DateTime @default(now()) @map("saved_at")

  page     Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@index([pageId])
  @@index([pageId, savedAt])
  @@map("page_versions")
}
```

**Schema decisions:**

- **cuid() for IDs:** Sortable, collision-resistant, URL-safe. UUIDs are 36 chars and not sortable; auto-increment leaks count. CUIDs are the right middle ground.
- **@@unique([slug, locale]):** A page slug like "pricing" can exist once per locale — `pricing/en`, `pricing/es`, `pricing/fr` are separate rows. This is the simplest model for per-locale editing.
- **@@map() everywhere:** Postgres convention is `snake_case` for columns; Prisma convention is `camelCase` in code. The `@map` directives bridge this cleanly.
- **Json column for puckData:** Puck stores its entire page layout as a JSON tree. PostgreSQL's `jsonb` type is ideal — supports indexing, GIN queries if needed later, and avoids a separate document store.
- **PageVersion stores full puckData snapshots:** Not diffs. Diffs are smaller but require reconstruct-from-base logic that is fragile and slow. At ~50KB per page version and maybe 100 versions per page, storage is negligible (~5MB per page's full history). Full snapshots mean instant restore.
- **RefreshToken with tokenHash:** The raw refresh token is never stored. We store bcrypt/argon2 hash only. The `@@index([tokenHash])` enables O(1) lookup during refresh. `revokedAt` enables soft-revocation for audit trail.
- **Cascade deletes:** Deleting a User cascades to their RefreshTokens. Deleting a Page cascades to its PageVersions. This prevents orphaned records.
- **SEO fields on Page:** seoTitle, seoDescription, seoKeywords are separate from puckData so the website's getStaticProps can extract them without parsing the entire Puck JSON tree. These are set in the dashboard's page settings panel.

### 2.3 Auth & Permission System

#### Authentication Flow

**Strategy:** JWT Access Token (short-lived) + Refresh Token (long-lived) with rotation.

**Why RS256 (asymmetric) over HS256 (symmetric):**

- The API signs tokens with the private key
- The website and dashboard verify tokens with the public key
- If the public key leaks, an attacker can verify tokens but **cannot forge them**
- With HS256, a single shared secret both signs and verifies — if any consumer is compromised, tokens can be forged
- RS256 is the correct choice for multi-app architectures

**Token Lifetimes:**
| Token | Lifetime | Storage | Reasoning |
|-------|----------|---------|-----------|
| Access Token | 15 minutes | Client memory (JS variable) | Short-lived = limited blast radius if stolen. In-memory = survives navigation but not tab close. Never localStorage (XSS-accessible). |
| Refresh Token | 30 days | httpOnly Secure SameSite=Strict cookie | httpOnly = invisible to JavaScript (immune to XSS). Secure = HTTPS only. SameSite=Strict = no CSRF. 30 days = reasonable session persistence for a CMS. |

**Login Flow (POST /auth/login):**

```
1. Client sends { email, password } in request body
2. LocalStrategy validates:
   a. User exists in DB by email
   b. User is not locked (lockedUntil < now OR null)
   c. Password matches hash via argon2.verify()
3. On password mismatch:
   a. Increment user.failedAttempts
   b. If failedAttempts >= 5: set lockedUntil = now + 15 minutes
   c. Return 401 UNAUTHORIZED
4. On success:
   a. Reset failedAttempts to 0, clear lockedUntil
   b. Generate access token (JWT, RS256, 15min expiry)
      Payload: { sub: userId, email, platformRole, activeMembershipRole, activeTenantId, activeSiteId, iat, exp }
   c. Generate refresh token (crypto.randomBytes(32).toString('hex'))
   d. Hash refresh token with argon2id, store in RefreshToken table
   e. Set refresh token in httpOnly cookie:
      Set-Cookie: refresh_token={raw_token}; HttpOnly; Secure;
      SameSite=Strict; Path=/auth/refresh; Max-Age=2592000
    f. Return the authenticated session payload with `user.platformRole`, `activeMembershipRole`, and active tenant/site context in the body
```

**Refresh Flow (POST /auth/refresh):**

```
1. Extract refresh_token from httpOnly cookie
2. Query all non-expired, non-revoked RefreshTokens for comparison
3. For each candidate, use argon2.verify(candidate.tokenHash, rawToken)
   — this is constant-time comparison (prevents timing attacks)
4. If no match: return 401 TOKEN_EXPIRED
5. If match but revokedAt is set:
   a. SECURITY ALERT — token reuse detected (possible theft)
   b. Revoke ALL refresh tokens for this user
   c. Return 401 TOKEN_REVOKED
6. If valid:
   a. Revoke the old token (set revokedAt = now)
   b. Generate new refresh token, hash and store
   c. Generate new access token
   d. Set new cookie, return new accessToken in body
```

**Why token rotation matters:** If an attacker steals a refresh token and uses it, the legitimate user's next refresh attempt will find a revoked token — triggering the theft-detection path that revokes ALL tokens, forcing re-login. Without rotation, a stolen refresh token grants 30 days of silent access.

**Logout Flow (POST /auth/logout):**

```
1. Requires valid JWT (AuthGuard)
2. Revoke all RefreshTokens for the user (set revokedAt = now)
3. Clear the httpOnly cookie (Set-Cookie with Max-Age=0)
4. Return 200 { message: 'Logged out' }
```

#### Authorization (RBAC)

**Workspace Permission Matrix:**

| Permission                   | EDITOR | ADMIN  | OWNER | BILLING |
| ---------------------------- | ------ | ------ | ----- | ------- |
| Read pages (published)       | Yes    | Yes    | Yes   | No      |
| Read pages (all incl. draft) | Yes    | Yes    | Yes   | No      |
| Create page                  | Yes    | Yes    | Yes   | No      |
| Update page (save draft)     | Yes    | Yes    | Yes   | No      |
| Publish / Unpublish          | **No** | Yes    | Yes   | No      |
| Delete page permanently      | **No** | **No** | Yes   | No      |
| Manage members / sites       | **No** | Yes    | Yes   | No      |
| Access billing               | **No** | **No** | Yes   | Yes     |

Platform administration routes are separate and require `PlatformRole` values such as `PLATFORM_OWNER`, `SUPPORT_ADMIN`, or `FINANCE_ADMIN`.

**Implementation:**

```typescript
// decorators/roles.decorator.ts
export const PlatformRoles = (...roles: PlatformRole[]) =>
  SetMetadata("platformRoles", roles);

export const MembershipRoles = (...roles: TenantMembershipRole[]) =>
  SetMetadata("membershipRoles", roles);

// guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPlatformRoles = this.reflector.getAllAndOverride<
      PlatformRole[]
    >("platformRoles", [context.getHandler(), context.getClass()]);
    const requiredMembershipRoles = this.reflector.getAllAndOverride<
      TenantMembershipRole[]
    >("membershipRoles", [context.getHandler(), context.getClass()]);
    const { user } = context.switchToHttp().getRequest();

    if (requiredPlatformRoles?.length) {
      return (
        !!user.platformRole && requiredPlatformRoles.includes(user.platformRole)
      );
    }

    if (requiredMembershipRoles?.length) {
      return (
        !!user.activeMembershipRole &&
        requiredMembershipRoles.includes(user.activeMembershipRole)
      );
    }

    return true;
  }
}
```

**Usage on controllers:**

```typescript
@Post(':slug/publish')
@UseGuards(JwtAuthGuard, RolesGuard)
@MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
async publishPage(@Param('slug') slug: string) { ... }
```

**Why not CASL:** The current permission model is still mostly role-based and scoped either to the platform or the active tenant membership. The split `PlatformRoles` / `MembershipRoles` decorators keep that explicit and easy to audit. If per-record ownership rules are introduced later, CASL becomes more compelling; for now, the guard-based approach is sufficient.

#### Security Hardening

**Password Hashing — Argon2id:**

```typescript
// Argon2id parameters (OWASP 2024 recommendation)
const ARGON2_CONFIG = {
  type: argon2.argon2id, // hybrid: side-channel resistant + GPU resistant
  memoryCost: 65536, // 64 MB RAM
  timeCost: 3, // 3 iterations
  parallelism: 4, // 4 threads
};
```

**Why Argon2id over bcrypt:** Argon2id is the winner of the Password Hashing Competition (2015), recommended by OWASP. It's memory-hard (resists GPU/ASIC attacks), configurable in all three dimensions (memory, time, parallelism), and argon2id specifically combines argon2i (side-channel resistance) and argon2d (GPU resistance). Bcrypt is limited to 72 bytes input and has no memory-hardness parameter.

**Rate Limiting:**

```typescript
// app.module.ts
ThrottlerModule.forRoot([
  {
    name: 'default',
    ttl: 900000,   // 15 minutes in ms
    limit: 200,    // 200 requests per 15 min per IP
  },
]),
```

```typescript
// auth.controller.ts — stricter limit on auth endpoints
@UseGuards(ThrottlerGuard)
@Throttle({ default: { ttl: 900000, limit: 10 } }) // 10 req/15min
@Post('login')
async login(...) { ... }
```

**Brute-force protection (account lockout):**

- After 5 failed login attempts within any window: lock account for 15 minutes
- `failedAttempts` counter on User model, `lockedUntil` timestamp
- Reset both on successful login
- Lockout check happens before password verification (save compute)

### 2.4 Full API Contract

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

---

## SECTION 3: React 19 + Vite Dashboard Architecture

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

### 3.2 Auth Implementation in SPA

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

### 3.3 Routing

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

### 3.4 State Management

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

### 3.5 Puck Editor Integration

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

### 3.6 Vite Configuration

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

## SECTION 4: Next.js Website Architecture (Refactored)

### Design Philosophy

The website's refactoring is the most delicate part of the migration. The live marketing site must never go down. The strategy is: introduce a dynamic catch-all route (`[...slug].js`) that fetches Puck data from the CMS API, while keeping existing hardcoded pages as fallbacks. Pages are migrated one at a time — a hardcoded page is only removed after its CMS-managed version is published and verified.

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
      next: { revalidate: 60 },
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

## SECTION 5: packages/puck-components Architecture

### Why a Shared Package

The same Puck components must render identically in two contexts:

1. **Dashboard** — inside Puck's `<Editor>` (drag-and-drop editing, field panels)
2. **Website** — inside Puck's `<Render>` (static HTML output, SSG/ISR)

A shared package ensures pixel-perfect consistency. Both apps import the same `puckConfig` object. If a component changes, both apps get the update via the Turborepo dependency graph.

### 5.1 Package Structure

```
packages/puck-components/
├── src/
│   ├── index.ts                      # Main entry: re-exports puckConfig + component types
│   ├── config.ts                     # puckConfig object: component registry with fields
│   ├── components/
│   │   ├── HeroSection.tsx           # Full-width hero with h1, subtitle, optional CTA
│   │   ├── TextImageSection.tsx      # Text left + image right (or reversed)
│   │   ├── ImageTextSection.tsx      # Image left + text right
│   │   ├── HeroTextImageSection.tsx  # Hero variant with text + browser mockup image
│   │   ├── FeatureCard.tsx           # Single feature card (icon + title + description)
│   │   ├── FeatureCardWrapper.tsx    # Grid wrapper for multiple FeatureCards
│   │   ├── CTASection.tsx            # Call-to-action section with heading + link
│   │   ├── PlanIncludesBanner.tsx    # Banner showing plan features
│   │   ├── FAQ.tsx                   # Accordion FAQ section
│   │   ├── Quote.tsx                 # Testimonial quote block
│   │   ├── OTASlider.tsx             # Infinite logo carousel
│   │   ├── PricingCard.tsx           # Pricing display card
│   │   ├── PricingSectionOnePlan.tsx  # Full pricing section (one plan)
│   │   ├── OnePlanFeaturesTable.tsx  # Feature comparison table
│   │   ├── UnifiedCTA.tsx            # Standalone CTA block for page bottom
│   │   ├── OrderList.tsx             # Numbered list component
│   │   ├── UnorderedList.tsx         # Bulleted list component
│   │   ├── FinancialToolsTabs.tsx    # Tabbed financial tools section
│   │   ├── Accordion.tsx             # Generic accordion component
│   │   ├── Button.tsx                # Button component
│   │   └── LinkButton.tsx            # Link styled as button
│   └── types/
│       └── index.ts                  # Shared TypeScript types for component props
│
├── tsconfig.json                     # Extends ../../packages/typescript-config/base.json
├── tsup.config.ts                    # Build config: ESM + CJS dual output
├── tailwind.config.ts                # Tailwind config for this package
└── package.json
```

### 5.2 puckConfig Type Contract

```typescript
// src/config.ts

import type { Config, Data } from "@measured/puck";

// ─── Root Data Type ────────────────────────────────────────
// Root-level fields available on every page (set in Puck's root panel)

export interface RootData {
  title: string;           // Page title (used in SEOHead)
  seoTitle: string;        // Override for <title> tag
  seoDescription: string;  // Meta description
  seoKeywords: string;     // Meta keywords
}

// ─── Component Field Types ─────────────────────────────────
// Each component's Puck fields define what editors can configure.

// Example: HeroSection fields
interface HeroSectionProps {
  heading: string;          // h1 text
  subheading: string;       // paragraph below h1
  ctaText: string;          // CTA button label
  ctaHref: string;          // CTA button link
  showCta: boolean;         // toggle CTA visibility
}

// Example: TextImageSection fields
interface TextImageSectionProps {
  sectionLabel: string;     // small label above title
  title: string;            // section heading
  description: string;      // body text (supports line breaks)
  imageSrc: string;         // image URL
  imageAlt: string;         // image alt text
  fullWidth: boolean;       // full-width layout variant
  reversed: boolean;        // swap text/image sides
}

// Example: FAQ fields
interface FAQProps {
  title: string;
  items: Array<{
    question: string;
    answer: string;         // rendered as markdown or paragraphs
  }>;
}

// Example: Quote fields
interface QuoteProps {
  text: string;             // quote body
  author: string;           // attribution name
  position: string;         // attribution title/role
  showBorder: boolean;      // decorative border
}

// Example: UnifiedCTA fields
interface UnifiedCTAProps {
  heading: string;
  buttonText: string;
  buttonHref: string;
}

// Example: OTASlider fields
interface OTASliderProps {
  direction: number;        // 1 or -1 (scroll direction)
  speed: number;            // animation speed multiplier
}

// Example: FeatureCard fields
interface FeatureCardProps {
  icon: string;             // icon name from icon set
  title: string;
  description: string;
  linkText: string;
  linkHref: string;
}

// Example: PricingCard fields
interface PricingCardProps {
  planName: string;
  price: string;            // displayed as-is (e.g., "$9/mo")
  period: string;           // billing period label
  features: Array<{
    text: string;
    included: boolean;
  }>;
  ctaText: string;
  ctaHref: string;
  highlighted: boolean;     // visual emphasis
}

// ─── Full puckConfig ───────────────────────────────────────

export const puckConfig: Config = {
  root: {
    fields: {
      title: { type: "text", label: "Page Title" },
      seoTitle: { type: "text", label: "SEO Title Override" },
      seoDescription: { type: "textarea", label: "SEO Description" },
      seoKeywords: { type: "text", label: "SEO Keywords" },
    },
    defaultProps: {
      title: "",
      seoTitle: "",
      seoDescription: "",
      seoKeywords: "",
    },
    render: ({ children, puck }) => {
      // Root render just wraps children — SEOHead is handled by the page
      return <>{children}</>;
    },
  },

  components: {
    HeroSection: {
      label: "Hero Section",
      fields: {
        heading: { type: "text", label: "Heading (H1)" },
        subheading: { type: "textarea", label: "Subheading" },
        ctaText: { type: "text", label: "CTA Button Text" },
        ctaHref: { type: "text", label: "CTA Button Link" },
        showCta: { type: "radio", label: "Show CTA", options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ]},
      },
      defaultProps: {
        heading: "Your Heading Here",
        subheading: "Your subheading text",
        ctaText: "Get Started",
        ctaHref: "/pricing",
        showCta: true,
      },
      render: HeroSection,
    },

    TextImageSection: {
      label: "Text + Image",
      fields: {
        sectionLabel: { type: "text", label: "Section Label" },
        title: { type: "text", label: "Title" },
        description: { type: "textarea", label: "Description" },
        imageSrc: { type: "text", label: "Image URL" },
        imageAlt: { type: "text", label: "Image Alt Text" },
        fullWidth: { type: "radio", label: "Full Width", options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ]},
        reversed: { type: "radio", label: "Reverse Layout", options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ]},
      },
      defaultProps: {
        sectionLabel: "",
        title: "Section Title",
        description: "Section description text",
        imageSrc: "",
        imageAlt: "",
        fullWidth: false,
        reversed: false,
      },
      render: TextImageSection,
    },

    ImageTextSection: {
      label: "Image + Text",
      fields: { /* same fields as TextImageSection */ },
      defaultProps: { /* same defaults, reversed: true */ },
      render: ImageTextSection,
    },

    HeroTextImageSection: {
      label: "Hero with Image",
      fields: {
        heading: { type: "text", label: "Heading" },
        subheading: { type: "textarea", label: "Subheading" },
        imageSrc: { type: "text", label: "Image URL" },
        imageAlt: { type: "text", label: "Image Alt Text" },
        browserUrl: { type: "text", label: "Browser Mockup URL" },
      },
      render: HeroTextImageSection,
    },

    FeatureCard: {
      label: "Feature Card",
      fields: {
        icon: { type: "text", label: "Icon Name" },
        title: { type: "text", label: "Title" },
        description: { type: "textarea", label: "Description" },
        linkText: { type: "text", label: "Link Text" },
        linkHref: { type: "text", label: "Link URL" },
      },
      render: FeatureCard,
    },

    FeatureCardWrapper: {
      label: "Feature Card Grid",
      fields: {
        columns: { type: "radio", label: "Columns", options: [
          { label: "2", value: 2 },
          { label: "3", value: 3 },
          { label: "4", value: 4 },
        ]},
      },
      defaultProps: { columns: 3 },
      render: FeatureCardWrapper,
      // Note: FeatureCards are nested via Puck's slot/children system
    },

    CTASection: {
      label: "CTA Section",
      fields: {
        heading: { type: "text", label: "Heading" },
        paragraph: { type: "textarea", label: "Description" },
        linkText: { type: "text", label: "Link Text" },
        linkHref: { type: "text", label: "Link URL" },
      },
      render: CTASection,
    },

    UnifiedCTA: {
      label: "Unified CTA Block",
      fields: {
        heading: { type: "text", label: "Heading" },
        buttonText: { type: "text", label: "Button Text" },
        buttonHref: { type: "text", label: "Button URL" },
      },
      defaultProps: {
        heading: "Ready to Take Control of Your Vacation Rental Business?",
        buttonText: "Get started",
        buttonHref: "/pricing",
      },
      render: UnifiedCTA,
    },

    FAQ: {
      label: "FAQ Section",
      fields: {
        title: { type: "text", label: "Section Title" },
        items: {
          type: "array",
          label: "FAQ Items",
          arrayFields: {
            question: { type: "text", label: "Question" },
            answer: { type: "textarea", label: "Answer" },
          },
        },
      },
      defaultProps: {
        title: "Frequently Asked Questions",
        items: [],
      },
      render: FAQ,
    },

    Quote: {
      label: "Testimonial Quote",
      fields: {
        text: { type: "textarea", label: "Quote Text" },
        author: { type: "text", label: "Author Name" },
        position: { type: "text", label: "Author Position" },
        showBorder: { type: "radio", label: "Show Border", options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ]},
      },
      defaultProps: { showBorder: true },
      render: Quote,
    },

    OTASlider: {
      label: "OTA Logo Slider",
      fields: {
        direction: { type: "radio", label: "Scroll Direction", options: [
          { label: "Left", value: -1 },
          { label: "Right", value: 1 },
        ]},
        speed: { type: "number", label: "Speed", min: 0.5, max: 3, step: 0.5 },
      },
      defaultProps: { direction: -1, speed: 1 },
      render: OTASlider,
    },

    PricingCard: {
      label: "Pricing Card",
      fields: {
        planName: { type: "text", label: "Plan Name" },
        price: { type: "text", label: "Price (e.g. $9/mo)" },
        period: { type: "text", label: "Billing Period" },
        features: {
          type: "array",
          label: "Features",
          arrayFields: {
            text: { type: "text", label: "Feature Text" },
            included: { type: "radio", label: "Included", options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ]},
          },
        },
        ctaText: { type: "text", label: "CTA Text" },
        ctaHref: { type: "text", label: "CTA Link" },
        highlighted: { type: "radio", label: "Highlight Card", options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ]},
      },
      render: PricingCard,
    },

    PricingSectionOnePlan: {
      label: "Pricing Section (Single Plan)",
      fields: {
        heading: { type: "text", label: "Section Heading" },
        price: { type: "text", label: "Price Display" },
        period: { type: "text", label: "Period Text" },
        ctaText: { type: "text", label: "CTA Text" },
        ctaHref: { type: "text", label: "CTA Link" },
      },
      render: PricingSectionOnePlan,
    },

    OnePlanFeaturesTable: {
      label: "Features Table",
      fields: {
        features: {
          type: "array",
          label: "Feature Rows",
          arrayFields: {
            category: { type: "text", label: "Category" },
            name: { type: "text", label: "Feature Name" },
            included: { type: "radio", label: "Included", options: [
              { label: "Yes", value: true },
              { label: "No", value: false },
            ]},
          },
        },
      },
      render: OnePlanFeaturesTable,
    },

    PlanIncludesBanner: {
      label: "Plan Includes Banner",
      fields: {
        heading: { type: "text", label: "Heading" },
        items: {
          type: "array",
          label: "Included Items",
          arrayFields: {
            text: { type: "text", label: "Item Text" },
          },
        },
      },
      render: PlanIncludesBanner,
    },

    OrderList: {
      label: "Numbered List",
      fields: {
        items: {
          type: "array",
          label: "List Items",
          arrayFields: {
            text: { type: "text", label: "Item Text" },
          },
        },
      },
      render: OrderList,
    },

    UnorderedList: {
      label: "Bulleted List",
      fields: {
        items: {
          type: "array",
          label: "List Items",
          arrayFields: {
            text: { type: "text", label: "Item Text" },
          },
        },
      },
      render: UnorderedList,
    },

    FinancialToolsTabs: {
      label: "Financial Tools Tabs",
      fields: {
        tabs: {
          type: "array",
          label: "Tabs",
          arrayFields: {
            label: { type: "text", label: "Tab Label" },
            content: { type: "textarea", label: "Tab Content" },
          },
        },
      },
      render: FinancialToolsTabs,
    },

    Accordion: {
      label: "Accordion",
      fields: {
        title: { type: "text", label: "Accordion Title" },
        content: { type: "textarea", label: "Content" },
        defaultOpen: { type: "radio", label: "Default Open", options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ]},
      },
      defaultProps: { defaultOpen: false },
      render: Accordion,
    },

    Button: {
      label: "Button",
      fields: {
        text: { type: "text", label: "Button Text" },
        variant: { type: "radio", label: "Variant", options: [
          { label: "Primary", value: "primary" },
          { label: "Secondary", value: "secondary" },
          { label: "Outline", value: "outline" },
        ]},
      },
      defaultProps: { variant: "primary" },
      render: Button,
    },

    LinkButton: {
      label: "Link Button",
      fields: {
        text: { type: "text", label: "Button Text" },
        href: { type: "text", label: "Link URL" },
        variant: { type: "radio", label: "Variant", options: [
          { label: "Primary", value: "primary" },
          { label: "Secondary", value: "secondary" },
          { label: "Outline", value: "outline" },
        ]},
        openInNewTab: { type: "radio", label: "Open in New Tab", options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ]},
      },
      defaultProps: { variant: "primary", openInNewTab: false },
      render: LinkButton,
    },
  },
};
```

### 5.3 How Components Are Exported

**Dual ESM + CJS output via tsup:**

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true, // generate .d.ts declaration files
  sourcemap: true,
  clean: true, // clean dist/ before build
  external: ["react", "react-dom", "@measured/puck"],
  splitting: false, // single bundle, no code splitting
  treeshake: true, // dead-code elimination
});
```

**package.json:**

```json
{
  "name": "@myallocator/puck-components",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "eslint src/",
    "type-check": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@measured/puck": "^0.18.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.4.0",
    "@myallocator/typescript-config": "workspace:*",
    "@myallocator/eslint-config": "workspace:*"
  }
}
```

**Why `external: ['react', 'react-dom', '@measured/puck']`:** These are peer dependencies — the consuming apps (dashboard and website) provide them. Bundling them would cause duplicate React instances and break hooks.

**Why ESM + CJS dual output:**

- The website (Next.js Pages Router) may import via CommonJS in `getStaticProps` (server-side Node.js)
- The dashboard (Vite) imports via ESM
- Dual output covers both consumption patterns

**Consumers import like this:**

```typescript
// In apps/dashboard or apps/website:
import { puckConfig } from "@myallocator/puck-components";
```

---

## SECTION 6: Data Flow Diagrams

### Diagram A: Dashboard Editor Save Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DASHBOARD (React SPA)                            │
│                                                                         │
│  ┌──────────┐   onChange    ┌────────────┐   click    ┌──────────────┐  │
│  │ Puck     │──────────────>│ isDirty =  │──────────->│ Save Button  │  │
│  │ <Editor> │              │ true       │           │ (enabled)    │  │
│  └──────────┘              └────────────┘           └──────┬───────┘  │
│                                                            │           │
│                                                  PUT /pages/:slug      │
│                                                  ?locale=en            │
│                                                  { puckData: {...} }   │
└────────────────────────────────────────────────────────────┼───────────┘
                                                             │
                                                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        NestJS API                                       │
│                                                                         │
│  ┌────────────────┐     ┌──────────────────┐     ┌──────────────────┐  │
│  │ JwtAuthGuard   │────>│ ValidationPipe   │────>│ PagesController  │  │
│  │ verify JWT     │     │ validate DTO     │     │ updatePage()     │  │
│  └────────────────┘     └──────────────────┘     └────────┬─────────┘  │
│                                                           │             │
│                                                           ▼             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ PagesService.updatePage()                                       │    │
│  │  1. Prisma: UPDATE page SET puck_data = $1 WHERE slug + locale  │    │
│  │  2. Prisma: INSERT INTO page_versions (pageId, puckData,        │    │
│  │             savedBy=user.email)                                  │    │
│  │  3. Return updated Page                                         │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                           │             │
│                                                  200 { page object }    │
└───────────────────────────────────────────────────────────┼─────────────┘
                                                            │
                                                            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Dashboard receives 200                                                 │
│  → isDirty = false                                                      │
│  → React Query invalidates ['page', slug, locale]                       │
│  → Toast: "Page saved successfully"                                     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Diagram B: Website ISR Render Flow

```
┌──────────┐         ┌──────────────┐         ┌─────────────────────────┐
│ Browser  │────────>│ CDN / Edge   │────────>│ Next.js (if stale/miss) │
│ GET /    │         │ (Vercel)     │         │                         │
│ pricing  │         │              │         │  getStaticProps()       │
└──────────┘         │ Cache HIT?   │         │                         │
                     │ ┌─YES: serve │         │  1. fetchPage(          │
                     │ │  cached    │         │       'pricing', 'en')  │
                     │ │  HTML      │         │                         │
                     │ └─NO/STALE:  │─────────│  2. GET CMS API         │
                     │   forward    │         │     /pages/pricing      │
                     └──────────────┘         │     ?locale=en          │
                                              │     &published=true     │
                                              └────────────┬────────────┘
                                                           │
                                                           ▼
                                              ┌─────────────────────────┐
                                              │ NestJS API              │
                                              │                         │
                                              │ PagesController         │
                                              │  .findBySlug()          │
                                              │                         │
                                              │ Prisma: SELECT * FROM   │
                                              │ pages WHERE slug =      │
                                              │ 'pricing' AND locale =  │
                                              │ 'en' AND published =    │
                                              │ true                    │
                                              └────────────┬────────────┘
                                                           │
                                              { slug, title, puckData,  │
                                                seoTitle, ... }         │
                                                           │
                                                           ▼
                                              ┌─────────────────────────┐
                                              │ Next.js renders:        │
                                              │                         │
                                              │ <SEOHead ... />         │
                                              │ <Render                 │
                                              │   config={puckConfig}   │
                                              │   data={puckData}       │
                                              │ />                      │
                                              │                         │
                                              │ → Static HTML generated │
                                              │ → Cached at edge        │
                                              │ → revalidate: 60s       │
                                              └─────────────────────────┘
```

### Diagram C: Publish + Revalidation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ DASHBOARD                                                               │
│                                                                         │
│  Admin clicks [Publish] on page "pricing" (locale: en)                  │
│  → POST /pages/pricing/publish?locale=en                                │
└─────────────────────────────────────────────────┬───────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ NestJS API                                                              │
│                                                                         │
│  1. JwtAuthGuard → verify JWT                                           │
│  2. RolesGuard → check @MembershipRoles(OWNER, ADMIN) → ✓              │
│  3. PagesService.publishPage('pricing', 'en')                           │
│     → Prisma: UPDATE pages SET published = true                         │
│       WHERE slug = 'pricing' AND locale = 'en'                          │
│  4. RevalidationService.revalidatePage('pricing')                       │
│     → POST to each locale path:                                         │
└──────────────┬──────────────────────────────────────────────────────────┘
               │
               │  POST {REVALIDATION_URL}
               │  Headers: { x-revalidate-secret: {secret} }
               │  Body: { slug: "pricing" }
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Next.js Website — /api/revalidate                                       │
│                                                                         │
│  1. Validate x-revalidate-secret header                                 │
│  2. For each locale in [en, es, fr, de]:                                │
│     → res.revalidate('/pricing')         (en — default)                 │
│     → res.revalidate('/es/pricing')      (es)                           │
│     → res.revalidate('/fr/pricing')      (fr)                           │
│     → res.revalidate('/de/pricing')      (de)                           │
│  3. Return { revalidated: true }                                        │
│                                                                         │
│  Next request to /pricing → getStaticProps runs fresh →                 │
│  fetches updated puckData → serves new HTML                             │
└─────────────────────────────────────────────────────────────────────────┘
```

### Diagram D: Auth Token Rotation Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ DASHBOARD SPA — Browser Tab Opens                                       │
│                                                                         │
│  AuthProvider mounts → useEffect fires                                  │
│                                                                         │
│  1. POST /auth/refresh                                                  │
│     (browser auto-sends httpOnly cookie with refresh_token)             │
└─────────────────────────────────────────────────┬───────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ NestJS API — AuthService.refreshToken()                                 │
│                                                                         │
│  1. Extract refresh_token from cookie                                   │
│  2. Query: SELECT * FROM refresh_tokens                                 │
│     WHERE revoked_at IS NULL AND expires_at > NOW()                     │
│  3. For each candidate: argon2.verify(candidate.tokenHash, rawToken)    │
│     → MATCH FOUND                                                       │
│  4. Revoke old token: UPDATE SET revoked_at = NOW()                     │
│  5. Generate new refresh token: crypto.randomBytes(32)                  │
│  6. Hash new token: argon2.hash(newToken)                               │
│  7. INSERT new RefreshToken row                                         │
│  8. Generate new access token (JWT RS256, 15min)                        │
│  9. Set-Cookie: refresh_token={newToken}; HttpOnly; Secure; ...         │
│ 10. Return { accessToken: "eyJ..." }                                    │
└─────────────────────────────────────────────────┬───────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ DASHBOARD SPA                                                           │
│                                                                         │
│  1. Receives { accessToken }                                            │
│  2. Stores in module-scoped variable: accessToken = "eyJ..."            │
│  3. Decodes JWT payload → reads exp claim                               │
│  4. Schedules next refresh: setTimeout(() => refresh(), exp - 60s)      │
│  5. Sets user state → UI renders authenticated dashboard                │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────┐            │
│  │ Timeline:                                                │            │
│  │                                                         │            │
│  │  t=0        t=14min      t=15min      t=29min           │            │
│  │  ├──────────┤            ├────────────┤                 │            │
│  │  │ Token 1  │←refresh    │ Token 2    │←refresh ...     │            │
│  │  │ active   │ fires at   │ active     │ fires at        │            │
│  │  │          │ 14min      │            │ 29min           │            │
│  │  └──────────┘            └────────────┘                 │            │
│  └─────────────────────────────────────────────────────────┘            │
│                                                                         │
│  On refresh failure (cookie expired / revoked):                         │
│  → accessToken = null                                                   │
│  → user = null                                                          │
│  → ProtectedRoute redirects to /login                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## SECTION 7: Environment Variables

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

---

## SECTION 8: Security Checklist

### Authentication

- [ ] **Argon2id password hashing** — `apps/api/src/users/users.service.ts` — Mitigates: offline password cracking via GPU/ASIC. Parameters: memoryCost=65536 (64MB), timeCost=3, parallelism=4.
- [ ] **RS256 asymmetric JWT signing** — `apps/api/src/auth/auth.module.ts` (JwtModule config) — Mitigates: token forgery if public key leaks (public key can only verify, not sign).
- [ ] **15-minute access token expiry** — `apps/api/src/auth/auth.service.ts` — Mitigates: stolen access token has limited usability window.
- [ ] **Refresh token rotation on every use** — `apps/api/src/auth/auth.service.ts` — Mitigates: stolen refresh token detected on next legitimate use (reuse triggers full revocation).
- [ ] **Refresh token stored as argon2 hash** — `apps/api/src/auth/auth.service.ts` — Mitigates: database breach doesn't expose usable refresh tokens.
- [ ] **Account lockout after 5 failed attempts** — `apps/api/src/users/users.service.ts` — Mitigates: brute-force password guessing. Lockout duration: 15 minutes.

### Authorization

- [ ] **Role-based access control (RBAC) via RolesGuard** — `apps/api/src/auth/guards/roles.guard.ts` — Mitigates: privilege escalation (editors can't publish/delete, only admins can).
- [ ] **@PlatformRoles() / @MembershipRoles() decorators on every protected endpoint** — All controllers — Mitigates: forgotten authorization checks.
- [ ] **PLATFORM_OWNER-only user management** — `apps/api/src/users/users.controller.ts` — Mitigates: unauthorized user creation or role elevation.
- [ ] **Cannot delete own account** — `apps/api/src/users/users.service.ts` — Mitigates: accidental self-lockout by the last platform owner.

### Input Validation

- [ ] **Global ValidationPipe with whitelist + forbidNonWhitelisted** — `apps/api/src/main.ts` — Mitigates: mass assignment attacks (extra fields in request body silently stripped or rejected).
- [ ] **class-validator DTOs on every endpoint** — `apps/api/src/*/dto/*.ts` — Mitigates: injection via malformed input, type coercion attacks.
- [ ] **puckData size limit (5MB)** — `apps/api/src/pages/pages.service.ts` — Mitigates: denial of service via oversized JSON payloads that exhaust memory/storage.
- [ ] **Slug validation (kebab-case, 1-200 chars)** — `apps/api/src/pages/dto/create-page.dto.ts` — Mitigates: path traversal, URL injection.
- [ ] **Email format validation on user creation** — `apps/api/src/users/dto/create-user.dto.ts` — Mitigates: invalid data in DB.
- [ ] **Locale validation (enum: en, es, fr, de)** — `apps/api/src/pages/dto/page-query.dto.ts` — Mitigates: arbitrary locale injection.

### Transport Security

- [ ] **HTTPS only in production** — Infrastructure/deployment config — Mitigates: man-in-the-middle token interception.
- [ ] **CORS whitelist (explicit origins, no wildcard)** — `apps/api/src/main.ts` via `CORS_ORIGINS` env var — Mitigates: cross-origin request forgery from unauthorized domains.
- [ ] **SameSite=Strict on refresh token cookie** — `apps/api/src/auth/auth.service.ts` — Mitigates: CSRF attacks (cookie not sent on cross-origin requests).
- [ ] **Secure flag on refresh token cookie** — `apps/api/src/auth/auth.service.ts` — Mitigates: cookie transmission over HTTP (only sent over HTTPS).

### Token Security

- [ ] **Access token in response body only (not cookie)** — `apps/api/src/auth/auth.controller.ts` — Mitigates: CSRF (access token requires JavaScript to attach, so CSRF requests can't include it).
- [ ] **Access token stored in JS memory (not localStorage)** — `apps/dashboard/src/auth/AuthProvider.tsx` — Mitigates: XSS token theft (memory variables aren't accessible via `document.cookie` or `localStorage`).
- [ ] **httpOnly flag on refresh token cookie** — `apps/api/src/auth/auth.service.ts` — Mitigates: XSS can't read the refresh token.
- [ ] **Constant-time hash comparison for refresh tokens** — `apps/api/src/auth/auth.service.ts` (argon2.verify is inherently constant-time) — Mitigates: timing attacks to guess token values.
- [ ] **Revalidation secret validated with constant-time comparison** — `apps/website/pages/api/revalidate.js` (use `crypto.timingSafeEqual`) — Mitigates: timing attacks on revalidation endpoint.

### Rate Limiting

- [ ] **Global rate limit: 200 req/15min per IP** — `apps/api/src/app.module.ts` (ThrottlerModule) — Mitigates: general API abuse, scraping.
- [ ] **Auth rate limit: 10 req/15min per IP** — `apps/api/src/auth/auth.controller.ts` (@Throttle override) — Mitigates: credential stuffing, brute-force attacks.
- [ ] **429 Too Many Requests response with Retry-After header** — `apps/api/src/common/filters/http-exception.filter.ts` — Mitigates: client confusion about rate limit behavior.

### Dependency Security

- [ ] **pnpm audit in CI pipeline** — `.github/workflows/ci.yml` — Mitigates: known vulnerabilities in dependencies.
- [ ] **Dependabot or Renovate configured** — `.github/dependabot.yml` — Mitigates: stale dependencies with known CVEs.
- [ ] **No secrets in NEXT*PUBLIC* variables** — `apps/website/.env.example` — Mitigates: client-side secret exposure.
- [ ] **Private key never committed to repo** — `.gitignore` includes `*.pem`, `.env` — Mitigates: key exposure via version control.

### Logging & Monitoring

- [ ] **Structured request/response logging** — `apps/api/src/common/interceptors/logging.interceptor.ts` — Mitigates: inability to detect attacks in progress.
- [ ] **Failed login attempts logged with IP** — `apps/api/src/auth/auth.service.ts` — Mitigates: undetected brute-force campaigns.
- [ ] **Token reuse (theft detection) logged as CRITICAL** — `apps/api/src/auth/auth.service.ts` — Mitigates: stolen tokens going unnoticed.
- [ ] **No sensitive data in logs (no passwords, tokens, puckData)** — All services — Mitigates: log file compromise exposing secrets.
- [ ] **Health endpoint for uptime monitoring** — `apps/api/src/health/health.controller.ts` — Mitigates: undetected API downtime.

---

## SECTION 9: i18n Strategy (Puck + Existing Translations)

### The Boundary — What Lives Where

| Content Category          | Source                                                                 | Example                                                                                             | Edited By                                                       |
| ------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **Layout chrome**         | `locales/{locale}/index.json`                                          | Navbar labels ("Platform", "Resources"), footer text, "Get Started" button, "Learn More" links      | Developers — changed in code, committed to git                  |
| **Global UI patterns**    | `locales/{locale}/index.json`                                          | Common phrases used by multiple components: error messages, form labels, accessibility text         | Developers                                                      |
| **Page-specific content** | `puckData` in CMS database                                             | Hero headlines, body paragraphs, section titles, FAQ Q&As, testimonial quotes, feature descriptions | Marketing team — edited visually in Puck dashboard              |
| **SEO metadata**          | `pages` table columns (`seo_title`, `seo_description`, `seo_keywords`) | Per-page title tags, meta descriptions                                                              | Marketing team — edited in Puck's page settings panel           |
| **Component defaults**    | `puckConfig` default props                                             | "Ready to Take Control...?" (UnifiedCTA heading default)                                            | Developers set defaults; marketing overrides per-page in editor |

### How the Dashboard Handles Multi-Locale Pages

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

### Fallback Chain When a Locale Variant Doesn't Exist

```
User visits /fr/pricing:
  1. getStaticProps calls fetchPage('pricing', 'fr')
  2. API returns 404 (French version doesn't exist or is unpublished)
  3. Fallback: fetchPage('pricing', 'en')
  4. English version renders, with French global chrome (navbar/footer from locales/fr/index.json)
  5. If English also 404: return { notFound: true } → show 404 page
```

**Reasoning for English fallback:** Showing English content is better than showing a 404 for a page that exists in other locales. The user still gets the information, and the layout chrome (navbar, footer) will be in their locale. This matches the current behavior of the existing i18n system where missing keys fall back to English.

### How Puck Components Handle Translated Content

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

### Migration Path for Existing Translation Keys

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

---

## SECTION 10: Migration Strategy (Hardcoded → Puck CMS)

### Guiding Principle

**Zero downtime. Zero content loss. One page at a time.**

The existing marketing site stays live throughout. Pages are migrated individually — each hardcoded `.js` file is only deleted after its CMS version is published and verified. If the CMS has an issue, the hardcoded pages are still serving traffic.

### Pre-Migration Steps

**Step 0.1: Set up the monorepo**

- Create Turborepo structure (Section 1)
- Move existing website code into `apps/website/`
- Ensure `npm run dev` and `npm run build` work identically before any changes
- **Verification:** Run production build, compare output to current live site

**Step 0.2: Deploy the NestJS API**

- Implement all endpoints from Section 2
- Run the full test suite
- Deploy to staging
- **Verification:** All API contract tests pass, Swagger UI accessible

**Step 0.3: Deploy the Dashboard**

- Implement all screens from Section 3
- Connect to staging API
- **Verification:** Login, create a test page, edit in Puck, save, preview

**Step 0.4: Build the puck-components package**

- Convert all 22 existing components to TypeScript with Puck field definitions
- Ensure pixel-perfect rendering compared to original JSX
- **Verification:** Side-by-side visual regression testing (screenshot comparison)

### Page Migration Process (repeat for each of 25 pages)

```
For each page (e.g., "pricing"):

STEP 1: Extract Content
  ├── Read pages/pricing.js
  ├── Read locales/en/index.json → extract pricing.* keys
  ├── Read locales/es/index.json → extract pricing.* keys
  ├── Read locales/fr/index.json → extract pricing.* keys
  └── Document all components used and their prop values

STEP 2: Create Puck JSON Blobs
  ├── For EN: construct puckData JSON matching the exact layout
  │   └── Each component → one entry in puckData.content[]
  │       with props populated from the hardcoded values
  ├── For ES: same structure, Spanish text from locales/es/
  ├── For FR: same structure, French text from locales/fr/
  └── Save as migration seed files: migrations/pricing-en.json, etc.

STEP 3: Seed into CMS Database
  ├── POST /pages { slug: "pricing", locale: "en", puckData: {...} }
  ├── POST /pages { slug: "pricing", locale: "es", puckData: {...} }
  ├── POST /pages { slug: "pricing", locale: "fr", puckData: {...} }
  └── Verify all 3 rows created in DB

STEP 4: Verify in Dashboard
  ├── Open /editor/pricing?locale=en → visual check
  ├── Open /editor/pricing?locale=es → visual check
  ├── Open /editor/pricing?locale=fr → visual check
  └── Check: all components render, all text correct, layout matches

STEP 5: Verify via Website Preview
  ├── Access staging: /pricing → compare to production
  ├── Access staging: /es/pricing → compare
  ├── Access staging: /fr/pricing → compare
  └── Check: SEO tags, images, links, responsive layout

STEP 6: Publish in CMS
  ├── POST /pages/pricing/publish?locale=en
  ├── POST /pages/pricing/publish?locale=es
  ├── POST /pages/pricing/publish?locale=fr
  └── ISR revalidation triggers automatically

STEP 7: Create Static Fallback
  ├── Save EN puckData as lib/fallbacks/pricing.json
  └── Commit to repo (used if API is down)

STEP 8: Delete Hardcoded Page
  ├── Delete pages/pricing.js
  ├── Remove pricing.* keys from locales/en/index.json
  ├── Remove pricing.* keys from locales/es/index.json
  ├── Remove pricing.* keys from locales/fr/index.json
  └── Deploy → [...slug].js now handles /pricing

STEP 9: Verify Production
  ├── Visit /pricing on live site → renders from CMS
  ├── Visit /es/pricing, /fr/pricing → render correctly
  ├── Check: Google PageSpeed, SEO tags, console errors
  └── Monitor for 24 hours before proceeding to next page
```

### Migration Order

Migrate pages in order of risk (lowest risk first):

| Phase                            | Pages                                                                                                                                                                                                                                                                                                                                                           | Reason                                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wave 1: Simple static pages**  | `privacy-policy`, `customer-agreement`, `404`                                                                                                                                                                                                                                                                                                                   | Text-only, no interactive components. Lowest risk.                                                                                                         |
| **Wave 2: Simple feature pages** | `about`, `careers`, `ambassador`, `annual-report`                                                                                                                                                                                                                                                                                                               | Mostly text + images. Low complexity.                                                                                                                      |
| **Wave 3: Property type pages**  | `bedbreakfast`, `boutique`, `farm-stays`, `guest-house`, `vacation-apartments-and-homes`, `vacations-camping-glamping`                                                                                                                                                                                                                                          | Similar structure — migrate as a batch.                                                                                                                    |
| **Wave 4: Feature pages**        | `channel-manager-vacation-rental`, `channel-manager-airbnb`, `channel-manager-booking-com`, `dynamic-pricing`, `reservation-system-pms-vacation-rental`, `statistics-kpis-vacation-rentals`, `website-builder-vacation-rentals`, `automatic-guest-communications-vacation-rentals`, `booking-system-engine-vacation-rental`, `guest-guide-for-vacation-rentals` | More complex layouts, interactive components.                                                                                                              |
| **Wave 5: Contact & Account**    | `contact-us`, `account-access`                                                                                                                                                                                                                                                                                                                                  | Contains forms — verify form submission still works via Formspree.                                                                                         |
| **Wave 6: High-traffic pages**   | `pricing`, `index` (homepage)                                                                                                                                                                                                                                                                                                                                   | Highest traffic, most complex. Migrate last when the process is proven. `pricing` uses dynamic pricing from env var. Homepage has Framer Motion animation. |

### Content Extraction Automation

To avoid manual copy-paste errors for 25 pages × 3 locales = 75 content blobs:

Create a one-time migration script: `scripts/extract-to-puck.js`

```
1. Parse each page JSX file using AST (babel/parser)
2. Extract component usage: <HeroSection h1="..." p="..." />
3. Map to Puck component format: { type: "HeroSection", props: { heading: "..." } }
4. Pull translated strings from locales/{locale}/index.json
5. Output: one JSON file per page per locale
```

This script runs once and is discarded after migration. It doesn't need to be perfect — just saves 80% of the manual work. The remaining 20% is manual verification and adjustment in the Puck editor.

### Rollback Plan

If a migrated page has issues in production:

1. **Immediate:** The static fallback (`lib/fallbacks/{slug}.json`) ensures content is served even if the API is down
2. **Quick rollback:** Restore the deleted hardcoded page file from git history (`git checkout HEAD~1 -- pages/pricing.js`)
3. **Full rollback:** Revert the entire deployment (git revert the migration commit)

No data is destroyed during migration — the hardcoded pages exist in git history forever.

---

## SECTION 11: Risk Register

### Risk 1: Puck Version Upgrade Breaking Changes

|                 |                                                                                                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | Puck is pre-1.0 software (currently ~0.18.x). A major version bump could change the puckData JSON schema, component registration API, or rendering behavior.                                                                                                    |
| **Probability** | High                                                                                                                                                                                                                                                            |
| **Impact**      | High — all stored page data could become incompatible                                                                                                                                                                                                           |
| **Mitigation**  | Pin Puck to an exact version in `packages/puck-components/package.json`. Do not auto-upgrade. Before upgrading: read changelog, test in staging with all 25 pages, validate puckData schema compatibility. Store puckData versions in PageVersion for rollback. |
| **Owner**       | Phase 2 (puck-components) team                                                                                                                                                                                                                                  |

### Risk 2: CMS API Downtime Blocking Website Renders

|                 |                                                                                                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | If the NestJS API goes down, `getStaticProps` fails, and new pages can't be generated. Existing cached pages continue serving, but uncached requests fail.                                                                                                                              |
| **Probability** | Medium                                                                                                                                                                                                                                                                                  |
| **Impact**      | High — marketing site partially unavailable                                                                                                                                                                                                                                             |
| **Mitigation**  | Three layers: (1) ISR cache means most pages are pre-built and served from edge CDN even when API is down. (2) Static JSON fallbacks in `lib/fallbacks/` as last resort. (3) Health endpoint + uptime monitoring with PagerDuty/Opsgenie alerts. Recovery: API restart is < 30 seconds. |
| **Owner**       | Phase 1 (API) + Phase 7 (DevOps)                                                                                                                                                                                                                                                        |

### Risk 3: Refresh Token Theft

|                 |                                                                                                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | If an attacker obtains a refresh token (via network interception, browser exploit, or compromised device), they get 30-day API access.                                                                                                                         |
| **Probability** | Low                                                                                                                                                                                                                                                            |
| **Impact**      | High — attacker can modify/publish CMS pages                                                                                                                                                                                                                   |
| **Mitigation**  | (1) httpOnly + Secure + SameSite=Strict cookie — immune to XSS and CSRF. (2) Token rotation — reuse detection revokes all sessions. (3) HTTPS only — prevents network interception. (4) Token reuse logged as CRITICAL alert. (5) 30-day expiry limits window. |
| **Owner**       | Phase 1 (Auth)                                                                                                                                                                                                                                                 |

### Risk 4: Migration Content Drift

|                 |                                                                                                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Description** | During the multi-week migration, the marketing team updates content on the live hardcoded site. These changes aren't reflected in the CMS versions being prepared, causing content regression when switching to CMS.                                                                                         |
| **Probability** | High                                                                                                                                                                                                                                                                                                         |
| **Impact**      | Medium — stale content on migrated pages                                                                                                                                                                                                                                                                     |
| **Mitigation**  | (1) Freeze content changes on pages currently being migrated (coordinate with marketing). (2) Migration script runs against the latest git HEAD, not a stale snapshot. (3) Final visual verification step (Step 9) catches drift. (4) Marketing team does a content review in the CMS editor before publish. |
| **Owner**       | Phase 5 (Migration) + Marketing team                                                                                                                                                                                                                                                                         |

### Risk 5: puckData Payload Size Exceeds Limits

|                 |                                                                                                                                                                                                                                                                |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | Complex pages with many components, large text blocks, or inline images could produce puckData JSON blobs that exceed PostgreSQL's practical JSON size limits or cause slow API responses.                                                                     |
| **Probability** | Low                                                                                                                                                                                                                                                            |
| **Impact**      | Medium — specific pages fail to save or load slowly                                                                                                                                                                                                            |
| **Mitigation**  | (1) 5MB limit enforced at API validation layer. (2) Images are URLs (not base64) — stored in `/public/images/` or a CDN, not in puckData. (3) Monitor puckData sizes via API logging. Largest current page (homepage) estimates at ~30KB — well within limits. |
| **Owner**       | Phase 1 (API validation)                                                                                                                                                                                                                                       |

### Risk 6: SEO Regression After Migration

|                 |                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Description** | Migrated pages might have different HTML structure, missing meta tags, broken canonical URLs, or different content that hurts search rankings.                                                                                                                                                                                                                                                                           |
| **Probability** | Medium                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Impact**      | High — organic traffic is the primary acquisition channel for a marketing site                                                                                                                                                                                                                                                                                                                                           |
| **Mitigation**  | (1) SEO fields (title, description, keywords) are explicit columns on the Page model, not buried in puckData. (2) `<SEOHead>` component is unchanged — same meta tag output. (3) Pre-migration: crawl current site with Screaming Frog, save baseline. Post-migration: crawl again, diff. (4) Monitor Google Search Console for 30 days post-migration. (5) `next-sitemap` continues generating sitemap from all routes. |
| **Owner**       | Phase 4 (Website refactor) + Phase 5 (Migration)                                                                                                                                                                                                                                                                                                                                                                         |

### Risk 7: Locale Data Inconsistency

|                 |                                                                                                                                                                                                                                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | A page exists in EN and ES but not FR. The fallback chain (FR → EN) works, but the user sees English content with a French URL, which is confusing and potentially SEO-harmful (duplicate content in different locale paths).                                                                                                                                          |
| **Probability** | Medium                                                                                                                                                                                                                                                                                                                                                                 |
| **Impact**      | Medium — user confusion, potential SEO duplicate content penalty                                                                                                                                                                                                                                                                                                       |
| **Mitigation**  | (1) Dashboard's LocaleTabs component shows "Missing" badge for non-existent locales, prompting editors to create them. (2) When falling back to EN, the page includes `<link rel="canonical" href="/en/{slug}">` pointing to the English version — signals to Google this is the canonical. (3) `hreflang` tags list only published locale variants, not missing ones. |
| **Owner**       | Phase 3 (Dashboard UX) + Phase 4 (Website SEO)                                                                                                                                                                                                                                                                                                                         |

### Risk 8: Build Time Increase in Monorepo

|                 |                                                                                                                                                                                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | Moving from a single Next.js app to a Turborepo with 3 apps + 3 packages could significantly increase CI build times, especially if caching doesn't work correctly.                                                                                                                                                                                                       |
| **Probability** | Medium                                                                                                                                                                                                                                                                                                                                                                    |
| **Impact**      | Low — developer experience issue, not user-facing                                                                                                                                                                                                                                                                                                                         |
| **Mitigation**  | (1) Turborepo remote caching (Vercel or self-hosted) — unchanged packages skip rebuild. (2) CI pipeline runs `turbo build --filter=...[origin/main]` to only build changed packages. (3) puck-components builds in ~5 seconds (tsup is fast). (4) Dashboard builds in ~10 seconds (Vite). (5) NestJS builds in ~15 seconds. Only website build is slow (~60s) due to SSG. |
| **Owner**       | Phase 7 (DevOps)                                                                                                                                                                                                                                                                                                                                                          |

### Risk 9: Dashboard Editor Usability for Non-Technical Users

|                 |                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | The marketing team may find Puck's editor interface confusing or limiting compared to tools they're familiar with (WordPress, Squarespace). This could lead to low adoption or requests for features Puck doesn't support.                                                                                                                                                                               |
| **Probability** | Medium                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Impact**      | Medium — defeats the purpose of the CMS migration (self-service content editing)                                                                                                                                                                                                                                                                                                                         |
| **Mitigation**  | (1) Puck components have sensible defaults — editors modify text, not build layouts from scratch. (2) Pre-populate pages with existing content during migration — editors tweak, not create. (3) Write a 1-page "How to edit a page" guide with screenshots. (4) Conduct 2 training sessions with marketing before go-live. (5) Keep the initial component set simple (no deeply nested configurations). |
| **Owner**       | Phase 3 (Dashboard) + Phase 5 (Migration)                                                                                                                                                                                                                                                                                                                                                                |

### Risk 10: Database Migration Failures

|                 |                                                                                                                                                                                                                                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Description** | Prisma migrations could fail in production if the schema change is incompatible with existing data, if migrations are run out of order, or if a migration runs during active traffic.                                                                                                                                                                         |
| **Probability** | Low                                                                                                                                                                                                                                                                                                                                                           |
| **Impact**      | High — API completely down until migration is fixed                                                                                                                                                                                                                                                                                                           |
| **Mitigation**  | (1) All schema changes are additive during initial deployment (new tables only — no altering existing tables). (2) Prisma migrations run in CI staging first. (3) Production migrations run during a maintenance window (low traffic). (4) Every migration is reversible — maintain down migrations. (5) Database backups before every migration (`pg_dump`). |
| **Owner**       | Phase 1 (API) + Phase 7 (DevOps)                                                                                                                                                                                                                                                                                                                              |

---

_End of document. This architecture specification covers all 11 sections as requested. Each section is self-contained and can be extracted for the corresponding implementation phase._
