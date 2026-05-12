## Phase 1 — Backend API

### PROJECT: MyAllocator CMS — Backend API

This is the persistence layer for a Puck-based headless CMS. The dashboard
uses this API to save/load page editor data. The public website uses it to
fetch page layouts at build time (ISR).

---

### TECH STACK

```
- Runtime: Node.js 20+
- Framework: NestJS 10 + TypeScript (strict mode)
- ORM: Prisma v7.2.0 with PostgreSQL 18 (compatible)
- Auth: JWT RS256 (asymmetric) via @nestjs/jwt + PassportJS (passport-jwt, passport-local) + Argon2id for password hashing
- Validation: class-validator + class-transformer (global ValidationPipe with whitelist + forbidNonWhitelisted)
- Security: @nestjs/throttler (rate limiting), helmet, CORS via NestJS built-in
- Logging: NestJS built-in logger + custom LoggingInterceptor (structured request/response logs)
- Testing: Jest + Supertest (NestJS default test runner)
- Process manager: not needed (deployed to Railway)
```

---

### 1.1 Module Map

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

### 1.2 Complete Prisma Schema

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

```md
**Schema decisions:**

- **cuid() for IDs:** Sortable, collision-resistant, URL-safe. UUIDs are 36 chars and not sortable; auto-increment leaks count. CUIDs are the right middle ground.
- **@@unique([slug, locale]):** A page slug like "pricing" can exist once per locale — `pricing/en`, `pricing/es`, `pricing/fr` are separate rows. This is the simplest model for per-locale editing.
- **@@map() everywhere:** Postgres convention is `snake_case` for columns; Prisma convention is `camelCase` in code. The `@map` directives bridge this cleanly.
- **Json column for puckData:** Puck stores its entire page layout as a JSON tree. PostgreSQL's `jsonb` type is ideal — supports indexing, GIN queries if needed later, and avoids a separate document store.
- **PageVersion stores full puckData snapshots:** Not diffs. Diffs are smaller but require reconstruct-from-base logic that is fragile and slow. At ~50KB per page version and maybe 100 versions per page, storage is negligible (~5MB per page's full history). Full snapshots mean instant restore.
- **RefreshToken with tokenHash:** The raw refresh token is never stored. We store bcrypt/argon2 hash only. The `@@index([tokenHash])` enables O(1) lookup during refresh. `revokedAt` enables soft-revocation for audit trail.
- **Cascade deletes:** Deleting a User cascades to their RefreshTokens. Deleting a Page cascades to its PageVersions. This prevents orphaned records.
- **SEO fields on Page:** seoTitle, seoDescription, seoKeywords are separate from puckData so the website's getStaticProps can extract them without parsing the entire Puck JSON tree. These are set in the dashboard's page settings panel.
```

### 1.3 Auth & Permission System

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

### 1.4 Full API Contract

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

### 1.5 PROJECT STRUCTURE TO GENERATE

```
├── apps/
│ ├── api/ # NestJS 10 backend (modular monolith)
│ │ ├── src/
│ │ │ ├── main.ts # Bootstrap, CORS, Swagger, global pipes
│ │ │ ├── app.module.ts # Root module — imports all feature modules
│ │ │ ├── prisma/
│ │ │ │ ├── prisma.module.ts # Global Prisma module
│ │ │ │ ├── prisma.service.ts # PrismaClient lifecycle (onModuleInit/Destroy)
│ │ │ │ └── schema.prisma # Full Prisma schema
│ │ │ ├── auth/
│ │ │ │ ├── auth.module.ts # AuthModule: imports PassportModule, JwtModule
│ │ │ │ ├── auth.controller.ts # POST /auth/login, /auth/refresh, /auth/logout
│ │ │ │ ├── auth.service.ts # Login, token issuance, refresh rotation
│ │ │ │ ├── strategies/
│ │ │ │ │ ├── local.strategy.ts # Email+password validation
│ │ │ │ │ └── jwt.strategy.ts # JWT access token extraction & validation
│ │ │ │ ├── guards/
│ │ │ │ │ ├── jwt-auth.guard.ts # Applies JwtStrategy
│ │ │ │ │ └── roles.guard.ts # RBAC guard (checks platform + workspace role decorators)
│ │ │ │ ├── decorators/
│ │ │ │ │ ├── current-user.decorator.ts # Extracts user from req
│ │ │ │ │ └── roles.decorator.ts # @PlatformRoles(...) + @MembershipRoles(...)
│ │ │ │ └── dto/
│ │ │ │ ├── login.dto.ts # { email, password }
│ │ │ │ └── refresh.dto.ts # (empty — token comes from cookie)
│ │ │ ├── users/
│ │ │ │ ├── users.module.ts # UsersModule
│ │ │ │ ├── users.controller.ts # CRUD endpoints for user management
│ │ │ │ ├── users.service.ts # User CRUD, password hashing
│ │ │ │ └── dto/
│ │ │ │ ├── create-user.dto.ts
│ │ │ │ └── update-user.dto.ts
│ │ │ ├── pages/
│ │ │ │ ├── pages.module.ts # PagesModule
│ │ │ │ ├── pages.controller.ts # Full page CRUD + publish/unpublish
│ │ │ │ ├── pages.service.ts # Page CRUD, versioning, slug validation
│ │ │ │ ├── versions.controller.ts # Version history + restore
│ │ │ │ ├── versions.service.ts # Version listing and restore logic
│ │ │ │ └── dto/
│ │ │ │ ├── create-page.dto.ts
│ │ │ │ ├── update-page.dto.ts
│ │ │ │ └── page-query.dto.ts # Filtering (locale, published, etc.)
│ │ │ ├── revalidation/
│ │ │ │ ├── revalidation.module.ts # RevalidationModule
│ │ │ │ └── revalidation.service.ts # Calls Next.js revalidation webhook
│ │ │ ├── health/
│ │ │ │ ├── health.module.ts # HealthModule
│ │ │ │ └── health.controller.ts # GET /health (DB check, uptime)
│ │ │ └── common/
│ │ │ ├── filters/
│ │ │ │ └── http-exception.filter.ts # Standardized error response
│ │ │ ├── interceptors/
│ │ │ │ └── logging.interceptor.ts # Request/response logging
│ │ │ └── pipes/
│ │ │ └── validation.pipe.ts # Global class-validator pipe
│ │ ├── test/
│ │ │ ├── app.e2e-spec.ts
│ │ │ └── jest-e2e.json
│ │ ├── .env.example # API-specific env vars
│ │ ├── nest-cli.json
│ │ ├── tsconfig.json # Extends ../../tsconfig.base.json
│ │ ├── tsconfig.build.json
│ │ └── package.json
```

### 1.6 IMPLEMENTATION RULES

- Every function must have explicit TypeScript return types
- No any type — use unknown and narrow properly
- All async functions must have try/catch or propagate to error middleware
- Services contain ALL business logic — controllers only call services and send responses
- Log every request (pino-http) and every error (logger.error)
- The Prisma client must be a singleton (re-use across requests)
- Graceful shutdown: on SIGTERM, stop accepting connections, wait for in-flight requests, disconnect Prisma, then exit
- Write the complete test file for auth and pages — happy path + all error cases
- Generate every file completely.

### 1.7 Security Checklist

#### Authentication

- [ ] **Argon2id password hashing** — `apps/api/src/users/users.service.ts` — Mitigates: offline password cracking via GPU/ASIC. Parameters: memoryCost=65536 (64MB), timeCost=3, parallelism=4.
- [ ] **RS256 asymmetric JWT signing** — `apps/api/src/auth/auth.module.ts` (JwtModule config) — Mitigates: token forgery if public key leaks (public key can only verify, not sign).
- [ ] **15-minute access token expiry** — `apps/api/src/auth/auth.service.ts` — Mitigates: stolen access token has limited usability window.
- [ ] **Refresh token rotation on every use** — `apps/api/src/auth/auth.service.ts` — Mitigates: stolen refresh token detected on next legitimate use (reuse triggers full revocation).
- [ ] **Refresh token stored as argon2 hash** — `apps/api/src/auth/auth.service.ts` — Mitigates: database breach doesn't expose usable refresh tokens.
- [ ] **Account lockout after 5 failed attempts** — `apps/api/src/users/users.service.ts` — Mitigates: brute-force password guessing. Lockout duration: 15 minutes.

#### Authorization

- [ ] **Role-based access control (RBAC) via RolesGuard** — `apps/api/src/auth/guards/roles.guard.ts` — Mitigates: privilege escalation (editors can't publish/delete, only admins can).
- [ ] **@PlatformRoles() / @MembershipRoles() decorators on every protected endpoint** — All controllers — Mitigates: forgotten authorization checks.
- [ ] **PLATFORM_OWNER-only user management** — `apps/api/src/users/users.controller.ts` — Mitigates: unauthorized user creation or role elevation.
- [ ] **Cannot delete own account** — `apps/api/src/users/users.service.ts` — Mitigates: accidental self-lockout by the last platform owner.

#### Input Validation

- [ ] **Global ValidationPipe with whitelist + forbidNonWhitelisted** — `apps/api/src/main.ts` — Mitigates: mass assignment attacks (extra fields in request body silently stripped or rejected).
- [ ] **class-validator DTOs on every endpoint** — `apps/api/src/*/dto/*.ts` — Mitigates: injection via malformed input, type coercion attacks.
- [ ] **puckData size limit (5MB)** — `apps/api/src/pages/pages.service.ts` — Mitigates: denial of service via oversized JSON payloads that exhaust memory/storage.
- [ ] **Slug validation (kebab-case, 1-200 chars)** — `apps/api/src/pages/dto/create-page.dto.ts` — Mitigates: path traversal, URL injection.
- [ ] **Email format validation on user creation** — `apps/api/src/users/dto/create-user.dto.ts` — Mitigates: invalid data in DB.
- [ ] **Locale validation (enum: en, es, fr, de)** — `apps/api/src/pages/dto/page-query.dto.ts` — Mitigates: arbitrary locale injection.

#### Transport Security

- [ ] **HTTPS only in production** — Infrastructure/deployment config — Mitigates: man-in-the-middle token interception.
- [ ] **CORS whitelist (explicit origins, no wildcard)** — `apps/api/src/main.ts` via `CORS_ORIGINS` env var — Mitigates: cross-origin request forgery from unauthorized domains.
- [ ] **SameSite=Strict on refresh token cookie** — `apps/api/src/auth/auth.service.ts` — Mitigates: CSRF attacks (cookie not sent on cross-origin requests).
- [ ] **Secure flag on refresh token cookie** — `apps/api/src/auth/auth.service.ts` — Mitigates: cookie transmission over HTTP (only sent over HTTPS).

#### Token Security

- [ ] **Access token in response body only (not cookie)** — `apps/api/src/auth/auth.controller.ts` — Mitigates: CSRF (access token requires JavaScript to attach, so CSRF requests can't include it).
- [ ] **httpOnly flag on refresh token cookie** — `apps/api/src/auth/auth.service.ts` — Mitigates: XSS can't read the refresh token.
- [ ] **Constant-time hash comparison for refresh tokens** — `apps/api/src/auth/auth.service.ts` (argon2.verify is inherently constant-time) — Mitigates: timing attacks to guess token values.

#### Rate Limiting

- [ ] **Global rate limit: 200 req/15min per IP** — `apps/api/src/app.module.ts` (ThrottlerModule) — Mitigates: general API abuse, scraping.
- [ ] **Auth rate limit: 10 req/15min per IP** — `apps/api/src/auth/auth.controller.ts` (@Throttle override) — Mitigates: credential stuffing, brute-force attacks.
- [ ] **429 Too Many Requests response with Retry-After header** — `apps/api/src/common/filters/http-exception.filter.ts` — Mitigates: client confusion about rate limit behavior.

#### Logging & Monitoring

- [ ] **Structured request/response logging** — `apps/api/src/common/interceptors/logging.interceptor.ts` — Mitigates: inability to detect attacks in progress.
- [ ] **Failed login attempts logged with IP** — `apps/api/src/auth/auth.service.ts` — Mitigates: undetected brute-force campaigns.
- [ ] **Token reuse (theft detection) logged as CRITICAL** — `apps/api/src/auth/auth.service.ts` — Mitigates: stolen tokens going unnoticed.
- [ ] **No sensitive data in logs (no passwords, tokens, puckData)** — All services — Mitigates: log file compromise exposing secrets.
- [ ] **Health endpoint for uptime monitoring** — `apps/api/src/health/health.controller.ts` — Mitigates: undetected API downtime.

---
