import SEOHead from "@/components/seoHead";
import Image from "next/image";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

const pageSeo = {
  pageTitle: `About ${BRAND_NAME} ,  Vacation Rental Software & Dynamic Pricing`,
  pageDescription: `Learn about ${BRAND_NAME}, the all-in-one vacation-rental management software that helps hosts and property managers earn more, work less, and delight guests.`,
  pageKeywords: `about, ${BRAND_NAME}, vacation rental, software, dynamic pricing`,
};

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData("about", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function about({ cmsPage }) {
  // ── CMS page is ready: render it via Puck ──────────────────────────────
  if (cmsPage?.puckData) {
    const rootProps = cmsPage.puckData?.root?.props || {};
    return (
      <>
        <SEOHead
          pageTitle={
            cmsPage.seoTitle ||
            rootProps.seoTitle ||
            cmsPage.title ||
            pageSeo.pageTitle
          }
          pageDescription={
            cmsPage.seoDescription ||
            rootProps.seoDescription ||
            pageSeo.pageDescription
          }
          pageKeywords={
            cmsPage.seoKeywords || rootProps.seoKeywords || pageSeo.pageKeywords
          }
        />
        <main id="about">
          <PuckRenderer data={cmsPage.puckData} />
        </main>
      </>
    );
  }

  // ── Fallback: original hardcoded page ──────────────────────────────────
  return (
    <>
      <SEOHead {...pageSeo} />
      <main id="about">
        <div className="hero bg-blue-700 relative flex items-center justify-center breakout-section ">
          <Image
            loading="lazy"
            width={2347}
            height={1244}
            className="absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 selection:bg-transparent"
            style={{ color: "transparent" }}
            src="/background-call-to-action.6a5a5672.jpg"
          />
          <h1 className="text-white! font-bold! tracking-tight relative z-[2] my-16 lg:my-10">
            About Us
          </h1>
        </div>

        <section>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="font-extrabold text-gray-900">{BRAND_NAME}</h2>
              <p className="mt-4 text-xl text-gray-600 leading-relaxed">
                {BRAND_NAME} is the all-in-one vacation-rental management
                software that helps hosts and property managers earn more, work
                less, and delight guests. On average, {BRAND_NAME} users
                increase revenue by 20 percent thanks to our intelligent
                dynamic-pricing engine and seamless channel manager.
              </p>
            </div>
          </div>
        </section>
        <section>
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h2 className="font-extrabold! leading-tight text-center!">
                Our Journey
              </h2>
            </div>
            <div className="max-w-4xl mx-auto text-center!">
              <p className="mt-4 text-lg text-center! text-gray-700 leading-relaxed mb-6">
                Back in 2014, a small group of hosts asked a simple question:
                Why is running a holiday rental so complicated? Booking
                calendars overlapped, prices never kept up with demand, and
                valuable hours vanished in spreadsheets. We decided to fix that.
              </p>
              <p className="mt-4 text-lg text-gray-700 leading-relaxed">
                Since then, {BRAND_NAME} has grown from a kitchen-table idea
                into a global platform trusted by thousands of property owners
                and managers. From single-apartment Airbnb hosts to
                multi-property vacation-rental agencies, we empower every
                customer with enterprise-level technology, without the
                enterprise price tag.
              </p>
            </div>
          </div>
        </section>
        <section className="bg-gray-50 breakout-section">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 lg:mb-16">
              <h2 className="font-extrabold! leading-tight">Our Mission</h2>
              <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                We exist to simplify short-term-rental management for hosts
                everywhere. That means:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
              <div className="bg-white rounded-xl shadow-lg p-8 transform transition duration-300 hover:scale-105 hover:shadow-2xl flex flex-col items-start text-left">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Education First
                </h3>
                <p className="text-gray-600 leading-relaxed text-base">
                  Step-by-step resources, webinars, and a knowledge base to turn
                  new hosts into confident entrepreneurs.
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-8 transform transition duration-300 hover:scale-105 hover:shadow-2xl flex flex-col items-start text-left">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Intuitive Tools
                </h3>
                <p className="text-gray-600 leading-relaxed text-base">
                  A unified dashboard, automated guest messaging, channel
                  management, and smart pricing that responds to real-time
                  market demand.
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-8 transform transition duration-300 hover:scale-105 hover:shadow-2xl flex flex-col items-start text-left">
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Human Support
                </h3>
                <p className="text-gray-600 leading-relaxed text-base">
                  Friendly experts available 24/7 because hospitality never
                  clocks out.
                </p>
              </div>
            </div>

            <div className="mt-16 text-center">
              <p className="text-lg text-gray-700 max-w-4xl mx-auto leading-relaxed">
                Every {BRAND_NAME} team member believes great tech should feel
                invisible, letting you focus on memorable guest experiences
                rather than manual admin.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
