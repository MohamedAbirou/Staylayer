/*
  # Phase B — Notifications model

  1. New Types
    - `NotificationChannel` enum (IN_APP, EMAIL)
    - `NotificationCategory` enum (DEPLOYMENT, DOMAIN, BILLING, FORM_SUBMISSION, SYSTEM)

  2. New Tables
    - `notifications`
      - `id` (cuid primary key)
      - `tenant_id` (text, required)
      - `user_id` (text, nullable — null = broadcast to all tenant members)
      - `site_id` (text, nullable)
      - `category` (NotificationCategory)
      - `channel` (NotificationChannel, default IN_APP)
      - `title` (text)
      - `body` (text)
      - `action_url` (text, nullable)
      - `read_at` (timestamptz, nullable)
      - `metadata` (jsonb, nullable)
      - `created_at` (timestamptz)
    - `notification_preferences`
      - `id` (cuid primary key)
      - `user_id` (text)
      - `tenant_id` (text)
      - `category` (NotificationCategory)
      - `channel` (NotificationChannel)
      - `enabled` (boolean, default true)
      - `created_at` / `updated_at`

  3. Indexes
    - notifications: (tenant_id, user_id, read_at), (tenant_id, created_at), (user_id, read_at)
    - notification_preferences: (user_id, tenant_id) + unique(user_id, tenant_id, category, channel)

  4. Notes
    - No foreign keys to users table since user IDs come from the JWT sub claim
    - Notifications are soft-read (read_at) — never deleted by the system
    - Preferences default to enabled; users opt-out per category/channel
*/

-- Create enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationChannel') THEN
    CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NotificationCategory') THEN
    CREATE TYPE "NotificationCategory" AS ENUM ('DEPLOYMENT', 'DOMAIN', 'BILLING', 'FORM_SUBMISSION', 'SYSTEM');
  END IF;
END $$;

-- Create notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "site_id" TEXT,
    "category" "NotificationCategory" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "action_url" TEXT,
    "read_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS "notifications_tenant_id_user_id_read_at_idx"
  ON "notifications"("tenant_id", "user_id", "read_at");

CREATE INDEX IF NOT EXISTS "notifications_tenant_id_created_at_idx"
  ON "notifications"("tenant_id", "created_at");

CREATE INDEX IF NOT EXISTS "notifications_user_id_read_at_idx"
  ON "notifications"("user_id", "read_at");

-- Indexes for notification_preferences
CREATE INDEX IF NOT EXISTS "notification_preferences_user_id_tenant_id_idx"
  ON "notification_preferences"("user_id", "tenant_id");

CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_user_id_tenant_id_category_channel_key"
  ON "notification_preferences"("user_id", "tenant_id", "category", "channel");
