-- CreateTable
CREATE TABLE "ai_citation_audits" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "entity_fact_count" INTEGER NOT NULL DEFAULT 0,
    "answer_ready_count" INTEGER NOT NULL DEFAULT 0,
    "freshness_days" INTEGER,
    "findings" JSONB NOT NULL,
    "signals" JSONB NOT NULL,
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_citation_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_citation_audits_site_id_slug_locale_key" ON "ai_citation_audits"("site_id", "slug", "locale");

-- CreateIndex
CREATE INDEX "ai_citation_audits_site_id_score_idx" ON "ai_citation_audits"("site_id", "score");

-- CreateIndex
CREATE INDEX "ai_citation_audits_site_id_analyzed_at_idx" ON "ai_citation_audits"("site_id", "analyzed_at");

-- AddForeignKey
ALTER TABLE "ai_citation_audits" ADD CONSTRAINT "ai_citation_audits_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
