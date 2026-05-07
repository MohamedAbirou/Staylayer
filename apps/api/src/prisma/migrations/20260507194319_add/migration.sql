-- CreateEnum
CREATE TYPE "DeploymentEnvironmentVariableType" AS ENUM ('PLAIN', 'ENCRYPTED');

-- CreateTable
CREATE TABLE "site_deployment_environment_variables" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "DeploymentEnvironmentVariableType" NOT NULL DEFAULT 'PLAIN',
    "description" TEXT NOT NULL DEFAULT '',
    "targets" TEXT[] DEFAULT ARRAY['production']::TEXT[],
    "encrypted_value" TEXT NOT NULL,
    "initialization_vector" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "site_deployment_environment_variables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "site_deployment_environment_variables_site_id_updated_at_idx" ON "site_deployment_environment_variables"("site_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "site_deployment_environment_variables_site_id_key_key" ON "site_deployment_environment_variables"("site_id", "key");

-- AddForeignKey
ALTER TABLE "site_deployment_environment_variables" ADD CONSTRAINT "site_deployment_environment_variables_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
