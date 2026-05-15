import { ConfigService } from "@nestjs/config";
import { normalizeHostname } from "./public-runtime.util";

const PROVIDER_MANAGED_ROOT_DOMAINS = ["vercel.app"];

export function getConfiguredPlatformRootDomain(
  configService: Pick<ConfigService, "get">,
): string {
  return normalizeHostname(
    configService.get<string>("HOSTED_SITE_ROOT_DOMAIN") ??
      configService.get<string>("PLATFORM_ROOT_DOMAIN"),
  );
}

export function isProviderManagedRootDomain(hostname: string | null): boolean {
  const normalized = normalizeHostname(hostname);

  return PROVIDER_MANAGED_ROOT_DOMAINS.some(
    (rootDomain) =>
      normalized === rootDomain || normalized.endsWith(`.${rootDomain}`),
  );
}

export function isUsablePlatformRootDomain(
  hostname: string | null | undefined,
): boolean {
  const normalized = normalizeHostname(hostname);

  return Boolean(normalized) && !isProviderManagedRootDomain(normalized);
}

export function getPlatformRootDomainIssue(
  hostname: string | null | undefined,
): string | null {
  const normalized = normalizeHostname(hostname);

  if (!normalized) {
    return "No hosted site root domain is configured.";
  }

  if (isProviderManagedRootDomain(normalized)) {
    return "The hosted site root uses a provider-owned vercel.app domain, which cannot route wildcard customer sites.";
  }

  return null;
}
