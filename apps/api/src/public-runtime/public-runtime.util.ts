export const SUPPORTED_RUNTIME_LOCALES = ["en", "es", "fr", "de"] as const;

export function normalizeHostname(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function normalizePathname(value: string | null | undefined): string {
  const input = String(value ?? "/").trim() || "/";
  let pathname = input.startsWith("/") ? input : `/${input}`;

  pathname = pathname.replace(/[?#].*$/, "").replace(/\/{2,}/g, "/");

  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }

  return pathname || "/";
}

export function isHomepagePathname(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return (
    normalized === "/" || normalized === "/home" || normalized === "/index"
  );
}

export function pathnameToSlug(pathname: string): string {
  const normalized = normalizePathname(pathname);
  return isHomepagePathname(normalized) ? "home" : normalized.slice(1);
}

export function pathnameToCanonicalPath(pathname: string): string {
  return isHomepagePathname(pathname) ? "/" : normalizePathname(pathname);
}

export function buildAbsoluteUrl(hostname: string, pathname: string): string {
  const canonicalPath = pathnameToCanonicalPath(pathname);
  return canonicalPath === "/"
    ? `https://${hostname}`
    : `https://${hostname}${canonicalPath}`;
}

export function stripWww(hostname: string): string {
  const normalized = normalizeHostname(hostname);
  return normalized.startsWith("www.") ? normalized.slice(4) : normalized;
}

export function companionHost(hostname: string): string {
  const normalized = normalizeHostname(hostname);
  return normalized.startsWith("www.")
    ? normalized.slice(4)
    : `www.${normalized}`;
}

export function isWwwHost(hostname: string): boolean {
  return normalizeHostname(hostname).startsWith("www.");
}

export type HostnameKind = "platform-subdomain" | "www" | "apex" | "subdomain";

export interface ClassifiedHostname {
  kind: HostnameKind;
  hostname: string;
  apexHost: string;
  companionHost: string | null;
}

/**
 * Classify a hostname relative to the platform root domain.
 *
 * - `platform-subdomain` : `<label>.<platformRootDomain>`. No companion.
 * - `www`                : `www.<apex>` where apex has exactly one dot or
 *                          is itself a registrable apex.
 * - `apex`               : a registrable apex (e.g. `example.com`).
 * - `subdomain`          : any other sub-host (e.g. `shop.example.com`,
 *                          `staging.example.co.uk`). No www companion.
 */
export function classifyHostname(
  hostname: string,
  platformRootDomain?: string | null,
): ClassifiedHostname {
  const normalized = normalizeHostname(hostname);
  const rootDomain = platformRootDomain
    ? normalizeHostname(platformRootDomain)
    : "";

  if (rootDomain && extractPlatformSubdomain(normalized, rootDomain) !== null) {
    return {
      kind: "platform-subdomain",
      hostname: normalized,
      apexHost: normalized,
      companionHost: null,
    };
  }

  const labels = normalized.split(".").filter((label) => label.length > 0);

  if (labels.length === 2) {
    return {
      kind: "apex",
      hostname: normalized,
      apexHost: normalized,
      companionHost: `www.${normalized}`,
    };
  }

  if (labels.length >= 3 && labels[0] === "www") {
    const apex = labels.slice(1).join(".");
    return {
      kind: "www",
      hostname: normalized,
      apexHost: apex,
      companionHost: apex,
    };
  }

  return {
    kind: "subdomain",
    hostname: normalized,
    apexHost: normalized,
    companionHost: null,
  };
}

export function extractPlatformSubdomain(
  hostname: string,
  rootDomain: string,
): string | null {
  const normalizedHost = normalizeHostname(hostname);
  const normalizedRootDomain = normalizeHostname(rootDomain);

  if (!normalizedHost || !normalizedRootDomain) {
    return null;
  }

  const suffix = `.${normalizedRootDomain}`;
  if (!normalizedHost.endsWith(suffix)) {
    return null;
  }

  const label = normalizedHost.slice(0, -suffix.length);
  return label.length > 0 && !label.includes(".") ? label : null;
}

export function isSupportedRuntimeLocale(
  value: string | null | undefined,
): value is (typeof SUPPORTED_RUNTIME_LOCALES)[number] {
  return SUPPORTED_RUNTIME_LOCALES.includes(
    String(
      value ?? "",
    ).toLowerCase() as (typeof SUPPORTED_RUNTIME_LOCALES)[number],
  );
}
