CREATE TYPE "HostVariant" AS ENUM ('APEX', 'WWW');

ALTER TABLE "sites"
ADD COLUMN "public_subdomain" TEXT,
ADD COLUMN "preferred_host_variant" "HostVariant" NOT NULL DEFAULT 'APEX',
ADD COLUMN "published_revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "preview_token_version" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "sites_public_subdomain_key" ON "sites"("public_subdomain");