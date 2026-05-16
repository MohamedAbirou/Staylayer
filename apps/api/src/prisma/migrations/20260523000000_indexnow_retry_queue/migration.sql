-- AlterTable
ALTER TABLE "sitemap_submission_log"
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "last_attempt_at" TIMESTAMP(3),
  ADD COLUMN "next_attempt_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "sitemap_submission_log_status_next_attempt_at_idx"
  ON "sitemap_submission_log"("status", "next_attempt_at");
