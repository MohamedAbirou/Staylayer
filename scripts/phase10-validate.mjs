import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const steps = [
  {
    label: "API launch-critical tests",
    command: process.execPath,
    args: [
      "./node_modules/jest/bin/jest.js",
      "src/auth/guards/roles.guard.spec.ts",
      "src/auth/guards/workspace-scope.guard.spec.ts",
      "src/billing/billing.service.spec.ts",
      "src/billing/billing.controller.spec.ts",
      "src/common/interceptors/logging.interceptor.spec.ts",
      "src/common/filters/http-exception.filter.spec.ts",
      "src/deployments/deployments.controller.spec.ts",
      "src/deployments/deployments.service.spec.ts",
      "src/domains/domains.controller.spec.ts",
      "src/forms/forms.controller.spec.ts",
      "src/forms/forms.service.spec.ts",
      "src/forms/public-submissions.controller.spec.ts",
      "src/pages/pages.controller.spec.ts",
      "src/settings/settings.controller.spec.ts",
      "src/settings/public-settings.controller.spec.ts",
      "--runInBand",
    ],
    cwd: resolve(rootDir, "apps/api"),
  },
  {
    label: "API type-check",
    command: `${pnpmCommand} run type-check`,
    args: [],
    cwd: resolve(rootDir, "apps/api"),
    shell: true,
  },
  {
    label: "Dashboard type-check",
    command: `${pnpmCommand} run type-check`,
    args: [],
    cwd: resolve(rootDir, "apps/dashboard"),
    shell: true,
  },
  {
    label: "Dashboard build",
    command: `${pnpmCommand} run build`,
    args: [],
    cwd: resolve(rootDir, "apps/dashboard"),
    shell: true,
  },
  {
    label: "Website build",
    command: `${pnpmCommand} run build`,
    args: [],
    cwd: resolve(rootDir, "apps/website"),
    shell: true,
  },
];

for (const step of steps) {
  console.log(`\n==> ${step.label}`);
  const result = spawnSync(step.command, step.args, {
    stdio: "inherit",
    shell: step.shell ?? false,
    cwd: step.cwd,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nPhase 10 launch validation passed.");
