/**
 * copy-fallbacks.js
 * Copies all migration JSONs from migrations/en/ → lib/fallbacks/
 * Run: node scripts/copy-fallbacks.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "migrations", "en");
const DEST = path.join(ROOT, "lib", "fallbacks");

if (!fs.existsSync(DEST)) fs.mkdirSync(DEST, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => f.endsWith(".json"));
let copied = 0;

for (const file of files) {
  fs.copyFileSync(path.join(SRC, file), path.join(DEST, file));
  copied++;
  console.log(`  ✓ ${file}`);
}

console.log(`\nCopied ${copied} fallback files to lib/fallbacks/`);
