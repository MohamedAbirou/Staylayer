-- CreateEnum
CREATE TYPE "TenantDeletionJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
-- NOTE: tenant_id is intentionally NOT a foreign key. The job row must survive
-- the tenant cascade so the dashboard can poll the job after the underlying
-- Tenant has been destroyed.
CREATE TABLE "tenant_deletion_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tenant_name" TEXT NOT NULL,
    "tenant_slug" TEXT NOT NULL,
    "status" "TenantDeletionJobStatus" NOT NULL DEFAULT 'QUEUED',
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

    CONSTRAINT "tenant_deletion_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_deletion_jobs_tenant_id_idx" ON "tenant_deletion_jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_deletion_jobs_status_idx" ON "tenant_deletion_jobs"("status");

-- CreateIndex
CREATE INDEX "tenant_deletion_jobs_tenant_id_created_at_idx" ON "tenant_deletion_jobs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "tenant_deletion_jobs_status_created_at_idx" ON "tenant_deletion_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "tenant_deletion_jobs_requested_by_user_id_idx" ON "tenant_deletion_jobs"("requested_by_user_id");
