ALTER TABLE "site_settings"
  ADD COLUMN "inquiry_integration_provider" TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN "inquiry_integration_config" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "inquiry_integration_secret" TEXT NOT NULL DEFAULT '';

ALTER TABLE "form_routing_rules"
  ADD COLUMN "integration_provider" TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN "integration_config" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "integration_secret" TEXT NOT NULL DEFAULT '';

UPDATE "site_settings"
SET "inquiry_integration_provider" = 'custom_webhook'
WHERE COALESCE(TRIM("inquiry_webhook_url"), '') <> '';

UPDATE "form_routing_rules"
SET "integration_provider" = 'custom_webhook'
WHERE COALESCE(TRIM("webhook_url"), '') <> '';