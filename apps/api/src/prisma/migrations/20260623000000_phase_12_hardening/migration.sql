-- Phase 12 — Hardening & Launch
--
-- 1. Isolated operator brute-force counter (separate from customer login)
-- 2. TOTP MFA for operator sign-in
-- 3. One-time MFA recovery codes table

ALTER TABLE "users"
  ADD COLUMN "operator_failed_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "operator_locked_until" TIMESTAMP(3),
  ADD COLUMN "operator_mfa_secret" TEXT,
  ADD COLUMN "operator_mfa_enrolled_at" TIMESTAMP(3);

CREATE TABLE "operator_mfa_recovery_codes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operator_mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operator_mfa_recovery_codes_code_hash_key"
  ON "operator_mfa_recovery_codes" ("code_hash");

CREATE INDEX "operator_mfa_recovery_codes_user_id_consumed_at_idx"
  ON "operator_mfa_recovery_codes" ("user_id", "consumed_at");

ALTER TABLE "operator_mfa_recovery_codes"
  ADD CONSTRAINT "operator_mfa_recovery_codes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
