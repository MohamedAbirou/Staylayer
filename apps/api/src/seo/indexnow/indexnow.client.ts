/**
 * IndexNow protocol client.
 *
 * Spec: https://www.indexnow.org/documentation
 *
 * Submitting to api.indexnow.org fans the URL list out to every participating
 * engine (Bing, Yandex, Naver, Seznam, Yep) in a single request. Per the spec:
 *   - Max 10,000 URLs per request
 *   - All URLs must be on the same host
 *   - The host must serve the verification key file at https://{host}/{key}.txt
 *
 * Failures are NOT retried in this client — the caller wraps the call in a
 * SitemapSubmissionLog row so the operator can re-run from the dashboard.
 */

import { Logger } from "@nestjs/common";

import { INDEXNOW_ENDPOINT } from "../crawlers/crawler-catalog";

export interface IndexNowSubmitInput {
  host: string;
  key: string;
  keyLocation?: string;
  urlList: string[];
}

export interface IndexNowSubmitResult {
  ok: boolean;
  status: number;
  body: string;
}

const MAX_URLS_PER_SUBMISSION = 10_000;
const MAX_BODY_CAPTURE_LENGTH = 4_000;

const logger = new Logger("IndexNowClient");

export async function submitToIndexNow(
  input: IndexNowSubmitInput,
  fetchImpl: typeof fetch = fetch,
): Promise<IndexNowSubmitResult> {
  if (!input.host || !input.key) {
    throw new Error("IndexNow submission requires both host and key");
  }
  if (input.urlList.length === 0) {
    return { ok: true, status: 200, body: "no urls supplied — skipped" };
  }
  if (input.urlList.length > MAX_URLS_PER_SUBMISSION) {
    throw new Error(
      `IndexNow allows at most ${MAX_URLS_PER_SUBMISSION} URLs per submission`,
    );
  }

  const sameOrigin = input.urlList.every((url) => {
    try {
      const u = new URL(url);
      return u.host.toLowerCase() === input.host.toLowerCase();
    } catch {
      return false;
    }
  });
  if (!sameOrigin) {
    throw new Error(
      "All URLs in an IndexNow submission must share the same host",
    );
  }

  const body = {
    host: input.host,
    key: input.key,
    keyLocation: input.keyLocation ?? `https://${input.host}/${input.key}.txt`,
    urlList: input.urlList,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = (await response.text().catch(() => "")).slice(
      0,
      MAX_BODY_CAPTURE_LENGTH,
    );
    const ok = response.status >= 200 && response.status < 300;

    if (!ok) {
      logger.warn(
        `IndexNow submission rejected host=${input.host} status=${response.status} body=${text.slice(0, 200)}`,
      );
    }

    return { ok, status: response.status, body: text };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown IndexNow error";
    logger.error(`IndexNow request failed host=${input.host} error=${message}`);
    return { ok: false, status: 0, body: message };
  } finally {
    clearTimeout(timeout);
  }
}
