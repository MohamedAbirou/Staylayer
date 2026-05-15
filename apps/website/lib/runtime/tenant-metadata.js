import { headers } from "next/headers";
import { normalizeHostname } from "@/lib/runtime/host";
import { fetchPublicRuntimePage } from "@/lib/runtime/public-site-api";
import { getRequestIdFromHeaders } from "@/lib/runtime/request-id";

export const DEFAULT_FAVICON_URL = "/staylayer-favicon.svg";

const DEFAULT_MANIFEST_ICONS = [
  {
    src: "/web-app-manifest-192x192.png",
    sizes: "192x192",
    type: "image/png",
  },
  {
    src: "/web-app-manifest-512x512.png",
    sizes: "512x512",
    type: "image/png",
  },
];

export async function getRuntimeSiteMetadata(pathname = "/") {
  const headerList = await headers();
  const hostname = normalizeHostname(
    headerList.get("x-staylayer-canonical-host") ||
      headerList.get("x-staylayer-resolved-host") ||
      headerList.get("host"),
  );
  const requestId = getRequestIdFromHeaders(headerList);

  if (!hostname) {
    return { hostname: "", payload: null };
  }

  try {
    const payload = await fetchPublicRuntimePage({
      hostname,
      pathname,
      requestId,
    });

    return { hostname, payload };
  } catch {
    return { hostname, payload: null };
  }
}

export function getTenantFaviconUrl(payload) {
  const faviconUrl = String(payload?.site?.theme?.faviconUrl || "").trim();

  return faviconUrl || DEFAULT_FAVICON_URL;
}

export function getManifestName(payload) {
  const siteName = String(payload?.site?.name || "").trim();

  return siteName || "Website";
}

function getAssetExtension(assetUrl) {
  const match = String(assetUrl || "")
    .trim()
    .toLowerCase()
    .match(/\.([a-z0-9]+)(?:$|[?#])/);

  return match ? match[1] : "";
}

export function buildManifestIcons(payload) {
  const faviconUrl = getTenantFaviconUrl(payload);

  if (faviconUrl === DEFAULT_FAVICON_URL) {
    return DEFAULT_MANIFEST_ICONS;
  }

  const extension = getAssetExtension(faviconUrl);
  const icon = {
    src: faviconUrl,
  };

  if (extension === "svg") {
    return [{ ...icon, type: "image/svg+xml", sizes: "any" }];
  }

  if (extension === "png") {
    return [{ ...icon, type: "image/png" }];
  }

  if (extension === "ico") {
    return [{ ...icon, type: "image/x-icon" }];
  }

  return [icon];
}