/**
 * sync-public-assets.js
 *
 * Copies public assets from apps/dashboard/public → apps/website/public
 * so that image paths stored in Puck page data (e.g. /villra.svg, /rooms.webp,
 * /agoda.svg …) resolve correctly when the Next.js site renders them.
 *
 * Rules:
 *   • Only copies files that do NOT already exist in the destination
 *     (website-specific assets are never overwritten).
 *   • Copies root-level files only (not sub-directories — the /images sub-dir
 *     in website/public is website-specific and should stay separate).
 *   • Safe to run repeatedly (idempotent).
 *
 * Run: node scripts/sync-public-assets.js
 */

const fs = require("fs");
const path = require("path");

const DASHBOARD_PUBLIC = path.resolve(__dirname, "../../dashboard/public");
const WEBSITE_PUBLIC = path.resolve(__dirname, "../public");

if (!fs.existsSync(DASHBOARD_PUBLIC)) {
  console.error(`Source directory not found: ${DASHBOARD_PUBLIC}`);
  process.exit(1);
}

const entries = fs.readdirSync(DASHBOARD_PUBLIC, { withFileTypes: true });
let copied = 0;
let skipped = 0;

for (const entry of entries) {
  // Only copy top-level files, not directories
  if (!entry.isFile()) continue;

  const src = path.join(DASHBOARD_PUBLIC, entry.name);
  const dest = path.join(WEBSITE_PUBLIC, entry.name);

  if (fs.existsSync(dest)) {
    skipped++;
    continue;
  }

  fs.copyFileSync(src, dest);
  console.log(`  ✓ Copied: ${entry.name}`);
  copied++;
}

console.log(
  `\nDone. ${copied} file(s) copied, ${skipped} already present (skipped).`,
);
