-- Phase A.1: Robots editor, sitemap controls, IndexNow auto-submission

-- AlterTable: site_settings — robots, sitemap, indexnow fields
ALTER TABLE "site_settings"
    ADD COLUMN "robots_custom_rules" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "robots_ai_crawler_policy" JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN "sitemap_excluded_paths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "sitemap_include_images" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "indexnow_key" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "indexnow_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateEnum
CREATE TYPE "SearchEngineSubmissionTarget" AS ENUM (
    'INDEXNOW_AUTO_PUBLISH',
    'INDEXNOW_AUTO_UNPUBLISH',
    'INDEXNOW_AUTO_DELETE',
    'INDEXNOW_AUTO_REDIRECT_CREATE',
    'INDEXNOW_AUTO_REDIRECT_REMOVE',
    'INDEXNOW_MANUAL'
);

CREATE TYPE "SearchEngineSubmissionStatus" AS ENUM (
    'PENDING',
    'SUCCESS',
    'FAILED',
    'SKIPPED'
);

-- CreateTable
CREATE TABLE "sitemap_submission_log" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "target" "SearchEngineSubmissionTarget" NOT NULL,
    "status" "SearchEngineSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "url_count" INTEGER NOT NULL DEFAULT 0,
    "response_status" INTEGER,
    "response_body" TEXT,
    "reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sitemap_submission_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sitemap_submission_log_site_id_created_at_idx"
    ON "sitemap_submission_log" ("site_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "sitemap_submission_log"
    ADD CONSTRAINT "sitemap_submission_log_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
