-- Phase 13: content snapshots for shared-runtime publish/rollback.

CREATE TABLE "site_published_revisions" (
    "id"                  TEXT NOT NULL,
    "site_id"             TEXT NOT NULL,
    "revision"            INTEGER NOT NULL,
    "pages_snapshot"      JSONB NOT NULL,
    "settings_snapshot"   JSONB,
    "deployment_id"       TEXT,
    "rolled_back_from"    INTEGER,
    "created_by_id"       TEXT,
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_published_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_published_revisions_site_id_revision_key"
    ON "site_published_revisions" ("site_id", "revision");

CREATE INDEX "site_published_revisions_site_id_created_at_idx"
    ON "site_published_revisions" ("site_id", "created_at");

CREATE INDEX "site_published_revisions_deployment_id_idx"
    ON "site_published_revisions" ("deployment_id");

ALTER TABLE "site_published_revisions"
    ADD CONSTRAINT "site_published_revisions_site_id_fkey"
    FOREIGN KEY ("site_id") REFERENCES "sites"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
