import { expect, type Page } from "@playwright/test";

interface RecordedError {
  kind: string;
  detail: string;
}

function isApiUrl(url: string): boolean {
  return (
    url.includes("/api/") ||
    url.includes(":3001/") ||
    url.includes("127.0.0.1:3001/")
  );
}

function normalizeSnippet(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

export function createAppMonitor(page: Page) {
  const errors: RecordedError[] = [];

  const onPageError = (error: Error) => {
    errors.push({ kind: "pageerror", detail: error.message });
  };

  const onRequestFailed = (request: {
    url: () => string;
    method: () => string;
    failure: () => { errorText?: string } | null;
  }) => {
    if (!isApiUrl(request.url())) {
      return;
    }

    const errorText = request.failure()?.errorText ?? "request failed";

    if (errorText.includes("ERR_ABORTED")) {
      return;
    }

    errors.push({
      kind: "requestfailed",
      detail: `${request.method()} ${request.url()} => ${errorText}`,
    });
  };

  const onResponse = (response: {
    url: () => string;
    status: () => number;
    request: () => { method: () => string };
    text: () => Promise<string>;
  }) => {
    void (async () => {
      if (!isApiUrl(response.url()) || response.status() < 400) {
        return;
      }

      const method = response.request().method();
      const status = response.status();
      let snippet = "";

      try {
        snippet = normalizeSnippet(await response.text());
      } catch {
        snippet = "";
      }

      errors.push({
        kind: "api",
        detail: `${method} ${response.url()} => ${status}${snippet ? ` :: ${snippet}` : ""}`,
      });
    })();
  };

  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);

  return {
    clear() {
      errors.length = 0;
    },
    async assertHealthy(context: string) {
      await page.waitForTimeout(300);

      expect(
        errors,
        [
          `Application errors were detected while validating ${context}.`,
          ...errors.map((error) => `- ${error.kind}: ${error.detail}`),
        ].join("\n"),
      ).toEqual([]);
    },
    dispose() {
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
    },
  };
}
