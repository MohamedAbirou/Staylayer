-- CreateTable
CREATE TABLE "seo_crawl_page_link" (
    "id" TEXT NOT NULL,
    "crawl_job_id" TEXT NOT NULL,
    "source_result_id" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "target_pathname" TEXT,
    "target_result_id" TEXT,
    "anchor_text" TEXT,
    "rel" TEXT,
    "nofollow" BOOLEAN NOT NULL DEFAULT false,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_crawl_page_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seo_crawl_page_link_crawl_job_id_source_result_id_idx" ON "seo_crawl_page_link"("crawl_job_id", "source_result_id");

-- CreateIndex
CREATE INDEX "seo_crawl_page_link_crawl_job_id_target_result_id_idx" ON "seo_crawl_page_link"("crawl_job_id", "target_result_id");

-- CreateIndex
CREATE INDEX "seo_crawl_page_link_crawl_job_id_target_url_idx" ON "seo_crawl_page_link"("crawl_job_id", "target_url");

-- CreateIndex
CREATE INDEX "seo_crawl_page_link_crawl_job_id_is_internal_idx" ON "seo_crawl_page_link"("crawl_job_id", "is_internal");

-- AddForeignKey
ALTER TABLE "seo_crawl_page_link" ADD CONSTRAINT "seo_crawl_page_link_source_result_id_fkey" FOREIGN KEY ("source_result_id") REFERENCES "seo_crawl_url_result"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seo_crawl_page_link" ADD CONSTRAINT "seo_crawl_page_link_target_result_id_fkey" FOREIGN KEY ("target_result_id") REFERENCES "seo_crawl_url_result"("id") ON DELETE SET NULL ON UPDATE CASCADE;
