-- C.2: Per-page JSON-LD overrides

ALTER TABLE "pages" ADD COLUMN "json_ld_override" JSONB;
