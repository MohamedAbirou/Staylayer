-- CreateEnum
CREATE TYPE "FormDefinitionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FormFieldType" AS ENUM ('SINGLE_LINE_TEXT', 'MULTI_LINE_TEXT', 'EMAIL', 'PHONE', 'SELECT', 'RADIO', 'CHECKBOX', 'DATE', 'NUMBER', 'HIDDEN');

-- CreateEnum
CREATE TYPE "FormEmailTemplateType" AS ENUM ('INTERNAL_NOTIFICATION', 'GUEST_CONFIRMATION');

-- CreateEnum
CREATE TYPE "FormDeliveryPurpose" AS ENUM ('INTERNAL_NOTIFICATION', 'GUEST_CONFIRMATION', 'WEBHOOK_FORWARD');

-- AlterTable
ALTER TABLE "form_deliveries" ADD COLUMN     "purpose" "FormDeliveryPurpose" NOT NULL DEFAULT 'INTERNAL_NOTIFICATION';

-- AlterTable
ALTER TABLE "form_submissions" ADD COLUMN     "form_definition_id" TEXT,
ADD COLUMN     "form_schema_version_id" TEXT,
ADD COLUMN     "routing_rule_id" TEXT;

-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "seo_canonical" TEXT,
ADD COLUMN     "seo_noindex" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seo_og_image" TEXT;

-- CreateTable
CREATE TABLE "form_definitions" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "form_type" "FormType" NOT NULL,
    "status" "FormDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
    "assignment" JSONB,
    "active_schema_version_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_fields" (
    "id" TEXT NOT NULL,
    "form_definition_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placeholder" TEXT NOT NULL DEFAULT '',
    "help_text" TEXT NOT NULL DEFAULT '',
    "type" "FormFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "validation" JSONB,
    "options" JSONB,
    "default_value" TEXT,
    "is_platform_managed" BOOLEAN NOT NULL DEFAULT false,
    "visibility_rules" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_schema_versions" (
    "id" TEXT NOT NULL,
    "form_definition_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "schema_snapshot" JSONB NOT NULL,
    "routing_snapshot" JSONB,
    "email_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "form_schema_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_routing_rules" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "form_definition_id" TEXT,
    "name" TEXT NOT NULL DEFAULT 'Default route',
    "page_slug" TEXT,
    "locale" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "save_to_inbox" BOOLEAN NOT NULL DEFAULT true,
    "email_recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "webhook_url" TEXT NOT NULL DEFAULT '',
    "webhook_secret" TEXT NOT NULL DEFAULT '',
    "send_confirmation_email" BOOLEAN NOT NULL DEFAULT false,
    "confirmation_reply_to_field_key" TEXT NOT NULL DEFAULT 'email',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_routing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_email_themes" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL DEFAULT '',
    "logo_url" TEXT NOT NULL DEFAULT '',
    "primary_color" TEXT NOT NULL DEFAULT '#2563eb',
    "accent_color" TEXT NOT NULL DEFAULT '#0f172a',
    "surface_color" TEXT NOT NULL DEFAULT '#ffffff',
    "text_color" TEXT NOT NULL DEFAULT '#0f172a',
    "typography_family" TEXT NOT NULL DEFAULT 'Arial',
    "button_style" JSONB,
    "card_style" JSONB,
    "header_content" JSONB,
    "footer_content" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "form_email_themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_email_templates" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "form_definition_id" TEXT,
    "template_type" "FormEmailTemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "subject_template" TEXT NOT NULL,
    "preview_text" TEXT NOT NULL DEFAULT '',
    "blocks" JSONB NOT NULL,
    "field_order" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "form_email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "form_definitions_site_id_status_idx" ON "form_definitions"("site_id", "status");

-- CreateIndex
CREATE INDEX "form_definitions_site_id_form_type_idx" ON "form_definitions"("site_id", "form_type");

-- CreateIndex
CREATE UNIQUE INDEX "form_definitions_site_id_key_key" ON "form_definitions"("site_id", "key");

-- CreateIndex
CREATE INDEX "form_fields_form_definition_id_sort_order_idx" ON "form_fields"("form_definition_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "form_fields_form_definition_id_key_key" ON "form_fields"("form_definition_id", "key");

-- CreateIndex
CREATE INDEX "form_schema_versions_form_definition_id_published_at_idx" ON "form_schema_versions"("form_definition_id", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "form_schema_versions_form_definition_id_version_number_key" ON "form_schema_versions"("form_definition_id", "version_number");

-- CreateIndex
CREATE INDEX "form_routing_rules_site_id_is_active_priority_idx" ON "form_routing_rules"("site_id", "is_active", "priority");

-- CreateIndex
CREATE INDEX "form_routing_rules_form_definition_id_is_active_priority_idx" ON "form_routing_rules"("form_definition_id", "is_active", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "form_email_themes_site_id_key" ON "form_email_themes"("site_id");

-- CreateIndex
CREATE INDEX "form_email_templates_site_id_template_type_idx" ON "form_email_templates"("site_id", "template_type");

-- CreateIndex
CREATE INDEX "form_email_templates_form_definition_id_template_type_idx" ON "form_email_templates"("form_definition_id", "template_type");

-- CreateIndex
CREATE INDEX "form_submissions_form_definition_id_idx" ON "form_submissions"("form_definition_id");

-- CreateIndex
CREATE INDEX "form_submissions_form_schema_version_id_idx" ON "form_submissions"("form_schema_version_id");

-- AddForeignKey
ALTER TABLE "form_definitions" ADD CONSTRAINT "form_definitions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_definitions" ADD CONSTRAINT "form_definitions_active_schema_version_id_fkey" FOREIGN KEY ("active_schema_version_id") REFERENCES "form_schema_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_fields" ADD CONSTRAINT "form_fields_form_definition_id_fkey" FOREIGN KEY ("form_definition_id") REFERENCES "form_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_schema_versions" ADD CONSTRAINT "form_schema_versions_form_definition_id_fkey" FOREIGN KEY ("form_definition_id") REFERENCES "form_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_routing_rules" ADD CONSTRAINT "form_routing_rules_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_routing_rules" ADD CONSTRAINT "form_routing_rules_form_definition_id_fkey" FOREIGN KEY ("form_definition_id") REFERENCES "form_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_email_themes" ADD CONSTRAINT "form_email_themes_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_email_templates" ADD CONSTRAINT "form_email_templates_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_email_templates" ADD CONSTRAINT "form_email_templates_form_definition_id_fkey" FOREIGN KEY ("form_definition_id") REFERENCES "form_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_definition_id_fkey" FOREIGN KEY ("form_definition_id") REFERENCES "form_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_schema_version_id_fkey" FOREIGN KEY ("form_schema_version_id") REFERENCES "form_schema_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_routing_rule_id_fkey" FOREIGN KEY ("routing_rule_id") REFERENCES "form_routing_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
