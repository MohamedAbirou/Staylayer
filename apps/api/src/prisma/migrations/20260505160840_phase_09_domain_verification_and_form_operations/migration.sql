-- CreateEnum
CREATE TYPE "FormDeliveryChannel" AS ENUM ('EMAIL', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "FormDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "OperationalAlertType" AS ENUM ('DOMAIN_FAILURE', 'FORM_DELIVERY_FAILURE', 'SUBMISSION_SPIKE');

-- CreateEnum
CREATE TYPE "OperationalAlertSeverity" AS ENUM ('WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OperationalAlertStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterTable
ALTER TABLE "domains" ADD COLUMN     "last_checked_at" TIMESTAMP(3),
ADD COLUMN     "last_error" TEXT,
ADD COLUMN     "verification_details" JSONB,
ADD COLUMN     "verification_requested_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "inquiry_webhook_secret" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "inquiry_webhook_url" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "form_deliveries" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "channel" "FormDeliveryChannel" NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "FormDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "last_attempt_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "response_code" INTEGER,
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_alerts" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "type" "OperationalAlertType" NOT NULL,
    "severity" "OperationalAlertSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "OperationalAlertStatus" NOT NULL DEFAULT 'OPEN',
    "fingerprint" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "first_triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_deliveries_submission_id_idx" ON "form_deliveries"("submission_id");

-- CreateIndex
CREATE INDEX "form_deliveries_site_id_status_idx" ON "form_deliveries"("site_id", "status");

-- CreateIndex
CREATE INDEX "form_deliveries_status_next_attempt_at_idx" ON "form_deliveries"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "operational_alerts_status_type_idx" ON "operational_alerts"("status", "type");

-- CreateIndex
CREATE INDEX "operational_alerts_site_id_status_idx" ON "operational_alerts"("site_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "operational_alerts_site_id_type_fingerprint_key" ON "operational_alerts"("site_id", "type", "fingerprint");

-- AddForeignKey
ALTER TABLE "form_deliveries" ADD CONSTRAINT "form_deliveries_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "form_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_deliveries" ADD CONSTRAINT "form_deliveries_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_alerts" ADD CONSTRAINT "operational_alerts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
