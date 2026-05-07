/*
  # Phase C: Translation Jobs, Glossary, and Page Translation Metadata

  1. New Enums
    - `TranslationJobStatus` (QUEUED, PROCESSING, COMPLETED, FAILED, REVIEW_REQUIRED, APPROVED)

  2. New Tables
    - `translation_jobs`
      - `id` (cuid, primary key)
      - `tenant_id` (references tenants)
      - `site_id` (references sites)
      - `source_locale` (text) - the locale being translated from
      - `target_locale` (text) - the locale being translated to
      - `status` (TranslationJobStatus) - current job state
      - `total_pages` (int) - number of pages in this job
      - `completed_pages` (int) - pages successfully translated
      - `failed_pages` (int) - pages that failed translation
      - `characters_used` (int) - DeepL characters consumed
      - `overwrite` (boolean) - whether to overwrite existing translations
      - `auto_publish` (boolean) - whether to publish translated pages automatically
      - `page_ids` (jsonb) - optional list of specific page IDs to translate
      - `error` (text) - error message if job failed
      - `started_at` (timestamp) - when processing began
      - `completed_at` (timestamp) - when processing finished
      - `created_at` (timestamp)
      - `created_by` (text) - user who initiated the job

    - `translation_glossaries`
      - `id` (cuid, primary key)
      - `tenant_id` (references tenants)
      - `site_id` (optional, references sites)
      - `name` (text) - glossary name
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `translation_glossary_terms`
      - `id` (cuid, primary key)
      - `glossary_id` (references translation_glossaries)
      - `source_term` (text) - the original term
      - `target_term` (text) - the translated term
      - `source_locale` (text)
      - `target_locale` (text)
      - `case_sensitive` (boolean)
      - `created_at` (timestamp)

    - `page_translation_meta`
      - `id` (cuid, primary key)
      - `page_id` (references pages, unique)
      - `source_page_id` (references pages) - the source page this was translated from
      - `last_translated_at` (timestamp)
      - `source_content_hash` (text) - hash of source puck_data at translation time
      - `is_stale` (boolean) - whether source has changed since translation
      - `translation_job_id` (text) - last job that translated this page
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  3. Security
    - All tables reference tenant/site for workspace isolation
    - Cascading deletes maintain referential integrity

  4. Indexes
    - translation_jobs: (tenant_id, created_at), (site_id, created_at), (status)
    - translation_glossaries: (tenant_id), (site_id), unique(tenant_id, site_id, name)
    - translation_glossary_terms: (glossary_id), unique(glossary_id, source_term, source_locale, target_locale)
    - page_translation_meta: unique(page_id), (source_page_id), (is_stale)
*/

-- TranslationJobStatus enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TranslationJobStatus') THEN
    CREATE TYPE "TranslationJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REVIEW_REQUIRED', 'APPROVED');
  END IF;
END $$;

-- translation_jobs table
CREATE TABLE IF NOT EXISTS "translation_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "source_locale" TEXT NOT NULL,
    "target_locale" TEXT NOT NULL,
    "status" "TranslationJobStatus" NOT NULL DEFAULT 'QUEUED',
    "total_pages" INTEGER NOT NULL DEFAULT 0,
    "completed_pages" INTEGER NOT NULL DEFAULT 0,
    "failed_pages" INTEGER NOT NULL DEFAULT 0,
    "characters_used" INTEGER NOT NULL DEFAULT 0,
    "overwrite" BOOLEAN NOT NULL DEFAULT false,
    "auto_publish" BOOLEAN NOT NULL DEFAULT false,
    "page_ids" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "translation_jobs_pkey" PRIMARY KEY ("id")
);

-- translation_glossaries table
CREATE TABLE IF NOT EXISTS "translation_glossaries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_glossaries_pkey" PRIMARY KEY ("id")
);

-- translation_glossary_terms table
CREATE TABLE IF NOT EXISTS "translation_glossary_terms" (
    "id" TEXT NOT NULL,
    "glossary_id" TEXT NOT NULL,
    "source_term" TEXT NOT NULL,
    "target_term" TEXT NOT NULL,
    "source_locale" TEXT NOT NULL,
    "target_locale" TEXT NOT NULL,
    "case_sensitive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_glossary_terms_pkey" PRIMARY KEY ("id")
);

-- page_translation_meta table
CREATE TABLE IF NOT EXISTS "page_translation_meta" (
    "id" TEXT NOT NULL,
    "page_id" TEXT NOT NULL,
    "source_page_id" TEXT NOT NULL,
    "last_translated_at" TIMESTAMP(3),
    "source_content_hash" TEXT,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "translation_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_translation_meta_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "translation_glossaries_tenant_id_site_id_name_key"
    ON "translation_glossaries"("tenant_id", "site_id", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "translation_glossary_terms_glossary_id_source_term_source_key"
    ON "translation_glossary_terms"("glossary_id", "source_term", "source_locale", "target_locale");

CREATE UNIQUE INDEX IF NOT EXISTS "page_translation_meta_page_id_key"
    ON "page_translation_meta"("page_id");

-- Indexes
CREATE INDEX IF NOT EXISTS "translation_jobs_tenant_id_created_at_idx"
    ON "translation_jobs"("tenant_id", "created_at");

CREATE INDEX IF NOT EXISTS "translation_jobs_site_id_created_at_idx"
    ON "translation_jobs"("site_id", "created_at");

CREATE INDEX IF NOT EXISTS "translation_jobs_status_idx"
    ON "translation_jobs"("status");

CREATE INDEX IF NOT EXISTS "translation_glossaries_tenant_id_idx"
    ON "translation_glossaries"("tenant_id");

CREATE INDEX IF NOT EXISTS "translation_glossaries_site_id_idx"
    ON "translation_glossaries"("site_id");

CREATE INDEX IF NOT EXISTS "translation_glossary_terms_glossary_id_idx"
    ON "translation_glossary_terms"("glossary_id");

CREATE INDEX IF NOT EXISTS "page_translation_meta_source_page_id_idx"
    ON "page_translation_meta"("source_page_id");

CREATE INDEX IF NOT EXISTS "page_translation_meta_is_stale_idx"
    ON "page_translation_meta"("is_stale");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'translation_jobs_tenant_id_fkey'
  ) THEN
    ALTER TABLE "translation_jobs"
      ADD CONSTRAINT "translation_jobs_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'translation_jobs_site_id_fkey'
  ) THEN
    ALTER TABLE "translation_jobs"
      ADD CONSTRAINT "translation_jobs_site_id_fkey"
      FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'translation_glossaries_tenant_id_fkey'
  ) THEN
    ALTER TABLE "translation_glossaries"
      ADD CONSTRAINT "translation_glossaries_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'translation_glossaries_site_id_fkey'
  ) THEN
    ALTER TABLE "translation_glossaries"
      ADD CONSTRAINT "translation_glossaries_site_id_fkey"
      FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'translation_glossary_terms_glossary_id_fkey'
  ) THEN
    ALTER TABLE "translation_glossary_terms"
      ADD CONSTRAINT "translation_glossary_terms_glossary_id_fkey"
      FOREIGN KEY ("glossary_id") REFERENCES "translation_glossaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'page_translation_meta_page_id_fkey'
  ) THEN
    ALTER TABLE "page_translation_meta"
      ADD CONSTRAINT "page_translation_meta_page_id_fkey"
      FOREIGN KEY ("page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'page_translation_meta_source_page_id_fkey'
  ) THEN
    ALTER TABLE "page_translation_meta"
      ADD CONSTRAINT "page_translation_meta_source_page_id_fkey"
      FOREIGN KEY ("source_page_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
