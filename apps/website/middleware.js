import { NextResponse } from "next/server";
import {
  fetchHostResolution,
  getRequestHostname,
  normalizeHostname,
} from "@/lib/runtime/host";
import { ensureRequestId, REQUEST_ID_HEADER } from "@/lib/runtime/request-id";
import { buildCsp } from "@/lib/runtime/csp";

const PUBLIC_FILE = /\.[a-z0-9]+$/i;
const METADATA_PATHS = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
]);

function shouldBypass(pathname) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    (PUBLIC_FILE.test(pathname) && !METADATA_PATHS.has(pathname))
  );
}

function getOriginHostname(origin) {
  try {
    return normalizeHostname(new URL(origin).host);
  } catch {
    return "";
  }
}

function buildRedirectUrl(origin, pathname, search) {
  try {
    return new URL(`${pathname || "/"}${search || ""}`, origin);
  } catch {
    return null;
  }
}

function maybeRedirectReservedHost(request, hostname) {
  const platformRootDomain = normalizeHostname(
    process.env.PLATFORM_ROOT_DOMAIN,
  );
  const marketingOrigin = process.env.MARKETING_APP_ORIGIN;
  const dashboardOrigin = process.env.DASHBOARD_APP_ORIGIN;
  const { pathname, search } = request.nextUrl;

  if (marketingOrigin) {
    const marketingHost = getOriginHostname(marketingOrigin);
    const shouldRedirectToMarketing =
      hostname === marketingHost ||
      (platformRootDomain &&
        (hostname === platformRootDomain ||
          hostname === `www.${platformRootDomain}`));

    if (shouldRedirectToMarketing) {
      const target = buildRedirectUrl(marketingOrigin, pathname, search);
      if (target) {
        return NextResponse.redirect(target, 307);
      }
    }
  }

  if (dashboardOrigin) {
    const dashboardHost = getOriginHostname(dashboardOrigin);
    if (hostname === dashboardHost) {
      const target = buildRedirectUrl(dashboardOrigin, pathname, search);
      if (target) {
        return NextResponse.redirect(target, 307);
      }
    }
  }

  return null;
}

export default async function middleware(request) {
  if (shouldBypass(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const requestId = ensureRequestId(request.headers);

  const hostname = getRequestHostname(request.headers);
  if (!hostname) {
    return decorateResponse(NextResponse.next(), requestId);
  }

  const reservedRedirect = maybeRedirectReservedHost(request, hostname);
  if (reservedRedirect) {
    return decorateResponse(reservedRedirect, requestId);
  }

  let resolution;

  try {
    resolution = await fetchHostResolution({
      hostname,
      pathname: request.nextUrl.pathname,
      previewToken:
        request.nextUrl.searchParams.get("previewToken") || undefined,
      vercelId: request.headers.get("x-vercel-id") || undefined,
      requestId,
    });
  } catch (error) {
    if (error?.status === 401) {
      return decorateResponse(
        NextResponse.json(
          {
            message: error.message,
          },
          { status: 401 },
        ),
        requestId,
      );
    }

    // Upstream failure — let the page render an upstream-error fallback
    // instead of falling through to a misleading 404.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(REQUEST_ID_HEADER, requestId);
    requestHeaders.set("x-staylayer-host-state", "upstream_error");
    return decorateResponse(
      NextResponse.next({ request: { headers: requestHeaders } }),
      requestId,
    );
  }

  if (resolution.action === "redirect") {
    return decorateResponse(
      NextResponse.redirect(
        resolution.location,
        resolution.permanent ? 308 : 307,
      ),
      requestId,
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  if (resolution.action === "serve") {
    requestHeaders.set("x-staylayer-host-state", "serve");
    requestHeaders.set("x-staylayer-resolved-host", hostname);
    requestHeaders.set("x-staylayer-canonical-host", resolution.canonicalHost);
    requestHeaders.set("x-staylayer-site-id", resolution.siteId);
    requestHeaders.set("x-staylayer-default-locale", resolution.defaultLocale);
    requestHeaders.set("x-staylayer-preview", resolution.preview ? "1" : "0");
  } else {
    requestHeaders.set("x-staylayer-host-state", "not_found");
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (resolution.action === "serve") {
    response.headers.set(
      "x-staylayer-canonical-host",
      resolution.canonicalHost,
    );
    response.headers.set("x-staylayer-site-id", resolution.siteId);
  }

  return decorateResponse(response, requestId);
}

function decorateResponse(response, requestId) {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  if (!response.headers.has("Content-Security-Policy")) {
    response.headers.set("Content-Security-Policy", buildCsp());
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
