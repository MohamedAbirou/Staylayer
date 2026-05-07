# Phase 11 Local Validation

## Purpose

This workflow validates the Phase 11 subscriber go-live, form studio, routing, and branded email features locally before a production push.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker Desktop with `docker compose`
- PostgreSQL available for the API app

## Seed Example Data

The seed now creates:

- two hospitality demo sites
- two published form definitions per site
- site-level branded email themes and templates
- routing rules with different email destinations

Run:

```bash
pnpm --filter @myallocator/api db:seed
```

## Start Local Support Services

Start Mailpit:

```bash
pnpm local:mailpit
```

Mailpit UI: `http://localhost:8025`

Start the webhook inspector in a second terminal:

```bash
pnpm local:webhooks
```

Webhook inspector UI: `http://localhost:8787`

Webhook capture endpoint: `http://localhost:8787/capture`

## Recommended Local Env

For local branded email preview without SMTP auth, set:

```env
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
INQUIRY_EMAIL_FROM=hello@local.myallocator.test
```

`SMTP_USER` and `SMTP_PASS` are optional for local sinks such as Mailpit.

For webhook validation, point a routing rule at:

```env
http://localhost:8787/capture
```

## Run The Apps

```bash
pnpm --filter @myallocator/api dev
pnpm --filter @myallocator/dashboard dev
pnpm --filter @myallocator/website dev
```

## Suggested Validation Sequence

1. Run Prisma generation or migrations if the schema changed.

```bash
pnpm --filter @myallocator/api db:generate
pnpm --filter @myallocator/api db:migrate:dev
```

2. Seed the demo tenants and sites.

```bash
pnpm --filter @myallocator/api db:seed
```

3. Open the dashboard and navigate to `/forms`.

4. Confirm the inbox, form studio, fallback routing, and branded email studio load for a seeded site.

5. Publish an edit to one of the seeded forms and confirm a new schema version appears.

6. Submit the live website form from the public site and confirm:
   - the submission appears in the inbox
   - the correct page slug and schema version are stored
   - the internal notification appears in Mailpit
   - the webhook payload appears in the webhook inspector when configured

7. Break config intentionally and confirm readiness warnings surface:
   - remove all email recipients and webhook URLs from active routes
   - disable the internal notification template
   - remove `SMTP_HOST` or `INQUIRY_EMAIL_FROM`
   - remove webhook signing secrets from active webhook routes

8. Run focused automated validation before merge.

```bash
pnpm --filter @myallocator/api type-check
pnpm --filter @myallocator/api test -- forms.service.spec.ts submission-operations.service.spec.ts public-submissions.controller.spec.ts
pnpm --filter @myallocator/dashboard type-check
```

## Shutdown

Stop Mailpit:

```bash
pnpm local:mailpit:down
```
