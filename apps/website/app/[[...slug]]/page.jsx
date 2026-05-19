import { draftMode, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import ClarityScript from "@/components/clarityScript";
import GoogleTagScript from "@/components/googleTagScript";
import { TenantPuckRenderer } from "@/components/runtime/TenantPuckRenderer";
import { UpstreamError } from "@/components/runtime/UpstreamError";
import { normalizeHostname, slugSegmentsToPathname } from "@/lib/runtime/host";
import { fetchPublicRuntimePage } from "@/lib/runtime/public-site-api";
import { getRequestIdFromHeaders } from "@/lib/runtime/request-id";
import { DEFAULT_FAVICON_URL } from "@/lib/runtime/tenant-metadata";

export const dynamic = "force-dynamic";

// Map runtime locale codes to Open Graph locale identifiers.
const OG_LOCALE_MAP = {
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
  de: "de_DE",
  it: "it_IT",
  pt: "pt_BR",
  nl: "nl_NL",
  ar: "ar_SA",
};
const SUPPORTED_RUNTIME_LOCALES = new Set(Object.keys(OG_LOCALE_MAP));

function splitLocalePathname(pathname) {
  const normalizedPathname = pathname || "/";
  const segments = normalizedPathname.split("/").filter(Boolean);
  const maybeLocale = segments[0]?.toLowerCase();

  if (!maybeLocale || !SUPPORTED_RUNTIME_LOCALES.has(maybeLocale)) {
    return { pathname: normalizedPathname, locale: undefined };
  }

  const remainingPathname =
    segments.length > 1 ? `/${segments.slice(1).join("/")}` : "/";

  return {
    pathname: remainingPathname,
    locale: maybeLocale,
  };
}

function buildLocalizedPathname(slug, locale, defaultLocale) {
  const basePathname = slug ? `/${slug}` : "/";

  if (!locale || locale === defaultLocale) {
    return basePathname;
  }

  return basePathname === "/" ? `/${locale}` : `/${locale}${basePathname}`;
}

function buildLocalizedUrl(hostname, slug, locale, defaultLocale) {
  return `https://${hostname}${buildLocalizedPathname(
    slug,
    locale,
    defaultLocale,
  )}`;
}

function buildSocialProfileUrls(site) {
  const social = site.social || {};
  const urls = [
    social.twitterHandle
      ? `https://x.com/${String(social.twitterHandle).replace(/^@+/, "")}`
      : null,
    social.facebookUrl,
    social.linkedinUrl,
    social.instagramUrl,
    social.youtubeUrl,
    social.tiktokUrl,
    social.pinterestUrl,
  ];

  return Array.from(
    new Set(urls.filter((url) => typeof url === "string" && url.trim())),
  );
}

async function getRuntimePayload(route) {
  const headerList = await headers();

  const hostState = headerList.get("x-staylayer-host-state");

  if (hostState === "not_found") {
    return { kind: "not_found" };
  }

  if (hostState === "upstream_error") {
    return {
      kind: "upstream_error",
      requestId: getRequestIdFromHeaders(headerList),
    };
  }

  const runtimeHost = normalizeHostname(
    headerList.get("x-staylayer-canonical-host") ||
      headerList.get("x-staylayer-resolved-host") ||
      headerList.get("host"),
  );

  if (!runtimeHost) {
    return { kind: "not_found" };
  }

  const currentDraftMode = await draftMode();
  const requestId = getRequestIdFromHeaders(headerList);

  try {
    const payload = await fetchPublicRuntimePage({
      hostname: runtimeHost,
      pathname: route.pathname,
      locale: route.locale,
      draft: currentDraftMode.isEnabled,
      requestId,
    });
    return { kind: "ok", payload };
  } catch (error) {
    if (error?.code === "RUNTIME_NOT_FOUND" || error?.status === 404) {
      return { kind: "not_found" };
    }
    console.error(
      `[website] upstream runtime error host=${runtimeHost} path=${route.pathname} locale=${route.locale ?? "-"} requestId=${requestId ?? "-"} status=${
        error?.status ?? "?"
      } message=${error?.message ?? "unknown"}`,
    );
    return { kind: "upstream_error", requestId };
  }
}

export async function generateMetadata({ params }) {
  const route = splitLocalePathname(
    slugSegmentsToPathname((await params)?.slug),
  );
  const result = await getRuntimePayload(route);

  if (result.kind !== "ok" || !result.payload?.page) {
    return {};
  }

  const payload = result.payload;
  const site = payload.site || {};
  const page = payload.page;
  const seo = page.seo || {};
  const canonicalHost = site.canonicalHost;
  const canonicalUrl = canonicalHost
    ? buildLocalizedUrl(
        canonicalHost,
        page.slug,
        page.locale,
        site.defaultLocale,
      )
    : seo.canonicalUrl;

  let metadataBase;
  try {
    metadataBase = canonicalHost
      ? new URL(`https://${canonicalHost}`)
      : undefined;
  } catch {
    metadataBase = undefined;
  }

  const ogLocale = OG_LOCALE_MAP[page.locale] || OG_LOCALE_MAP.en;
  const availablePageLocales =
    page.availableLocales?.length > 0
      ? page.availableLocales
      : site.enabledLocales || [];
  const alternateLocales = availablePageLocales
    .filter((locale) => locale && locale !== page.locale)
    .map((locale) => OG_LOCALE_MAP[locale] || locale);

  // hreflang map for alternate language URLs (path-based: /<locale>/<slug>).
  const languages = {};
  if (canonicalHost) {
    for (const locale of availablePageLocales) {
      if (!locale) continue;
      languages[locale] = buildLocalizedUrl(
        canonicalHost,
        page.slug,
        locale,
        site.defaultLocale,
      );
    }
    if (site.defaultLocale) {
      languages["x-default"] = `https://${canonicalHost}${
        page.slug ? `/${page.slug}` : "/"
      }`;
    }
  }

  const ogImages = seo.ogImage
    ? [{ url: seo.ogImage, alt: seo.title || site.name || "" }]
    : [];

  const twitter = {
    card: "summary_large_image",
    title: seo.title,
    description: seo.description,
    images: seo.ogImage ? [seo.ogImage] : undefined,
  };
  if (site.social?.twitterHandle) {
    twitter.site = site.social.twitterHandle;
    twitter.creator = site.social.twitterHandle;
  }
  const socialProfileUrls = buildSocialProfileUrls(site);

  const metadata = {
    title: seo.title,
    description: seo.description,
    applicationName: site.name || undefined,
    manifest: "/manifest.webmanifest",
    metadataBase,
    icons: {
      icon: DEFAULT_FAVICON_URL,
      shortcut: DEFAULT_FAVICON_URL,
      apple: DEFAULT_FAVICON_URL,
    },
    alternates: {
      canonical: canonicalUrl,
      ...(Object.keys(languages).length > 0 ? { languages } : {}),
    },
    openGraph: {
      type: "website",
      title: seo.title,
      description: seo.description,
      url: canonicalUrl,
      siteName: site.name || undefined,
      locale: ogLocale,
      alternateLocale:
        alternateLocales.length > 0 ? alternateLocales : undefined,
      images: ogImages,
    },
    twitter,
    ...(socialProfileUrls.length > 0
      ? { other: { "og:see_also": socialProfileUrls } }
      : {}),
    robots: seo.noindex
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-snippet": -1,
            "max-image-preview": "large",
            "max-video-preview": -1,
          },
        },
  };

  if (Array.isArray(seo.keywords) && seo.keywords.length > 0) {
    metadata.keywords = seo.keywords;
  }

  if (site.theme?.faviconUrl) {
    metadata.icons = {
      icon: site.theme.faviconUrl,
      shortcut: site.theme.faviconUrl,
      apple: site.theme.faviconUrl,
    };
  }

  if (site.verification?.googleSiteVerification) {
    metadata.verification = {
      google: site.verification.googleSiteVerification,
    };
  }

  const otherVerification = {};
  if (site.verification?.bingSiteVerification) {
    otherVerification["msvalidate.01"] = site.verification.bingSiteVerification;
  }
  if (site.verification?.yandexSiteVerification) {
    otherVerification.yandex = site.verification.yandexSiteVerification;
  }
  if (site.verification?.pinterestSiteVerification) {
    otherVerification["p:domain_verify"] =
      site.verification.pinterestSiteVerification;
  }
  if (Object.keys(otherVerification).length > 0) {
    metadata.verification = {
      ...(metadata.verification || {}),
      other: otherVerification,
    };
  }

  return metadata;
}

export default async function TenantPage({ params }) {
  const route = splitLocalePathname(
    slugSegmentsToPathname((await params)?.slug),
  );
  const result = await getRuntimePayload(route);

  if (result.kind === "upstream_error") {
    return <UpstreamError requestId={result.requestId} />;
  }

  if (result.kind === "not_found") {
    notFound();
  }

  const payload = result.payload;

  if (payload.redirect) {
    redirect(payload.redirect.location);
  }

  if (!payload.page) {
    notFound();
  }

  return (
    <>
      {payload.site.analytics?.gtmContainerId ? (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${payload.site.analytics.gtmContainerId}`}
            title="Google Tag Manager"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
      ) : null}
      <GoogleTagScript
        gaId={payload.site.analytics?.gaTrackingId || ""}
        gtmId={payload.site.analytics?.gtmContainerId || ""}
      />
      <ClarityScript clarityId={payload.site.analytics?.clarityId || ""} />
      {payload.structuredData.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          // SECURITY: escape characters that can break out of the inline
          // <script> tag or be interpreted as HTML when the JSON is parsed
          // as application/ld+json. `JSON.stringify` alone is insufficient
          // because tenant-supplied strings could contain `</script>` or
          // line-separator characters that browsers treat specially.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(entry).replace(
              /[<>&\u2028\u2029]/g,
              (ch) =>
                ({
                  "<": "\\u003c",
                  ">": "\\u003e",
                  "&": "\\u0026",
                  "\u2028": "\\u2028",
                  "\u2029": "\\u2029",
                })[ch],
            ),
          }}
        />
      ))}
      <main id={payload.page.slug || "home"}>
        <TenantPuckRenderer runtime={payload} />
      </main>
    </>
  );
}
