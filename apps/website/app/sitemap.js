import { headers } from "next/headers";
import { normalizeHostname } from "@/lib/runtime/host";
import { fetchPublicRuntimeRoutes } from "@/lib/runtime/public-site-api";
import { getRequestIdFromHeaders } from "@/lib/runtime/request-id";

export const dynamic = "force-dynamic";

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
    const canonicalHost = payload.site?.canonicalHost || hostname;
    const defaultLocale = payload.site?.defaultLocale || null;

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

      return {
        url: route.url,
        lastModified: route.lastModified,
        ...(Object.keys(languages).length > 0
          ? { alternates: { languages } }
          : {}),
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
