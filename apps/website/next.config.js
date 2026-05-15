const path = require("path");

const puckComponentsSrc = path.resolve(
  __dirname,
  "../../packages/puck-components/src/index.ts",
);

const imageHosts = (process.env.PUBLIC_IMAGE_HOSTS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@staylayer/puck-components", "@puckeditor/core"],
  images: {
    remotePatterns: imageHosts.map((hostname) => ({
      protocol: "https",
      hostname,
    })),
  },
  webpack(config) {
    config.resolve.alias["@staylayer/puck-components"] = puckComponentsSrc;
    return config;
  },
};

module.exports = nextConfig;
