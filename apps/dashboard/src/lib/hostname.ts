import type { HostnameKind } from "../api/domains";

/**
 * Client-side mirror of the API's hostname classifier so the domain setup
 * wizard can surface DNS guidance before submission. Must stay in sync with
 * `apps/api/src/public-runtime/public-runtime.util.ts#classifyHostname`.
 */
export interface ClassifiedHostname {
  kind: HostnameKind;
  hostname: string;
  apexHost: string;
  companionHost: string | null;
}

export function normalizeHostname(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export function classifyHostname(
  hostname: string,
  platformRootDomain?: string | null,
): ClassifiedHostname | null {
  const normalized = normalizeHostname(hostname);

  if (!normalized || !normalized.includes(".") || normalized.includes(" ")) {
    return null;
  }

  const rootDomain = platformRootDomain
    ? normalizeHostname(platformRootDomain)
    : "";

  if (rootDomain) {
    const suffix = `.${rootDomain}`;
    if (normalized.endsWith(suffix)) {
      const label = normalized.slice(0, -suffix.length);
      if (label.length > 0 && !label.includes(".")) {
        return {
          kind: "platform-subdomain",
          hostname: normalized,
          apexHost: normalized,
          companionHost: null,
        };
      }
    }
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

export function describeHostnameKind(kind: HostnameKind): string {
  switch (kind) {
    case "apex":
      return "Root domain (apex)";
    case "www":
      return "www subdomain";
    case "subdomain":
      return "Subdomain";
    case "platform-subdomain":
      return "Platform subdomain";
  }
}
