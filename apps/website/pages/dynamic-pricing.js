import FAQ from "@/components/faq";
import HeroSection from "@/components/heroSection";
import OrderList from "@/components/orderList";
import SEOHead from "@/components/seoHead";
import UnifiedCTA from "@/components/unifiedCTA";
import FeatureCard, { FeatureCardWrapper } from "@/components/unorderedList";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

const pageDetails = {
  pageTitle: `${BRAND_NAME} Dynamic Pricing | Boost Your Vacation Rental Revenue by 20%`,
  pageDescription: `Unlock higher occupancy and profits with ${BRAND_NAME}’s AI‑powered dynamic pricing. Our engine analyses 20 billion market signals to set the perfect nightly rate, lifting revenue by up to 20 %. Free 30‑day trial, no credit card.`,
};

const faqContent = [
  {
    q: "What is dynamic pricing and why does it matter?",
    a: {
      paragraphs: [
        "Dynamic pricing automatically adjusts your nightly rate based on real‑time supply and demand. During quiet periods it nudges prices lower to attract guests; in peak season it lifts rates to capture extra profit, maximising revenue and occupancy.",
      ],
    },
  },
  {
    q: "How much extra money can I make?",
    a: {
      paragraphs: [
        "Most hosts see an average uplift of around 20 %, but properties in high‑traffic areas or with wide seasonal swings often earn even more.",
      ],
    },
  },
  {
    q: "Is there any risk?",
    a: {
      paragraphs: [
        `You remain in charge. ${BRAND_NAME} gives you suggested rates backed by billions of data points, yet you can override any price or pause automation at any time.`,
      ],
    },
  },
  {
    q: "How do I start?",
    a: {
      paragraphs: [
        `Dynamic Pricing is an optional add‑on for all ${BRAND_NAME} subscribers. Activate it from your dashboard, set your guardrails, and enjoy a risk‑free 30‑day trial.`,
      ],
    },
  },
  {
    q: "Who can use the free trial?",
    a: {
      paragraphs: [
        `Every paying ${BRAND_NAME} customer, whether you manage one cottage or fifty apartments, is eligible for one complimentary 30‑day test drive.`,
      ],
    },
  },
];

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData("dynamic-pricing", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function DynamicPricing({ cmsPage }) {
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
        <main id="dynamic-pricing">
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
          h1={`${BRAND_NAME} Dynamic Pricing`}
          p={"Smarter rates. More bookings. Less hassle."}
        >
          <p className="text-center max-w-2xl mx-auto">
            Running a holiday rental is hard work, you juggle guest messages,
            cleaning schedules, and marketing. Pricing should be the easy part.
            {BRAND_NAME} Dynamic Pricing uses artificial intelligence and
            20 billion live data points, local events, competitor rates,
            seasonality, lead time, and booking trends, to find the sweet spot
            for every night. The result? Hosts see up to 20 % more revenue and a
            steadier stream of guests all year round.
          </p>
        </HeroSection>

        <section>
          <div className="title">
            <h2>The right price at the right time</h2>
          </div>

          <FeatureCardWrapper className="grid grid-cols-1 gap-6">
            <FeatureCard
              title="Real‑time market monitoring"
              paragraphs={[
                "Our engine tracks thousands of signals an hour so your rates always reflect current demand.",
              ]}
            />

            <FeatureCard
              title="Occupancy & ADR optimisation"
              paragraphs={[
                "We balance nightly price and occupancy to maximise your total revenue, not just fill your calendar.",
              ]}
            />

            <FeatureCard
              title="20 billion data points under the hood"
              paragraphs={[
                "From weather forecasts to airline seat sales, our dataset leaves no revenue opportunity behind.",
              ]}
            />
          </FeatureCardWrapper>
        </section>

        <section>
          <div className="title">
            <h2>Stay in control</h2>
          </div>

          <FeatureCardWrapper className="grid grid-cols-1 gap-6">
            <FeatureCard
              title="Rate guardrails"
              paragraphs={[
                "Set minimum and maximum prices and we’ll never go outside your comfort zone.",
              ]}
            />

            <FeatureCard
              title="One‑click overrides"
              paragraphs={[
                "Want to price a festival weekend higher or offer a last‑minute deal? Edit any date manually in seconds.",
              ]}
            />
          </FeatureCardWrapper>
        </section>

        <section className="max-w-2xl mx-auto">
          <div className="title">
            <h2>Fast setup, big impact</h2>
          </div>

          <div className="w-fit mx-auto">
            <OrderList
              list={[
                {
                  title: `Connect your rental calendar to ${BRAND_NAME}.`,
                },
                {
                  title: "Choose your price range.",
                },
                {
                  title: "Watch bookings roll in at smarter rates.",
                },
              ]}
            />
          </div>
        </section>

        <section className="max-w-4xl mx-auto">
          <FAQ content={faqContent} />
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
