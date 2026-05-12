import SEOHead from "@/components/seoHead";
import GoogleTagScript from "@/components/googleTagScript";
import ClarityScript from "@/components/clarityScript";
import { BRAND_NAME } from "@/lib/brand";
import { fetchSettings, getHomepageData } from "@/lib/cmsClient";
import { getMarketingRedirect, hasDedicatedSiteRuntime } from "@/lib/runtimeOwnership";
import PuckRenderer from "@/lib/puckRenderer";

function getDefaultLocale() {
  return (process.env.PRIMARY_LOCALE || "en").trim() || "en";
}

export async function getStaticProps({ locale }) {
  if (!hasDedicatedSiteRuntime()) {
    return getMarketingRedirect("/");
  }

  const requestedLocale = locale || getDefaultLocale();
  const [cmsPage, settings] = await Promise.all([
    getHomepageData(requestedLocale),
    fetchSettings(),
  ]);

  return {
    props: {
      cmsPage,
      settings: settings ?? null,
    },
    revalidate: 60,
  };
}

export default function Home({ cmsPage, settings }) {
  return (
    <>
      <SEOHead
        pageTitle={cmsPage.seoTitle || cmsPage.title || BRAND_NAME}
        pageDescription={cmsPage.seoDescription || ""}
        pageKeywords={cmsPage.seoKeywords || ""}
        settings={settings}
      />
      <GoogleTagScript
        gaId={settings?.gaTrackingId || ""}
        gtmId={settings?.gtmContainerId || ""}
      />
      <ClarityScript clarityId={settings?.clarityId || ""} />
      <main id="home">
        <PuckRenderer data={cmsPage.puckData} />
      </main>
    </>
  );
}
