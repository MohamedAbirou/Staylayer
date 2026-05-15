import { NextResponse } from "next/server";
import {
  DEFAULT_FAVICON_URL,
  getRuntimeSiteMetadata,
  getTenantFaviconUrl,
} from "@/lib/runtime/tenant-metadata";

export const dynamic = "force-dynamic";

function resolveFaviconUrl(requestUrl, iconUrl) {
  try {
    const resolved = new URL(iconUrl || DEFAULT_FAVICON_URL, requestUrl);

    if (resolved.pathname === "/favicon.ico") {
      return new URL(DEFAULT_FAVICON_URL, requestUrl);
    }

    return resolved;
  } catch {
    return new URL(DEFAULT_FAVICON_URL, requestUrl);
  }
}

export async function GET(request) {
  const { payload } = await getRuntimeSiteMetadata("/");
  const target = resolveFaviconUrl(
    request.url,
    getTenantFaviconUrl(payload),
  );
  const response = NextResponse.redirect(target, 307);

  response.headers.set("Cache-Control", "public, max-age=0, must-revalidate");

  return response;
}