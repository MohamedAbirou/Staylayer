import PuckRenderer from "../lib/puckRenderer";
import SEOHead from "@/components/seoHead";
import GoogleTagScript from "@/components/googleTagScript";
import ClarityScript from "@/components/clarityScript";
import {
  getPageData,
  fetchAllPublishedSlugs,
  fetchSettings,
  isHomepageSlug,
} from "@/lib/cmsClient";

function getDefaultLocale() {
  return (process.env.PRIMARY_LOCALE || "en").trim() || "en";
}

export async function getStaticPaths({ locales }) {
  const pages = await fetchAllPublishedSlugs();
  const enabledLocales =
    Array.isArray(locales) && locales.length > 0
      ? locales
      : [getDefaultLocale()];

  const paths = pages
    .filter(
      (page) =>
        enabledLocales.includes(page.locale) && !isHomepageSlug(page.slug),
    )
    .map((page) => ({
      params: { slug: page.slug.split("/") },
      locale: page.locale,
    }));

  return {
    paths,
    fallback: "blocking",
  };
}

export async function getStaticProps({ params, locale }) {
  const requestedLocale = locale || getDefaultLocale();
  const slug = Array.isArray(params.slug) ? params.slug.join("/") : params.slug;

  if (isHomepageSlug(slug)) {
    return {
      redirect: {
        destination:
          requestedLocale === getDefaultLocale() ? "/" : `/${requestedLocale}`,
        permanent: true,
      },
    };
  }

  const [page, settings] = await Promise.all([
    getPageData(slug, requestedLocale),
    fetchSettings(),
  ]);

  if (!page) {
    return { notFound: true };
  }

  return {
    props: {
      page,
      settings: settings ?? null,
    },
    revalidate: 60,
  };
}

export default function CMSPage({ page, settings }) {
  return (
    <>
      <SEOHead
        pageTitle={page.seoTitle || page.title || "MyAllocator"}
        pageDescription={page.seoDescription || ""}
        pageKeywords={page.seoKeywords || ""}
        settings={settings}
      />
      <GoogleTagScript
        gaId={settings?.gaTrackingId || ""}
        gtmId={settings?.gtmContainerId || ""}
      />
      <ClarityScript clarityId={settings?.clarityId || ""} />
      <main id={page.slug}>
        <PuckRenderer data={page.puckData} />
      </main>
    </>
  );
}
