import { expect, type Page } from "@playwright/test";

export const PLATFORM_OWNER = {
  email: "superadmin@myallocator.com",
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
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "MyAllocator CMS" }),
  ).toBeVisible();

  await page.getByRole("textbox", { name: "Email" }).fill(credentials.email);
  await page.locator('input[type="password"]').fill(credentials.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(expectedPath);
}
