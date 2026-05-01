import FAQ from "@/components/faq";
import HeroSection from "@/components/heroSection";
import OrderList from "@/components/orderList";
import Quote from "@/components/quote";
import SEOHead from "@/components/seoHead";
import UnifiedCTA from "@/components/unifiedCTA";
import FeatureCard, { FeatureCardWrapper } from "@/components/unorderedList";
import React from "react";
import { BRAND_NAME } from "@/lib/brand";
import PuckRenderer from "@/lib/puckRenderer";
import { getPageData } from "@/lib/cmsClient";

const pageDetails = {
  pageTitle: "Vacation Rental Property Management System & Channel Manager",
  pageDescription: ` Boost revenue by up to 20 % with ${BRAND_NAME}, the all-in-one PMS and channel manager for short-term vacation rentals. Dynamic pricing, automated guest messaging.`,
};

const faqContent = [
  {
    q: "What is a Property Management System (PMS)?",
    a: {
      paragraphs: [
        "A PMS is software that helps vacation-rental owners and managers handle reservations, availability, payments, and guest communication online, replacing manual spreadsheets and double bookings.",
      ],
    },
  },
  {
    q: `How is ${BRAND_NAME} different from a standalone channel manager?`,
    a: {
      paragraphs: [
        `${BRAND_NAME} combines a full PMS with a two-way channel manager, giving you unified calendars, dynamic pricing, automated messaging, and financial reporting in one login.`,
      ],
    },
  },
  {
    q: `What does ${BRAND_NAME} cost?`,
    a: {
      paragraphs: [
        "Plans start at " +
          process.env.NEXT_PUBLIC_PRICE +
          " per property. Every plan includes reservation syncing, guest messaging, and dynamic pricing. No setup fees, and you can cancel anytime.",
      ],
    },
  },
];

export async function getStaticProps({ locale }) {
  const cmsPage = await getPageData(
    "reservation-system-pms-vacation-rental",
    locale || "en",
  );

  return {
    props: {
      cmsPage: cmsPage || null,
    },
    revalidate: 60,
  };
}

export default function ReservationSystemPmsVacationRental({ cmsPage }) {
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
        <main id="reservation-system-pms-vacation-rental">
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
          h1={`${BRAND_NAME} – Property Management System for Short-Term & Vacation Rentals`}
        >
          <p className="max-w-3xl mx-auto">
            {BRAND_NAME} is the human-friendly property management software that
            turns scattered tasks into a single, streamlined workflow. Hosts and
            property managers using {BRAND_NAME} report up to{" "}
            <span className="raw font-semibold">20 % more revenue</span> thanks
            to dynamic pricing, automated guest communication, and real-time
            channel syncing.
          </p>
        </HeroSection>

        <section>
          <div className="title">
            <h2>Why {BRAND_NAME}?</h2>
          </div>
          <FeatureCardWrapper className="grid grid-cols-1 items-stretch gap-6 mt-8 !max-w-4xl">
            <FeatureCard
              textBg="bg-blue-100"
              textColor="text-blue-700"
              title="One Command Center"
              paragraphs={[
                "Unified Dashboard – Monitor occupancy, revenue, reviews, and performance KPIs from one clear screen.",
                "Custom Filters & Smart Search – Locate any reservation, guest, or payout instantly.",
              ]}
            />
            <FeatureCard
              textBg="bg-green-100"
              textColor="text-green-700"
              title="Workflows That Work for You"
              paragraphs={[
                "Automation Suite – Schedule messages, collect payments, and send door codes while you sleep.",
                "Dynamic Pricing Engine – Adjust nightly rates automatically to maximise ADR and occupancy.",
                "Direct Booking Website – Drive commission-free reservations with our built-in booking engine.",
              ]}
              // Icon: Search
            />
            <FeatureCard
              textBg="bg-yellow-100"
              textColor="text-yellow-700"
              title="Seamless Connectivity"
              paragraphs={[
                "Channel Manager – Two-way calendar sync with Airbnb, Booking.com, Vrbo, Expedia, and 100+ portals.",
                "Partner Marketplace – Integrations for keyless entry, accounting, smart thermostats, and more.",
                `Avoid double-bookings with live sync across ${BRAND_NAME} and major OTAs.`,
              ]}
            />
          </FeatureCardWrapper>
        </section>

        <section className="mx-auto max-w-3xl">
          <div className="title">
            <h2>Built for Every Kind of Stay</h2>
          </div>

          <div className="mx-auto w-fit">
            <OrderList
              list={[
                {
                  title: "Vacation apartments & holiday homes",
                },
                {
                  title: "Boutique hotels & guest houses",
                },
                {
                  title: "Bed-and-breakfasts",
                },
                {
                  title: "Camping, glamping & farm stays",
                },
              ]}
            />
          </div>

          <p className="text-center text-balance font-semibold! mx-auto mt-6">
            Centralise reservations, automate guest touchpoints, and keep the
            unique charm that sets your property apart.
          </p>
        </section>

        <section>
          <div className="title">
            <h2>Trusted by Hosts Worldwide</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Quote
              quote={
                "“Best channel manager out there, no hidden fees, everything just works.”"
              }
              author=" – Hasan"
            />

            <Quote
              quote={`“After four years and six listings, ${BRAND_NAME} remains the easiest system I’ve used.”`}
              author=" – Rebecca"
            />

            <Quote
              quote={
                "“Automated the manual tasks that used to eat my weekends, and it’s still affordable.”"
              }
              author=" – Stefano"
            />
          </div>
        </section>

        <section className="mx-auto max-w-3xl">
          <FAQ content={faqContent} />
        </section>

        <UnifiedCTA />
      </main>
    </>
  );
}
