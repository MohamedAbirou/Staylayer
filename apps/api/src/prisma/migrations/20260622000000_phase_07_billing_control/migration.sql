-- Phase 7: Billing Control backend.
-- Adds operator-owned billing surfaces:
--   * `billing_invoice_snapshots`  – cached Stripe invoices for fast UI.
--   * `billing_payment_events`     – cached Stripe payment activity.
--   * `billing_operator_notes`     – internal-only notes per tenant.
--   * `billing_action_requests`    – audit trail with before/after snapshots
--                                    and optional approver for high-risk
--                                    mutations (refunds, entitlement
--                                    overrides, credits).
--   * `billing_entitlement_overrides` – per-tenant limit overrides.
-- All tables are owned by the operator console; customer-facing billing
-- code (BillingService) keeps writing to `subscriptions` and
-- `billing_webhook_events` only.

-- CreateEnum
CREATE TYPE "BillingActionType" AS ENUM (
  'CHANGE_PLAN',
  'CANCEL_PENDING_PLAN_CHANGE',
  'CANCEL_AT_PERIOD_END',
  'REACTIVATE_SUBSCRIPTION',
  'EXTEND_GRACE_PERIOD',
  'REFUND_INVOICE',
  'ISSUE_CREDIT',
  'ENTITLEMENT_OVERRIDE_CREATE',
  'ENTITLEMENT_OVERRIDE_REVOKE',
  'STRIPE_WEBHOOK_REPLAY',
  'STRIPE_SYNC'
);

-- CreateEnum
CREATE TYPE "BillingActionStatus" AS ENUM (
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'EXECUTED',
  'FAILED',
  'CANCELED'
);

-- CreateTable
CREATE TABLE "billing_invoice_snapshots" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "subscription_id" TEXT,
  "provider" TEXT NOT NULL,
  "provider_invoice_id" TEXT NOT NULL,
  "provider_customer_id" TEXT,
  "status" TEXT NOT NULL,
  "amount_due" INTEGER NOT NULL,
  "amount_paid" INTEGER NOT NULL,
  "amount_remaining" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL,
  "hosted_invoice_url" TEXT,
  "invoice_pdf_url" TEXT,
  "period_start" TIMESTAMP(3),
  "period_end" TIMESTAMP(3),
  "provider_created_at" TIMESTAMP(3),
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "raw" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "billing_invoice_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoice_snapshots_provider_invoice_id_key" ON "billing_invoice_snapshots"("provider_invoice_id");

-- CreateIndex
CREATE INDEX "billing_invoice_snapshots_tenant_id_provider_created_at_idx" ON "billing_invoice_snapshots"("tenant_id", "provider_created_at");

-- CreateIndex
CREATE INDEX "billing_invoice_snapshots_status_provider_created_at_idx" ON "billing_invoice_snapshots"("status", "provider_created_at");

-- CreateIndex
CREATE INDEX "billing_invoice_snapshots_subscription_id_provider_created__idx" ON "billing_invoice_snapshots"("subscription_id", "provider_created_at");

-- AddForeignKey
ALTER TABLE "billing_invoice_snapshots" ADD CONSTRAINT "billing_invoice_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice_snapshots" ADD CONSTRAINT "billing_invoice_snapshots_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "billing_payment_events" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "subscription_id" TEXT,
  "invoice_snapshot_id" TEXT,
  "provider" TEXT NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "amount" INTEGER,
  "currency" TEXT,
  "status" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "billing_payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_payment_events_provider_event_id_key" ON "billing_payment_events"("provider_event_id");

-- CreateIndex
CREATE INDEX "billing_payment_events_tenant_id_occurred_at_idx" ON "billing_payment_events"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "billing_payment_events_event_type_occurred_at_idx" ON "billing_payment_events"("event_type", "occurred_at");

-- AddForeignKey
ALTER TABLE "billing_payment_events" ADD CONSTRAINT "billing_payment_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payment_events" ADD CONSTRAINT "billing_payment_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payment_events" ADD CONSTRAINT "billing_payment_events_invoice_snapshot_id_fkey" FOREIGN KEY ("invoice_snapshot_id") REFERENCES "billing_invoice_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "billing_operator_notes" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "author_user_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "billing_operator_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_operator_notes_tenant_id_pinned_created_at_idx" ON "billing_operator_notes"("tenant_id", "pinned", "created_at");

-- AddForeignKey
ALTER TABLE "billing_operator_notes" ADD CONSTRAINT "billing_operator_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_operator_notes" ADD CONSTRAINT "billing_operator_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "billing_action_requests" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "type" "BillingActionType" NOT NULL,
  "status" "BillingActionStatus" NOT NULL DEFAULT 'EXECUTED',
  "requires_approval" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT NOT NULL,
  "provider_object_ids" JSONB,
  "idempotency_key" TEXT,
  "before_snapshot" JSONB,
  "after_snapshot" JSONB,
  "approver_user_id" TEXT,
  "approver_reason" TEXT,
  "approved_at" TIMESTAMP(3),
  "executed_at" TIMESTAMP(3),
  "failure_code" TEXT,
  "failure_message" TEXT,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "billing_action_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_action_requests_idempotency_key_key" ON "billing_action_requests"("idempotency_key");

-- CreateIndex
CREATE INDEX "billing_action_requests_tenant_id_created_at_idx" ON "billing_action_requests"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "billing_action_requests_status_created_at_idx" ON "billing_action_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "billing_action_requests_type_created_at_idx" ON "billing_action_requests"("type", "created_at");

-- AddForeignKey
ALTER TABLE "billing_action_requests" ADD CONSTRAINT "billing_action_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_action_requests" ADD CONSTRAINT "billing_action_requests_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_action_requests" ADD CONSTRAINT "billing_action_requests_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "billing_entitlement_overrides" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "limit_key" TEXT NOT NULL,
  "int_value" INTEGER,
  "json_value" JSONB,
  "reason" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3),
  "created_by_user_id" TEXT NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "revoked_by_user_id" TEXT,
  "revoke_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "billing_entitlement_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_entitlement_overrides_tenant_id_revoked_at_expires__idx" ON "billing_entitlement_overrides"("tenant_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "billing_entitlement_overrides_limit_key_idx" ON "billing_entitlement_overrides"("limit_key");

-- AddForeignKey
ALTER TABLE "billing_entitlement_overrides" ADD CONSTRAINT "billing_entitlement_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_entitlement_overrides" ADD CONSTRAINT "billing_entitlement_overrides_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_entitlement_overrides" ADD CONSTRAINT "billing_entitlement_overrides_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
