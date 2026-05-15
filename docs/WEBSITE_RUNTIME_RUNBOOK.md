# Website Runtime Operations Runbook

Phase 13 ships a **single shared Next.js runtime** (`apps/website`) that serves
every customer site from one Vercel project. Publishing a site is therefore a
**database write + targeted cache invalidation** — not a deployment. This
runbook documents the operational surface: required environment variables, the
revalidation flow, the snapshot-based content rollback playbook, and the
end-to-end SEO / analytics / inquiry contract.

---

## 1. Environment variables

### 1.1 API (`apps/api/.env`)

| Variable                                                                                     | Purpose                                                                                                                        |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                                               | Postgres connection string (Prisma).                                                                                           |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY`                                                         | RS256 key pair for access tokens.                                                                                              |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN`                                           | Token lifetimes.                                                                                                               |
| `REFRESH_TOKEN_SECRET`                                                                       | HMAC secret for refresh-token rotation.                                                                                        |
| `CORS_ORIGINS`                                                                               | Comma-separated browser origins allowed to call the API.                                                                       |
| `PORT`                                                                                       | API port (default `4000`).                                                                                                     |
| `THROTTLE_TTL` / `THROTTLE_LIMIT`                                                            | Global rate-limit window/limit.                                                                                                |
| `WEBSITE_RUNTIME_SECRET`                                                                     | **Required.** Shared secret the API uses to authorize requests from the website runtime (`x-website-runtime-secret` header).   |
| `WEBSITE_APP_ORIGIN`                                                                         | URL of the shared website runtime (e.g. `https://www.staylayer.com`). Used as the target of revalidation calls during publish. |
| `REVALIDATE_SECRET`                                                                          | Optional legacy alias accepted by the website's `/api/revalidate` route. Prefer `WEBSITE_RUNTIME_SECRET`.                      |
| `PLATFORM_ROOT_DOMAIN`                                                                       | Apex root used to build subdomain hosts (e.g. `staylayer.com`).                                                                |
| `DEPLOYMENTS_*`                                                                              | Phase-07 dedicated-site provisioning. **Optional** in shared-runtime mode.                                                     |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `INQUIRY_EMAIL_FROM` | Outbound mail transport for inquiry deliveries. Use Mailpit locally (`127.0.0.1:1025`).                                        |
| `FORM_DELIVERY_POLL_INTERVAL_MS`                                                             | Inquiry-delivery worker poll interval. Defaults to 20 s.                                                                       |
| `DOMAIN_VERIFICATION_ENABLED`                                                                | Set `false` only for local DNS-less testing.                                                                                   |

### 1.2 Website (`apps/website/.env.local`)

| Variable                       | Purpose                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `API_URL` / `API_INTERNAL_URL` | Base URL of the API. `API_INTERNAL_URL` is preferred when the runtime is co-located with the API and can avoid the public edge. |
| `WEBSITE_RUNTIME_SECRET`       | **Required.** Must match the API value. Sent on every public-runtime call.                                                      |
| `REVALIDATE_SECRET`            | Optional legacy alias accepted by `app/api/revalidate/route.js`. Prefer `WEBSITE_RUNTIME_SECRET`.                              |
| `NEXT_PUBLIC_*`                | Anything safe to expose to the browser (none required by the runtime today).                                                    |

### 1.3 Dashboard (`apps/dashboard/.env.local`)

| Variable       | Purpose                       |
| -------------- | ----------------------------- |
| `VITE_API_URL` | API base URL used by the SPA. |

---

## 2. Publish flow (shared-runtime)

```
Operator clicks Publish
        │
        ▼
POST /sites/:id/deployments        ← API
        │
        ├─ writes Deployment(status=DEPLOYING)
        ├─ computes hosts (apex/www/subdomain)
        ├─ POST  $WEBSITE_APP_ORIGIN/api/revalidate
        │       header: x-website-runtime-secret = $WEBSITE_RUNTIME_SECRET
        │       body:   { siteId, hosts, paths }
        │
        ├─ on success → captureSnapshot(siteId, {deploymentId})
        │   (writes SitePublishedRevision row N)
        │
        └─ updates Deployment to LIVE
             metadata.publishedRevision = N
             metadata.publishedAt       = ISO timestamp
```

The website's `/api/revalidate` route calls `revalidateTag` for `site:<id>`,
`host:<hostname>`, `page:<hostname>:<path>`, and `routes:<hostname>` so the next request
re-fetches the now-current payload from the API.

If revalidation fails, no snapshot is captured and the deployment is marked
FAILED — preserving the linear `publishedRevision` history.

---

## 3. Rollback flow (shared-runtime)

```
Operator clicks "Restore rev N"
        │
        ▼
POST /sites/:id/deployments/:depId/rollback
        │
        ├─ guard: no in-flight DEPLOYING/PROMOTING deployment
        ├─ resolves snapshot via metadata.publishedRevision
        │   fallback: SitePublishedRevision.deploymentId
        │   throws ROLLBACK_TARGET_HAS_NO_SNAPSHOT if neither present
        │
        ├─ restoreToRevision()                            ← transactional
        │   • unpublish pages not in snapshot (preserve drafts)
        │   • upsert pages keyed on (siteId, slug, locale)
        │   • upsert SiteSettings field-by-field
        │   • write a fresh snapshot rolledBackFrom=N
        │
        ├─ POST $WEBSITE_APP_ORIGIN/api/revalidate
        │   (same payload as publish)
        │
        └─ Deployment → LIVE with new publishedRevision
```

The dashboard's Deployments page renders **Rev N badges** on each row and a
**Restore rev N** button (with a "Restore content to this revision?" confirm
dialog) whenever a row has both `sharedRuntime: true` and `publishedRevision`
metadata.

### When rollback is **not** possible

| Condition                   | Symptom                                              | Recovery                                                               |
| --------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Snapshot row missing        | API returns `ROLLBACK_TARGET_HAS_NO_SNAPSHOT`        | Publish the desired state again to create a new revision.              |
| In-flight deployment        | API returns `DEPLOYMENT_IN_PROGRESS`                 | Wait for the in-flight deployment to settle or cancel it.              |
| Revalidation upstream fails | Deployment row updated to FAILED; database untouched | Investigate `WEBSITE_APP_ORIGIN` / `WEBSITE_RUNTIME_SECRET`; retry. |

---

## 4. SEO contract (Phase F)

Each public-runtime page payload now exposes:

```jsonc
{
  "site": {
    "verification": { "googleSiteVerification": "…" },
    "social": {
      "twitterHandle": "@handle",
      "facebookUrl": "…",
      "linkedinUrl": "…",
    },
    "analytics": {
      "gaTrackingId": "G-…",
      "gtmContainerId": "GTM-…",
      "clarityId": "…",
    },
    "contact": { "supportEmail": "…" },
  },
  "page": {
    "seo": {
      "title": "…",
      "description": "…",
      "keywords": ["…", "…"], // parsed from comma-separated seoKeywords
      "canonicalUrl": "…", // honors per-page seoCanonical override
      "ogImage": "…",
      "noindex": false,
    },
  },
}
```

The website's `app/[[...slug]]/page.jsx` `generateMetadata` consumes this and
emits the full marketer-grade head:

- `metadataBase`, `alternates.canonical`, `alternates.languages` (hreflang)
- Full `openGraph` (type=website, siteName, locale, alternateLocale, images)
- Twitter Card (`summary_large_image` + handle in `site`/`creator`)
- `verification.google` for Search Console
- `robots` block with explicit `googleBot` directives
- `keywords`, `icons` (icon/shortcut/apple)

The sitemap (`app/sitemap.js`) emits `alternates.languages` per route so each
locale is discoverable as a hreflang alternate.

### Settings DTO validation

`UpdateSettingsDto` enforces format on save (empty string still clears):

| Field                                         | Regex                               |
| --------------------------------------------- | ----------------------------------- |
| `gaTrackingId`                                | `^(G\|UA\|AW\|DC)-[A-Z0-9-]{4,32}$` |
| `gtmContainerId`                              | `^GTM-[A-Z0-9]{4,20}$`              |
| `clarityId`                                   | `^[a-z0-9]{6,20}$`                  |
| `googleSiteVerify`                            | `^[A-Za-z0-9_-]{20,100}$`           |
| `twitterHandle`                               | `^@?[A-Za-z0-9_]{1,15}$`            |
| `facebookUrl` / `linkedinUrl`                 | absolute `http(s)://` URL           |
| `inquiryWebhookUrl`                           | absolute `http(s)://` URL           |
| `defaultInquiryRoutingEmail` / `supportEmail` | RFC-valid email                     |

---

## 5. Inquiry / forms contract

Public submission path:

```
Visitor submits form → POST /api/forms/submit (Next.js route)
                       ↓ resolves siteId via host resolution
                       ↓ proxies to API /public/submissions
                                          ↓ rate-limited 5/minute per IP
                                          ↓ billing.assertCanAcceptInquiry()
                                          ↓ persists FormSubmission
                                          ↓ queueSubmissionDelivery()

Background worker (SubmissionOperationsService)
   • renders FormDelivery rows for email + webhook channels
   • email   → SMTP (nodemailer)            with exponential retries up to
                                              FORM_DELIVERY_MAX_ATTEMPTS (5)
   • webhook → POST with HMAC-SHA256 sig    in x-staylayer-signature
                                              using inquiryWebhookSecret
   • on persistent failure → OperationalAlert (severity HIGH) for the workspace
```

Settings that drive delivery:

| Setting                      | Effect                                                 |
| ---------------------------- | ------------------------------------------------------ |
| `defaultInquiryRoutingEmail` | Fallback inbox when a routing rule has no recipient.   |
| `inquiryWebhookUrl`          | Optional outbound webhook URL.                         |
| `inquiryWebhookSecret`       | HMAC secret; required when `inquiryWebhookUrl` is set. |
| `supportEmail`               | Used as the Reply-To header on outbound emails.        |

---

## 6. Local validation checklist

1. `pnpm --filter @staylayer/api exec prisma migrate dev`
2. `pnpm --filter @staylayer/api exec ts-node src/prisma/seed.ts`
3. Export `WEBSITE_RUNTIME_SECRET` in both API and website `.env` files.
4. Start API (`pnpm --filter @staylayer/api dev`) on `:4000`.
5. Start dashboard (`pnpm --filter @staylayer/dashboard dev`) on `:4174`.
6. Start website (`pnpm --filter @staylayer/website dev`) on `:3000`.
7. Run `pnpm test:e2e` — the Playwright suite (including the new
   `website-runtime.spec.ts`) must be green.

---

## 7. Troubleshooting

| Symptom                                    | Likely cause                                                   | Fix                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Website renders empty / 404 for known host | Host not yet provisioned or `WEBSITE_RUNTIME_SECRET` mismatch. | Check `/public/runtime/resolve-host` with the secret.                                     |
| `INVALID_RUNTIME_SECRET` from API          | Secrets out of sync.                                           | Re-deploy with matching `WEBSITE_RUNTIME_SECRET` on API + website.                        |
| `ROLLBACK_TARGET_HAS_NO_SNAPSHOT`          | Target deployment predates Phase 13 (no snapshot row).         | Publish the site once to create a baseline snapshot, then roll back to a future revision. |
| `BILLING_INQUIRY_LIMIT_REACHED`            | Plan inquiry cap hit.                                          | Upgrade plan or clear monthly quota.                                                      |
| Webhook fails repeatedly                   | Bad URL/TLS or wrong secret.                                   | Re-save settings; inspect `OperationalAlert` row of type `WEBHOOK_DELIVERY_FAILED`.       |
