-- AlterEnum
ALTER TYPE "OperationalAlertType" ADD VALUE 'SEO_AUDIT_REGRESSION';
ALTER TYPE "OperationalAlertType" ADD VALUE 'SEO_AUDIT_CRITICAL';

-- CreateEnum
CREATE TYPE "SeoAuditScheduleCadence" AS ENUM ('OFF', 'DAILY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "SeoAuditRunKind" AS ENUM ('SCHEDULED', 'MANUAL');

-- CreateEnum
CREATE TYPE "SeoAuditRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "seo_audit_schedules" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "cadence" "SeoAuditScheduleCadence" NOT NULL DEFAULT 'WEEKLY',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "hour_utc" INTEGER NOT NULL DEFAULT 3,
    "day_of_week" INTEGER,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_audit_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seo_audit_schedules_site_id_key" ON "seo_audit_schedules"("site_id");

-- CreateIndex
CREATE INDEX "seo_audit_schedules_enabled_next_run_at_idx" ON "seo_audit_schedules"("enabled", "next_run_at");

-- CreateTable
CREATE TABLE "seo_audit_runs" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "kind" "SeoAuditRunKind" NOT NULL DEFAULT 'SCHEDULED',
    "status" "SeoAuditRunStatus" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "pages_audited" INTEGER NOT NULL DEFAULT 0,
    "alerts_created" INTEGER NOT NULL DEFAULT 0,
    "average_score" INTEGER,
    "error" TEXT,
    "triggered_by" TEXT,

    CONSTRAINT "seo_audit_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seo_audit_runs_site_id_started_at_idx" ON "seo_audit_runs"("site_id", "started_at");

-- CreateIndex
CREATE INDEX "seo_audit_runs_status_idx" ON "seo_audit_runs"("status");

-- CreateTable
CREATE TABLE "seo_audit_snapshots" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "entity_fact_count" INTEGER NOT NULL DEFAULT 0,
    "answer_ready_count" INTEGER NOT NULL DEFAULT 0,
    "findings_count" INTEGER NOT NULL DEFAULT 0,
    "allows_citation" BOOLEAN NOT NULL DEFAULT true,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_audit_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seo_audit_snapshots_site_id_slug_locale_recorded_at_idx" ON "seo_audit_snapshots"("site_id", "slug", "locale", "recorded_at");

-- CreateIndex
CREATE INDEX "seo_audit_snapshots_run_id_idx" ON "seo_audit_snapshots"("run_id");

-- AddForeignKey
ALTER TABLE "seo_audit_schedules" ADD CONSTRAINT "seo_audit_schedules_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_audit_runs" ADD CONSTRAINT "seo_audit_runs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_audit_snapshots" ADD CONSTRAINT "seo_audit_snapshots_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "seo_audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_audit_snapshots" ADD CONSTRAINT "seo_audit_snapshots_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
