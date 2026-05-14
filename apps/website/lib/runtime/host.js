export function normalizeHostname(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function normalizePathname(value) {
  const input = String(value || "/").trim() || "/";
  let pathname = input.startsWith("/") ? input : `/${input}`;

  pathname = pathname.replace(/[?#].*$/, "").replace(/\/{2,}/g, "/");

  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  return pathname || "/";
}

export function slugSegmentsToPathname(slug) {
  return Array.isArray(slug) && slug.length > 0 ? `/${slug.join("/")}` : "/";
}

export function pathnameToPageSlug(pathname) {
  const normalized = normalizePathname(pathname);

  if (normalized === "/" || normalized === "/home" || normalized === "/index") {
    return "home";
  }

  return normalized.slice(1);
}

export function getRequestHostname(source) {
  const forwardedHost = normalizeHostname(
    source?.get?.("x-forwarded-host") ?? source?.["x-forwarded-host"] ?? null,
  );
  const host = normalizeHostname(
    source?.get?.("host") ?? source?.host ?? source?.["host"] ?? null,
  );
  return forwardedHost || host;
}

function getApiBaseUrl() {
  return process.env.API_INTERNAL_URL || process.env.API_URL;
}

function getRuntimeSecret() {
  return process.env.WEBSITE_RUNTIME_SECRET || "";
}

export async function fetchHostResolution({
  hostname,
  pathname = "/",
  previewToken,
  vercelId,
  requestId,
}) {
  const apiBaseUrl = getApiBaseUrl();
  const runtimeSecret = getRuntimeSecret();

  if (!apiBaseUrl || !runtimeSecret) {
    throw new Error(
      "Website runtime is missing API_INTERNAL_URL/API_URL or WEBSITE_RUNTIME_SECRET",
    );
  }

  const url = new URL("/public/runtime/resolve-host", apiBaseUrl);
  url.searchParams.set("hostname", normalizeHostname(hostname));
  url.searchParams.set("pathname", normalizePathname(pathname));

  if (previewToken) {
    url.searchParams.set("previewToken", previewToken);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "x-website-runtime-secret": runtimeSecret,
      ...(vercelId ? { "x-vercel-id": vercelId } : {}),
      ...(requestId ? { "x-request-id": requestId } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = new Error(
      `Host resolution failed with status ${response.status}`,
    );
    error.status = response.status;
    throw error;
  }

  return response.json();
}
