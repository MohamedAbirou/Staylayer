-- CreateEnum
CREATE TYPE "HreflangScanStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "HreflangIssueType" AS ENUM ('MISSING_LOCALE', 'ORPHAN_ALTERNATE', 'MISSING_X_DEFAULT', 'UNPUBLISHED_SIBLING', 'INVALID_LOCALE_CODE');

-- CreateEnum
CREATE TYPE "HreflangIssueSeverity" AS ENUM ('ERROR', 'WARNING', 'INFO');

-- CreateTable
CREATE TABLE "hreflang_scans" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "status" "HreflangScanStatus" NOT NULL DEFAULT 'PENDING',
    "total_slugs" INTEGER NOT NULL DEFAULT 0,
    "total_pages" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "warning_count" INTEGER NOT NULL DEFAULT 0,
    "info_count" INTEGER NOT NULL DEFAULT 0,
    "default_locale" TEXT NOT NULL,
    "active_locales" TEXT[],
    "failure_reason" TEXT,
    "triggered_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "hreflang_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hreflang_issues" (
    "id" TEXT NOT NULL,
    "scan_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "type" "HreflangIssueType" NOT NULL,
    "severity" "HreflangIssueSeverity" NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" TEXT,
    "page_id" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "dismissed_at" TIMESTAMP(3),
    "dismissed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hreflang_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hreflang_scans_site_id_created_at_idx" ON "hreflang_scans"("site_id", "created_at");

-- CreateIndex
CREATE INDEX "hreflang_scans_site_id_status_idx" ON "hreflang_scans"("site_id", "status");

-- CreateIndex
CREATE INDEX "hreflang_issues_scan_id_idx" ON "hreflang_issues"("scan_id");

-- CreateIndex
CREATE INDEX "hreflang_issues_site_id_type_idx" ON "hreflang_issues"("site_id", "type");

-- CreateIndex
CREATE INDEX "hreflang_issues_site_id_slug_idx" ON "hreflang_issues"("site_id", "slug");

-- AddForeignKey
ALTER TABLE "hreflang_scans" ADD CONSTRAINT "hreflang_scans_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hreflang_issues" ADD CONSTRAINT "hreflang_issues_scan_id_fkey" FOREIGN KEY ("scan_id") REFERENCES "hreflang_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hreflang_issues" ADD CONSTRAINT "hreflang_issues_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
