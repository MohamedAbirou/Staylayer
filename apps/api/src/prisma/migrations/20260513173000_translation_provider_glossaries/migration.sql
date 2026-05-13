-- Persistent provider-backed translation glossaries

CREATE TABLE IF NOT EXISTS "translation_provider_glossaries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "source_locale" TEXT NOT NULL,
    "target_locale" TEXT NOT NULL,
    "provider_glossary_id" TEXT NOT NULL,
    "entries_hash" TEXT NOT NULL,
    "entry_count" INTEGER NOT NULL DEFAULT 0,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translation_provider_glossaries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "translation_provider_glossaries_site_provider_source_target_key"
    ON "translation_provider_glossaries"("site_id", "provider", "source_locale", "target_locale");

CREATE INDEX IF NOT EXISTS "translation_provider_glossaries_tenant_id_idx"
    ON "translation_provider_glossaries"("tenant_id");

CREATE INDEX IF NOT EXISTS "translation_provider_glossaries_site_id_idx"
    ON "translation_provider_glossaries"("site_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'translation_provider_glossaries_tenant_id_fkey'
  ) THEN
    ALTER TABLE "translation_provider_glossaries"
      ADD CONSTRAINT "translation_provider_glossaries_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'translation_provider_glossaries_site_id_fkey'
  ) THEN
    ALTER TABLE "translation_provider_glossaries"
      ADD CONSTRAINT "translation_provider_glossaries_site_id_fkey"
      FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;