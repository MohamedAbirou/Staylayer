-- AlterTable
ALTER TABLE "subscriptions"
    ADD COLUMN "provider_price_id" TEXT,
    ADD COLUMN "grace_period_ends_at" TIMESTAMP(3),
    ADD COLUMN "last_webhook_event_id" TEXT,
    ADD COLUMN "last_webhook_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "billing_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "tenant_id" TEXT,
    "subscription_id" TEXT,
    "payload" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_webhook_events_provider_event_id_key"
ON "billing_webhook_events"("provider_event_id");

-- CreateIndex
CREATE INDEX "billing_webhook_events_provider_created_at_idx"
ON "billing_webhook_events"("provider", "created_at");

-- CreateIndex
CREATE INDEX "billing_webhook_events_tenant_id_created_at_idx"
ON "billing_webhook_events"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "billing_webhook_events_subscription_id_created_at_idx"
ON "billing_webhook_events"("subscription_id", "created_at");

-- AddForeignKey
ALTER TABLE "billing_webhook_events"
ADD CONSTRAINT "billing_webhook_events_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_webhook_events"
ADD CONSTRAINT "billing_webhook_events_subscription_id_fkey"
FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;