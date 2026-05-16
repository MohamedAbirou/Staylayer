ALTER TABLE "subscriptions"
ADD COLUMN "pending_plan_key" TEXT,
ADD COLUMN "pending_plan_effective_at" TIMESTAMP(3),
ADD COLUMN "pending_plan_direction" TEXT,
ADD COLUMN "provider_schedule_id" TEXT;

CREATE INDEX "subscriptions_pending_plan_effective_at_idx" ON "subscriptions"("pending_plan_effective_at");
