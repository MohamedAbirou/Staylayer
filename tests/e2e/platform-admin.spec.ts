import { expect, test, type Page } from "@playwright/test";
import { loginAs, PLATFORM_OWNER } from "./support/auth";
import { createAppMonitor } from "./support/appMonitor";
import { waitForAnyText } from "./support/wait";

type RouteCheck = {
  name: string;
  path: string;
  heading: string | RegExp;
  readyTexts: readonly string[];
};

const PLATFORM_ROUTES: readonly RouteCheck[] = [
  {
    name: "admin tenants",
    path: "/admin/tenants",
    heading: "Tenants",
    readyTexts: ["Azure Bay Hospitality", "Pine & Peak Hospitality"],
  },
  {
    name: "admin deployments",
    path: "/admin/deployments",
    heading: "Deployments",
    readyTexts: ["No deployments found.", "Azure Bay Villas"],
  },
  {
    name: "admin subscriptions",
    path: "/admin/subscriptions",
    heading: "Subscriptions",
    readyTexts: [
      "Azure Bay Hospitality",
      "Pine and Peak Hospitality",
      "No subscriptions found.",
    ],
  },
  {
    name: "admin domains",
    path: "/admin/domains",
    heading: "Domains",
    readyTexts: ["No domains found.", "Azure Bay Villas", "pineandpeak"],
  },
  {
    name: "admin inquiry analytics",
    path: "/admin/forms",
    heading: "Inquiry Volume",
    readyTexts: ["Azure Bay Villas", "Pine & Peak Glamping"],
  },
  {
    name: "admin audit log",
    path: "/admin/audit",
    heading: "Audit Log",
    readyTexts: ["No audit entries yet.", "superadmin@staylayer.com"],
  },
];

async function visitRoute(page: Page, route: RouteCheck) {
  await page.goto(route.path);
  await expect(
    page.getByRole("heading", { name: route.heading }),
  ).toBeVisible();
  await waitForAnyText(page, route.readyTexts);
}

test.describe("platform admin console", () => {
  test("loads every operator route without app errors", async ({ page }) => {
    const monitor = createAppMonitor(page);

    try {
      await loginAs(page, PLATFORM_OWNER, /\/admin(?:\/tenants)?$/);

      for (const route of PLATFORM_ROUTES) {
        monitor.clear();
        await visitRoute(page, route);
        await monitor.assertHealthy(route.name);
      }
    } finally {
      monitor.dispose();
    }
  });

  test("can suspend and reactivate a tenant cleanly", async ({ page }) => {
    const monitor = createAppMonitor(page);

    try {
      await loginAs(page, PLATFORM_OWNER, /\/admin(?:\/tenants)?$/);
      await visitRoute(page, PLATFORM_ROUTES[0]);

      const pineAndPeakRow = page.getByRole("row", {
        name: /Pine\s*&\s*Peak Hospitality/i,
      });

      await expect(pineAndPeakRow).toBeVisible();

      monitor.clear();
      await pineAndPeakRow.getByRole("button", { name: "Suspend" }).click();

      const suspendDialog = page.locator("dialog");
      await expect(suspendDialog).toContainText("Suspend tenant?");
      await suspendDialog.getByRole("button", { name: "Suspend" }).click();

      await expect(page.getByText("Tenant suspended.")).toBeVisible();
      await expect(
        page.getByRole("row", { name: /Pine\s*&\s*Peak Hospitality/i }),
      ).toContainText("Suspended");
      await monitor.assertHealthy("tenant suspension flow");

      monitor.clear();
      const suspendedRow = page.getByRole("row", {
        name: /Pine\s*&\s*Peak Hospitality/i,
      });
      await suspendedRow.getByRole("button", { name: "Reactivate" }).click();

      const reactivateDialog = page.locator("dialog");
      await expect(reactivateDialog).toContainText("Reactivate tenant?");
      await reactivateDialog
        .getByRole("button", { name: "Reactivate" })
        .click();

      await expect(page.getByText("Tenant reactivated.")).toBeVisible();
      await expect(
        page.getByRole("row", { name: /Pine\s*&\s*Peak Hospitality/i }),
      ).toContainText("Active");
      await monitor.assertHealthy("tenant reactivation flow");
    } finally {
      monitor.dispose();
    }
  });
});
