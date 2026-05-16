-- CreateEnum
CREATE TYPE "SeoAuditTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "SeoAuditTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SeoAuditTaskSource" AS ENUM ('ALERT', 'MANUAL');

-- CreateTable
CREATE TABLE "seo_audit_tasks" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "source_alert_id" TEXT,
    "source" "SeoAuditTaskSource" NOT NULL DEFAULT 'MANUAL',
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SeoAuditTaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SeoAuditTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignee_user_id" TEXT,
    "created_by_user_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_audit_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seo_audit_tasks_source_alert_id_key" ON "seo_audit_tasks"("source_alert_id");

-- CreateIndex
CREATE INDEX "seo_audit_tasks_site_id_status_idx" ON "seo_audit_tasks"("site_id", "status");

-- CreateIndex
CREATE INDEX "seo_audit_tasks_site_id_assignee_user_id_status_idx" ON "seo_audit_tasks"("site_id", "assignee_user_id", "status");

-- CreateIndex
CREATE INDEX "seo_audit_tasks_site_id_priority_status_idx" ON "seo_audit_tasks"("site_id", "priority", "status");

-- CreateIndex
CREATE INDEX "seo_audit_tasks_site_id_slug_locale_idx" ON "seo_audit_tasks"("site_id", "slug", "locale");

-- AddForeignKey
ALTER TABLE "seo_audit_tasks" ADD CONSTRAINT "seo_audit_tasks_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_audit_tasks" ADD CONSTRAINT "seo_audit_tasks_source_alert_id_fkey" FOREIGN KEY ("source_alert_id") REFERENCES "operational_alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_audit_tasks" ADD CONSTRAINT "seo_audit_tasks_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_audit_tasks" ADD CONSTRAINT "seo_audit_tasks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
