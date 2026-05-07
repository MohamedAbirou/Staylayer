import FAQ from "@/components/faq";
import Quote from "@/components/quote";
import SEOHead from "@/components/seoHead";
import GoogleTagScript from "@/components/googleTagScript";
import ClarityScript from "@/components/clarityScript";
import UnifiedCTA from "@/components/unifiedCTA";
import { getTranslations } from "../lib/getTranslations";
import { useTranslation } from "../lib/useTranslation";
import { fetchSettings, getHomepageData } from "@/lib/cmsClient";
import PuckRenderer from "@/lib/puckRenderer";

function getDefaultLocale() {
  return (process.env.PRIMARY_LOCALE || "en").trim() || "en";
}

export async function getStaticProps({ locale }) {
  const requestedLocale = locale || getDefaultLocale();
  const [translations, cmsPage, settings] = await Promise.all([
    getTranslations(requestedLocale),
    getHomepageData(requestedLocale),
    fetchSettings(),
  ]);

  return {
    props: {
      translations,
      cmsPage: cmsPage || null,
      settings: settings ?? null,
    },
    revalidate: 60,
  };
}

export default function Home({ translations, cmsPage, settings }) {
  const { t } = useTranslation(translations);

  // ── CMS page is ready: render it via Puck ──────────────────────────────
  if (cmsPage?.puckData) {
    return (
      <>
        <SEOHead
          pageTitle={cmsPage.seoTitle || cmsPage.title || t("seo.home.title")}
          pageDescription={cmsPage.seoDescription || t("seo.home.description")}
          pageKeywords={cmsPage.seoKeywords || t("seo.home.keywords")}
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

  // ── Fallback: original hardcoded page ──────────────────────────────────
  const pageSeo = {
    pageTitle: t("seo.home.title"),
    pageDescription: t("seo.home.description"),
    pageKeywords: t("seo.home.keywords"),
  };
  const tools = t("home.sections.tools", { returnObjects: true });
  const features = tools?.features || {};
  const builtFor = t("home.sections.builtFor", { returnObjects: true });
  const stories = t("home.sections.stories", { returnObjects: true });
  const integrations = t("home.sections.integrations", { returnObjects: true });
  const faqContent = t("home.sections.faq.items", { returnObjects: true });
  return (
    <>
      <SEOHead {...pageSeo} settings={settings} />
      <GoogleTagScript
        gaId={settings?.gaTrackingId || ""}
        gtmId={settings?.gtmContainerId || ""}
      />
      <ClarityScript clarityId={settings?.clarityId || ""} />

      <main id="home">
        <div className="hero h-screen space-y-8 min-h-[700px] overflow-x-hidden">
          <h1 className="mx-auto max-w-4xl font-medium text-5xl tracking-tight text-slate-900 sm:text-7xl text-balance">
            {t("home.hero.headingPrefix")}
            <span className="relative whitespace-nowrap text-blue-600!">
              <svg
                aria-hidden="true"
                viewBox="0 0 418 42"
                className="absolute top-2/3 left-0 w-full fill-blue-300/70"
                preserveAspectRatio="none"
              >
                <path d="M203.371.916c-26.013-2.078-76.686 1.963-124.73 9.946L67.3 12.749C35.421 18.062 18.2 21.766 6.004 25.934 1.244 27.561.828 27.778.874 28.61c.07 1.214.828 1.121 9.595-1.176 9.072-2.377 17.15-3.92 39.246-7.496C123.565 7.986 157.869 4.492 195.942 5.046c7.461.108 19.25 1.696 19.17 2.582-.107 1.183-7.874 4.31-25.75 10.366-21.992 7.45-35.43 12.534-36.701 13.884-2.173 2.308-.202 4.407 4.442 4.734 2.654.187 3.263.157 15.593-.78 35.401-2.686 57.944-3.488 88.365-3.143 46.327.526 75.721 2.23 130.788 7.584 19.787 1.924 20.814 1.98 24.557 1.332l.066-.011c1.201-.203 1.53-1.825.399-2.335-2.911-1.31-4.893-1.604-22.048-3.261-57.509-5.556-87.871-7.36-132.059-7.842-23.239-.254-33.617-.116-50.627.674-11.629.54-42.371 2.494-46.696 2.967-2.359.259 8.133-3.625 26.504-9.81 23.239-7.825 27.934-10.149 28.304-14.005.417-4.348-3.529-6-16.878-7.066Z"></path>
              </svg>
              <span className="text-3xl! sm:text-4xl! md:text-5xl! lg:text-6xl! font-bold! !mb-6 relative text-blue-600">
                {t("home.hero.highlight")}
              </span>
            </span>
          </h1>
          <p className="mx-auto max-w-4xl text-lg! text-slate-800">
            {t("home.hero.subheading")}
          </p>
        </div>

        <section className="breakout-section">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 lg:mb-16">
              <h2>{tools?.title}</h2>
              <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                {tools?.subtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-8 mt-12">
              <div className="feature-card">
                <h3 className="feature-card-title">
                  {features?.bookingEngine?.title}
                </h3>
                <ul className="feature-card-list">
                  {(features?.bookingEngine?.bullets || []).map((item, idx) => (
                    <li key={idx} className="feature-card-list-item">
                      <span className="feature-card-list-marker">
                        <svg
                          className="h-5 w-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="feature-card">
                <h3 className="feature-card-title">
                  {features?.guestCommunication?.title}
                </h3>
                <ul className="feature-card-list">
                  {(features?.guestCommunication?.bullets || []).map(
                    (item, idx) => (
                      <li key={idx} className="feature-card-list-item">
                        <span className="feature-card-list-marker">
                          <svg
                            className="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>

              <div className="feature-card">
                <h3 className="feature-card-title">
                  {features?.teamManagement?.title}
                </h3>
                <ul className="feature-card-list">
                  {(features?.teamManagement?.bullets || []).map(
                    (item, idx) => (
                      <li key={idx} className="feature-card-list-item">
                        <span className="feature-card-list-marker">
                          <svg
                            className="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>

              <div className="feature-card">
                <h3 className="feature-card-title">
                  {features?.websiteBuilder?.title}
                </h3>
                <ul className="feature-card-list">
                  {(features?.websiteBuilder?.bullets || []).map(
                    (item, idx) => (
                      <li key={idx} className="feature-card-list-item">
                        <span className="feature-card-list-marker">
                          <svg
                            className="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </span>
                        <span>{item}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2>{builtFor?.title}</h2>
            <p className="text-lg! max-w-2xl text-center">{builtFor?.body}</p>
          </div>
        </section>

        <section>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center text-slate-900">
              {stories?.title}
            </h2>
            <Quote
              quote={stories?.quote?.text}
              author={stories?.quote?.author}
            />
          </div>
        </section>

        <section>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900">
              {integrations?.title}
            </h2>
            <p className="text-lg text-slate-700 max-w-2xl mx-auto">
              {integrations?.body}
            </p>
          </div>
        </section>

        <section className="bg-gray-50 breakout-section">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 text-center">
              {t("home.sections.faq.title")}
            </h2>
            <FAQ content={faqContent} />
          </div>
        </section>
        <UnifiedCTA heading={t("cta.heading")} secondary={t("cta.secondary")} />
      </main>
    </>
  );
}
