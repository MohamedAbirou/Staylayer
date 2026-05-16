import { cache } from "react";
import { normalizeHostname, normalizePathname } from "./host";

function getApiBaseUrl() {
  return process.env.API_INTERNAL_URL || process.env.API_URL;
}

function getRuntimeSecret() {
  return process.env.WEBSITE_RUNTIME_SECRET || "";
}

async function fetchRuntimeJson(pathname, searchParams, options = {}) {
  const apiBaseUrl = getApiBaseUrl();
  const runtimeSecret = getRuntimeSecret();

  if (!apiBaseUrl || !runtimeSecret) {
    throw new Error(
      "Website runtime is missing API_INTERNAL_URL/API_URL or WEBSITE_RUNTIME_SECRET",
    );
  }

  const url = new URL(pathname, apiBaseUrl);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      "x-website-runtime-secret": runtimeSecret,
      ...(options.hostname
        ? { "x-forwarded-host": normalizeHostname(options.hostname) }
        : {}),
      ...(options.requestId ? { "x-request-id": options.requestId } : {}),
    },
    cache: options.cacheMode || "force-cache",
    ...(options.nextOptions ? { next: options.nextOptions } : {}),
  });

  if (response.status === 404) {
    const error = new Error("Runtime payload not found");
    error.code = "RUNTIME_NOT_FOUND";
    error.status = 404;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      `Runtime request failed with status ${response.status}`,
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export const fetchPublicRuntimePage = cache(
  async ({ hostname, pathname, locale, draft = false, requestId }) => {
    const normalizedHostname = normalizeHostname(hostname);
    const normalizedPathname = normalizePathname(pathname);

    return fetchRuntimeJson(
      "/public/runtime/page",
      {
        hostname: normalizedHostname,
        pathname: normalizedPathname,
        locale,
        draft: draft ? "1" : undefined,
      },
      {
        hostname: normalizedHostname,
        requestId,
        cacheMode: draft ? "no-store" : "force-cache",
        nextOptions: draft
          ? undefined
          : {
              revalidate: 300,
              tags: [
                `host:${normalizedHostname}`,
                `page:${normalizedHostname}:${normalizedPathname}`,
              ],
            },
      },
    );
  },
);

export const fetchPublicRuntimeRoutes = cache(
  async ({ hostname, requestId }) => {
    const normalizedHostname = normalizeHostname(hostname);

    return fetchRuntimeJson(
      "/public/runtime/routes",
      {
        hostname: normalizedHostname,
      },
      {
        hostname: normalizedHostname,
        requestId,
        cacheMode: "force-cache",
        nextOptions: {
          revalidate: 300,
          tags: [`host:${normalizedHostname}`, `routes:${normalizedHostname}`],
        },
      },
    );
  },
);

export const fetchPublicRuntimeSiteMeta = cache(
  async ({ hostname, requestId }) => {
    const normalizedHostname = normalizeHostname(hostname);

    return fetchRuntimeJson(
      "/public/runtime/site-meta",
      {
        hostname: normalizedHostname,
      },
      {
        hostname: normalizedHostname,
        requestId,
        cacheMode: "force-cache",
        nextOptions: {
          revalidate: 300,
          tags: [
            `host:${normalizedHostname}`,
            `site-meta:${normalizedHostname}`,
          ],
        },
      },
    );
  },
);

export async function verifyIndexNowKey({ hostname, key, requestId }) {
  const normalizedHostname = normalizeHostname(hostname);
  return fetchRuntimeJson(
    "/public/runtime/indexnow-verify",
    { hostname: normalizedHostname, key },
    {
      hostname: normalizedHostname,
      requestId,
      cacheMode: "no-store",
    },
  );
}
