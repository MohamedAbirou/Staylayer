-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EDITOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EDITOR',
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "title" TEXT NOT NULL,
    "puck_data" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "seo_keywords" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_versions" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "puck_data" JSONB NOT NULL,
    "saved_by" TEXT NOT NULL,
    "note" TEXT,
    "saved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Site-wide CMS settings (singleton row, id = 'default')
CREATE TABLE "site_settings" (
    "id"                      TEXT NOT NULL     DEFAULT 'default',
    "site_name"               TEXT NOT NULL     DEFAULT 'MyAllocator CMS',
    "support_email"           TEXT NOT NULL     DEFAULT '',
    "logo_url"                TEXT NOT NULL     DEFAULT '',
    "favicon_url"             TEXT NOT NULL     DEFAULT '',
    "seo_title_template"      TEXT NOT NULL     DEFAULT '%s | MyAllocator',
    "seo_default_desc"        TEXT NOT NULL     DEFAULT '',
    "seo_og_image"            TEXT NOT NULL     DEFAULT '',
    "seo_indexing_enabled"    BOOLEAN NOT NULL  DEFAULT true,
    "google_site_verify"      TEXT NOT NULL     DEFAULT '',
    "ga_tracking_id"          TEXT NOT NULL     DEFAULT '',
    "gtm_container_id"        TEXT NOT NULL     DEFAULT '',
    "twitter_handle"          TEXT NOT NULL     DEFAULT '',
    "linkedin_url"            TEXT NOT NULL     DEFAULT '',
    "facebook_url"            TEXT NOT NULL     DEFAULT '',
    "default_locale"          TEXT NOT NULL     DEFAULT 'en',
    "active_locales"          TEXT[]            DEFAULT ARRAY['en','es','fr','de'],
    "updated_at"              TIMESTAMP(3) NOT NULL,
    "updated_by"              TEXT,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "pages_slug_idx" ON "pages"("slug");

-- CreateIndex
CREATE INDEX "pages_locale_idx" ON "pages"("locale");

-- CreateIndex
CREATE INDEX "pages_published_idx" ON "pages"("published");

-- CreateIndex
CREATE INDEX "pages_published_locale_idx" ON "pages"("published", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_locale_key" ON "pages"("slug", "locale");

-- CreateIndex
CREATE INDEX "page_versions_page_id_idx" ON "page_versions"("page_id");

-- CreateIndex
CREATE INDEX "page_versions_page_id_saved_at_idx" ON "page_versions"("page_id", "saved_at");

-- AddForeignKey
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add soft-delete column to pages
ALTER TABLE "pages" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "pages_deleted_at_idx" ON "pages"("deleted_at");