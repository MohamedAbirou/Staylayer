-- Phase 3: Operator permission registry support + refresh session table + audit log.

-- CreateTable
CREATE TABLE "operator_refresh_sessions" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_agent_hash" TEXT,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "replaced_by_session_id" TEXT,

    CONSTRAINT "operator_refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operator_refresh_sessions_jti_key" ON "operator_refresh_sessions"("jti");

-- CreateIndex
CREATE INDEX "operator_refresh_sessions_user_id_revoked_at_idx" ON "operator_refresh_sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "operator_refresh_sessions_expires_at_idx" ON "operator_refresh_sessions"("expires_at");

-- AddForeignKey
ALTER TABLE "operator_refresh_sessions" ADD CONSTRAINT "operator_refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "operator_audit_logs" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "platform_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "permission_keys" TEXT[],
    "target_type" TEXT,
    "target_id" TEXT,
    "tenant_id" TEXT,
    "site_id" TEXT,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operator_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operator_audit_logs_actor_user_id_created_at_idx" ON "operator_audit_logs"("actor_user_id", "created_at");

-- CreateIndex
CREATE INDEX "operator_audit_logs_action_created_at_idx" ON "operator_audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "operator_audit_logs_tenant_id_created_at_idx" ON "operator_audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "operator_audit_logs_target_type_target_id_idx" ON "operator_audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "operator_audit_logs_request_id_idx" ON "operator_audit_logs"("request_id");

-- AddForeignKey
-- ON DELETE RESTRICT: audit history MUST survive deletion of the operator
-- user account so retention/compliance requirements continue to hold.
ALTER TABLE "operator_audit_logs" ADD CONSTRAINT "operator_audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
