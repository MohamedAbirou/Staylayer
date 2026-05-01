import FAQ from "@/components/faq";
import { OnePlanFeaturesTable } from "@/components/featuresTable";
import PricingSectionOnePlan from "@/components/pricing";
import SEOHead from "@/components/seoHead";
import UnifiedCTA from "@/components/unifiedCTA";
import React from "react";
import { useTranslation } from "@/lib/useTranslation";
import PuckRenderer from "@/lib/puckRenderer";
import { getTranslations } from "@/lib/getTranslations";
import { getPageData } from "@/lib/cmsClient";

export async function getStaticProps({ locale }) {
  const [translations, cmsPage] = await Promise.all([
    getTranslations(locale),
    getPageData("pricing", locale || "en"),
  ]);

  return {
    props: {
      translations,
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function Pricing({ translations, cmsPage }) {
  const { t } = useTranslation(translations);

  // ── CMS page is ready: render it via Puck ──────────────────────────────
  if (cmsPage?.puckData) {
    // SEO is stored in dedicated DB columns (synced from puck root props on
    // save). Read root.props as an extra fallback for pages not yet re-saved.
    const rootProps = cmsPage.puckData?.root?.props || {};
    return (
      <>
        <SEOHead
          pageTitle={
            cmsPage.seoTitle ||
            rootProps.seoTitle ||
            cmsPage.title ||
            t("seo.pricing.title")
          }
          pageDescription={
            cmsPage.seoDescription ||
            rootProps.seoDescription ||
            t("seo.pricing.description")
          }
          pageKeywords={
            cmsPage.seoKeywords ||
            rootProps.seoKeywords ||
            t("seo.pricing.keywords")
          }
        />
        <main id="pricing">
          <PuckRenderer data={cmsPage.puckData} />
        </main>
      </>
    );
  }

  // ── Fallback: original hardcoded page ──────────────────────────────────
  const pageSeo = {
    pageTitle: t("seo.pricing.title"),
    pageDescription: t("seo.pricing.description"),
    pageKeywords: t("seo.pricing.keywords"),
  };
  const faqContent = t("pricing.faq.items", { returnObjects: true });

  return (
    <>
      <SEOHead {...pageSeo} />

      <main className="relative -mt-10">
        <PricingSectionOnePlan />
        <OnePlanFeaturesTable />
        <section className="max-w-5xl mx-auto">
          <FAQ content={faqContent} />
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
