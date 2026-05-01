import FAQ from "@/components/faq";
import HeroSection from "@/components/heroSection";
import { ImageTextSection } from "@/components/imageTextSection";
import Quote from "@/components/quote";
import SEOHead from "@/components/seoHead";
import { TextImageSection } from "@/components/textImageSection";
import UnifiedCTA from "@/components/unifiedCTA";
import FeatureCard, { FeatureCardWrapper } from "@/components/unorderedList";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

const pageDetails = {
  pageTitle:
    "Vacation Rental Analytics & AI Dynamic Pricing, Boost Revenue 20 %",
  pageDescription: `Unlock 20 % higher earnings with ${BRAND_NAME}’s vacation-rental analytics and AI-driven dynamic pricing. Track occupancy, revenue, and booking trends in one dashboard, free 14-day trial, no card required.`,
};

const faqContent = [
  {
    q: "How can statistics improve my vacation-rental business?",
    a: {
      paragraphs: [
        "Key performance indicators (KPIs) reveal booking trends over time. By tracking occupancy, ADR, and RevPAR, you’ll make data-backed decisions on pricing, marketing, and property upgrades.",
      ],
    },
  },
  {
    q: "Which KPIs should hosts monitor?",
    a: {
      paragraphs: [
        `Start with occupancy rate, average daily rate, total revenue, length of stay, and cancellation rate. ${BRAND_NAME} tracks them all automatically.`,
      ],
    },
  },
  {
    q: "How do I calculate occupancy rate?",
    a: {
      paragraphs: [
        "Divide booked nights by available nights, then multiply by 100. Example: 287 booked nights ÷ 365 available nights × 100 = 78.6 % occupancy.",
      ],
    },
  },
  {
    q: "Can I compare Airbnb vs. Booking.com performance?",
    a: {
      paragraphs: [
        `Yes. ${BRAND_NAME}’s channel widgets break down bookings, nights, and revenue per platform. View data as bar, pie, or column charts.`,
      ],
    },
  },
];

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData(
    "statistics-kpis-vacation-rentals",
    locale || "en",
  );

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function StatisticsKpisVacationRentals({ cmsPage }) {
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
            pageDetails.pageTitle
          }
          pageDescription={
            cmsPage.seoDescription ||
            rootProps.seoDescription ||
            pageDetails.pageDescription
          }
          pageKeywords={
            cmsPage.seoKeywords ||
            rootProps.seoKeywords ||
            pageDetails.pageKeywords
          }
        />
        <main id="statistics-kpis-vacation-rentals">
          <PuckRenderer data={cmsPage.puckData} />
        </main>
      </>
    );
  }

  // ── Fallback: original hardcoded page ──────────────────────────────────
  return (
    <>
      <SEOHead {...pageDetails} />

      <main className="relative -mt-10">
        <HeroSection
          h1={"Turn Your Rental Data into Revenue"}
          p={`${BRAND_NAME} puts every booking statistic at your fingertips and turns raw numbers into profit-driving insights. Hosts who switch see an average revenue lift of 20 percent.`}
        />

        <section>
          <div className="title">
            <h2>Why {BRAND_NAME}?</h2>
          </div>

          <div className="table-wrapper mx-auto max-w-3xl">
            <div>
              <table>
                <thead>
                  <tr>
                    <th className="text-center!">Built for hosts</th>
                    <th className="text-center!">Proven revenue boost</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      Designed for vacation apartments, boutique hotels, guest
                      houses, and glamping sites.
                    </td>
                    <td>
                      Adaptive algorithms adjust nightly rates in real time for
                      Max RevPAR.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <ImageTextSection
          title={"Unified Dashboard"}
          description={
            "Get a bird’s-eye view of bookings from Airbnb, Booking.com, Vrbo, and direct channels in one clean interface."
          }
          src={"/images/crm/overview.png"}
          fullWidth={false}
        >
          <ul className="pl-4 list-disc mt-2">
            <li>Instant occupancy snapshots</li>
            <li>Real-time revenue tracking</li>
            <li>Channel-by-channel performance</li>
          </ul>
        </ImageTextSection>

        <TextImageSection
          title="Deep-Dive Analytics"
          description={"Drill into the metrics that matter:"}
          src={"/images/deep-dive-analytics.jpg"}
          alt={"Deep-Dive Analytics Chart"}
        >
          <ul className="pl-4 list-disc my-2">
            <li>Occupancy rate, ADR, RevPAR</li>
            <li>Lead time and booking window analysis</li>
            <li>Cancellation trends</li>
            <li>Seasonality patterns</li>
          </ul>
          <p className="raw">
            Smart filters let you pivot by date range, property, or channel in
            seconds.
          </p>
        </TextImageSection>

        <ImageTextSection
          title="AI Dynamic Pricing"
          description={
            "Activate ${BRAND_NAME} Dynamic Pricing to sync optimized rates back to every connected channel automatically."
          }
          src="/images/dynamic-pricing-2.png"
        >
          <ul className="pl-4 list-disc mt-2">
            <li>Machine-learning forecasts update up to 4× daily</li>
            <li>Detects local demand spikes and events</li>
            <li>
              Keeps your listings competitively priced while protecting minimum
              rates
            </li>
          </ul>
        </ImageTextSection>

        <section>
          <div className="title">
            <h2>One-Click Reports</h2>
            <p>
              Export PDF, Excel, or CSV files for accountants, owners, and
              investors. Schedule recurring email reports to save even more
              time.
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto">
          <div className="title">
            <h2>Trusted by Professional Hosts</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Quote
              quote={`“${BRAND_NAME} is the only channel manager that nailed dynamic pricing without extra fees.”`}
              author={",  Hasan, 12 units"}
            />

            <Quote
              quote={
                "“Four years in and it still feels effortless. My six properties run themselves.” "
              }
              author={"Rebecca, Superhost"}
            />

            <Quote
              quote={
                "“Automated the manual tasks that burned hours each week, and it’s affordable.”"
              }
              author={",  Stefano, Property Manager"}
            />
          </div>
        </section>

        <section className="max-w-5xl mx-auto">
          <div className="title">
            <h2>Fits Every Property Type</h2>
          </div>

          <FeatureCardWrapper className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FeatureCard paragraphs={["Vacation apartments & holiday homes"]} />
            <FeatureCard paragraphs={["Boutique hotels & B&Bs"]} />
            <FeatureCard paragraphs={["Guest houses"]} />
            <FeatureCard paragraphs={["Camping, glamping, farm stays"]} />
            <FeatureCard paragraphs={["Large multi-unit portfolios"]} />
          </FeatureCardWrapper>

          <p className="text-center text-balance font-semibold! mx-auto mt-6">
            Centralize reservations, automate guest communications, and showcase
            the unique charm of your stay.
          </p>
        </section>

        <section className="max-w-3xl mx-auto">
          <FAQ content={faqContent} />
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
