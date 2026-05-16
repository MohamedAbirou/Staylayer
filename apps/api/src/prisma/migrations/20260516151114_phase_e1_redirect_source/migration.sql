-- CreateEnum
CREATE TYPE "BingWebmasterConnectionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'ERROR');

-- CreateEnum
CREATE TYPE "BingSyncJobType" AS ENUM ('DAILY', 'ON_DEMAND', 'SITEMAP_SUBMIT');

-- CreateEnum
CREATE TYPE "BingSyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BingCrawlIssueSeverity" AS ENUM ('ERROR', 'WARNING', 'INFO');

-- CreateTable
CREATE TABLE "bing_webmaster_connection" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "status" "BingWebmasterConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "property_url" TEXT NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "api_key_fingerprint" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "last_successful_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "consecutive_failures" INTEGER NOT NULL DEFAULT 0,
    "connected_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bing_webmaster_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bing_sync_job" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "type" "BingSyncJobType" NOT NULL,
    "status" "BingSyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "range_start" TIMESTAMP(3),
    "range_end" TIMESTAMP(3),
    "pages_synced" INTEGER NOT NULL DEFAULT 0,
    "queries_synced" INTEGER NOT NULL DEFAULT 0,
    "sitemaps_synced" INTEGER NOT NULL DEFAULT 0,
    "crawl_issues_synced" INTEGER NOT NULL DEFAULT 0,
    "failure_reason" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "triggered_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bing_sync_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bing_page_performance" (
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

    CONSTRAINT "bing_page_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bing_query_performance" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "query" TEXT NOT NULL,
    "page" TEXT NOT NULL DEFAULT '',
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "position" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bing_query_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bing_sitemap" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "sitemap_url" TEXT NOT NULL,
    "status" TEXT,
    "last_submitted" TIMESTAMP(3),
    "last_downloaded" TIMESTAMP(3),
    "errors" INTEGER NOT NULL DEFAULT 0,
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "url_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bing_sitemap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bing_crawl_issue" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "issue_code" TEXT NOT NULL,
    "category" TEXT,
    "severity" "BingCrawlIssueSeverity" NOT NULL DEFAULT 'WARNING',
    "http_code" INTEGER,
    "first_detected_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bing_crawl_issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bing_link_summary" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "total_links" INTEGER NOT NULL DEFAULT 0,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "top_domains" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bing_link_summary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bing_webmaster_connection_site_id_key" ON "bing_webmaster_connection"("site_id");

-- CreateIndex
CREATE INDEX "bing_webmaster_connection_status_idx" ON "bing_webmaster_connection"("status");

-- CreateIndex
CREATE INDEX "bing_webmaster_connection_last_synced_at_idx" ON "bing_webmaster_connection"("last_synced_at");

-- CreateIndex
CREATE INDEX "bing_sync_job_site_id_created_at_idx" ON "bing_sync_job"("site_id", "created_at");

-- CreateIndex
CREATE INDEX "bing_sync_job_status_idx" ON "bing_sync_job"("status");

-- CreateIndex
CREATE INDEX "bing_page_performance_site_id_date_idx" ON "bing_page_performance"("site_id", "date");

-- CreateIndex
CREATE INDEX "bing_page_performance_site_id_page_idx" ON "bing_page_performance"("site_id", "page");

-- CreateIndex
CREATE UNIQUE INDEX "bing_page_performance_site_id_date_page_key" ON "bing_page_performance"("site_id", "date", "page");

-- CreateIndex
CREATE INDEX "bing_query_performance_site_id_date_idx" ON "bing_query_performance"("site_id", "date");

-- CreateIndex
CREATE INDEX "bing_query_performance_site_id_query_idx" ON "bing_query_performance"("site_id", "query");

-- CreateIndex
CREATE UNIQUE INDEX "bing_query_performance_site_id_date_query_page_key" ON "bing_query_performance"("site_id", "date", "query", "page");

-- CreateIndex
CREATE INDEX "bing_sitemap_site_id_idx" ON "bing_sitemap"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "bing_sitemap_site_id_sitemap_url_key" ON "bing_sitemap"("site_id", "sitemap_url");

-- CreateIndex
CREATE INDEX "bing_crawl_issue_site_id_last_seen_at_idx" ON "bing_crawl_issue"("site_id", "last_seen_at");

-- CreateIndex
CREATE INDEX "bing_crawl_issue_site_id_severity_idx" ON "bing_crawl_issue"("site_id", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "bing_crawl_issue_site_id_url_issue_code_key" ON "bing_crawl_issue"("site_id", "url", "issue_code");

-- CreateIndex
CREATE UNIQUE INDEX "bing_link_summary_site_id_key" ON "bing_link_summary"("site_id");

-- AddForeignKey
ALTER TABLE "bing_webmaster_connection" ADD CONSTRAINT "bing_webmaster_connection_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bing_sync_job" ADD CONSTRAINT "bing_sync_job_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bing_page_performance" ADD CONSTRAINT "bing_page_performance_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bing_query_performance" ADD CONSTRAINT "bing_query_performance_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bing_sitemap" ADD CONSTRAINT "bing_sitemap_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bing_crawl_issue" ADD CONSTRAINT "bing_crawl_issue_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bing_link_summary" ADD CONSTRAINT "bing_link_summary_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
