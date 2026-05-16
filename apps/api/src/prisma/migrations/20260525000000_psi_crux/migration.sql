-- Phase B.3: PageSpeed Insights + Chrome UX Report

CREATE TYPE "PsiStrategy" AS ENUM ('MOBILE', 'DESKTOP');
CREATE TYPE "PsiAuditStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "CruxFormFactor" AS ENUM ('PHONE', 'DESKTOP', 'TABLET', 'ALL');

CREATE TABLE "psi_audits" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "strategy" "PsiStrategy" NOT NULL,
  "status" "PsiAuditStatus" NOT NULL DEFAULT 'PENDING',
  "performance_score" DOUBLE PRECISION,
  "accessibility_score" DOUBLE PRECISION,
  "best_practices_score" DOUBLE PRECISION,
  "seo_score" DOUBLE PRECISION,
  "pwa_score" DOUBLE PRECISION,
  "lcp_ms" DOUBLE PRECISION,
  "fcp_ms" DOUBLE PRECISION,
  "cls" DOUBLE PRECISION,
  "tbt_ms" DOUBLE PRECISION,
  "inp_ms" DOUBLE PRECISION,
  "si_ms" DOUBLE PRECISION,
  "tti_ms" DOUBLE PRECISION,
  "lighthouse_version" TEXT,
  "user_agent" TEXT,
  "fetch_time" TIMESTAMP(3),
  "final_url" TEXT,
  "total_byte_weight" INTEGER,
  "num_requests" INTEGER,
  "lighthouse_result" JSONB,
  "loading_experience" JSONB,
  "origin_loading_experience" JSONB,
  "failure_reason" TEXT,
  "triggered_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),

  CONSTRAINT "psi_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "psi_audits_site_id_created_at_idx" ON "psi_audits"("site_id", "created_at");
CREATE INDEX "psi_audits_site_id_url_strategy_created_at_idx" ON "psi_audits"("site_id", "url", "strategy", "created_at");
CREATE INDEX "psi_audits_site_id_status_idx" ON "psi_audits"("site_id", "status");

ALTER TABLE "psi_audits"
  ADD CONSTRAINT "psi_audits_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "crux_records" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "record_key" TEXT NOT NULL,
  "form_factor" "CruxFormFactor" NOT NULL,
  "lcp_p75_ms" INTEGER,
  "fcp_p75_ms" INTEGER,
  "cls_p75" DOUBLE PRECISION,
  "inp_p75_ms" INTEGER,
  "ttfb_p75_ms" INTEGER,
  "fid_p75_ms" INTEGER,
  "record" JSONB NOT NULL,
  "collection_period_start" TIMESTAMP(3),
  "collection_period_end" TIMESTAMP(3),
  "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "crux_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crux_records_site_id_scope_record_key_form_factor_key" ON "crux_records"("site_id", "scope", "record_key", "form_factor");
CREATE INDEX "crux_records_site_id_fetched_at_idx" ON "crux_records"("site_id", "fetched_at");

ALTER TABLE "crux_records"
  ADD CONSTRAINT "crux_records_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
