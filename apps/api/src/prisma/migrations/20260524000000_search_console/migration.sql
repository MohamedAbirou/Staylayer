-- CreateEnum
CREATE TYPE "SearchConsoleConnectionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'ERROR', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SearchConsoleSyncJobType" AS ENUM ('DAILY', 'ON_DEMAND', 'SITEMAP_SUBMIT', 'URL_INSPECTION');

-- CreateEnum
CREATE TYPE "SearchConsoleSyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "search_console_connection" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "status" "SearchConsoleConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "google_account_email" TEXT,
    "google_account_subject" TEXT,
    "property_url" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT NOT NULL,
    "access_token_cache" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "last_successful_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "connected_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_console_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_console_sync_job" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "type" "SearchConsoleSyncJobType" NOT NULL,
    "status" "SearchConsoleSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "range_start" TIMESTAMP(3),
    "range_end" TIMESTAMP(3),
    "pages_synced" INTEGER NOT NULL DEFAULT 0,
    "queries_synced" INTEGER NOT NULL DEFAULT 0,
    "sitemaps_synced" INTEGER NOT NULL DEFAULT 0,
    "inspections_run" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "triggered_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_console_sync_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_console_page_performance" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "page" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_console_page_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_console_query_performance" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "query" TEXT NOT NULL,
    "page" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_console_query_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_console_sitemap" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "sitemap_url" TEXT NOT NULL,
    "type" TEXT,
    "is_pending" BOOLEAN NOT NULL DEFAULT false,
    "is_sitemaps_index" BOOLEAN NOT NULL DEFAULT false,
    "last_submitted" TIMESTAMP(3),
    "last_downloaded" TIMESTAMP(3),
    "errors" INTEGER NOT NULL DEFAULT 0,
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "contents" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_console_sitemap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_console_url_inspection" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "verdict" TEXT,
    "coverage_state" TEXT,
    "indexing_state" TEXT,
    "robots_txt_state" TEXT,
    "page_fetch_state" TEXT,
    "last_crawl_time" TIMESTAMP(3),
    "google_canonical" TEXT,
    "user_canonical" TEXT,
    "mobile_usability" TEXT,
    "rich_results_items" INTEGER NOT NULL DEFAULT 0,
    "inspectionResult" JSONB NOT NULL,
    "last_inspected_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "search_console_url_inspection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_console_connection_site_id_key" ON "search_console_connection"("site_id");

-- CreateIndex
CREATE INDEX "search_console_connection_status_idx" ON "search_console_connection"("status");

-- CreateIndex
CREATE INDEX "search_console_connection_last_synced_at_idx" ON "search_console_connection"("last_synced_at");

-- CreateIndex
CREATE INDEX "search_console_sync_job_site_id_created_at_idx" ON "search_console_sync_job"("site_id", "created_at");

-- CreateIndex
CREATE INDEX "search_console_sync_job_status_idx" ON "search_console_sync_job"("status");

-- CreateIndex
CREATE INDEX "search_console_page_performance_site_id_date_idx" ON "search_console_page_performance"("site_id", "date");

-- CreateIndex
CREATE INDEX "search_console_page_performance_site_id_page_idx" ON "search_console_page_performance"("site_id", "page");

-- CreateIndex
CREATE UNIQUE INDEX "search_console_page_performance_site_id_date_page_key" ON "search_console_page_performance"("site_id", "date", "page");

-- CreateIndex
CREATE INDEX "search_console_query_performance_site_id_date_idx" ON "search_console_query_performance"("site_id", "date");

-- CreateIndex
CREATE INDEX "search_console_query_performance_site_id_query_idx" ON "search_console_query_performance"("site_id", "query");

-- CreateIndex
CREATE UNIQUE INDEX "search_console_query_performance_site_id_date_query_page_key" ON "search_console_query_performance"("site_id", "date", "query", "page");

-- CreateIndex
CREATE INDEX "search_console_sitemap_site_id_idx" ON "search_console_sitemap"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_console_sitemap_site_id_sitemap_url_key" ON "search_console_sitemap"("site_id", "sitemap_url");

-- CreateIndex
CREATE INDEX "search_console_url_inspection_site_id_last_inspected_at_idx" ON "search_console_url_inspection"("site_id", "last_inspected_at");

-- CreateIndex
CREATE UNIQUE INDEX "search_console_url_inspection_site_id_url_key" ON "search_console_url_inspection"("site_id", "url");

-- AddForeignKey
ALTER TABLE "search_console_connection" ADD CONSTRAINT "search_console_connection_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_console_sync_job" ADD CONSTRAINT "search_console_sync_job_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_console_page_performance" ADD CONSTRAINT "search_console_page_performance_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_console_query_performance" ADD CONSTRAINT "search_console_query_performance_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_console_sitemap" ADD CONSTRAINT "search_console_sitemap_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_console_url_inspection" ADD CONSTRAINT "search_console_url_inspection_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
