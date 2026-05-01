import HeroSection from "@/components/heroSection";
import OrderList from "@/components/orderList";
import SEOHead from "@/components/seoHead";
import AnnualReportForm from "@/components/annual-report-form";
import FeatureCard, { FeatureCardWrapper } from "@/components/unorderedList";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

const pageDetails = {
  pageTitle: `${BRAND_NAME} Vacation Rental Report 2025 | Proven Tips to Increase Bookings`,
  pageDescription: `Download ${BRAND_NAME}'s 2025 Vacation Rental Report for fresh market analysis, dynamic-pricing tactics, and step-by-step strategies from high-performing hosts to grow your short-term rental revenue.`,
};

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData("annual-report", locale || "en");

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function AnnualReport({ cmsPage }) {
  // ── CMS page is ready: render via Puck (AnnualReportSection override active) ──
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
          pageKeywords={cmsPage.seoKeywords || rootProps.seoKeywords || ""}
        />
        <main id="annual-report">
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
          h1={`${BRAND_NAME} Annual Report 2025`}
          p="Actionable insights, data-driven trends, and field-tested playbooks to help every host earn more next year."
        />

        <section>
          <div className="title">
            <h2>Why download this report?</h2>
            <p>
              If you want to climb the rankings on Airbnb, Booking.com, and
              Vrbo, fill more nights, and maximise nightly rates, the
              {BRAND_NAME} Annual Report is your blueprint. We analysed
              thousands of listings and interviewed our top hosts to surface the
              proven tactics that lifted revenue by an average of{" "}
              <span className="raw font-semibold!">20 percent</span> in 2024.
              Inside, you’ll learn exactly how to:
            </p>
          </div>

          <FeatureCardWrapper className="grid grid-cols-1 gap-6">
            <FeatureCard
              paragraphs={[
                "Optimise your listing copy and photography for higher click-through rates.",
              ]}
            />
            <FeatureCard
              paragraphs={[
                `Deploy ${BRAND_NAME} Dynamic Pricing to capture demand spikes without leaving money on the table.`,
              ]}
            />
            <FeatureCard
              paragraphs={[
                "Personalise guest communication to drive five-star reviews and repeat bookings.",
              ]}
            />
            <FeatureCard
              paragraphs={[
                "Spot the biggest travel trends for 2025, think bleisure travel, work-from-anywhere stays, and eco-conscious amenities.",
              ]}
            />
          </FeatureCardWrapper>
        </section>

        <section>
          <div className="title">
            <h2>What’s inside</h2>
          </div>

          <FeatureCardWrapper className="grid grid-cols-1 gap-6">
            <FeatureCard
              paragraphs={[
                "Market Analysis: macro shifts in global short-term rentals.",
              ]}
            />
            <FeatureCard
              paragraphs={[
                "2024 Key Takeaways: wins and pitfalls you can immediately act on.",
              ]}
            />
            <FeatureCard
              paragraphs={[
                "Top-Host Case Studies: channels they prioritise, tech stacks they trust, and guest-experience workflows.",
              ]}
            />
            <FeatureCard
              paragraphs={[
                "2025 Trend Forecast: consumer behaviour, booking windows, and price elasticity.",
              ]}
            />
            <FeatureCard
              paragraphs={[
                "Best-Practice Toolbox: checklists, email templates, and pricing rules ready to plug into your operation.",
              ]}
            />
          </FeatureCardWrapper>
        </section>

        <section>
          <div className="title">
            <h2>Six ways this report accelerates growth</h2>
          </div>

          <div className="max-w-fit mx-auto">
            <OrderList
              list={[
                {
                  title: "Learn from 2024’s successes and missteps.",
                },
                {
                  title: `Benchmark against ${BRAND_NAME}’s highest-earning hosts.`,
                },
                {
                  title:
                    "Adopt optimisation tactics that boost search visibility.",
                },
                {
                  title: "Apply 2025’s hottest trends before competitors do.",
                },
                {
                  title:
                    "Leverage hard numbers, no fluff, just clear ROI projections.",
                },
                {
                  title:
                    "Build an action plan tailored to your property portfolio.",
                },
              ]}
            />
          </div>
        </section>

        <section className="max-w-2xl mx-auto">
          <div className="title">
            <h2>Claim your copy</h2>
            <p>Fill out the short form below to receive the PDF instantly.</p>
          </div>

          <AnnualReportForm />
        </section>

        <section>
          <div className="title">
            <h2>About {BRAND_NAME}</h2>
            <p>
              {BRAND_NAME} is the all-in-one vacation-rental software that
              combines a channel manager, dynamic-pricing engine,
              guest-messaging hub, and analytics dashboard. Thousands of hosts
              worldwide rely on {BRAND_NAME} to simplify operations and grow
              profitably.
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
