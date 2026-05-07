import Head from "next/head";
import { useRouter } from "next/router";
import { BRAND_NAME, BRAND_URL } from "@/lib/brand";

const SITE_NAME = BRAND_NAME;
const BASE_URL = BRAND_URL;
const DEFAULT_OG_IMAGE = `${BASE_URL}/images/thumb.jpg`;
const DEFAULT_ORG_LOGO = `${BASE_URL}/images/logo.svg`;
const SECOND_ORG_SCHEMA_LOGO = `${BASE_URL}/images/logo.png`;
const AUTHOR_NAME = BRAND_NAME;
const OG_TYPE = "website";
const OG_LOCALE_MAP = { en: "en_US", es: "es_ES", fr: "fr_FR", de: "de_DE" };
const TWITTER_CARD_TYPE = "summary_large_image";
const DEFAULT_TITLE_TEMPLATE = `%s | ${SITE_NAME}`;

const SEOHead = ({
  pageTitle,
  pageDescription,
  pageKeywords,
  pageImage,
  settings,
}) => {
  const router = useRouter();
  const currentLocale = router.locale || "en";
  const canonicalPath =
    (router.asPath || "/").split("#")[0].split("?")[0] || "/";

  // Use CMS settings when available, fall back to hardcoded defaults.
  const titleTemplate = settings?.seoTitleTemplate || DEFAULT_TITLE_TEMPLATE;
  const fullPageTitle = titleTemplate.replace("%s", pageTitle);
  const resolvedDescription = pageDescription || settings?.seoDefaultDesc || "";
  const resolvedPageImage =
    pageImage || settings?.seoOgImage || DEFAULT_OG_IMAGE;
  const indexingEnabled = settings?.seoIndexingEnabled !== false;
  const absolutePageUrl = new URL(canonicalPath, `${BASE_URL}/`).toString();
  const ogLocale = OG_LOCALE_MAP[currentLocale] || "en_US";
  const siteName = settings?.siteName || SITE_NAME;

  // Build sameAs list from social URLs configured in site settings.
  const sameAsUrls = [settings?.facebookUrl, settings?.linkedinUrl].filter(
    Boolean,
  );

  const organizationSchema1 = {
    "@context": "https://schema.org",
    "@type": "Organization",
    image: resolvedPageImage,
    url: BASE_URL,
    sameAs: [absolutePageUrl, ...sameAsUrls],
    logo: DEFAULT_ORG_LOGO,
    name: siteName,
    description:
      settings?.seoDefaultDesc || `${siteName} — hospitality and accommodation`,
    email: settings?.supportEmail || `contact@${new URL(BASE_URL).hostname}`,
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: fullPageTitle,
    url: absolutePageUrl,
    description: resolvedDescription,
    publisher: {
      "@type": "Organization",
      name: siteName,
    },
  };

  const organizationSchema2 = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: fullPageTitle,
    url: absolutePageUrl,
    logo: SECOND_ORG_SCHEMA_LOGO,
    sameAs: sameAsUrls,
  };

  return (
    <Head>
      <meta charSet="UTF-8" />
      <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{fullPageTitle}</title>
      <meta
        name="robots"
        content={indexingEnabled ? "index,follow" : "noindex,nofollow"}
      />
      {settings?.googleSiteVerify && (
        <meta
          name="google-site-verification"
          content={settings.googleSiteVerify}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema1),
        }}
      />
      <meta name="description" content={resolvedDescription} />
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/apple-touch-icon.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="32x32"
        href="/favicon-32x32.png"
      />
      <link
        rel="icon"
        type="image/png"
        sizes="16x16"
        href="/favicon-16x16.png"
      />
      <link rel="manifest" href="/site.webmanifest" />
      <link rel="mask-icon" href="/safari-pinned-tab.svg" color="#5bbad5" />
      <meta name="msapplication-TileColor" content="#da532c" />
      <meta name="theme-color" content="#ffffff" />
      <meta name="keywords" content={pageKeywords} />
      <meta property="og:type" content={OG_TYPE} />
      <meta property="og:title" content={fullPageTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:image" content={resolvedPageImage} />
      <meta property="og:url" content={absolutePageUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={ogLocale} />
      <meta name="twitter:card" content={TWITTER_CARD_TYPE} />
      <meta name="twitter:title" content={fullPageTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={resolvedPageImage} />
      <meta name="twitter:url" content={absolutePageUrl} />
      {settings?.twitterHandle && (
        <meta
          name="twitter:site"
          content={`@${settings.twitterHandle.replace(/^@/, "")}`}
        />
      )}
      <meta name="author" content={AUTHOR_NAME} />
      <link rel="canonical" href={absolutePageUrl} />
      <meta name="DC.title" content={fullPageTitle} />
      <meta name="DC.description" content={resolvedDescription} />
      <meta name="DC.language" content={currentLocale} />
      <meta itemProp="name" content={fullPageTitle} />
      <meta itemProp="description" content={resolvedDescription} />
      <meta itemProp="image" content={resolvedPageImage} />
      {/* Dynamic & Static Schema.org JSON-LD (WebSite) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      {/* Dynamic & Static Schema.org JSON-LD (Organization 2) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema2),
        }}
      />
    </Head>
  );
};

export default SEOHead;
