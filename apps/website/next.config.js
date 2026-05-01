const path = require("path");

const puckComponentsSrc = path.resolve(
  __dirname,
  "../../packages/puck-components/src/index.ts",
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  i18n: {
    locales: ["en", "es", "fr", "de"],
    defaultLocale: "en",
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
