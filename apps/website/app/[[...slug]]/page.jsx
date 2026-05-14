import { draftMode, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import ClarityScript from "@/components/clarityScript";
import GoogleTagScript from "@/components/googleTagScript";
import { TenantPuckRenderer } from "@/components/runtime/TenantPuckRenderer";
import { UpstreamError } from "@/components/runtime/UpstreamError";
import { normalizeHostname, slugSegmentsToPathname } from "@/lib/runtime/host";
import { fetchPublicRuntimePage } from "@/lib/runtime/public-site-api";
import { getRequestIdFromHeaders } from "@/lib/runtime/request-id";

export const dynamic = "force-dynamic";

// Map runtime locale codes to Open Graph locale identifiers.
const OG_LOCALE_MAP = {
  en: "en_US",
  es: "es_ES",
  fr: "fr_FR",
  de: "de_DE",
};

async function getRuntimePayload(pathname) {
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
      pathname,
      draft: currentDraftMode.isEnabled,
      requestId,
    });
    return { kind: "ok", payload };
  } catch (error) {
    if (error?.code === "RUNTIME_NOT_FOUND" || error?.status === 404) {
      return { kind: "not_found" };
    }
    console.error(
      `[website] upstream runtime error host=${runtimeHost} path=${pathname} requestId=${requestId ?? "-"} status=${
        error?.status ?? "?"
      } message=${error?.message ?? "unknown"}`,
    );
    return { kind: "upstream_error", requestId };
  }
}

export async function generateMetadata({ params }) {
  const pathname = slugSegmentsToPathname((await params)?.slug);
  const result = await getRuntimePayload(pathname);

  if (result.kind !== "ok" || !result.payload?.page) {
    return {};
  }

  const payload = result.payload;
  const site = payload.site || {};
  const page = payload.page;
  const seo = page.seo || {};
  const canonicalHost = site.canonicalHost;
  const canonicalUrl = seo.canonicalUrl;

  let metadataBase;
  try {
    metadataBase = canonicalHost
      ? new URL(`https://${canonicalHost}`)
      : undefined;
  } catch {
    metadataBase = undefined;
  }

  const ogLocale = OG_LOCALE_MAP[page.locale] || OG_LOCALE_MAP.en;
  const alternateLocales = (site.enabledLocales || [])
    .filter((locale) => locale && locale !== page.locale)
    .map((locale) => OG_LOCALE_MAP[locale] || locale);

  // hreflang map for alternate language URLs (path-based: /<locale>/<slug>).
  const languages = {};
  if (canonicalHost) {
    const baseSlug = page.slug ? `/${page.slug}` : "";
    for (const locale of site.enabledLocales || []) {
      if (!locale) continue;
      languages[locale] =
        locale === site.defaultLocale
          ? `https://${canonicalHost}${baseSlug || "/"}`
          : `https://${canonicalHost}/${locale}${baseSlug}`;
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

  const metadata = {
    title: seo.title,
    description: seo.description,
    applicationName: site.name || undefined,
    metadataBase,
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

  return metadata;
}

export default async function TenantPage({ params }) {
  const pathname = slugSegmentsToPathname((await params)?.slug);
  const result = await getRuntimePayload(pathname);

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
      <GoogleTagScript
        gaId={payload.site.analytics?.gaTrackingId || ""}
        gtmId={payload.site.analytics?.gtmContainerId || ""}
      />
      <ClarityScript clarityId={payload.site.analytics?.clarityId || ""} />
      {payload.structuredData.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
      <main id={payload.page.slug || "home"}>
        <TenantPuckRenderer runtime={payload} />
      </main>
    </>
  );
}
