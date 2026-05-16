-- D.3: rename Page.seo_keywords -> target_keywords and introduce a new
-- internal_brief textarea. Pure rename + additive column; no data movement.
ALTER TABLE "pages" RENAME COLUMN "seo_keywords" TO "target_keywords";
ALTER TABLE "pages" ADD COLUMN "internal_brief" TEXT;
