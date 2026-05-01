const CMS_API_URL =
  process.env.NEXT_PUBLIC_CMS_API_URL || "http://localhost:4000";

// Fetch a single published page. Returns null on 404.
// Throws on network errors (caller handles fallback).
export async function fetchPage(slug, locale = "en") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(
      `${CMS_API_URL}/pages/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}&published=true`,
      {
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`CMS API error: ${res.status}`);
    return res.json();
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
    console.error(`CMS fetch failed:`, { slug, locale, error: err.message });

    // API down — try static fallback committed to repo
    try {
      const fallback = await import(`@/lib/fallbacks/${slug}.json`);
      return fallback.default;
    } catch {
      return null;
    }
  }
}

// Fetch all published slugs for getStaticPaths.
export async function fetchAllPublishedSlugs() {
  try {
    const res = await fetch(`${CMS_API_URL}/pages?published=true&limit=1000`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return body.data || [];
  } catch {
    return [];
  }
}

// Fetch global site settings. Returns null if unavailable (graceful fallback).
export async function fetchSettings() {
  try {
    const res = await fetch(`${CMS_API_URL}/settings`, {
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
