-- Phase 5: Support System backend.
-- Adds native support case schema (cases, messages, notes, events, assignments,
-- linked resources, handoffs) plus supporting enums. Read-only operator audit
-- already lives in `operator_audit_logs`; per-case timeline events get their
-- own table so the UI can render an inline history without joining the audit
-- table.

-- CreateEnum
CREATE TYPE "SupportCaseStatus" AS ENUM ('OPEN', 'PENDING_CUSTOMER', 'PENDING_INTERNAL', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SupportCasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportCaseCategory" AS ENUM ('BILLING', 'DEPLOYMENT', 'DOMAIN', 'FORMS', 'SEO', 'TRANSLATION', 'ACCESS', 'CONTENT', 'ACCOUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "SupportCaseChannel" AS ENUM ('MANUAL', 'EMAIL', 'CUSTOMER_WORKSPACE', 'SYSTEM_ALERT', 'BILLING', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "SupportCaseEventType" AS ENUM (
  'CREATED',
  'STATUS_CHANGED',
  'PRIORITY_CHANGED',
  'CATEGORY_CHANGED',
  'ASSIGNMENT_CHANGED',
  'TAGS_UPDATED',
  'MESSAGE_ADDED',
  'NOTE_ADDED',
  'RESOURCE_LINKED',
  'RESOURCE_UNLINKED',
  'HANDOFF_OPENED',
  'HANDOFF_ACKNOWLEDGED',
  'HANDOFF_CLOSED',
  'RESOLVED',
  'REOPENED',
  'CLOSED',
  'SLA_BREACHED'
);

-- CreateEnum
CREATE TYPE "SupportLinkedResourceType" AS ENUM ('TENANT', 'SITE', 'DEPLOYMENT', 'DOMAIN', 'FORM_DEFINITION', 'FORM_SUBMISSION', 'SUBSCRIPTION', 'OPERATIONAL_ALERT', 'USER');

-- CreateEnum
CREATE TYPE "SupportHandoffTarget" AS ENUM ('BILLING', 'PLATFORM_OWNER', 'SUPPORT');

-- CreateEnum
CREATE TYPE "SupportHandoffStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'CLOSED');

-- CreateTable
CREATE TABLE "support_cases" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT,
    "requester_user_id" TEXT,
    "requester_email" TEXT,
    "subject" TEXT NOT NULL,
    "channel" "SupportCaseChannel" NOT NULL DEFAULT 'MANUAL',
    "status" "SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportCasePriority" NOT NULL DEFAULT 'NORMAL',
    "category" "SupportCaseCategory" NOT NULL DEFAULT 'OTHER',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assigned_operator_id" TEXT,
    "created_by_operator_id" TEXT,
    "first_response_due_at" TIMESTAMP(3),
    "resolution_due_at" TIMESTAMP(3),
    "first_response_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "sla_breached_first_response" BOOLEAN NOT NULL DEFAULT false,
    "sla_breached_resolution" BOOLEAN NOT NULL DEFAULT false,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_cases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_cases_number_key" ON "support_cases"("number");
CREATE INDEX "support_cases_status_priority_last_activity_at_idx" ON "support_cases"("status", "priority", "last_activity_at");
CREATE INDEX "support_cases_assigned_operator_id_status_idx" ON "support_cases"("assigned_operator_id", "status");
CREATE INDEX "support_cases_tenant_id_status_idx" ON "support_cases"("tenant_id", "status");
CREATE INDEX "support_cases_category_status_idx" ON "support_cases"("category", "status");
CREATE INDEX "support_cases_created_at_idx" ON "support_cases"("created_at");
CREATE INDEX "support_cases_tags_idx" ON "support_cases" USING GIN ("tags");

-- AddForeignKey
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_assigned_operator_id_fkey" FOREIGN KEY ("assigned_operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_created_by_operator_id_fkey" FOREIGN KEY ("created_by_operator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: messages
CREATE TABLE "support_case_messages" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "author_user_id" TEXT,
    "author_is_operator" BOOLEAN NOT NULL DEFAULT true,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_case_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_case_messages_case_id_created_at_idx" ON "support_case_messages"("case_id", "created_at");

ALTER TABLE "support_case_messages" ADD CONSTRAINT "support_case_messages_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "support_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_case_messages" ADD CONSTRAINT "support_case_messages_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: notes
CREATE TABLE "support_case_notes" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_case_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_case_notes_case_id_created_at_idx" ON "support_case_notes"("case_id", "created_at");

ALTER TABLE "support_case_notes" ADD CONSTRAINT "support_case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "support_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_case_notes" ADD CONSTRAINT "support_case_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: events
CREATE TABLE "support_case_events" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "type" "SupportCaseEventType" NOT NULL,
    "actor_user_id" TEXT,
    "from_value" TEXT,
    "to_value" TEXT,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_case_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_case_events_case_id_created_at_idx" ON "support_case_events"("case_id", "created_at");
CREATE INDEX "support_case_events_type_created_at_idx" ON "support_case_events"("type", "created_at");

ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "support_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_case_events" ADD CONSTRAINT "support_case_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: assignments
CREATE TABLE "support_case_assignments" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "from_user_id" TEXT,
    "to_user_id" TEXT,
    "changed_by_user_id" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_case_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_case_assignments_case_id_created_at_idx" ON "support_case_assignments"("case_id", "created_at");

ALTER TABLE "support_case_assignments" ADD CONSTRAINT "support_case_assignments_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "support_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_case_assignments" ADD CONSTRAINT "support_case_assignments_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_case_assignments" ADD CONSTRAINT "support_case_assignments_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "support_case_assignments" ADD CONSTRAINT "support_case_assignments_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: linked resources
CREATE TABLE "support_case_linked_resources" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "resource_type" "SupportLinkedResourceType" NOT NULL,
    "resource_id" TEXT NOT NULL,
    "label" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_case_linked_resources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "support_case_linked_resources_case_id_resource_type_resourc_key" ON "support_case_linked_resources"("case_id", "resource_type", "resource_id");
CREATE INDEX "support_case_linked_resources_resource_type_resource_id_idx" ON "support_case_linked_resources"("resource_type", "resource_id");

ALTER TABLE "support_case_linked_resources" ADD CONSTRAINT "support_case_linked_resources_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "support_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_case_linked_resources" ADD CONSTRAINT "support_case_linked_resources_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: handoffs
CREATE TABLE "support_case_handoffs" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "target" "SupportHandoffTarget" NOT NULL,
    "status" "SupportHandoffStatus" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT NOT NULL,
    "opened_by_user_id" TEXT NOT NULL,
    "closed_by_user_id" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_case_handoffs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_case_handoffs_case_id_created_at_idx" ON "support_case_handoffs"("case_id", "created_at");
CREATE INDEX "support_case_handoffs_target_status_idx" ON "support_case_handoffs"("target", "status");

ALTER TABLE "support_case_handoffs" ADD CONSTRAINT "support_case_handoffs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "support_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_case_handoffs" ADD CONSTRAINT "support_case_handoffs_opened_by_user_id_fkey" FOREIGN KEY ("opened_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_case_handoffs" ADD CONSTRAINT "support_case_handoffs_closed_by_user_id_fkey" FOREIGN KEY ("closed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
