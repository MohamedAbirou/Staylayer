/**
 * scripts/migrate-pages.js
 *
 * Migrates all pages from migrations/<locale>/*.json into the CMS database.
 * Automatically logs in with your admin credentials — no manual JWT required.
 * Supports all locale directories that exist under migrations/ (en, es, fr, …).
 *
 * ── Quick start ──────────────────────────────────────────────────────────────
 *   1. Add to apps/website/.env:
 *        CMS_API_URL=http://localhost:4000
 *        CMS_ADMIN_EMAIL=admin@myallocator.com
 *        CMS_ADMIN_PASSWORD=YourPassword
 *
 *   2. Make sure the API server is running, then:
 *        node scripts/migrate-pages.js            # migrate all locales, published
 *        node scripts/migrate-pages.js --draft    # migrate as unpublished drafts
 *        node scripts/migrate-pages.js --locale=es  # single locale only
 *
 * ── Production ───────────────────────────────────────────────────────────────
 *   Set the same vars pointing to your production API:
 *        CMS_API_URL=https://api.yourdomain.com \
 *        CMS_ADMIN_EMAIL=... CMS_ADMIN_PASSWORD=... \
 *        node scripts/migrate-pages.js
 *
 * ── What it does ─────────────────────────────────────────────────────────────
 *   1. Reads .env  (or env vars already in the shell)
 *   2. Logs in to the API  →  obtains a JWT access token
 *   3. Discovers all locale dirs under migrations/ (or uses --locale=xx)
 *   4. Upserts every JSON as PUBLISHED (default) or draft (--draft flag)
 *        • New pages   →  POST /pages
 *        • Existing    →  PUT  /pages/:slug?locale=xx  (idempotent, updates content)
 *   5. Copies migrations/en/*.json → lib/fallbacks/ (English SSR fallback)
 *   6. Prints a per-locale result summary
 *
 * ── Flags ────────────────────────────────────────────────────────────────────
 *   --draft          Seed as unpublished drafts instead of published
 *   --locale=<code>  Only migrate a single locale (e.g. --locale=es)
 *
 * ── Env vars ─────────────────────────────────────────────────────────────────
 *   CMS_API_URL          API base URL         default: http://localhost:4000
 *   CMS_ADMIN_EMAIL      Admin user email     (required for auto-login)
 *   CMS_ADMIN_PASSWORD   Admin password       (required for auto-login)
 *   CMS_SEED_TOKEN       Pre-obtained JWT     (optional override — skips login)
 */

"use strict";

const fs = require("fs");
const path = require("path");

// ── Load .env from apps/website/.env ──────────────────────────────────────────
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed
      .slice(idx + 1)
      .trim()
      .replace(/^["']|["']$/g, ""); // strip surrounding quotes
    if (!process.env[key]) process.env[key] = val;
  }
}

const API_URL = (process.env.CMS_API_URL || "http://localhost:4000").replace(
  /\/$/,
  "",
);
const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");
const FALLBACKS_DIR = path.join(__dirname, "..", "lib", "fallbacks");
const DELAY_MS = 300; // ms between requests

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const PUBLISH = !args.includes("--draft"); // default: publish
const LOCALE_FILTER =
  (args.find((a) => a.startsWith("--locale=")) || "").replace(
    "--locale=",
    "",
  ) || null; // null = all locales

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Auto-login ────────────────────────────────────────────────────────────────
async function getToken() {
  // Direct token override (CI / advanced use)
  if (process.env.CMS_SEED_TOKEN) {
    console.log("  Using CMS_SEED_TOKEN from env.");
    return process.env.CMS_SEED_TOKEN;
  }

  const email = process.env.CMS_ADMIN_EMAIL;
  const password = process.env.CMS_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error(
      "\nERROR: Missing credentials.\n" +
        "Set CMS_ADMIN_EMAIL + CMS_ADMIN_PASSWORD in apps/website/.env\n" +
        "(or supply a pre-obtained JWT via CMS_SEED_TOKEN)",
    );
    process.exit(1);
  }

  console.log(`  Logging in as ${email} …`);

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  }).catch((err) => {
    console.error(
      `\nERROR: Could not reach the API at ${API_URL}\n` +
        "Make sure the API server is running before running this script.\n" +
        `Detail: ${err.message}`,
    );
    process.exit(1);
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error(
      `\nERROR: Login failed (${res.status}): ${JSON.stringify(body)}\n` +
        "Check CMS_ADMIN_EMAIL and CMS_ADMIN_PASSWORD in your .env",
    );
    process.exit(1);
  }

  const { accessToken } = await res.json();
  console.log("  Login successful.\n");
  return accessToken;
}

// ── Upsert a single page ──────────────────────────────────────────────────────
async function upsertPage(pageData, token, publish) {
  const {
    slug,
    locale,
    title,
    puckData,
    seoTitle,
    seoDescription,
    seoKeywords,
  } = pageData;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Try PUT first (update if exists).
  // Also send published flag on update so re-running promotes drafts to live.
  const putRes = await fetch(
    `${API_URL}/pages/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        title,
        puckData,
        seoTitle,
        seoDescription,
        seoKeywords,
        published: publish,
      }),
    },
  );

  if (putRes.ok) return { action: "updated", slug, locale };

  if (putRes.status === 404) {
    // Page doesn't exist yet — create it
    const postRes = await fetch(`${API_URL}/pages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        slug,
        locale,
        title,
        puckData,
        seoTitle,
        seoDescription,
        seoKeywords,
        published: publish,
      }),
    });

    if (postRes.ok) return { action: "created", slug, locale };

    if (postRes.status === 409) {
      // Race condition: another process created it — treat as success
      return { action: "skipped (already exists)", slug, locale };
    }

    const err = await postRes.json().catch(() => ({}));
    throw new Error(
      `POST /pages failed (${postRes.status}): ${JSON.stringify(err)}`,
    );
  }

  const err = await putRes.json().catch(() => ({}));
  throw new Error(
    `PUT /pages/${slug} failed (${putRes.status}): ${JSON.stringify(err)}`,
  );
}

// ── Copy English fallbacks (SSR fallback layer is English-only) ───────────────
function copyFallbacks() {
  const enDir = path.join(MIGRATIONS_DIR, "en");
  if (!fs.existsSync(enDir)) return 0;
  if (!fs.existsSync(FALLBACKS_DIR)) {
    fs.mkdirSync(FALLBACKS_DIR, { recursive: true });
  }
  const files = fs.readdirSync(enDir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    fs.copyFileSync(path.join(enDir, file), path.join(FALLBACKS_DIR, file));
  }
  return files.length;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const modeLabel = PUBLISH ? "PUBLISHED" : "DRAFT (unpublished)";

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  MyAllocator CMS — Page Migration`);
  console.log(`  API    : ${API_URL}`);
  console.log(`  Mode   : ${modeLabel}`);
  if (LOCALE_FILTER) console.log(`  Locale : ${LOCALE_FILTER} (filtered)`);
  console.log(`═══════════════════════════════════════════\n`);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(
      `ERROR: migrations/ directory not found at ${MIGRATIONS_DIR}`,
    );
    process.exit(1);
  }

  // Discover locale directories (en, es, fr, …) — or use --locale= filter
  let localeDirs = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (LOCALE_FILTER) {
    if (!localeDirs.includes(LOCALE_FILTER)) {
      console.error(
        `ERROR: No migrations directory found for locale "${LOCALE_FILTER}".\n` +
          `Available: ${localeDirs.join(", ") || "(none)"}`,
      );
      process.exit(1);
    }
    localeDirs = [LOCALE_FILTER];
  }

  if (localeDirs.length === 0) {
    console.error("ERROR: No locale directories found under migrations/");
    process.exit(1);
  }

  console.log(
    `── Step 1/${localeDirs.length + 2}: Authentication ─────────────────`,
  );
  const token = await getToken();

  let stepNum = 2;
  let totalCreated = 0,
    totalUpdated = 0,
    totalSkipped = 0,
    totalFailed = 0;

  for (const locale of localeDirs) {
    const localeDir = path.join(MIGRATIONS_DIR, locale);
    const files = fs.readdirSync(localeDir).filter((f) => f.endsWith(".json"));

    console.log(
      `── Step ${stepNum++}/${localeDirs.length + 2}: Locale "${locale}" — ${files.length} page(s) ──`,
    );

    if (files.length === 0) {
      console.log(`  (no JSON files, skipping)`);
      continue;
    }

    let created = 0,
      updated = 0,
      skipped = 0,
      failed = 0;

    for (const file of files) {
      const filePath = path.join(localeDir, file);
      let pageData;
      try {
        pageData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      } catch (e) {
        console.error(`  ✗ PARSE ERROR: ${file} — ${e.message}`);
        failed++;
        continue;
      }

      // Enforce locale from directory name (overrides whatever is in the JSON)
      pageData.locale = locale;

      try {
        const result = await upsertPage(pageData, token, PUBLISH);
        const icon = result.action.startsWith("created")
          ? "✚"
          : result.action.startsWith("updated")
            ? "↻"
            : "–";
        console.log(`  ${icon} ${result.action.padEnd(26)} ${result.slug}`);
        if (result.action.startsWith("created")) created++;
        else if (result.action.startsWith("updated")) updated++;
        else skipped++;
      } catch (err) {
        console.error(`  ✗ FAILED: ${pageData.slug} — ${err.message}`);
        failed++;
      }

      await sleep(DELAY_MS);
    }

    console.log(
      `     → created: ${created}  updated: ${updated}  skipped: ${skipped}  failed: ${failed}`,
    );
    totalCreated += created;
    totalUpdated += updated;
    totalSkipped += skipped;
    totalFailed += failed;
  }

  // Always (re)copy English fallbacks so lib/fallbacks/ stays in sync
  if (!LOCALE_FILTER || LOCALE_FILTER === "en") {
    console.log(`\n── Step ${stepNum}: Copying English fallbacks ────────────`);
    const copied = copyFallbacks();
    console.log(`  ✓ Copied ${copied} file(s) to lib/fallbacks/`);
  }

  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Done. (${localeDirs.join(", ")})`);
  console.log(`  Created : ${totalCreated}`);
  console.log(`  Updated : ${totalUpdated}`);
  console.log(`  Skipped : ${totalSkipped}`);
  console.log(`  Failed  : ${totalFailed}`);
  console.log(`  Mode    : ${modeLabel}`);
  console.log(`═══════════════════════════════════════════`);

  if (totalFailed > 0) {
    console.error(`\n${totalFailed} page(s) failed. Check errors above.`);
    process.exit(1);
  }
}

main();
