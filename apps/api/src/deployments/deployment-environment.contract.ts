import {
  DeploymentProviderEnvironment,
  SiteDeploymentContext,
} from "./deployment-provider.port";

export const OPERATOR_MANAGED_ENVIRONMENT_DESCRIPTIONS: Record<string, string> =
  {
    CMS_API_URL: "Internal CMS API base URL consumed by the website runtime.",
    NEXT_PUBLIC_CMS_API_URL:
      "Public CMS API URL exposed to the website frontend build.",
    REQUIRE_CMS_DATA:
      "Forces the website runtime to fetch CMS content before serving pages.",
    SITE_ID: "Internal site identifier used for CMS and content lookups.",
    NEXT_PUBLIC_SITE_ID:
      "Public site identifier exposed to the website frontend build.",
    SITE_SLUG: "Normalized site slug available during runtime.",
    REVALIDATE_SECRET: "Primary revalidation secret managed by the platform.",
    REVALIDATION_SECRET:
      "Legacy revalidation secret alias kept for compatibility.",
    PRIMARY_LOCALE: "Primary locale used by the website runtime.",
    ENABLE_EXPERIMENTAL_COREPACK:
      "Ensures Corepack is enabled for deterministic pnpm installs.",
    ENABLED_LOCALES: "Comma-separated list of locales enabled for the site.",
    NEXT_PUBLIC_BRAND_NAME:
      "Brand name injected into the website frontend runtime.",
    NEXT_PUBLIC_BRAND_URL:
      "Canonical public brand URL when a primary custom domain is active.",
  };

export const OPERATOR_MANAGED_ENVIRONMENT_KEYS = new Set(
  Object.keys(OPERATOR_MANAGED_ENVIRONMENT_DESCRIPTIONS),
);

export function buildOperatorManagedEnvironmentContract(input: {
  site: SiteDeploymentContext;
  cmsApiUrl: string;
  revalidateSecret: string;
}): DeploymentProviderEnvironment[] {
  const environment: DeploymentProviderEnvironment[] = [
    {
      key: "CMS_API_URL",
      value: input.cmsApiUrl,
    },
    {
      key: "NEXT_PUBLIC_CMS_API_URL",
      value: input.cmsApiUrl,
    },
    {
      key: "REQUIRE_CMS_DATA",
      value: "1",
    },
    {
      key: "SITE_ID",
      value: input.site.siteId,
    },
    {
      key: "NEXT_PUBLIC_SITE_ID",
      value: input.site.siteId,
    },
    {
      key: "SITE_SLUG",
      value: input.site.siteSlug,
    },
    {
      key: "REVALIDATE_SECRET",
      value: input.revalidateSecret,
      type: "encrypted",
    },
    {
      key: "REVALIDATION_SECRET",
      value: input.revalidateSecret,
      type: "encrypted",
    },
    {
      key: "PRIMARY_LOCALE",
      value: input.site.primaryLocale,
    },
    {
      key: "ENABLE_EXPERIMENTAL_COREPACK",
      value: "1",
    },
    {
      key: "ENABLED_LOCALES",
      value: input.site.enabledLocales.join(","),
    },
    {
      key: "NEXT_PUBLIC_BRAND_NAME",
      value: input.site.siteName,
    },
  ];

  if (input.site.primaryDomain) {
    environment.push({
      key: "NEXT_PUBLIC_BRAND_URL",
      value: `https://${input.site.primaryDomain}`,
    });
  }

  return environment;
}
