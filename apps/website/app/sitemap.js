import { headers } from "next/headers";
import { normalizeHostname } from "@/lib/runtime/host";
import { fetchPublicRuntimeRoutes } from "@/lib/runtime/public-site-api";
import { getRequestIdFromHeaders } from "@/lib/runtime/request-id";

export const dynamic = "force-dynamic";

function escapeXmlText(value) {
  return String(value)
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-fA-F]+;)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function sitemap() {
  const headerList = await headers();
  const hostname = normalizeHostname(
    headerList.get("x-staylayer-canonical-host") || headerList.get("host"),
  );
  const requestId = getRequestIdFromHeaders(headerList);

  if (!hostname) {
    return [];
  }

  try {
    const payload = await fetchPublicRuntimeRoutes({ hostname, requestId });

    // Honor site indexing flag — emit an empty sitemap when indexing is
    // paused so crawlers receive a clear "nothing to index" signal.
    if (payload?.sitemap?.indexingEnabled === false) {
      return [];
    }

    const canonicalHost = payload.canonicalHost || hostname;
    const defaultLocale = payload.site?.defaultLocale || null;
    const includeImages = payload?.sitemap?.includeImages !== false;

    return payload.routes.map((route) => {
      const path = route.path === "/" ? "" : route.path;
      const locales = Array.isArray(route.locales) ? route.locales : [];
      const languages = {};
      for (const locale of locales) {
        if (!locale) continue;
        languages[locale] =
          locale === defaultLocale
            ? `https://${canonicalHost}${path || "/"}`
            : `https://${canonicalHost}/${locale}${path}`;
      }
      if (defaultLocale) {
        languages["x-default"] = `https://${canonicalHost}${path || "/"}`;
      }

      const images =
        includeImages && Array.isArray(route.images)
          ? route.images.filter(Boolean).map(escapeXmlText)
          : [];

      return {
        url: route.url,
        lastModified: route.lastModified,
        ...(Object.keys(languages).length > 0
          ? { alternates: { languages } }
          : {}),
        ...(images.length > 0 ? { images } : {}),
      };
    });
  } catch (error) {
    console.error(
      `[website] sitemap upstream error host=${hostname} requestId=${requestId ?? "-"} status=${
        error?.status ?? "?"
      } message=${error?.message ?? "unknown"}`,
    );
    return [];
  }
}
