ALTER TABLE "sites"
ADD COLUMN "archived_at" TIMESTAMP(3),
ADD COLUMN "archived_slug" TEXT,
ADD COLUMN "archived_public_subdomain" TEXT,
ADD COLUMN "archived_domains" TEXT[] DEFAULT ARRAY[]::TEXT[];
