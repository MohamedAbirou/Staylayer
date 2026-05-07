import { expect, test, type Page } from "@playwright/test";
import { CUSTOMER_OWNER, loginAs } from "./support/auth";
import { createAppMonitor } from "./support/appMonitor";
import { waitForAnyText } from "./support/wait";

type RouteCheck = {
  name: string;
  path: string;
  assertReady: (page: Page) => Promise<void>;
};

const CUSTOMER_ROUTES: readonly RouteCheck[] = [
  {
    name: "dashboard home",
    path: "/",
    assertReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: /Good to see you/i }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "New Page" }),
      ).toBeVisible();
    },
  },
  {
    name: "pages list",
    path: "/pages",
    assertReady: async (page) => {
      await expect(page.getByRole("heading", { name: "Pages" })).toBeVisible();
      await waitForAnyText(page, [
        "Azure Bay Villas | Coastal stays by direct inquiry",
        "Azure Bay Villas | Villas frente al mar por consulta directa",
      ]);
    },
  },
  {
    name: "new page wizard",
    path: "/pages/new",
    assertReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: "Create New Page" }),
      ).toBeVisible();
      await waitForAnyText(page, ["Hospitality presets", "Homepage"]);
    },
  },
  {
    name: "editor",
    path: "/editor/home?locale=en",
    assertReady: async (page) => {
      await expect(
        page.getByRole("button", { name: "Dashboard" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    },
  },
  {
    name: "preview",
    path: "/preview/home?locale=en",
    assertReady: async (page) => {
      await waitForAnyText(page, ["PREVIEW MODE"]);
      await expect(
        page.getByRole("button", { name: /Back to Editor/i }),
      ).toBeVisible();
    },
  },
  {
    name: "settings",
    path: "/settings",
    assertReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: "Settings" }),
      ).toBeVisible();
      await waitForAnyText(page, ["Site Name", "SEO Defaults"]);
    },
  },
  {
    name: "forms",
    path: "/forms",
    assertReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: "Inquiry Studio" }),
      ).toBeVisible();
      await waitForAnyText(page, ["Inbox", "Form Studio", "Email Studio"]);
    },
  },
  {
    name: "domains",
    path: "/domains",
    assertReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: "Domains" }),
      ).toBeVisible();
      await waitForAnyText(page, ["Add domain", "No domains connected yet"]);
    },
  },
  {
    name: "deployments",
    path: "/deployments",
    assertReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: "Deployments", level: 1 }),
      ).toBeVisible();
      await waitForAnyText(page, [
        "Provision deployment",
        "No deployment history yet",
      ]);
    },
  },
  {
    name: "billing",
    path: "/billing",
    assertReady: async (page) => {
      await expect(
        page.getByRole("heading", { name: "Billing & Plan" }),
      ).toBeVisible();
      await waitForAnyText(page, ["Current plan", "Launch"]);
    },
  },
  {
    name: "workspace studio",
    path: "/workspace",
    assertReady: async (page) => {
      await expect(
        page.getByRole("heading", {
          name: /Architect the next property, crew, and site handoff/i,
        }),
      ).toBeVisible();
      await waitForAnyText(page, ["Site atlas", "Crew board"]);
    },
  },
  {
    name: "onboarding wizard",
    path: "/onboarding",
    assertReady: async (page) => {
      await expect(
        page.getByRole("heading", {
          name: "What type of property are you creating a site for?",
        }),
      ).toBeVisible();
    },
  },
];

async function visitRoute(page: Page, route: RouteCheck) {
  await page.goto(route.path);
  await route.assertReady(page);
}

test.describe("customer workspace", () => {
  test("loads every wired customer route without app errors", async ({
    page,
  }) => {
    const monitor = createAppMonitor(page);

    try {
      await loginAs(page, CUSTOMER_OWNER, /\/pages$/);

      for (const route of CUSTOMER_ROUTES) {
        monitor.clear();
        await visitRoute(page, route);
        await monitor.assertHealthy(route.name);
      }
    } finally {
      monitor.dispose();
    }
  });

  test("keeps the customer creation and inquiry tools interactive", async ({
    page,
  }) => {
    const monitor = createAppMonitor(page);

    try {
      await loginAs(page, CUSTOMER_OWNER, /\/pages$/);

      monitor.clear();
      await page.goto("/pages/new");
      await page.getByRole("button", { name: "Accommodation" }).click();
      await expect(page.getByLabel("Title")).toHaveValue("Accommodation");
      await expect(page.getByLabel("Slug")).toHaveValue("accommodation");
      await monitor.assertHealthy("new page preset selection");

      monitor.clear();
      await page.goto("/forms");
      await expect(
        page.getByRole("heading", { name: "Inquiry Studio" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Form Studio" }).click();
      await expect(
        page.getByRole("heading", { name: "Reusable Forms" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "New form" }).click();
      await expect(
        page.getByRole("heading", { name: "Create a new form" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Email Studio" }).click();
      await expect(
        page.getByRole("heading", { name: "Branded Email Studio" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Refresh preview" }).click();
      await waitForAnyText(page, [
        "New Primary inquiry form submission",
        "We received your Azure Bay Villas request",
      ]);
      await monitor.assertHealthy("forms and email studio interactions");

      monitor.clear();
      await page.goto("/workspace");
      await expect(
        page.getByRole("heading", {
          name: /Architect the next property, crew, and site handoff/i,
        }),
      ).toBeVisible();
      await expect(
        page.getByText("Current site: Azure Bay Villas"),
      ).toBeVisible();
      await page
        .getByRole("textbox", { name: "Filter by email" })
        .fill("editor");
      await expect(page.getByText("editor@azurebayvillas.com")).toBeVisible();
      await monitor.assertHealthy("workspace roster filtering");

      monitor.clear();
      await page.goto("/onboarding");
      await page.getByRole("button", { name: "Villa" }).click();
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(
        page.getByRole("heading", {
          name: "What language will your site use primarily?",
        }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Continue" }).click();
      await expect(
        page.getByRole("heading", { name: "Choose your starter pages" }),
      ).toBeVisible();
      await expect(page.getByText("Contact & Inquiry")).toBeVisible();
      await monitor.assertHealthy("onboarding wizard navigation");
    } finally {
      monitor.dispose();
    }
  });
});
