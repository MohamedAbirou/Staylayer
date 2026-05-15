import { expect, type Page } from "@playwright/test";

const API_BASE_URL =
  process.env.PLAYWRIGHT_API_BASE_URL ?? "http://localhost:4000";

export const PLATFORM_OWNER = {
  email: "superadmin@staylayer.com",
  password: "SuperAdmin123!",
};

export const CUSTOMER_OWNER = {
  email: "owner@azurebayvillas.com",
  password: "AzureBay123!",
};

export async function loginAs(
  page: Page,
  credentials: { email: string; password: string },
  expectedPath: RegExp,
) {
  const response = await page.request.post(`${API_BASE_URL}/auth/login`, {
    data: credentials,
  });

  expect(response.ok()).toBeTruthy();

  const authResponse = (await response.json()) as {
    accessToken: string;
    user: { platformRole: string | null };
  };

  const payload = Buffer.from(JSON.stringify(authResponse)).toString(
    "base64url",
  );

  await page.goto(`/auth/handoff#payload=${payload}`);

  await expect(page).toHaveURL(expectedPath);
}
