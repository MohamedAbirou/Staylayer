// scripts/validate-migration.js
// Validates all migration JSON files in migrations/<locale>/ are properly
// structured and reference only registered Puck component types.
//
// Run:
//   node scripts/validate-migration.js              (local JSON check, all locales)
//   node scripts/validate-migration.js --locale=es  (single locale)
//   node scripts/validate-migration.js --check-api  (also verify via API)

const fs = require("fs");
const path = require("path");

const API_URL = process.env.CMS_API_URL || "http://localhost:4000";
const MIGRATIONS_DIR = path.join(__dirname, "../migrations");

// Registered component types from packages/puck-components/src/puck-config.tsx
const KNOWN_COMPONENTS = new Set([
  // Layout
  "Container",
  "Section",
  "Columns",
  "FlexBox",
  "Grid",
  "BentoGrid",
  "Spacer",
  "Divider",
  "Separator",
  "Card",
  // Typography
  "Heading",
  "Paragraph",
  "RichText",
  "Badge",
  "Avatar",
  "List",
  // Hero
  "Hero",
  "HeroSplit",
  // Content
  "TextWithImage",
  "FeatureShowcase",
  "FeatureCard",
  "StatsBar",
  "FeatureTable",
  "DataTable",
  "Alert",
  "IconBlock",
  "ContactSection",
  "AnnualReportSection",
  // Media
  "Image",
  "Video",
  // CTA
  "Button",
  "ButtonGroup",
  "CTABanner",
  // Social Proof
  "Testimonial",
  "TestimonialCarousel",
  "QuoteCard",
  "LogoCloud",
  "Marquee",
  // Pricing
  "PricingCard",
  "PricingTable",
  "ComparisonTable",
  "PricingOnePlan",
  // Interactive
  "FAQ",
  "Accordion",
  "StepList",
  "Tabs",
  "Progress",
  "Countdown",
  // Navigation
  "Navbar",
  "Footer",
  "Banner",
  "Breadcrumb",
]);

function validatePuckData(puckData, slug) {
  const errors = [];

  if (!puckData || typeof puckData !== "object") {
    errors.push("puckData is missing or not an object");
    return errors;
  }

  if (!Array.isArray(puckData.content)) {
    errors.push("puckData.content is not an array");
    return errors;
  }

  if (puckData.content.length === 0) {
    errors.push("puckData.content is empty (no components)");
  }

  for (let i = 0; i < puckData.content.length; i++) {
    const item = puckData.content[i];
    if (!item.type) {
      errors.push(`content[${i}] is missing 'type'`);
    } else if (!KNOWN_COMPONENTS.has(item.type)) {
      errors.push(`content[${i}] has unknown component type: "${item.type}"`);
    }
    if (!item.props || typeof item.props !== "object") {
      errors.push(`content[${i}] (${item.type}) is missing 'props' object`);
    }
  }

  return errors;
}

function validateFile(filePath) {
  const errors = [];
  let data;

  try {
    data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    return [`Invalid JSON: ${e.message}`];
  }

  if (!data.slug) errors.push("Missing 'slug'");
  if (!data.locale) errors.push("Missing 'locale'");
  if (!data.title) errors.push("Missing 'title'");
  if (!data.seoTitle) errors.push("Missing 'seoTitle'");
  if (!data.seoDescription) errors.push("Missing 'seoDescription'");
  if (!data.puckData) errors.push("Missing 'puckData'");

  if (data.puckData) {
    errors.push(...validatePuckData(data.puckData, data.slug));
  }

  return errors;
}

async function checkApiPage(slug, locale) {
  try {
    const res = await fetch(
      `${API_URL}/pages/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}&published=true`,
    );
    if (!res.ok) return `API returned ${res.status}`;
    const page = await res.json();
    if (!page.puckData) return "API page has no puckData";
    return null;
  } catch (e) {
    return `API unreachable: ${e.message}`;
  }
}

async function main() {
  let totalFiles = 0,
    totalErrors = 0;
  const args = process.argv.slice(2);
  const checkApi = args.includes("--check-api");
  const localeFilter =
    (args.find((a) => a.startsWith("--locale=")) || "").replace(
      "--locale=",
      "",
    ) || null;

  let localeDirs = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (localeFilter) {
    if (!localeDirs.includes(localeFilter)) {
      console.error(
        `ERROR: No migrations directory for locale "${localeFilter}". Available: ${localeDirs.join(", ")}`,
      );
      process.exit(1);
    }
    localeDirs = [localeFilter];
  }

  for (const locale of localeDirs) {
    const localeDir = path.join(MIGRATIONS_DIR, locale);
    const files = fs.readdirSync(localeDir).filter((f) => f.endsWith(".json"));

    console.log(
      `\n--- Validating ${files.length} files for locale: ${locale} ---`,
    );

    for (const file of files) {
      totalFiles++;
      const filePath = path.join(localeDir, file);
      const errors = validateFile(filePath);

      if (errors.length > 0) {
        console.error(`  ✗ ${file}: ${errors.length} error(s)`);
        errors.forEach((e) => console.error(`      - ${e}`));
        totalErrors += errors.length;
      } else {
        console.log(`  ✓ ${file}`);
      }

      if (checkApi) {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const apiErr = await checkApiPage(data.slug, locale);
        if (apiErr) {
          console.error(`      API: ${apiErr}`);
          totalErrors++;
        } else {
          console.log(`      API: OK`);
        }
      }
    }
  }

  console.log(`\n=== Validation complete ===`);
  console.log(`Files: ${totalFiles}, Errors: ${totalErrors}`);
  if (!checkApi) {
    console.log(
      "Tip: Run with --check-api to also verify pages in the CMS API",
    );
  }
  if (totalErrors > 0) process.exit(1);
}

main();
