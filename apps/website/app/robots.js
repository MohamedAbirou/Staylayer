import { headers } from "next/headers";
import { normalizeHostname } from "@/lib/runtime/host";
import { fetchPublicRuntimePage } from "@/lib/runtime/public-site-api";
import { getRequestIdFromHeaders } from "@/lib/runtime/request-id";

export const dynamic = "force-dynamic";

export default async function robots() {
  const headerList = await headers();
  const hostname = normalizeHostname(
    headerList.get("x-staylayer-canonical-host") || headerList.get("host"),
  );
  const requestId = getRequestIdFromHeaders(headerList);

  if (!hostname) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  try {
    const payload = await fetchPublicRuntimePage({
      hostname,
      pathname: "/",
      requestId,
    });
    const allowIndexing = Boolean(
      payload?.page &&
      payload.site?.indexingEnabled !== false &&
      payload.page.seo?.noindex !== true,
    );

    if (!allowIndexing) {
      return {
        rules: {
          userAgent: "*",
          disallow: "/",
        },
      };
    }

    return {
      rules: {
        userAgent: "*",
        allow: "/",
      },
      sitemap: `https://${payload.site.canonicalHost}/sitemap.xml`,
      host: payload.site.canonicalHost,
    };
  } catch (error) {
    console.error(
      `[website] robots upstream error host=${hostname} requestId=${requestId ?? "-"} status=${
        error?.status ?? "?"
      } message=${error?.message ?? "unknown"}`,
    );
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }
}
