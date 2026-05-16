-- Phase E.1: Redirect migration suite
-- Adds a `source` column to track origin (MANUAL/CSV_IMPORT/SLUG_CHANGE/PAGE_DELETE)
-- so the dashboard can distinguish manually-curated rules from auto-generated ones.

ALTER TABLE "redirects"
  ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';

CREATE INDEX IF NOT EXISTS "redirects_site_id_source_idx"
  ON "redirects"("site_id", "source");
