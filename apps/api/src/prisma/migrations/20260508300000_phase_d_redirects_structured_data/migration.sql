/*
  # Phase D: URL Redirects and Structured Data for SEO

  1. New Tables
    - `redirects`
      - `id` (cuid, primary key)
      - `site_id` (references sites)
      - `from_path` (text) - the old URL path to redirect from
      - `to_path` (text) - the new URL path to redirect to
      - `status_code` (int, default 301) - HTTP redirect status
      - `locale` (text, optional) - locale-specific redirect
      - `reason` (text, optional) - why this redirect was created
      - `permanent` (boolean, default true) - 301 vs 302
      - `enabled` (boolean, default true) - active or paused
      - `created_at`, `updated_at`

    - `site_structured_data`
      - `id` (cuid, primary key)
      - `site_id` (references sites, unique)
      - `business_type` (text, default 'Hotel') - schema.org type
      - `business_name`, `description` - identity
      - `street_address`, `city`, `region`, `postal_code`, `country` - location
      - `telephone`, `email` - contact
      - `star_rating`, `price_range` - classification
      - `check_in_time`, `check_out_time` - hospitality specific
      - `amenities` (jsonb) - array of amenity strings
      - `room_count` (int) - number of rooms
      - `latitude`, `longitude` - coordinates
      - `image_url` - primary image
      - `created_at`, `updated_at`

  2. Indexes
    - redirects: unique(site_id, from_path, locale), (site_id, enabled), (site_id, from_path)
    - site_structured_data: unique(site_id)

  3. Purpose
    - Redirect management ensures old URLs still reach content after slug renames or deletions
    - Structured data provides rich hospitality Schema.org markup for enhanced search results
*/

-- redirects table
CREATE TABLE IF NOT EXISTS "redirects" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "from_path" TEXT NOT NULL,
    "to_path" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL DEFAULT 301,
    "locale" TEXT,
    "reason" TEXT,
    "permanent" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- site_structured_data table
CREATE TABLE IF NOT EXISTS "site_structured_data" (
    "id" TEXT NOT NULL,
    "site_id" TEXT NOT NULL,
    "business_type" TEXT NOT NULL DEFAULT 'Hotel',
    "business_name" TEXT,
    "description" TEXT,
    "street_address" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "telephone" TEXT,
    "email" TEXT,
    "star_rating" INTEGER,
    "price_range" TEXT,
    "check_in_time" TEXT,
    "check_out_time" TEXT,
    "amenities" JSONB,
    "room_count" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_structured_data_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "redirects_site_id_from_path_locale_key"
    ON "redirects"("site_id", "from_path", "locale");

CREATE UNIQUE INDEX IF NOT EXISTS "site_structured_data_site_id_key"
    ON "site_structured_data"("site_id");

-- Indexes
CREATE INDEX IF NOT EXISTS "redirects_site_id_enabled_idx"
    ON "redirects"("site_id", "enabled");

CREATE INDEX IF NOT EXISTS "redirects_site_id_from_path_idx"
    ON "redirects"("site_id", "from_path");

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'redirects_site_id_fkey'
  ) THEN
    ALTER TABLE "redirects"
      ADD CONSTRAINT "redirects_site_id_fkey"
      FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'site_structured_data_site_id_fkey'
  ) THEN
    ALTER TABLE "site_structured_data"
      ADD CONSTRAINT "site_structured_data_site_id_fkey"
      FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
