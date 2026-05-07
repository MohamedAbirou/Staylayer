const CMS_API_URL =
  process.env.NEXT_PUBLIC_CMS_API_URL ||
  process.env.CMS_API_URL ||
  "http://localhost:4000";
const REQUIRE_CMS_DATA = Boolean(
  (process.env.SITE_ID || process.env.NEXT_PUBLIC_SITE_ID || "").trim(),
);

class SiteRuntimeConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "SiteRuntimeConfigError";
  }
}

class RequiredCmsDataError extends Error {
  constructor(message) {
    super(message);
    this.name = "RequiredCmsDataError";
  }
}

function isSiteRuntimeConfigError(error) {
  return error instanceof SiteRuntimeConfigError;
}

function isRequiredCmsDataError(error) {
  return error instanceof RequiredCmsDataError;
}

function getConfiguredSiteId() {
  const serverSiteId = (process.env.SITE_ID || "").trim();
  const publicSiteId = (process.env.NEXT_PUBLIC_SITE_ID || "").trim();

  if (serverSiteId && publicSiteId && serverSiteId !== publicSiteId) {
    throw new SiteRuntimeConfigError(
      "SITE_ID and NEXT_PUBLIC_SITE_ID must match for site-scoped CMS reads",
    );
  }

  const siteId = publicSiteId || serverSiteId;

  if (!siteId) {
    throw new SiteRuntimeConfigError(
      "SITE_ID or NEXT_PUBLIC_SITE_ID must be configured for site-scoped CMS reads",
    );
  }

  return siteId;
}

export const HOMEPAGE_SLUG_ALIASES = Object.freeze(["index", "home"]);

export function isHomepageSlug(slug = "") {
  return HOMEPAGE_SLUG_ALIASES.includes(String(slug).trim().toLowerCase());
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

function summarizeResponseBody(body) {
  return String(body || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

async function parseCmsJsonResponse(response, context) {
  const body = await response.text();

  try {
    return body ? JSON.parse(body) : null;
  } catch {
    const preview = summarizeResponseBody(body);
    throw new Error(
      `${context} returned invalid JSON from ${response.url}: ${preview || "<empty body>"}`,
    );
  }
}

function buildRequiredCmsError(message) {
  return new RequiredCmsDataError(`${message} (CMS_API_URL=${CMS_API_URL})`);
}

// Fetch a single published page. Returns null on 404.
// Throws on network errors (caller handles fallback).
export async function fetchPage(slug, locale = "en") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const siteId = getConfiguredSiteId();
    const res = await fetch(
      buildCmsUrl(`/pages/${encodeURIComponent(slug)}`, {
        siteId,
        locale,
        published: true,
      }),
      {
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`CMS API error: ${res.status}`);
    return parseCmsJsonResponse(
      res,
      `Page fetch for slug \"${slug}\" and locale \"${locale}\"`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// Fetch a single page with fallback to English, then to static JSON on API failure.
export async function getPageData(slug, locale = "en") {
  try {
    const page = await fetchPage(slug, locale);
    if (page) return page;

    // Locale variant missing — try English fallback
    if (locale !== "en") {
      const enPage = await fetchPage(slug, "en");
      if (enPage) return enPage;
    }

    return null;
  } catch (err) {
    if (isSiteRuntimeConfigError(err)) {
      throw err;
    }

    console.error(`CMS fetch failed:`, { slug, locale, error: err.message });

    if (isRequiredCmsDataError(err)) {
      throw err;
    }

    if (REQUIRE_CMS_DATA) {
      throw buildRequiredCmsError(
        `Dedicated site runtime could not load page \"${slug}\" for locale \"${locale}\": ${err.message}`,
      );
    }

    return null;
  }
}

export async function getHomepageData(locale = "en") {
  const errors = [];

  for (const slug of HOMEPAGE_SLUG_ALIASES) {
    try {
      const page = await fetchPage(slug, locale);
      if (page) {
        return page;
      }

      if (locale !== "en") {
        const enPage = await fetchPage(slug, "en");
        if (enPage) {
          return enPage;
        }
      }
    } catch (error) {
      if (isSiteRuntimeConfigError(error)) {
        throw error;
      }

      console.error(`CMS fetch failed:`, {
        slug,
        locale,
        error: error.message,
      });
      errors.push(error);
    }
  }

  if (REQUIRE_CMS_DATA) {
    const reason =
      errors[0]?.message ||
      `No published homepage found for aliases: ${HOMEPAGE_SLUG_ALIASES.join(", ")}`;
    throw buildRequiredCmsError(
      `Dedicated site runtime could not load homepage content: ${reason}`,
    );
  }

  return null;
}

// Fetch all published slugs for getStaticPaths.
export async function fetchAllPublishedSlugs() {
  try {
    const siteId = getConfiguredSiteId();
    const res = await fetch(
      buildCmsUrl("/pages/published", {
        siteId,
      }),
      {
        headers: { "Content-Type": "application/json" },
      },
    );
    if (!res.ok) {
      throw new Error(`CMS API error: ${res.status}`);
    }
    const body = await parseCmsJsonResponse(res, "Published pages fetch");
    return Array.isArray(body) ? body : body.data || [];
  } catch (error) {
    if (isSiteRuntimeConfigError(error)) {
      throw error;
    }

    if (REQUIRE_CMS_DATA) {
      throw buildRequiredCmsError(
        `Dedicated site runtime could not load published slugs: ${error.message}`,
      );
    }

    console.error("Failed to load published slugs", error);
    return [];
  }
}

// Fetch public site settings. Returns null if unavailable (graceful fallback).
export async function fetchSettings() {
  try {
    const siteId = getConfiguredSiteId();
    const res = await fetch(buildCmsUrl("/settings/public", { siteId }), {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    return parseCmsJsonResponse(res, "Public settings fetch");
  } catch (error) {
    if (isSiteRuntimeConfigError(error)) {
      throw error;
    }

    console.error("Failed to load public settings", error);
    return null;
  }
}
