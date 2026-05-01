-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TenantMembershipRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'BILLING');

-- CreateEnum
CREATE TYPE "SiteStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SiteType" AS ENUM ('VACATION_RENTAL', 'BOUTIQUE_HOTEL', 'BNB', 'GLAMPING', 'GUEST_HOUSE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('PENDING', 'CREATING_PROJECT', 'SYNCING_ENV', 'DEPLOYING', 'LIVE', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'DNS_REQUIRED', 'VERIFYING', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "FormType" AS ENUM ('CONTACT', 'INQUIRY', 'AVAILABILITY_REQUEST', 'GROUP_STAY');

-- CreateEnum
CREATE TYPE "FormSubmissionStatus" AS ENUM ('RECEIVED', 'REVIEWED', 'SPAM', 'ARCHIVED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_memberships" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "TenantMembershipRole" NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "SiteStatus" NOT NULL DEFAULT 'DRAFT',
    "template_key" TEXT,
    "primary_locale" TEXT NOT NULL DEFAULT 'en',
    "enabled_locales" TEXT[] NOT NULL DEFAULT ARRAY['en'],
    "site_type" "SiteType" NOT NULL DEFAULT 'VACATION_RENTAL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_customer_id" TEXT,
    "provider_subscription_id" TEXT,
    "plan_key" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "limits_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "provider_project_id" TEXT,
    "provider_deploy_id" TEXT,
    "url" TEXT,
    "metadata" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_submissions" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "form_type" "FormType" NOT NULL,
    "page_slug" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "payload" JSONB NOT NULL,
    "spam_score" DOUBLE PRECISION,
    "status" "FormSubmissionStatus" NOT NULL DEFAULT 'RECEIVED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT,
    "target_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "pages" ADD COLUMN "site_id" TEXT;

-- AlterTable
ALTER TABLE "site_settings"
    ADD COLUMN "site_id" TEXT,
    ADD COLUMN "site_subtitle" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "public_phone" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "whatsapp_url" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "address" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "region" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "primary_cta_label" TEXT NOT NULL DEFAULT 'Send inquiry',
    ADD COLUMN "default_inquiry_routing_email" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "site_settings" ALTER COLUMN "id" DROP DEFAULT;

-- Bootstrap tenant and site for existing single-tenant content.
INSERT INTO "tenants" ("id", "slug", "name", "status", "created_at", "updated_at")
VALUES (
    'bootstrap_tenant',
    'bootstrap-tenant',
    'Bootstrap Tenant',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

INSERT INTO "sites" (
    "id",
    "tenant_id",
    "name",
    "slug",
    "status",
    "template_key",
    "primary_locale",
    "enabled_locales",
    "site_type",
    "created_at",
    "updated_at"
)
VALUES (
    'bootstrap_site',
    'bootstrap_tenant',
    COALESCE(
        (SELECT NULLIF("site_name", '') FROM "site_settings" ORDER BY "updated_at" DESC LIMIT 1),
        'Bootstrap Site'
    ),
    'bootstrap-site',
    'ACTIVE',
    NULL,
    COALESCE(
        (SELECT "default_locale" FROM "site_settings" ORDER BY "updated_at" DESC LIMIT 1),
        'en'
    ),
    COALESCE(
        (SELECT "active_locales" FROM "site_settings" ORDER BY "updated_at" DESC LIMIT 1),
        ARRAY['en']::TEXT[]
    ),
    'VACATION_RENTAL',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

UPDATE "pages"
SET "site_id" = 'bootstrap_site'
WHERE "site_id" IS NULL;

INSERT INTO "site_settings" ("id", "site_id", "updated_at")
SELECT 'default', 'bootstrap_site', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "site_settings");

UPDATE "site_settings"
SET "site_id" = 'bootstrap_site'
WHERE "site_id" IS NULL;

INSERT INTO "tenant_memberships" (
    "id",
    "tenant_id",
    "user_id",
    "role",
    "is_default",
    "created_at"
)
SELECT
    md5('bootstrap-membership:' || "id"),
    'bootstrap_tenant',
    "id",
    CASE
        WHEN "role" = 'SUPER_ADMIN' THEN 'OWNER'::"TenantMembershipRole"
        WHEN "role" = 'ADMIN' THEN 'ADMIN'::"TenantMembershipRole"
        ELSE 'EDITOR'::"TenantMembershipRole"
    END,
    true,
    CURRENT_TIMESTAMP
FROM "users";

-- Ownership columns are mandatory after bootstrap backfill.
ALTER TABLE "pages" ALTER COLUMN "site_id" SET NOT NULL;
ALTER TABLE "site_settings" ALTER COLUMN "site_id" SET NOT NULL;

-- Drop old single-tenant page indexes.
DROP INDEX "pages_slug_locale_key";
DROP INDEX "pages_slug_idx";
DROP INDEX "pages_locale_idx";
DROP INDEX "pages_published_idx";
DROP INDEX "pages_published_locale_idx";
DROP INDEX "pages_deleted_at_idx";

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_memberships_tenant_id_user_id_key" ON "tenant_memberships"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "tenant_memberships_user_id_idx" ON "tenant_memberships"("user_id");

-- CreateIndex
CREATE INDEX "tenant_memberships_tenant_id_role_idx" ON "tenant_memberships"("tenant_id", "role");

-- CreateIndex
CREATE INDEX "tenant_memberships_user_id_is_default_idx" ON "tenant_memberships"("user_id", "is_default");

-- CreateIndex
CREATE UNIQUE INDEX "sites_tenant_id_slug_key" ON "sites"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "sites_tenant_id_idx" ON "sites"("tenant_id");

-- CreateIndex
CREATE INDEX "sites_status_idx" ON "sites"("status");

-- CreateIndex
CREATE INDEX "sites_tenant_id_status_idx" ON "sites"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "site_settings_site_id_key" ON "site_settings"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_subscription_id_key" ON "subscriptions"("provider_subscription_id");

-- CreateIndex
CREATE INDEX "subscriptions_tenant_id_idx" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "deployments_site_id_idx" ON "deployments"("site_id");

-- CreateIndex
CREATE INDEX "deployments_site_id_status_idx" ON "deployments"("site_id", "status");

-- CreateIndex
CREATE INDEX "deployments_site_id_created_at_idx" ON "deployments"("site_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "domains_host_key" ON "domains"("host");

-- CreateIndex
CREATE INDEX "domains_site_id_idx" ON "domains"("site_id");

-- CreateIndex
CREATE INDEX "domains_site_id_status_idx" ON "domains"("site_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pages_site_id_slug_locale_key" ON "pages"("site_id", "slug", "locale");

-- CreateIndex
CREATE INDEX "pages_site_id_idx" ON "pages"("site_id");

-- CreateIndex
CREATE INDEX "pages_site_id_slug_idx" ON "pages"("site_id", "slug");

-- CreateIndex
CREATE INDEX "pages_site_id_locale_idx" ON "pages"("site_id", "locale");

-- CreateIndex
CREATE INDEX "pages_site_id_published_idx" ON "pages"("site_id", "published");

-- CreateIndex
CREATE INDEX "pages_site_id_published_locale_idx" ON "pages"("site_id", "published", "locale");

-- CreateIndex
CREATE INDEX "pages_site_id_deleted_at_idx" ON "pages"("site_id", "deleted_at");

-- CreateIndex
CREATE INDEX "form_submissions_site_id_idx" ON "form_submissions"("site_id");

-- CreateIndex
CREATE INDEX "form_submissions_site_id_form_type_idx" ON "form_submissions"("site_id", "form_type");

-- CreateIndex
CREATE INDEX "form_submissions_site_id_status_idx" ON "form_submissions"("site_id", "status");

-- CreateIndex
CREATE INDEX "form_submissions_site_id_created_at_idx" ON "form_submissions"("site_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_site_id_created_at_idx" ON "audit_logs"("site_id", "created_at");

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;