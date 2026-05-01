import PuckRenderer from "../lib/puckRenderer";
import SEOHead from "@/components/seoHead";
import GoogleTagScript from "@/components/googleTagScript";
import ClarityScript from "@/components/clarityScript";
import {
  getPageData,
  fetchAllPublishedSlugs,
  fetchSettings,
} from "@/lib/cmsClient";
import { getTranslations } from "@/lib/getTranslations";

export async function getStaticPaths({ locales }) {
  const pages = await fetchAllPublishedSlugs();

  const paths = pages
    .filter((page) => locales.includes(page.locale))
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
  const slug = Array.isArray(params.slug) ? params.slug.join("/") : params.slug;

  const [page, settings, translations] = await Promise.all([
    getPageData(slug, locale || "en"),
    fetchSettings(),
    getTranslations(locale || "en"),
  ]);

  if (!page) {
    return { notFound: true };
  }

  return {
    props: {
      page,
      settings: settings ?? null,
      translations,
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
