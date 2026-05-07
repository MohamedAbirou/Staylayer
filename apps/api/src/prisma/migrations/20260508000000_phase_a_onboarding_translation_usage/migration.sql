-- Phase A: Onboarding milestones and translation usage tracking
--
-- 1. New Tables
--    - `tenant_onboarding` — one row per tenant, tracks onboarding lifecycle
--    - `tenant_onboarding_milestones` — individual completed milestones per tenant
--    - `translation_usage` — per-tenant translation character accounting
--
-- 2. New Enums
--    - `OnboardingMilestoneKey` — enumerated milestone ids
--
-- 3. Notes
--    - All new tables cascade with tenant removal where applicable
--    - Translation usage is aggregated by (tenantId, periodStart) for plan enforcement

CREATE TYPE "OnboardingMilestoneKey" AS ENUM (
    'SITE_CREATED',
    'FIRST_PAGE_PUBLISHED',
    'DEPLOYMENT_PROVISIONED',
    'DOMAIN_CONNECTED',
    'SEO_COMPLETED',
    'FORM_CONFIGURED',
    'TRANSLATION_CONFIGURED'
);

CREATE TABLE "tenant_onboarding" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "tenant_onboarding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_onboarding_tenant_id_key" ON "tenant_onboarding"("tenant_id");

CREATE TABLE "tenant_onboarding_milestones" (
    "id" TEXT NOT NULL,
    "onboarding_id" TEXT NOT NULL,
    "milestone" "OnboardingMilestoneKey" NOT NULL,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "tenant_onboarding_milestones_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_onboarding_milestones_onboarding_id_milestone_key"
    ON "tenant_onboarding_milestones"("onboarding_id", "milestone");
CREATE INDEX "tenant_onboarding_milestones_onboarding_id_idx"
    ON "tenant_onboarding_milestones"("onboarding_id");

ALTER TABLE "tenant_onboarding_milestones"
    ADD CONSTRAINT "tenant_onboarding_milestones_onboarding_id_fkey"
    FOREIGN KEY ("onboarding_id") REFERENCES "tenant_onboarding"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "translation_usage" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT,
    "characters" INTEGER NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'deepl',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "translation_usage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "translation_usage_tenant_id_period_start_idx"
    ON "translation_usage"("tenant_id", "period_start");
CREATE INDEX "translation_usage_site_id_period_start_idx"
    ON "translation_usage"("site_id", "period_start");
