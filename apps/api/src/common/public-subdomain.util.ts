export const RESERVED_PUBLIC_SUBDOMAINS = new Set(["www", "dashboard", "api"]);
export const MAX_PUBLIC_SUBDOMAIN_LENGTH = 63;

export function normalizePublicSubdomainLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, MAX_PUBLIC_SUBDOMAIN_LENGTH)
    .replace(/-+$/g, "");
}

export function buildPublicSubdomainCandidate(
  baseValue: string,
  attempt: number,
): string {
  const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
  const maxBaseLength = Math.max(
    1,
    MAX_PUBLIC_SUBDOMAIN_LENGTH - suffix.length,
  );
  const trimmedBase = baseValue.slice(0, maxBaseLength).replace(/-+$/g, "");
  return `${trimmedBase || "site"}${suffix}`;
}
