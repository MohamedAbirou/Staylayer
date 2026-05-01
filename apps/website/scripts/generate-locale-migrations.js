/**
 * generate-locale-migrations.js
 *
 * Translates all English migration JSONs to Spanish and French
 * using the DeepL API. Results are cached locally so re-runs are
 * free and instantaneous.
 *
 * Usage:
 *   DEEPL_API_KEY=<key> node scripts/generate-locale-migrations.js
 *   node scripts/generate-locale-migrations.js --api-key=<key>
 *
 * Free API key:  https://www.deepl.com/pro#developer  (500k chars/month)
 */

"use strict";

const fs = require("fs");
const path = require("path");
const https = require("https");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");
const EN_DIR = path.join(MIGRATIONS_DIR, "en");
const CACHE_FILE = path.join(__dirname, ".translation-cache.json");

const TARGET_LANGS = [
  { code: "es", deepl: "ES" },
  { code: "fr", deepl: "FR" },
];

const PROTECTED_NOUNS = [
  "MyAllocator",
  "Airbnb",
  "Booking.com",
  "Vrbo",
  "Expedia",
  "iCal",
];

const STYLE_VALUES = new Set([
  "left",
  "center",
  "right",
  "auto",
  "none",
  "normal",
  "bold",
  "semibold",
  "medium",
  "light",
  "thin",
  "italic",
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "blur",
  "fullscreen-right",
  "sticky",
  "relative",
  "absolute",
  "columns",
  "rows",
  "show",
  "hide",
  "image",
  "text",
  "outline",
  "solid",
  "ghost",
  "primary",
  "secondary",
  "wide",
  "narrow",
  "x-wide",
  "colorCycle",
  "capitalize",
  "Inter",
  "Roboto",
  "Lato",
  "Poppins",
  "Montserrat",
  "Open Sans",
  "Plus Jakarta Sans",
  "DM Sans",
]);

function getApiKey() {
  const a = process.argv.find((a) => a.startsWith("--api-key="));
  if (a) return a.split("=")[1];
  return process.env.DEEPL_API_KEY || null;
}

function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    } catch {
      return {};
    }
  }
  return {};
}

function saveCache(c) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(c, null, 2) + "\n", "utf8");
}

function isTranslatable(s) {
  if (!s || typeof s !== "string") return false;
  const t = s.trim();
  if (t.length < 2) return false;
  if (/^https?:\/\//.test(t)) return false;
  if (/^\/[a-z0-9\-._/]*$/.test(t)) return false;
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return false;
  if (/^rgba?\s*\(|^hsla?\s*\(/.test(t)) return false;
  if (/^[\d\s.,:%$€£+\-]+$/.test(t)) return false;
  if (/^[A-Za-z]+-[0-9a-f-]{8,}/.test(t)) return false;
  // All-lowercase CSS/layout tokens: "to-br", "fadeIn" false-positives, "transparent", etc.
  // Human-readable UI text is always sentence-case or title-case; pure-lowercase
  // single tokens without spaces are virtually always code values.
  if (/^[a-z][a-zA-Z0-9]*(-[a-z0-9]+)*$/.test(t) && !t.includes(" "))
    return false;
  if (STYLE_VALUES.has(t)) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return false;
  if (!/[a-zA-Z]/.test(t)) return false;
  return true;
}

function xmlEscape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function xmlUnescape(s) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function protectNouns(text) {
  // Escape XML special chars first, then wrap proper nouns in ignorable tags.
  // Proper nouns don't contain & < > so the regex still matches after escaping.
  let r = xmlEscape(text);
  PROTECTED_NOUNS.forEach((n, i) => {
    r = r.replace(
      new RegExp(n.replace(/\./g, "\\."), "g"),
      `<x id="${i}">${n}</x>`,
    );
  });
  return r;
}

function restoreNouns(text) {
  return xmlUnescape(
    text.replace(/<x id="\d+">(.*?)<\/x>/g, "$1").replace(/<\/?x[^>]*>/g, ""),
  );
}

function deepLTranslate(texts, targetLang, apiKey) {
  return new Promise((resolve, reject) => {
    const prepared = texts.map(protectNouns);
    const body = new URLSearchParams();
    prepared.forEach((t) => body.append("text", t));
    body.append("target_lang", targetLang);
    body.append("source_lang", "EN");
    body.append("tag_handling", "xml");
    body.append("ignore_tags", "x");
    body.append("preserve_formatting", "1");
    const postData = body.toString();
    const hostname = apiKey.endsWith(":fx")
      ? "api-free.deepl.com"
      : "api.deepl.com";
    const req = https.request(
      {
        hostname,
        path: "/v2/translate",
        method: "POST",
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`DeepL ${res.statusCode}: ${data}`));
            return;
          }
          try {
            resolve(
              JSON.parse(data).translations.map((t) => restoreNouns(t.text)),
            );
          } catch (e) {
            reject(new Error(`parse error: ${e.message}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function translateStrings(strings, targetLang, apiKey, cache) {
  const key = (s) => `${targetLang}::${s}`;
  const uncached = strings.filter(
    (s) => !Object.prototype.hasOwnProperty.call(cache, key(s)),
  );
  if (uncached.length > 0) {
    console.log(
      `  Translating ${uncached.length} new strings to ${targetLang} via DeepL...`,
    );
    const BATCH = 50;
    for (let i = 0; i < uncached.length; i += BATCH) {
      const batch = uncached.slice(i, i + BATCH);
      const translated = await deepLTranslate(batch, targetLang, apiKey);
      batch.forEach((src, j) => {
        cache[key(src)] = translated[j];
      });
    }
    console.log(`  Done`);
  } else {
    console.log(`  All ${strings.length} strings cached for ${targetLang}`);
  }
  const map = {};
  for (const s of strings) map[s] = cache[key(s)] ?? s;
  return map;
}

// Keys that are Puck structural identifiers — never translated.
const SKIP_KEYS = new Set([
  // ── Routing / identity ──────────────────────────────────────────
  "type",
  "id",
  "slug",
  "locale",
  "href",
  "src",
  "url",
  "ctaHref",
  "ctaUrl",
  "logoHref",
  "browserUrl",
  "link",

  // ── Icon / image references ─────────────────────────────────────
  "icon",
  "iconName",
  "iconType",
  "iconPosition",
  "iconShape",
  "activeIcon",
  "globalIcon",
  "listGlobalIcon",
  "svg",
  "imageUrl",
  "imagePosition",
  "imageBrowserFrame",
  "imageOverflow",
  "imageWidthPx",
  "imageHeight",
  "backgroundImage",
  "backgroundImageOpacity",
  "logoType",
  "logoImageUrl",
  "logoImageWidth",
  "logoImageHeight",
  "logoImagePadding",
  "logoImageBorderRadius",
  "logoImageBgColor",
  "avatarUrl",
  "browserMockupMaxWidth",
  "showBrowserChrome",

  // ── Colors ──────────────────────────────────────────────────────
  "color",
  "backgroundColor",
  "textColor",
  "borderColor",
  "accentColor",
  "bgColor",
  "headingColor",
  "subheadingColor",
  "descriptionColor",
  "titleColor",
  "bodyTextColor",
  "footerTextColor",
  "headerTextColor",
  "linkTextColor",
  "linkHoverColor",
  "borderBottomColor",
  "borderTopColor",
  "dividerColor",
  "quoteColor",
  "authorColor",
  "valueColor",
  "listColor",
  "listAccentColor",
  "hoverTextColor",
  "hoverBackgroundColor",
  "hoverBorderColor",
  "ctaTextColor",
  "ctaBorderColor",
  "ctaBackgroundColor",
  "ctaHoverTextColor",
  "ctaHoverBackgroundColor",
  "ctaHoverBorderColor",
  "gradientFrom",
  "gradientTo",
  "rowEvenBgColor",
  "rowOddBgColor",
  "bottomBarBgColor",
  "bottomBarTextColor",
  "bottomBarBorderColor",
  "bottomBarBg",
  "highlightBgColor",
  "highlightTextColor",
  "highlightColors",
  "highlightUnderlineColor",
  "blobColor1",
  "blobColor2",
  "activeTabBgColor",
  "activeTabTextColor",
  "activeTabMobileTextColor",
  "inactiveTabTextColor",
  "inactiveTabBgColor",
  "activeIndicatorColor",
  "contentBgColor",
  "tabBarBgColor",
  "shadowColor",
  "planNameColor",
  "priceColor",
  "badgeDotColor",
  "iconColor",
  "iconBackground",
  "cardBadgeColor",
  "cardBorderColor",
  "cardBackgroundColor",
  "featureAccentColor",
  "sectionBackgroundColor",

  // ── Gradient ────────────────────────────────────────────────────
  "gradient",
  "gradientDirection",

  // ── Typography (sizes, weights, transforms) ─────────────────────
  "fontFamily",
  "fontSize",
  "fontWeight",
  "weight",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "titleFontSize",
  "titleFontWeight",
  "titleWeight",
  "titleMaxWidth",
  "headingFontSize",
  "headingWeight",
  "headingSize",
  "headingMaxWidth",
  "subheadingFontSize",
  "subheadingWeight",
  "subheadingOpacity",
  "subheadingMaxWidth",
  "taglineFontSize",
  "taglineOpacity",
  "taglineMaxWidth",
  "descriptionFontSize",
  "descriptionWeight",
  "descriptionOpacity",
  "descriptionMaxWidth",
  "linkFontSize",
  "linkFontWeight",
  "logoFontSize",
  "logoFontWeight",
  "columnHeadingFontSize",
  "columnHeadingTransform",
  "columnHeadingLetterSpacing",
  "listFontSize",
  "listFontWeight",
  "bottomBarFontSize",
  "numberSize",
  "valueFontSize",
  "labelFontSize",
  "planNameFontSize",
  "priceFontSize",
  "quoteFontSize",
  "authorFontSize",
  "ctaFontSize",
  "tabFontSize",
  "tabFontWeight",

  // ── Layout & spacing ───────────────────────────────────────────
  "padding",
  "paddingX",
  "paddingY",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginSize",
  "gap",
  "rowGap",
  "maxWidth",
  "minHeight",
  "size",
  "width",
  "height",
  "fullWidth",
  "contentSpacing",
  "itemSpacing",
  "spacing",
  "itemHeight",
  "columnWidth",
  "logoColumnWidth",
  "customPaddingX",
  "customPaddingY",
  "topSpacing",
  "listTopSpacing",
  "listItemSpacing",
  "layout",
  "layoutVariant",
  "columnsLayout",
  "columnSpacing",

  // ── Positioning & alignment ─────────────────────────────────────
  "alignment",
  "contentAlignment",
  "contentVerticalAlignment",
  "position",
  "positionType",
  "linksAlignment",
  "headingAlignment",
  "headingPosition",
  "tabPosition",
  "labelPosition",
  "textAlignment",

  // ── Border & decoration ─────────────────────────────────────────
  "borderTop",
  "borderBottom",
  "borderBottomWidth",
  "borderTopWidth",
  "borderRadius",
  "rounded",
  "shadow",
  "bordered",
  "border",

  // ── Opacity & display ──────────────────────────────────────────
  "opacity",
  "backgroundOpacity",
  "overlayOpacity",
  "linkOpacity",
  "linkHoverOpacity",
  "socialIconOpacity",
  "bottomBarOpacity",
  "display",

  // ── Visibility toggles ─────────────────────────────────────────
  "showIcon",
  "showList",
  "showActions",
  "showConnector",
  "showBottomBar",
  "showFooter",
  "showBorder",
  "showBadge",
  "showCardBadge",
  "showCheckmarks",
  "showDecorationBlobs",
  "showBodyText",
  "showAccordion",
  "showDisclaimer",
  "showHighlightUnderline",

  // ── Animation ──────────────────────────────────────────────────
  "animation",
  "animationDelay",
  "animationDuration",
  "highlightAnimation",

  // ── Interaction / behaviour ─────────────────────────────────────
  "openInNewTab",
  "ctaOpenInNewTab",
  "readOnly",
  "hasDropdown",
  "dropdownType",
  "isHighlighted",
  "highlighted",
  "featureIncluded",
  "scaleOnHover",
  "dragToScroll",
  "pauseOnHover",
  "defaultOpen",
  "isOpen",
  "isActive",
  "stackOnMobile",
  "grayscale",
  "disabled",
  "required",

  // ── Component-specific structural ───────────────────────────────
  "variant",
  "style",
  "panelStyle",
  "mobileMenuStyle",
  "ctaVariant",
  "ctaPaddingX",
  "ctaPaddingY",
  "ctaBorderRadius",
  "listVariant",
  "navbarHeight",
  "logoLinksGap",
  "linksCtaGap",
  "linkGap",
  "backdropBlur",
  "socialIconSize",
  "socialIconGap",
  "objectFit",
  "aspectRatio",
  "activeTab",
  "direction",
  "speed",
  "wrap",
  "justifyContent",
  "alignItems",
  "alignContent",
  "inputType",
  "defaultValue",
  "bold",
  "align",
  "level",
  "contentPadding",
  "contentBorderRadius",
  "contentBorder",
  "contentShadow",
  "wrapperPadding",
  "wrapperBorderRadius",
  "wrapperShadow",
  "wrapperBorder",
  "tabBarPadding",
  "tabPadding",
  "tabGap",
  "tabBorderRadius",
  "tabsWidth",
  "activeIndicatorThickness",
  "legendHeight",
  "legendWidth",
  "filterBy",
  "sortBy",
  "responsive",
  "deviceType",
  "maxResults",
  "charLimit",
  "platform",
  "styled",
  "orientation",
  "thickness",
  "imageRounded",
  "imageShadow",
  "logoHeight",
  "withBorder",
  "emailAddress",
]);

function extractStrings(obj, out = new Set()) {
  if (!obj || typeof obj !== "object") return out;
  if (Array.isArray(obj)) {
    obj.forEach((v) => extractStrings(v, out));
    return out;
  }
  for (const [k, val] of Object.entries(obj)) {
    if (SKIP_KEYS.has(k)) continue;
    if (typeof val === "string") {
      if (isTranslatable(val)) out.add(val);
    } else if (val && typeof val === "object") extractStrings(val, out);
  }
  return out;
}

function applyTranslations(obj, map) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((v) => applyTranslations(v, map));
  const r = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SKIP_KEYS.has(k)) {
      r[k] = v;
      continue;
    } // never touch structural keys
    if (typeof v === "string") r[k] = map[v] ?? v;
    else if (v && typeof v === "object") r[k] = applyTranslations(v, map);
    else r[k] = v;
  }
  return r;
}

async function main() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error(
      "\nError: DeepL API key required.\n" +
        "  DEEPL_API_KEY=<key> node scripts/generate-locale-migrations.js\n" +
        "  -- or --\n" +
        "  node scripts/generate-locale-migrations.js --api-key=<key>\n\n" +
        "  Get a free key (500k chars/month): https://www.deepl.com/pro#developer\n",
    );
    process.exit(1);
  }

  const files = fs.readdirSync(EN_DIR).filter((f) => f.endsWith(".json"));
  console.log(`\nFound ${files.length} English migration files`);
  const cache = loadCache();

  const allStrings = new Set();
  const fileData = files.map((file) => {
    const data = JSON.parse(fs.readFileSync(path.join(EN_DIR, file), "utf8"));
    extractStrings(data, allStrings);
    return { file, data };
  });

  const uniqueStrings = [...allStrings];
  console.log(
    `Extracted ${uniqueStrings.length} unique translatable strings\n`,
  );

  for (const { code, deepl } of TARGET_LANGS) {
    console.log(`── ${code.toUpperCase()} ─────────────────────────────`);
    const map = await translateStrings(uniqueStrings, deepl, apiKey, cache);
    const outDir = path.join(MIGRATIONS_DIR, code);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    for (const { file, data } of fileData) {
      const translated = applyTranslations(data, map);
      translated.locale = code;
      fs.writeFileSync(
        path.join(outDir, file),
        JSON.stringify(translated, null, 2) + "\n",
        "utf8",
      );
    }
    console.log(`  Written ${files.length} files to migrations/${code}/\n`);
  }

  saveCache(cache);
  console.log(`Cache saved to scripts/.translation-cache.json`);
  console.log("Done.\n");
}

main().catch((err) => {
  console.error("\nFatal:", err.message);
  process.exit(1);
});
