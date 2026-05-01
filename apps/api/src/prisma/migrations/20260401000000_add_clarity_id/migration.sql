-- Add Microsoft Clarity tracking ID to site_settings
ALTER TABLE "site_settings" ADD COLUMN "clarity_id" TEXT NOT NULL DEFAULT '';
