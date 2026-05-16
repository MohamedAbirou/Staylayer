-- CreateEnum
CREATE TYPE "SeoCrawlJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "SeoCrawlIssueSeverity" AS ENUM ('ERROR', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "SeoCrawlIssueCategory" AS ENUM ('META', 'CONTENT', 'LINKS', 'IMAGES', 'PERFORMANCE', 'INDEXABILITY', 'STRUCTURED_DATA', 'ACCESSIBILITY');

-- CreateTable
CREATE TABLE "seo_crawl_job" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "status" "SeoCrawlJobStatus" NOT NULL DEFAULT 'PENDING',
    "start_url" TEXT NOT NULL,
    "canonical_host" TEXT NOT NULL,
    "url_limit" INTEGER NOT NULL,
    "max_depth" INTEGER NOT NULL,
    "total_urls" INTEGER NOT NULL DEFAULT 0,
    "completed_urls" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "info_count" INTEGER NOT NULL DEFAULT 0,
    "broken_link_count" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER,
    "failure_reason" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_crawl_job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_crawl_url_result" (
    "id" TEXT NOT NULL,
    "crawl_job_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "status_code" INTEGER NOT NULL,
    "content_type" TEXT,
    "content_length" INTEGER,
    "response_time_ms" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT,
    "meta_description" TEXT,
    "canonical" TEXT,
    "h1_count" INTEGER NOT NULL DEFAULT 0,
    "h1_first" TEXT,
    "h2_count" INTEGER NOT NULL DEFAULT 0,
    "h3_count" INTEGER NOT NULL DEFAULT 0,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "image_count" INTEGER NOT NULL DEFAULT 0,
    "images_missing_alt" INTEGER NOT NULL DEFAULT 0,
    "internal_links" INTEGER NOT NULL DEFAULT 0,
    "external_links" INTEGER NOT NULL DEFAULT 0,
    "broken_links" INTEGER NOT NULL DEFAULT 0,
    "redirect_chain" JSONB NOT NULL DEFAULT '[]',
    "final_url" TEXT,
    "robots_header" TEXT,
    "indexable" BOOLEAN NOT NULL DEFAULT true,
    "noindex_reason" TEXT,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "fetch_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_crawl_url_result_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_crawl_issue" (
    "id" TEXT NOT NULL,
    "crawl_job_id" TEXT NOT NULL,
    "url_result_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "SeoCrawlIssueSeverity" NOT NULL,
    "category" "SeoCrawlIssueCategory" NOT NULL,
    "message" TEXT NOT NULL,
    "recommendation" TEXT,
    "context" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_crawl_issue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seo_crawl_job_site_id_created_at_idx" ON "seo_crawl_job"("site_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "seo_crawl_job_status_idx" ON "seo_crawl_job"("status");

-- CreateIndex
CREATE UNIQUE INDEX "seo_crawl_url_result_crawl_job_id_url_key" ON "seo_crawl_url_result"("crawl_job_id", "url");

-- CreateIndex
CREATE INDEX "seo_crawl_url_result_crawl_job_id_status_code_idx" ON "seo_crawl_url_result"("crawl_job_id", "status_code");

-- CreateIndex
CREATE INDEX "seo_crawl_url_result_crawl_job_id_error_count_idx" ON "seo_crawl_url_result"("crawl_job_id", "error_count" DESC);

-- CreateIndex
CREATE INDEX "seo_crawl_issue_crawl_job_id_severity_idx" ON "seo_crawl_issue"("crawl_job_id", "severity");

-- CreateIndex
CREATE INDEX "seo_crawl_issue_crawl_job_id_category_idx" ON "seo_crawl_issue"("crawl_job_id", "category");

-- CreateIndex
CREATE INDEX "seo_crawl_issue_crawl_job_id_code_idx" ON "seo_crawl_issue"("crawl_job_id", "code");

-- AddForeignKey
ALTER TABLE "seo_crawl_job" ADD CONSTRAINT "seo_crawl_job_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_crawl_url_result" ADD CONSTRAINT "seo_crawl_url_result_crawl_job_id_fkey" FOREIGN KEY ("crawl_job_id") REFERENCES "seo_crawl_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_crawl_issue" ADD CONSTRAINT "seo_crawl_issue_crawl_job_id_fkey" FOREIGN KEY ("crawl_job_id") REFERENCES "seo_crawl_job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_crawl_issue" ADD CONSTRAINT "seo_crawl_issue_url_result_id_fkey" FOREIGN KEY ("url_result_id") REFERENCES "seo_crawl_url_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;
