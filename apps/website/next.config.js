const path = require("path");

const puckComponentsSrc = path.resolve(
  __dirname,
  "../../packages/puck-components/src/index.ts",
);

const SUPPORTED_LOCALES = ["en", "es", "fr", "de"];

function getConfiguredLocales() {
  const defaultLocale = (process.env.PRIMARY_LOCALE || "en").trim() || "en";
  const configuredLocales = (process.env.ENABLED_LOCALES || "")
    .split(",")
    .map((locale) => locale.trim())
    .filter(Boolean);
  const locales = Array.from(new Set([defaultLocale, ...configuredLocales]));
  const invalidLocales = locales.filter(
    (locale) => !SUPPORTED_LOCALES.includes(locale),
  );

  if (!SUPPORTED_LOCALES.includes(defaultLocale) || invalidLocales.length > 0) {
    throw new Error(
      `Unsupported locale configuration for dedicated site runtime: ${locales.join(", ")}`,
    );
  }

  return {
    locales,
    defaultLocale,
  };
}

const { locales, defaultLocale } = getConfiguredLocales();

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales,
    defaultLocale,
  },
  // Transpile the raw source so Next.js compiles the TSX directly,
  // same as the Vite alias in the dashboard.
  transpilePackages: ["@myallocator/puck-components", "@puckeditor/core"],
  webpack(config) {
    // Point the package alias to the raw TypeScript source, bypassing the
    // stale dist/ — mirrors the Vite resolve.alias in apps/dashboard/vite.config.ts
    config.resolve.alias["@myallocator/puck-components"] = puckComponentsSrc;
    return config;
  },
};

module.exports = nextConfig;
