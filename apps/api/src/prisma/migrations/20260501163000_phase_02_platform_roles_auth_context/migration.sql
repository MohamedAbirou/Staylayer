-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_OWNER', 'SUPPORT_ADMIN', 'FINANCE_ADMIN');

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "platform_role" "PlatformRole";

-- Backfill only the unambiguous legacy operator role.
UPDATE "users"
SET "platform_role" = 'PLATFORM_OWNER'::"PlatformRole"
WHERE "role" = 'SUPER_ADMIN';

-- CreateIndex
CREATE INDEX "users_platform_role_idx" ON "users"("platform_role");