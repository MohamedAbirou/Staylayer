import type { Page } from "@playwright/test";

export async function waitForAnyText(
  page: Page,
  candidates: readonly string[],
  timeout = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    for (const candidate of candidates) {
      const locator = page.getByText(candidate, { exact: false }).first();

      if (await locator.isVisible().catch(() => false)) {
        return candidate;
      }
    }

    await page.waitForTimeout(200);
  }

  throw new Error(`Timed out waiting for one of: ${candidates.join(", ")}`);
}
