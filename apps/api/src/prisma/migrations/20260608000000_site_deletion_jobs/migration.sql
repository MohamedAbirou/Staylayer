-- CreateEnum
CREATE TYPE "SiteDeletionJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "site_deletion_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "site_name" TEXT NOT NULL,
    "archived_slug" TEXT,
    "status" "SiteDeletionJobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "total_steps" INTEGER NOT NULL DEFAULT 0,
    "current_step" TEXT,
    "requested_by_user_id" TEXT,
    "acknowledgements" JSONB,
    "impact_snapshot" JSONB,
    "result_summary" JSONB,
    "error_code" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_deletion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_deletion_jobs_tenant_id_idx" ON "site_deletion_jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "site_deletion_jobs_status_idx" ON "site_deletion_jobs"("status");

-- CreateIndex
CREATE INDEX "site_deletion_jobs_tenant_id_created_at_idx" ON "site_deletion_jobs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "site_deletion_jobs_status_created_at_idx" ON "site_deletion_jobs"("status", "created_at");

-- AddForeignKey
ALTER TABLE "site_deletion_jobs" ADD CONSTRAINT "site_deletion_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
