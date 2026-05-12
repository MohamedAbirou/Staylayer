const CMS_API_URL =
  process.env.NEXT_PUBLIC_CMS_API_URL ||
  process.env.CMS_API_URL ||
  "http://localhost:4000";
const BUILD_TIMESTAMP = new Date().toISOString();
const SUPPORTED_LOCALES = ["en", "es", "fr", "de"];
const HOMEPAGE_SLUG_ALIASES = new Set(["", "index", "home"]);

class SiteRuntimeConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "SiteRuntimeConfigError";
  }
}

function sanitizeBrandHostname(brandName) {
  const normalized = String(brandName || "BrandName")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "brandname";
}

function getConfiguredSiteId() {
  const serverSiteId = (process.env.SITE_ID || "").trim();
  const publicSiteId = (process.env.NEXT_PUBLIC_SITE_ID || "").trim();

  if (serverSiteId && publicSiteId && serverSiteId !== publicSiteId) {
    throw new SiteRuntimeConfigError(
      "SITE_ID and NEXT_PUBLIC_SITE_ID must match for site-scoped sitemap generation",
    );
  }

  const siteId = publicSiteId || serverSiteId;

  if (!siteId) {
    return null;
  }

  return siteId;
}

function hasDedicatedSiteRuntime() {
  return Boolean(getConfiguredSiteId());
}

function getConfiguredBrandUrl() {
  const configuredBrandUrl = (process.env.NEXT_PUBLIC_BRAND_URL || "").trim();
  const fallbackBrandUrl = `https://${sanitizeBrandHostname(process.env.NEXT_PUBLIC_BRAND_NAME || "BrandName")}.com`;

  if (configuredBrandUrl) {
    try {
      return new URL(configuredBrandUrl).toString().replace(/\/$/, "");
    } catch {
      return fallbackBrandUrl;
    }
  }

  return fallbackBrandUrl;
}

function getConfiguredLocales() {
  const defaultLocale = (process.env.PRIMARY_LOCALE || "en").trim() || "en";
  const configuredLocales = (process.env.ENABLED_LOCALES || "")
    .split(",")
    .map((locale) => locale.trim())
    .filter(Boolean);
  const locales = Array.from(new Set([defaultLocale, ...configuredLocales]));
  const invalidLocales = locales.filter(
    (locale) => !SUPPORTED_LOCALES.includes(locale),
  );

  if (!SUPPORTED_LOCALES.includes(defaultLocale) || invalidLocales.length > 0) {
    throw new SiteRuntimeConfigError(
      `Unsupported locale configuration for dedicated site sitemap generation: ${locales.join(", ")}`,
    );
  }

  return {
    locales,
    defaultLocale,
  };
}

function buildCmsUrl(path, params = {}) {
  const url = new URL(path, CMS_API_URL);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}

function isHomepageSlug(slug = "") {
  return HOMEPAGE_SLUG_ALIASES.has(String(slug).trim().toLowerCase());
}

function getRouteForPage(slug, locale, defaultLocale) {
  const normalizedSlug = String(slug || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  const localePrefix = locale && locale !== defaultLocale ? `/${locale}` : "";

  if (isHomepageSlug(normalizedSlug)) {
    return localePrefix || "/";
  }

  return `${localePrefix}/${normalizedSlug}`;
}

async function fetchPublishedPages() {
  try {
    const siteId = getConfiguredSiteId();
    if (!siteId) {
      return [];
    }

    const { locales } = getConfiguredLocales();
    const response = await fetch(buildCmsUrl("/pages/published", { siteId }), {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`CMS API error: ${response.status}`);
    }

    const body = await response.json();
    const pages = Array.isArray(body) ? body : body.data || [];

    return pages.filter((page) => locales.includes(page.locale));
  } catch (error) {
    if (error instanceof SiteRuntimeConfigError) {
      throw error;
    }

    console.error("Failed to load published sitemap paths", error);
    return [];
  }
}

async function fetchPublicSettings() {
  try {
    const siteId = getConfiguredSiteId();
    if (!siteId) {
      return null;
    }

    const response = await fetch(buildCmsUrl("/settings/public", { siteId }), {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    if (error instanceof SiteRuntimeConfigError) {
      throw error;
    }

    console.error("Failed to load public sitemap settings", error);
    return null;
  }
}

function groupPagesBySlug(pages) {
  const groups = new Map();

  for (const page of pages) {
    const slug = String(page.slug || "").trim();
    const locale = String(page.locale || "").trim();
    const key = isHomepageSlug(slug) ? "__home__" : slug;

    if (!groups.has(key)) {
      groups.set(key, new Map());
    }

    const localeMap = groups.get(key);
    if (!localeMap.has(locale)) {
      localeMap.set(locale, { slug, locale });
    }
  }

  return Array.from(groups.values(), (localeMap) =>
    Array.from(localeMap.values()),
  );
}

function buildAlternateRefs(entries, siteUrl, defaultLocale) {
  return entries.map((entry) => ({
    hrefLang: entry.locale,
    href: `${siteUrl}${getRouteForPage(entry.slug, entry.locale, defaultLocale)}`,
  }));
}

async function buildSitePageEntries(config) {
  const settings = await fetchPublicSettings();

  if (settings?.seoIndexingEnabled === false) {
    return [];
  }

  const siteUrl = config.siteUrl.replace(/\/$/, "");
  const { defaultLocale } = getConfiguredLocales();
  const pages = await fetchPublishedPages();
  const groups = groupPagesBySlug(pages);

  return groups.flatMap((entries) => {
    const alternateRefs = buildAlternateRefs(entries, siteUrl, defaultLocale);
    const defaultLocaleEntry = entries.find(
      (entry) => entry.locale === defaultLocale,
    );
    const xDefaultRef = defaultLocaleEntry
      ? {
          hrefLang: "x-default",
          href: `${siteUrl}${getRouteForPage(
            defaultLocaleEntry.slug,
            defaultLocale,
            defaultLocale,
          )}`,
        }
      : null;

    return entries.map((entry) => ({
      loc: getRouteForPage(entry.slug, entry.locale, defaultLocale),
      changefreq: config.changefreq,
      priority: isHomepageSlug(entry.slug) ? 1 : config.priority,
      lastmod: BUILD_TIMESTAMP,
      alternateRefs: xDefaultRef
        ? [...alternateRefs, xDefaultRef]
        : alternateRefs,
    }));
  });
}

function buildRobotsTxt(siteUrl, indexingEnabled) {
  return [
    "User-agent: *",
    indexingEnabled ? "Allow: /" : "Disallow: /",
    "",
    `Sitemap: ${siteUrl}/sitemap.xml`,
  ].join("\n");
}

module.exports = {
  siteUrl: getConfiguredBrandUrl(),
  generateRobotsTxt: true,
  exclude: ["/api/*", "/404", "/404.html"],
  autoLastmod: false,
  changefreq: "daily",
  priority: 0.7,

  transform: async () => null,
  additionalPaths: async (config) => buildSitePageEntries(config),

  robotsTxtOptions: {
    policies: [{ userAgent: "*", allow: "/" }],
    transformRobotsTxt: async (config) => {
      if (!hasDedicatedSiteRuntime()) {
        return buildRobotsTxt(config.siteUrl.replace(/\/$/, ""), false);
      }

      const settings = await fetchPublicSettings();
      return buildRobotsTxt(
        config.siteUrl.replace(/\/$/, ""),
        settings?.seoIndexingEnabled !== false,
      );
    },
  },
};
