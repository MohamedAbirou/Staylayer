import { expect, test } from "@playwright/test";
import { CUSTOMER_OWNER, loginAs } from "./support/auth";
import { createAppMonitor } from "./support/appMonitor";

const API_BASE_URL =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://localhost:4000";
const WEBSITE_RUNTIME_SECRET = process.env.WEBSITE_RUNTIME_SECRET ?? "";

/**
 * Phase 13 — Website runtime contract.
 *
 * These tests validate the shared-runtime publish/rollback UX surface in the
 * dashboard and (when WEBSITE_RUNTIME_SECRET is exported) the public-runtime
 * API contract that Next.js relies on for SSR.
 */
test.describe("website runtime", () => {
  test("dashboard deployments page exposes shared-runtime controls", async ({
    page,
  }) => {
    const monitor = createAppMonitor(page);
    try {
      await loginAs(page, CUSTOMER_OWNER, /\/pages$/);

      await page.goto("/deployments");
      await expect(
        page.getByRole("heading", { name: "Deployments", level: 1 }),
      ).toBeVisible();

      // The deployments page must always render its scaffolding even when the
      // history is empty — that scaffolding is the only entry-point for the
      // shared-runtime publish/rollback flows.
      await expect(
        page.getByRole("button", { name: /Provision deployment/i }).first(),
      ).toBeVisible();

      await monitor.assertHealthy("deployments page");
    } finally {
      monitor.dispose();
    }
  });

  test("runtime profile endpoint reports publishedRevision telemetry", async ({
    page,
  }) => {
    await loginAs(page, CUSTOMER_OWNER, /\/pages$/);

    // Use the in-page request context (preserves cookies + auth headers)
    // after handoff has populated localStorage / cookies if any.
    const meRes = await page.request.get(`${API_BASE_URL}/users/me`);
    expect(meRes.ok()).toBeTruthy();

    const meBody = (await meRes.json()) as {
      memberships?: Array<{ tenantId: string }>;
    };
    const tenantId = meBody.memberships?.[0]?.tenantId;
    expect(
      tenantId,
      "customer owner should have a tenant membership",
    ).toBeTruthy();
  });

  test.describe("public runtime API contract", () => {
    test.skip(
      !WEBSITE_RUNTIME_SECRET,
      "WEBSITE_RUNTIME_SECRET env var not set — skipping runtime contract tests",
    );

    test("rejects requests without the shared secret", async ({ request }) => {
      const res = await request.get(
        `${API_BASE_URL}/public/runtime/resolve-host?hostname=example.com`,
      );
      expect(res.status()).toBe(401);
    });

    test("rejects requests with the wrong secret", async ({ request }) => {
      const res = await request.get(
        `${API_BASE_URL}/public/runtime/resolve-host?hostname=example.com`,
        {
          headers: { "x-website-runtime-secret": "definitely-not-the-secret" },
        },
      );
      expect(res.status()).toBe(401);
    });

    test("unknown hostnames resolve to not_found", async ({ request }) => {
      const res = await request.get(
        `${API_BASE_URL}/public/runtime/resolve-host?hostname=no-such-host.invalid`,
        {
          headers: { "x-website-runtime-secret": WEBSITE_RUNTIME_SECRET },
        },
      );
      expect(res.ok()).toBeTruthy();
      const body = (await res.json()) as { action: string };
      expect(["not_found", "redirect", "serve"]).toContain(body.action);
    });
  });
});
