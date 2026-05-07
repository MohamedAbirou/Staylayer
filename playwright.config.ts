import { defineConfig } from "@playwright/test";

const apiPort = process.env.PLAYWRIGHT_API_PORT ?? "3001";
const dashboardPort = process.env.PLAYWRIGHT_DASHBOARD_PORT ?? "4174";
const baseURL = `http://localhost:${dashboardPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: {
      width: 1440,
      height: 1100,
    },
  },
  webServer: [
    {
      command: "pnpm --filter @myallocator/api dev",
      url: `http://localhost:${apiPort}/health`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        PORT: apiPort,
      },
    },
    {
      command: `pnpm --filter @myallocator/dashboard dev -- --port ${dashboardPort}`,
      url: `${baseURL}/login`,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        VITE_API_URL: "/api",
      },
    },
  ],
});
