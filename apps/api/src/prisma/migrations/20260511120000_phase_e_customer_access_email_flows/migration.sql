/*
  # Phase E — Customer access email flows

  1. User verification state
    - add `email_verified_at` to `users`

  2. Email verification tokens
    - `email_verification_tokens`

  3. Password reset tokens
    - `password_reset_tokens`

  4. Workspace invitations
    - `workspace_invitations`
*/

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "workspace_invitations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TenantMembershipRole" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "invited_by_user_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_verification_tokens_token_hash_key"
ON "email_verification_tokens"("token_hash");

CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_id_created_at_idx"
ON "email_verification_tokens"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "email_verification_tokens_expires_at_idx"
ON "email_verification_tokens"("expires_at");

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key"
ON "password_reset_tokens"("token_hash");

CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_created_at_idx"
ON "password_reset_tokens"("user_id", "created_at");

CREATE INDEX IF NOT EXISTS "password_reset_tokens_expires_at_idx"
ON "password_reset_tokens"("expires_at");

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invitations_token_hash_key"
ON "workspace_invitations"("token_hash");

CREATE INDEX IF NOT EXISTS "workspace_invitations_tenant_id_email_idx"
ON "workspace_invitations"("tenant_id", "email");

CREATE INDEX IF NOT EXISTS "workspace_invitations_email_accepted_at_revoked_at_idx"
ON "workspace_invitations"("email", "accepted_at", "revoked_at");

CREATE INDEX IF NOT EXISTS "workspace_invitations_expires_at_idx"
ON "workspace_invitations"("expires_at");

ALTER TABLE "email_verification_tokens"
ADD CONSTRAINT "email_verification_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "password_reset_tokens"
ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invitations"
ADD CONSTRAINT "workspace_invitations_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invitations"
ADD CONSTRAINT "workspace_invitations_invited_by_user_id_fkey"
FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;