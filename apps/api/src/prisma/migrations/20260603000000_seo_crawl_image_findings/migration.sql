-- Phase D.1 — Image SEO audit
--
-- Per-crawl, per-image structured findings produced by the SEO crawler.
-- One row per <img> encountered while crawling a page (capped per page in
-- the runner).  Lets the dashboard render an Images tab with aggregate
-- counts and per-page drill-downs without re-parsing HTML.

CREATE TYPE "ImageAltQuality" AS ENUM (
  'MISSING',
  'EMPTY',
  'FILENAME_LIKE',
  'TOO_SHORT',
  'TOO_LONG',
  'GOOD'
);

CREATE TABLE "seo_crawl_image_finding" (
    "id"             TEXT NOT NULL,
    "crawl_job_id"   TEXT NOT NULL,
    "url_result_id"  TEXT NOT NULL,
    "src"            TEXT NOT NULL,
    "filename"       TEXT,
    "alt"            TEXT,
    "has_alt"        BOOLEAN NOT NULL DEFAULT FALSE,
    "alt_quality"    "ImageAltQuality" NOT NULL,
    "width_attr"     INTEGER,
    "height_attr"    INTEGER,
    "loading_attr"   TEXT,
    "is_og_image"    BOOLEAN NOT NULL DEFAULT FALSE,
    "in_sitemap"     BOOLEAN NOT NULL DEFAULT FALSE,
    "above_fold"     BOOLEAN NOT NULL DEFAULT FALSE,
    "flags"          JSONB NOT NULL DEFAULT '[]',
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "seo_crawl_image_finding_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "seo_crawl_image_finding_crawl_job_id_idx"
  ON "seo_crawl_image_finding" ("crawl_job_id");
CREATE INDEX "seo_crawl_image_finding_crawl_job_id_alt_quality_idx"
  ON "seo_crawl_image_finding" ("crawl_job_id", "alt_quality");
CREATE INDEX "seo_crawl_image_finding_crawl_job_id_has_alt_idx"
  ON "seo_crawl_image_finding" ("crawl_job_id", "has_alt");
CREATE INDEX "seo_crawl_image_finding_url_result_id_idx"
  ON "seo_crawl_image_finding" ("url_result_id");

ALTER TABLE "seo_crawl_image_finding"
  ADD CONSTRAINT "seo_crawl_image_finding_crawl_job_id_fkey"
  FOREIGN KEY ("crawl_job_id") REFERENCES "seo_crawl_job"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "seo_crawl_image_finding"
  ADD CONSTRAINT "seo_crawl_image_finding_url_result_id_fkey"
  FOREIGN KEY ("url_result_id") REFERENCES "seo_crawl_url_result"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-page rollups stored on the existing url_result row so the Images tab
-- can paginate over results without joining the findings table for counts.
ALTER TABLE "seo_crawl_url_result"
  ADD COLUMN "image_findings_total"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "image_findings_missing" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "image_findings_issues"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "og_image"               TEXT;

-- Per-job rollups so the Images tab summary card is a single row read.
ALTER TABLE "seo_crawl_job"
  ADD COLUMN "image_total"          INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "image_missing_alt"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "image_filename_alt"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "image_oversized_og"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "image_undersized_og"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "image_missing_dims"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "image_not_lazy"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "image_missing_sitemap" INTEGER NOT NULL DEFAULT 0;
